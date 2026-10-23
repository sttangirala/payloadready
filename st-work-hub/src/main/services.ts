// Application services that sit between IPC and the repository. Electron-free so they can be
// exercised directly by tests.

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { Repo } from './repo';
import { AiService, describeAiError, ChatTurn } from './ai';
import { parseIntakeLocally, DraftSuggestion, IntakeContext } from '../shared/intake';
import { findDuplicates, similarity, textHash } from '../shared/duplicates';
import { answerLocally } from '../shared/assistant';
import { buildQueue } from '../shared/queue';
import { followUpInfo, FollowUpInfo, ownedByMe } from '../shared/followup';
import { dateInZone, formatDate, hourInZone } from '../shared/dates';
import { newId } from '../shared/task';
import { tasksToCsv } from '../shared/csv';
import type { AppNotification, AssistantAnswer, ExportBundle, IntakeBatch, IntakeRequest, IntakeResult, Proposal, Task } from '../shared/types';
import { isOpen, STATUSES } from '../shared/types';

export interface ServiceOptions {
  dataDir: string;
  backupDir: string;
  schemaVersion: () => number;
  now?: () => Date;
}

export class Services {
  constructor(
    readonly repo: Repo,
    readonly ai: AiService | null,
    private opts: ServiceOptions,
  ) {}

  private now() {
    return this.opts.now?.() ?? new Date();
  }

  intakeContext(): IntakeContext {
    const tasks = this.repo.listTasks();
    const contacts = this.repo.listContacts();
    return {
      today: this.repo.today(),
      settings: this.repo.getSettings(),
      categories: this.repo.listCategories(),
      contacts,
      knownCompanies: [...new Set([...tasks.map((t) => t.company), ...contacts.map((c) => c.company)].filter((c) => c && c.length > 2))],
    };
  }

  // ---------- intake ----------

  /** Turn pasted text into pending suggestions. Nothing is added to the task list here. */
  async intake(req: IntakeRequest): Promise<IntakeResult> {
    const text = (req.text ?? '').replace(/\u0000/g, '').trim();
    if (!text) throw new Error('Nothing to capture — the text is empty.');
    if (text.length > 400_000) throw new Error('That text is too long (over 400,000 characters). Split it into smaller pieces.');
    const kind = req.kind === 'quick' || req.kind === 'email' || req.kind === 'meeting' || req.kind === 'list' || req.kind === 'note' ? req.kind : 'note';

    const prior = this.repo.findSourceByHash(textHash(text)) ?? null;
    const source = this.repo.createSource(kind, text, req.title ?? '', req.link ?? '');
    const ctx = this.intakeContext();
    let drafts: DraftSuggestion[] = [];
    let engine: 'ai' | 'local' = 'local';
    let notice = '';

    if (req.useAi && this.ai) {
      const st = this.ai.status();
      if (st.available) {
        try {
          const out = await this.ai.intake(text, kind, ctx, this.repo.listTasks());
          drafts = out.drafts;
          engine = 'ai';
          notice = out.notes;
        } catch (e) {
          notice = `AI intake failed (${describeAiError(e)}). The offline parser was used instead.`;
        }
      } else {
        notice = `${st.reason} The offline parser was used instead.`;
      }
    }
    if (engine === 'local') drafts = parseIntakeLocally(text, kind, ctx);
    if (!drafts.length) {
      notice = `${notice ? `${notice} ` : ''}No tasks were detected. You can still create one manually from this source.`.trim();
    }

    const tasks = this.repo.listTasks();
    const batch: IntakeBatch = { id: newId('b'), sourceId: source.id, engine, status: drafts.length ? 'pending' : 'reviewed', notice, createdAt: this.now().toISOString() };
    this.repo.createBatch(batch);
    const proposals: Proposal[] = [];
    const seen: string[] = [];
    for (const d of drafts) {
      const fields = { ...d.fields, sourceId: source.id, sourceLink: source.link };
      const dups = findDuplicates({ title: fields.title ?? '', contact: fields.contact, company: fields.company }, tasks);
      if (d.aiDuplicateId && !dups.some((x) => x.taskId === d.aiDuplicateId)) {
        const t = tasks.find((x) => x.id === d.aiDuplicateId);
        if (t) dups.push({ taskId: t.id, title: t.title, score: 0.6, reason: 'AI flagged as a possible duplicate' });
      }
      const flags = [...d.flags];
      if (prior) flags.unshift(`This exact text was already imported on ${formatDate(prior.createdAt.slice(0, 10))}.`);
      const inBatch = seen.find((title) => similarity(title, fields.title ?? '') >= 0.6);
      if (inBatch) flags.push(`Looks similar to another suggestion in this batch (“${inBatch}”).`);
      seen.push(fields.title ?? '');
      const p: Proposal = {
        id: newId('pr'),
        batchId: batch.id,
        origin: 'intake',
        engine,
        kind: 'create',
        taskId: null,
        baseUpdatedAt: null,
        fields: { ...fields, reviewFlags: flags },
        provenance: d.provenance,
        duplicates: dups,
        flags,
        rationale: d.rationale,
        draftText: '',
        status: 'pending',
        createdAt: this.now().toISOString(),
      };
      this.repo.saveProposal(p);
      proposals.push(p);
    }
    return { batch, proposals, sourceDuplicateOf: prior };
  }

  /** Quick capture: a single task straight into the Inbox (manual entry saves directly). */
  quickCapture(title: string, notes = ''): Task {
    const text = title.trim();
    if (!text) throw new Error('Type something to capture.');
    const src = notes.trim() ? this.repo.createSource('quick', `${text}\n\n${notes}`, text, '') : null;
    return this.repo.createTask({ title: text.slice(0, 200), description: notes.slice(0, 5000), status: 'inbox', sourceId: src?.id ?? null }, { activitySummary: 'Captured via quick capture' });
  }

  // ---------- assistant ----------

  async ask(question: string, history: ChatTurn[], useAi: boolean): Promise<AssistantAnswer> {
    const q = (question ?? '').trim().slice(0, 50_000);
    if (!q) throw new Error('Ask a question.');
    const ctx = this.assistantContext();
    const local = answerLocally(q, ctx);

    if (local.suggestIntake) {
      const res = await this.intake({ kind: q.length > 280 ? 'meeting' : 'note', text: q, useAi, title: 'Pasted into assistant' });
      return {
        text: `${local.text}\n\nI found ${res.proposals.length} suggested task${res.proposals.length === 1 ? '' : 's'}. Review them in the Inbox.`,
        taskIds: [],
        engine: res.batch.engine,
        proposalIds: res.proposals.map((p) => p.id),
        notice: res.batch.notice || undefined,
      };
    }

    const localProposalIds: string[] = [];
    if (local.draft) {
      const t = this.repo.getTask(local.draft.taskId);
      if (t) localProposalIds.push(this.saveAssistantProposal({ kind: 'draft', taskId: t.id, fields: {}, draftText: local.draft.text, rationale: 'Follow-up draft. Copy it into your email client; nothing is sent from here.', flags: [] }, 'local', t).id);
    }

    if (useAi && this.ai) {
      const st = this.ai.status();
      if (st.available) {
        try {
          const followUps = new Map<string, FollowUpInfo>();
          for (const t of ctx.tasks) if (t.status === 'waiting') followUps.set(t.id, followUpInfo(t, ctx.settings, ctx.categories, ctx.contacts, ctx.today));
          const res = await this.ai.assist(q, history, {
            today: ctx.today,
            settings: ctx.settings,
            tasks: ctx.tasks,
            contacts: ctx.contacts,
            categories: ctx.categories,
            queue: buildQueue(ctx),
            followUps,
            localAnswer: local.text,
          });
          const ids = res.proposals.map((p) => this.saveAssistantProposal(p, 'ai', p.taskId ? this.repo.getTask(p.taskId) : undefined).id);
          return {
            text: res.answer,
            taskIds: res.citedTaskIds.length ? res.citedTaskIds : local.taskIds,
            engine: 'ai',
            proposalIds: ids,
            notice: res.dropped.length ? res.dropped.join(' ') : undefined,
          };
        } catch (e) {
          return { text: local.text, taskIds: local.taskIds, engine: 'local', proposalIds: localProposalIds, notice: `AI unavailable (${describeAiError(e)}). Showing the built-in answer.` };
        }
      }
      return { text: local.text, taskIds: local.taskIds, engine: 'local', proposalIds: localProposalIds, notice: `${st.reason} Showing the built-in answer.` };
    }
    return { text: local.text, taskIds: local.taskIds, engine: 'local', proposalIds: localProposalIds };
  }

  private saveAssistantProposal(
    p: { kind: Proposal['kind']; taskId: string | null; fields: Proposal['fields']; draftText: string; rationale: string; flags: string[] },
    engine: 'ai' | 'local',
    target?: Task,
  ): Proposal {
    const prop: Proposal = {
      id: newId('pr'),
      batchId: null,
      origin: 'assistant',
      engine,
      kind: p.kind,
      taskId: target?.id ?? null,
      baseUpdatedAt: target?.updatedAt ?? null,
      fields: p.fields,
      provenance: Object.fromEntries(Object.keys(p.fields).map((k) => [k, { basis: 'inferred' as const }])),
      duplicates: p.kind === 'create' ? findDuplicates({ title: p.fields.title ?? '' }, this.repo.listTasks()) : [],
      flags: p.flags,
      rationale: p.rationale,
      draftText: p.draftText,
      status: 'pending',
      createdAt: this.now().toISOString(),
    };
    this.repo.saveProposal(prop);
    return prop;
  }

  assistantContext() {
    return {
      today: this.repo.today(),
      settings: this.repo.getSettings(),
      categories: this.repo.listCategories(),
      contacts: this.repo.listContacts(),
      tasks: this.repo.listTasks(),
      activity: this.repo.listActivity({ limit: 1000 }),
      sources: this.repo.listSources(),
      nowIso: this.now().toISOString(),
    };
  }

  // ---------- reminders ----------

  /**
   * Compute reminders that are due now and record them. Each reminder has a fingerprint of
   * (kind, task, relevant date), so an unchanged item never produces a second reminder; changing the
   * date (e.g. after logging a follow-up) produces a new one later.
   * Returns notifications that should be shown on the desktop now.
   */
  checkReminders(): { id: string; title: string; body: string; taskId: string | null }[] {
    const settings = this.repo.getSettings();
    const tz = settings.timezone;
    const now = this.now();
    const today = dateInZone(now, tz);
    const ctx = { today, settings, categories: this.repo.listCategories(), contacts: this.repo.listContacts(), tasks: this.repo.listTasks() };
    const pastReminderHour = hourInZone(now, tz) >= settings.reminderHour;
    if (pastReminderHour && settings.inAppNotifications) {
      for (const t of ctx.tasks) {
        if (!isOpen(t.status) || !t.remindersEnabled) continue;
        const add = (kind: AppNotification['kind'], date: string, title: string, body: string) => {
          const fp = `${kind}:${t.id}:${date}`;
          if (this.repo.hasFingerprint(fp)) return;
          this.repo.insertNotification({ id: newId('nt'), taskId: t.id, kind, fingerprint: fp, title, body, createdAt: now.toISOString(), readAt: null, snoozedUntil: null, dismissed: false });
        };
        const mine = ownedByMe(t, settings) || !!t.coordinationStep.trim();
        if (t.status === 'waiting') {
          const fu = followUpInfo(t, settings, ctx.categories, ctx.contacts, today);
          if ((fu.state === 'due' || fu.state === 'overdue') && fu.date && mine) add('followup_due', fu.date, `Follow up: ${t.title}`, fu.basis);
          continue;
        }
        if (!mine || t.status === 'inbox') continue;
        if (t.dueDate && t.dueDate < today) add('overdue', t.dueDate, `Overdue: ${t.title}`, `Deadline was ${formatDate(t.dueDate)}.`);
        else if (t.dueDate === today) add('due_today', t.dueDate, `Due today: ${t.title}`, t.nextAction || 'Deadline is today.');
        if (t.nextActionDate && t.nextActionDate <= today) add('next_action_due', t.nextActionDate, `Ready to revisit: ${t.title}`, `Next-action date ${formatDate(t.nextActionDate)} has arrived.`);
      }
    }
    if (!settings.desktopNotifications || !pastReminderHour) return [];
    return this.repo.dueForDesktop();
  }

  // ---------- daily review ----------

  dailyReview() {
    const ctx = this.assistantContext();
    const today = ctx.today;
    const startOfDay = new Date(this.now().getTime() - 24 * 3600_000).toISOString();
    const completed = ctx.tasks.filter((t) => t.completedAt && dateInZone(new Date(t.completedAt), ctx.settings.timezone) === today);
    const queue = buildQueue(ctx);
    const unfinished = queue.map((e) => e.task);
    const blockedIds = new Set(
      ctx.activity
        .filter((a) => a.createdAt >= startOfDay && a.taskId && (/Waiting on Someone$/.test(a.summary.split(';').find((s) => s.includes('Status:')) ?? '') || /Dependencies:/.test(a.summary)))
        .map((a) => a.taskId!),
    );
    const newlyBlocked = ctx.tasks.filter((t) => blockedIds.has(t.id) && isOpen(t.status));
    const tomorrow = buildQueue({ ...ctx, today: addOne(today) }).slice(0, ctx.settings.todayLimit);
    return {
      today,
      completed: completed.map((t) => t.id),
      unfinished: unfinished.map((t) => t.id),
      newlyBlocked: newlyBlocked.map((t) => t.id),
      tomorrow: tomorrow.map((e) => ({ taskId: e.task.id, reasons: e.reasons })),
    };
  }

  // ---------- export / restore / backup ----------

  exportJson(): string {
    return JSON.stringify(this.repo.exportBundle(this.opts.schemaVersion()), null, 2);
  }

  exportCsv(): string {
    return tasksToCsv(this.repo.listTasks(), this.repo.listCategories());
  }

  /** Validate a JSON export, back up the current database, then replace all data. */
  restoreJson(json: string): { tasks: number; backupPath: string } {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    const parsed = BundleSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`That file is not an ST Work Hub export (${parsed.error.issues[0]?.path.join('.') || 'format'} invalid).`);
    const bundle = parsed.data as unknown as ExportBundle;
    const backupPath = this.backup('pre-restore');
    this.repo.restoreBundle(bundle);
    return { tasks: bundle.data.tasks.length, backupPath };
  }

  /** Write a timestamped copy of the database to the backup folder and prune old ones. */
  backup(label = 'auto'): string {
    fs.mkdirSync(this.opts.backupDir, { recursive: true });
    const stamp = this.now().toISOString().replace(/[:.]/g, '-');
    const file = path.join(this.opts.backupDir, `st-work-hub-${label}-${stamp}.sqlite`);
    fs.writeFileSync(file, this.repo.store.exportBytes(), { mode: 0o600 });
    const all = fs.readdirSync(this.opts.backupDir).filter((f) => f.startsWith(`st-work-hub-${label}-`)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(this.opts.backupDir, old), { force: true });
    return file;
  }

  /** One automatic backup per calendar day. */
  dailyBackupIfNeeded() {
    fs.mkdirSync(this.opts.backupDir, { recursive: true });
    const day = this.now().toISOString().slice(0, 10);
    if (!fs.readdirSync(this.opts.backupDir).some((f) => f.startsWith(`st-work-hub-auto-${day}`))) this.backup('auto');
  }
}

const addOne = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const BundleSchema = z.object({
  app: z.literal('st-work-hub'),
  formatVersion: z.literal(1),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  data: z.object({
    tasks: z.array(TaskSchema),
    categories: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), position: z.number(), followUpDays: z.number().nullable() })),
    contacts: z.array(z.object({ id: z.string(), name: z.string(), company: z.string(), status: z.enum(['active', 'closed']), notes: z.string(), isDemo: z.boolean() })),
    projects: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
    sources: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string(), rawText: z.string(), link: z.string(), textHash: z.string(), isDemo: z.boolean(), createdAt: z.string() })),
    activity: z.array(z.object({ id: z.string(), taskId: z.string().nullable(), kind: z.string(), summary: z.string(), createdAt: z.string() }).passthrough()),
    settings: z.object({}).passthrough(),
  }),
});
