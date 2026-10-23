// Data access and business operations. Every write goes through a transaction and records an
// activity entry so history and "what changed" answers are always grounded in real events.

import { Store } from './db';
import { DEFAULT_SETTINGS, IMPORTANCE_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../shared/types';
import type {
  Activity, AppNotification, Category, Contact, ExportBundle, IntakeBatch, Project, Proposal, Settings, Source,
  Task, TaskNote, TaskPatch,
} from '../shared/types';
import { blankTask, newId, sanitizePatch } from '../shared/task';
import { buildDemoData, makeDefaultCategories } from '../shared/demo';
import { followUpSentPatch } from '../shared/followup';
import { textHash } from '../shared/duplicates';
import { formatDate, ISODate } from '../shared/dates';

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class Repo {
  constructor(
    readonly store: Store,
    private todayFn: () => ISODate,
  ) {}

  today() {
    return this.todayFn();
  }

  // ---------- initialization ----------

  ensureDefaults(seedDemo: boolean) {
    this.store.transaction(() => {
      if (!this.store.get('SELECT id FROM categories LIMIT 1')) {
        for (const c of makeDefaultCategories()) this.insertCategory(c);
      }
      const s = this.getSettings();
      if (seedDemo && !s.demoSeeded && !this.store.get('SELECT id FROM tasks LIMIT 1')) {
        this.loadDemo();
      }
    });
  }

  loadDemo() {
    this.store.transaction(() => {
      const demo = buildDemoData(this.today(), this.listCategories(), now());
      for (const c of demo.contacts) this.insertContact(c);
      for (const s of demo.sources) this.insertSource(s);
      for (const p of demo.projects) this.saveProject(p);
      for (const t of demo.tasks) {
        this.writeTask(t);
        this.log(t.id, 'created', 'Created (demo data)');
      }
      this.saveSettings({ ...this.getSettings(), demoSeeded: true });
    });
  }

  removeDemo(): number {
    return this.store.transaction(() => {
      const ids = this.store.all<{ id: string }>('SELECT id FROM tasks WHERE is_demo = 1').map((r) => r.id);
      for (const id of ids) {
        this.store.run('DELETE FROM task_notes WHERE task_id = ?', [id]);
        this.store.run('DELETE FROM activity WHERE task_id = ?', [id]);
        this.store.run('DELETE FROM notifications WHERE task_id = ?', [id]);
      }
      this.store.run('DELETE FROM tasks WHERE is_demo = 1');
      this.store.run('DELETE FROM contacts WHERE is_demo = 1');
      this.store.run('DELETE FROM projects WHERE is_demo = 1');
      this.store.run('DELETE FROM sources WHERE is_demo = 1');
      // Drop references from user tasks to removed demo records.
      for (const t of this.listTasks()) {
        const deps = t.dependsOn.filter((d) => !ids.includes(d));
        const projectGone = t.projectId && !this.store.get('SELECT id FROM projects WHERE id = ?', [t.projectId]);
        if (deps.length !== t.dependsOn.length || projectGone) {
          this.writeTask({ ...t, dependsOn: deps, projectId: projectGone ? null : t.projectId });
        }
      }
      return ids.length;
    });
  }

  // ---------- settings ----------

  getSettings(): Settings {
    const row = this.store.get<{ value: string }>("SELECT value FROM settings WHERE key = 'settings'");
    return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.value) : {}) };
  }

  saveSettings(s: Settings) {
    this.store.transaction(() => {
      this.store.run("INSERT INTO settings (key, value) VALUES ('settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(s)]);
    });
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const cur = this.getSettings();
    const next: Settings = { ...cur };
    for (const [k, v] of Object.entries(patch) as [keyof Settings, unknown][]) {
      if (!(k in DEFAULT_SETTINGS)) continue;
      const def = DEFAULT_SETTINGS[k];
      if (Array.isArray(def) ? Array.isArray(v) : typeof v === typeof def) (next as unknown as Record<string, unknown>)[k] = v;
    }
    next.defaultFollowUpDays = clampInt(next.defaultFollowUpDays, 1, 60);
    next.reminderHour = clampInt(next.reminderHour, 0, 23);
    next.todayLimit = clampInt(next.todayLimit, 1, 25);
    this.saveSettings(next);
    return next;
  }

  // ---------- tasks ----------

  private rowToTask(r: Row): Task {
    const t = JSON.parse(r.data as string) as Task;
    t.notes = this.store
      .all<{ id: string; body: string; created_at: string }>('SELECT id, body, created_at FROM task_notes WHERE task_id = ? ORDER BY created_at', [t.id])
      .map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at }));
    return t;
  }

  listTasks(): Task[] {
    return this.store.all('SELECT * FROM tasks ORDER BY created_at').map((r) => this.rowToTask(r));
  }

  getTask(id: string): Task | undefined {
    const r = this.store.get('SELECT * FROM tasks WHERE id = ?', [id]);
    return r ? this.rowToTask(r) : undefined;
  }

  private writeTask(t: Task) {
    const { notes: _notes, ...rest } = t;
    void _notes;
    const data = JSON.stringify({ ...rest, notes: [] });
    this.store.run(
      `INSERT INTO tasks (id, title, status, owner, category_id, project_id, due_date, next_action_date, is_demo, created_at, updated_at, completed_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, owner=excluded.owner, category_id=excluded.category_id,
         project_id=excluded.project_id, due_date=excluded.due_date, next_action_date=excluded.next_action_date, is_demo=excluded.is_demo,
         updated_at=excluded.updated_at, completed_at=excluded.completed_at, data=excluded.data`,
      [t.id, t.title, t.status, t.owner, t.categoryId, t.projectId, t.dueDate, t.nextActionDate, t.isDemo ? 1 : 0, t.createdAt, t.updatedAt, t.completedAt, data],
    );
  }

  createTask(patch: TaskPatch, opts: { activitySummary?: string; activityKind?: string } = {}): Task {
    return this.store.transaction(() => {
      const ts = now();
      const clean = sanitizeLinks(sanitizePatch(patch));
      const t = blankTask(ts, clean);
      if (!t.title.trim()) t.title = 'Untitled task';
      this.applyStatusSideEffects(t, null);
      this.writeTask(t);
      this.log(t.id, opts.activityKind ?? 'created', opts.activitySummary ?? 'Created');
      return this.getTask(t.id)!;
    });
  }

  /** Manual edits save directly. Records a field-level activity entry. */
  updateTask(id: string, patch: TaskPatch, opts: { activityKind?: string; activityPrefix?: string } = {}): Task {
    return this.store.transaction(() => {
      const cur = this.getTask(id);
      if (!cur) throw new Error('Task not found');
      const clean = sanitizeLinks(sanitizePatch(patch));
      const next: Task = { ...cur, ...clean, updatedAt: now() };
      this.applyStatusSideEffects(next, cur);
      const changes = describeChanges(cur, next, this.listCategories());
      if (!changes.length) return cur;
      this.writeTask(next);
      const kind = opts.activityKind ?? (cur.status !== next.status ? 'status' : 'updated');
      this.log(id, kind, `${opts.activityPrefix ?? ''}${changes.join('; ')}`, { from: pick(cur, Object.keys(clean)), to: clean });
      return this.getTask(id)!;
    });
  }

  private applyStatusSideEffects(next: Task, prev: Task | null) {
    if (!prev || prev.status !== next.status) {
      if (next.status === 'done' || next.status === 'closed') {
        next.completedAt = next.completedAt ?? now();
        next.manualRank = null;
      } else {
        next.completedAt = null;
      }
      if (next.status === 'waiting' && !next.waitingSince) next.waitingSince = this.today();
    }
  }

  deleteTask(id: string) {
    this.store.transaction(() => {
      const t = this.getTask(id);
      if (!t) return;
      this.store.run('DELETE FROM tasks WHERE id = ?', [id]);
      this.store.run('DELETE FROM task_notes WHERE task_id = ?', [id]);
      this.store.run('DELETE FROM notifications WHERE task_id = ?', [id]);
      for (const other of this.listTasks()) {
        if (other.dependsOn.includes(id)) this.writeTask({ ...other, dependsOn: other.dependsOn.filter((d) => d !== id) });
      }
      this.log(id, 'deleted', `Deleted “${t.title}”`);
    });
  }

  addNote(taskId: string, body: string): TaskNote {
    return this.store.transaction(() => {
      const t = this.getTask(taskId);
      if (!t) throw new Error('Task not found');
      const note = { id: newId('n'), body: body.slice(0, 20000), createdAt: now() };
      this.store.run('INSERT INTO task_notes (id, task_id, body, created_at) VALUES (?, ?, ?, ?)', [note.id, taskId, note.body, note.createdAt]);
      this.writeTask({ ...t, updatedAt: note.createdAt });
      this.log(taskId, 'note', `Note: ${truncate(body, 80)}`);
      return note;
    });
  }

  logFollowUpSent(taskId: string, note?: string): Task {
    return this.store.transaction(() => {
      const t = this.updateTask(taskId, followUpSentPatch(this.today()), { activityKind: 'followup_sent', activityPrefix: 'Follow-up sent. ' });
      if (note?.trim()) this.addNote(taskId, note);
      this.store.run('UPDATE notifications SET dismissed = 1 WHERE task_id = ? AND kind = ? AND dismissed = 0', [taskId, 'followup_due']);
      return t;
    });
  }

  skipTask(taskId: string, reason: string): Task {
    return this.updateTask(taskId, { skippedOn: this.today(), skipReason: reason.slice(0, 500) }, { activityKind: 'skipped', activityPrefix: `Skipped${reason ? ` (${truncate(reason, 60)})` : ''}. ` });
  }

  /** Manual queue override: write ranks 1..n for the given ordered ids; others lose their rank. */
  setManualOrder(orderedIds: string[]) {
    this.store.transaction(() => {
      const ts = now();
      for (const t of this.listTasks()) {
        const idx = orderedIds.indexOf(t.id);
        const rank = idx >= 0 ? idx + 1 : null;
        if (t.manualRank !== rank) this.writeTask({ ...t, manualRank: rank, updatedAt: ts });
      }
      this.log(null, 'reordered', orderedIds.length ? 'Manually reordered the queue' : 'Reset queue to automatic order');
    });
  }

  // ---------- categories ----------

  listCategories(): Category[] {
    return this.store
      .all<{ id: string; name: string; color: string; position: number; follow_up_days: number | null }>('SELECT * FROM categories ORDER BY position, name')
      .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position, followUpDays: r.follow_up_days }));
  }

  private insertCategory(c: Category) {
    this.store.run('INSERT OR REPLACE INTO categories (id, name, color, position, follow_up_days) VALUES (?, ?, ?, ?, ?)', [c.id, c.name, c.color, c.position, c.followUpDays]);
  }

  saveCategory(c: Partial<Category> & { name: string }): Category {
    return this.store.transaction(() => {
      const existing = c.id ? this.listCategories().find((x) => x.id === c.id) : undefined;
      const cat: Category = {
        id: existing?.id ?? newId('cat'),
        name: c.name.trim().slice(0, 80) || 'Untitled',
        color: /^#[0-9a-f]{6}$/i.test(c.color ?? '') ? c.color! : existing?.color ?? '#5a6b7d',
        position: c.position ?? existing?.position ?? this.listCategories().length,
        followUpDays: c.followUpDays === undefined ? existing?.followUpDays ?? null : c.followUpDays,
      };
      this.insertCategory(cat);
      return cat;
    });
  }

  deleteCategory(id: string) {
    this.store.transaction(() => {
      this.store.run('DELETE FROM categories WHERE id = ?', [id]);
      for (const t of this.listTasks()) if (t.categoryId === id) this.writeTask({ ...t, categoryId: null });
    });
  }

  // ---------- contacts ----------

  listContacts(): Contact[] {
    return this.store
      .all<{ id: string; name: string; company: string; status: string; notes: string; is_demo: number }>('SELECT * FROM contacts ORDER BY name')
      .map((r) => ({ id: r.id, name: r.name, company: r.company, status: r.status === 'closed' ? 'closed' : 'active', notes: r.notes, isDemo: !!r.is_demo }));
  }

  private insertContact(c: Contact) {
    this.store.run('INSERT OR REPLACE INTO contacts (id, name, company, status, notes, is_demo) VALUES (?, ?, ?, ?, ?, ?)', [c.id, c.name, c.company, c.status, c.notes, c.isDemo ? 1 : 0]);
  }

  saveContact(c: Partial<Contact> & { name: string }): Contact {
    return this.store.transaction(() => {
      const existing = c.id ? this.listContacts().find((x) => x.id === c.id) : undefined;
      const contact: Contact = {
        id: existing?.id ?? newId('ct'),
        name: c.name.trim().slice(0, 120),
        company: (c.company ?? existing?.company ?? '').slice(0, 120),
        status: c.status === 'closed' ? 'closed' : c.status === 'active' ? 'active' : existing?.status ?? 'active',
        notes: (c.notes ?? existing?.notes ?? '').slice(0, 5000),
        isDemo: existing?.isDemo ?? false,
      };
      this.insertContact(contact);
      if (existing && existing.status !== contact.status) {
        this.log(null, 'contact', `${contact.name} marked ${contact.status}`);
      }
      return contact;
    });
  }

  deleteContact(id: string) {
    this.store.transaction(() => this.store.run('DELETE FROM contacts WHERE id = ?', [id]));
  }

  // ---------- projects ----------

  listProjects(): Project[] {
    return this.store.all<{ data: string }>('SELECT data FROM projects ORDER BY created_at').map((r) => JSON.parse(r.data));
  }

  saveProject(p: Partial<Project> & { name: string }): Project {
    return this.store.transaction(() => {
      const existing = p.id ? this.listProjects().find((x) => x.id === p.id) : undefined;
      const proj: Project = {
        id: existing?.id ?? p.id ?? newId('p'),
        name: p.name.trim().slice(0, 160) || 'Untitled project',
        description: (p.description ?? existing?.description ?? '').slice(0, 5000),
        status: p.status ?? existing?.status ?? 'active',
        milestones: (p.milestones ?? existing?.milestones ?? []).map((m) => ({ id: m.id || newId('m'), title: String(m.title).slice(0, 200), dueDate: m.dueDate ?? null, done: !!m.done })),
        isDemo: p.isDemo ?? existing?.isDemo ?? false,
        createdAt: existing?.createdAt ?? p.createdAt ?? now(),
      };
      this.store.run(
        'INSERT INTO projects (id, name, status, is_demo, created_at, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status, data=excluded.data',
        [proj.id, proj.name, proj.status, proj.isDemo ? 1 : 0, proj.createdAt, JSON.stringify(proj)],
      );
      return proj;
    });
  }

  deleteProject(id: string) {
    this.store.transaction(() => {
      this.store.run('DELETE FROM projects WHERE id = ?', [id]);
      for (const t of this.listTasks()) if (t.projectId === id) this.writeTask({ ...t, projectId: null });
    });
  }

  // ---------- sources ----------

  listSources(): Source[] {
    return this.store.all<Row>('SELECT * FROM sources ORDER BY created_at DESC').map(rowToSource);
  }

  getSource(id: string): Source | undefined {
    const r = this.store.get<Row>('SELECT * FROM sources WHERE id = ?', [id]);
    return r ? rowToSource(r) : undefined;
  }

  findSourceByHash(hash: string): Source | undefined {
    const r = this.store.get<Row>('SELECT * FROM sources WHERE text_hash = ? ORDER BY created_at LIMIT 1', [hash]);
    return r ? rowToSource(r) : undefined;
  }

  private insertSource(s: Source) {
    this.store.run('INSERT INTO sources (id, kind, title, raw_text, link, text_hash, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      s.id, s.kind, s.title, s.rawText, s.link, s.textHash, s.isDemo ? 1 : 0, s.createdAt,
    ]);
  }

  createSource(kind: Source['kind'], rawText: string, title: string, link: string): Source {
    return this.store.transaction(() => {
      const s: Source = {
        id: newId('src'),
        kind,
        title: (title || firstLine(rawText)).slice(0, 200),
        rawText: rawText.slice(0, 500_000),
        link: safeLink(link),
        textHash: textHash(rawText),
        isDemo: false,
        createdAt: now(),
      };
      this.insertSource(s);
      return s;
    });
  }

  // ---------- intake batches & proposals ----------

  createBatch(b: IntakeBatch) {
    this.store.transaction(() => {
      this.store.run('INSERT INTO intake_batches (id, source_id, engine, status, notice, created_at) VALUES (?, ?, ?, ?, ?, ?)', [b.id, b.sourceId, b.engine, b.status, b.notice, b.createdAt]);
    });
  }

  listBatches(): IntakeBatch[] {
    return this.store
      .all<Row>('SELECT * FROM intake_batches ORDER BY created_at DESC')
      .map((r) => ({ id: r.id as string, sourceId: r.source_id as string, engine: r.engine as 'ai' | 'local', status: r.status as 'pending' | 'reviewed', notice: r.notice as string, createdAt: r.created_at as string }));
  }

  saveProposal(p: Proposal) {
    this.store.transaction(() => {
      this.store.run(
        'INSERT INTO proposals (id, batch_id, status, created_at, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data',
        [p.id, p.batchId, p.status, p.createdAt, JSON.stringify(p)],
      );
    });
  }

  listProposals(): Proposal[] {
    return this.store.all<{ data: string }>('SELECT data FROM proposals ORDER BY created_at').map((r) => JSON.parse(r.data));
  }

  getProposal(id: string): Proposal | undefined {
    const r = this.store.get<{ data: string }>('SELECT data FROM proposals WHERE id = ?', [id]);
    return r ? JSON.parse(r.data) : undefined;
  }

  private markBatchReviewedIfDone(batchId: string | null) {
    if (!batchId) return;
    const left = this.store.get<{ n: number }>("SELECT COUNT(*) AS n FROM proposals WHERE batch_id = ? AND status = 'pending'", [batchId]);
    if (!left?.n) this.store.run("UPDATE intake_batches SET status = 'reviewed' WHERE id = ?", [batchId]);
  }

  /**
   * Apply a proposal after explicit user confirmation. `overrides` are the user's edits in the review
   * screen. For updates, the target must be unchanged since the proposal was made unless the user has
   * confirmed against the current values (`confirmCurrent`).
   */
  applyProposal(id: string, overrides: TaskPatch = {}, opts: { mergeIntoTaskId?: string; confirmCurrent?: boolean } = {}): Task | null {
    return this.store.transaction(() => {
      const p = this.getProposal(id);
      if (!p) throw new Error('Proposal not found');
      if (p.status !== 'pending') throw new ConflictError('This suggestion was already handled.');
      const fields = { ...sanitizePatch(p.fields), ...sanitizePatch(overrides) };
      let result: Task | null = null;
      const engineLabel = p.engine === 'ai' ? 'AI suggestion' : 'intake suggestion';

      if (opts.mergeIntoTaskId) {
        const target = this.getTask(opts.mergeIntoTaskId);
        if (!target) throw new Error('Merge target not found');
        const src = fields.sourceId ? this.getSource(fields.sourceId) : undefined;
        this.addNote(target.id, `Merged duplicate intake item: “${fields.title ?? ''}”${src ? ` (source: ${src.title})` : ''}${fields.description ? `\n\n${fields.description}` : ''}`);
        this.log(target.id, 'ai_applied', `Merged a duplicate ${engineLabel} into this task`);
        result = this.getTask(target.id)!;
      } else if (p.kind === 'create') {
        if (fields.status === 'inbox' || !fields.status) fields.status = 'ready';
        result = this.createTask(fields, { activityKind: 'ai_applied', activitySummary: `Created from ${engineLabel} (confirmed by you)` });
      } else if (p.kind === 'update') {
        const target = p.taskId ? this.getTask(p.taskId) : undefined;
        if (!target) throw new Error('Target task no longer exists');
        if (target.updatedAt !== p.baseUpdatedAt && !opts.confirmCurrent) {
          throw new ConflictError('The task changed after this suggestion was made. Review the current values and confirm again.');
        }
        result = this.updateTask(target.id, fields, { activityKind: 'ai_applied', activityPrefix: `Applied ${engineLabel} (confirmed by you): ` });
      } else if (p.kind === 'draft') {
        if (p.taskId) this.log(p.taskId, 'draft', 'Follow-up draft reviewed (not sent)');
      }
      this.saveProposal({ ...p, status: 'applied' });
      this.markBatchReviewedIfDone(p.batchId);
      return result;
    });
  }

  rejectProposal(id: string) {
    this.store.transaction(() => {
      const p = this.getProposal(id);
      if (!p || p.status !== 'pending') return;
      this.saveProposal({ ...p, status: 'rejected' });
      this.markBatchReviewedIfDone(p.batchId);
    });
  }

  // ---------- activity ----------

  log(taskId: string | null, kind: string, summary: string, detail: Record<string, unknown> = {}) {
    this.store.run('INSERT INTO activity (id, task_id, kind, summary, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      newId('a'), taskId, kind, summary.slice(0, 1000), JSON.stringify(detail), now(),
    ]);
  }

  listActivity(opts: { taskId?: string; since?: string; limit?: number } = {}): Activity[] {
    const where: string[] = [];
    const params: string[] = [];
    if (opts.taskId) {
      where.push('task_id = ?');
      params.push(opts.taskId);
    }
    if (opts.since) {
      where.push('created_at >= ?');
      params.push(opts.since);
    }
    const sql = `SELECT * FROM activity ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ${Math.min(opts.limit ?? 500, 5000)}`;
    return this.store.all<Row>(sql, params).map((r) => ({
      id: r.id as string,
      taskId: (r.task_id as string) ?? null,
      kind: r.kind as string,
      summary: r.summary as string,
      detail: JSON.parse((r.detail as string) || '{}'),
      createdAt: r.created_at as string,
    }));
  }

  // ---------- notifications ----------

  listNotifications(): AppNotification[] {
    return this.store.all<Row>('SELECT * FROM notifications WHERE dismissed = 0 ORDER BY created_at DESC LIMIT 200').map(rowToNotification);
  }

  hasFingerprint(fp: string): boolean {
    return !!this.store.get('SELECT id FROM notifications WHERE fingerprint = ?', [fp]);
  }

  insertNotification(n: AppNotification) {
    this.store.transaction(() => {
      this.store.run(
        'INSERT OR IGNORE INTO notifications (id, task_id, kind, fingerprint, title, body, created_at, read_at, snoozed_until, dismissed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
        [n.id, n.taskId, n.kind, n.fingerprint, n.title, n.body, n.createdAt, n.readAt, n.snoozedUntil],
      );
    });
  }

  markDesktopShown(id: string) {
    this.store.transaction(() => this.store.run('UPDATE notifications SET desktop_shown_at = ? WHERE id = ?', [now(), id]));
  }

  /** Notifications whose snooze has expired and that should surface again (once). */
  dueForDesktop(): { id: string; title: string; body: string; taskId: string | null }[] {
    const ts = now();
    return this.store.all<{ id: string; title: string; body: string; task_id: string | null }>(
      `SELECT id, title, body, task_id FROM notifications WHERE dismissed = 0 AND read_at IS NULL AND desktop_shown_at IS NULL
       AND (snoozed_until IS NULL OR snoozed_until <= ?)`,
      [ts],
    ).map((r) => ({ id: r.id, title: r.title, body: r.body, taskId: r.task_id }));
  }

  snoozeNotification(id: string, untilIso: string) {
    this.store.transaction(() => this.store.run('UPDATE notifications SET snoozed_until = ?, desktop_shown_at = NULL, read_at = NULL WHERE id = ?', [untilIso, id]));
  }

  markNotificationRead(id: string) {
    this.store.transaction(() => this.store.run('UPDATE notifications SET read_at = ? WHERE id = ?', [now(), id]));
  }

  dismissNotification(id: string) {
    this.store.transaction(() => this.store.run('UPDATE notifications SET dismissed = 1 WHERE id = ?', [id]));
  }

  // ---------- export / restore ----------

  exportBundle(schemaVersion: number): ExportBundle {
    return {
      app: 'st-work-hub',
      formatVersion: 1,
      schemaVersion,
      exportedAt: now(),
      data: {
        tasks: this.listTasks(),
        categories: this.listCategories(),
        contacts: this.listContacts(),
        projects: this.listProjects(),
        sources: this.listSources(),
        activity: this.listActivity({ limit: 5000 }),
        settings: this.getSettings(),
      },
    };
  }

  /** Replace all data with the bundle contents. Caller validates and backs up first. */
  restoreBundle(b: ExportBundle) {
    this.store.transaction(() => {
      for (const table of ['tasks', 'task_notes', 'categories', 'contacts', 'projects', 'sources', 'activity', 'intake_batches', 'proposals', 'notifications']) {
        this.store.run(`DELETE FROM ${table}`);
      }
      for (const c of b.data.categories) this.insertCategory(c);
      for (const c of b.data.contacts) this.insertContact(c);
      for (const p of b.data.projects) this.saveProject(p);
      for (const s of b.data.sources) this.insertSource(s);
      for (const t of b.data.tasks) {
        const base = blankTask(t.createdAt, sanitizePatch(t));
        const full: Task = { ...base, id: t.id, isDemo: !!t.isDemo, createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt ?? null };
        this.writeTask(full);
        for (const n of t.notes ?? []) {
          this.store.run('INSERT INTO task_notes (id, task_id, body, created_at) VALUES (?, ?, ?, ?)', [n.id, t.id, n.body, n.createdAt]);
        }
      }
      for (const a of b.data.activity) {
        this.store.run('INSERT OR IGNORE INTO activity (id, task_id, kind, summary, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
          a.id, a.taskId, a.kind, a.summary, JSON.stringify(a.detail ?? {}), a.createdAt,
        ]);
      }
      this.saveSettings({ ...DEFAULT_SETTINGS, ...b.data.settings });
      this.log(null, 'restored', `Restored from backup exported ${b.exportedAt}`);
    });
  }
}

// ---------- helpers ----------

function rowToSource(r: Row): Source {
  return {
    id: r.id as string,
    kind: r.kind as Source['kind'],
    title: r.title as string,
    rawText: r.raw_text as string,
    link: r.link as string,
    textHash: r.text_hash as string,
    isDemo: !!r.is_demo,
    createdAt: r.created_at as string,
  };
}

function rowToNotification(r: Row): AppNotification {
  return {
    id: r.id as string,
    taskId: (r.task_id as string) ?? null,
    kind: r.kind as AppNotification['kind'],
    fingerprint: r.fingerprint as string,
    title: r.title as string,
    body: r.body as string,
    createdAt: r.created_at as string,
    readAt: (r.read_at as string) ?? null,
    snoozedUntil: (r.snoozed_until as string) ?? null,
    dismissed: !!r.dismissed,
  };
}

function describeChanges(a: Task, b: Task, cats: Category[]): string[] {
  const out: string[] = [];
  const label = (k: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '(blank)';
    if (k === 'status') return STATUS_LABEL[v as Task['status']];
    if (k === 'importance') return IMPORTANCE_LABEL[v as Task['importance']];
    if (k === 'urgency') return URGENCY_LABEL[v as Task['urgency']];
    if (k === 'categoryId') return cats.find((c) => c.id === v)?.name ?? '(none)';
    if (k.endsWith('Date') || k === 'waitingSince' || k === 'skippedOn') return formatDate(v as string);
    if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
    return truncate(String(v), 60);
  };
  const names: Record<string, string> = {
    title: 'Title', description: 'Description', status: 'Status', importance: 'Importance', urgency: 'Urgency', owner: 'Owner',
    dueDate: 'Due date', nextActionDate: 'Next-action date', categoryId: 'Category', waitingOn: 'Waiting on', nextAction: 'Next action',
    effortMinutes: 'Effort', company: 'Company', contact: 'Contact', engagement: 'Engagement', projectId: 'Project', blockers: 'Blockers',
    dependsOn: 'Dependencies', checklist: 'Checklist', coordinationStep: 'Coordination step', lastFollowUpDate: 'Last follow-up',
    manualRank: 'Queue position', tags: 'Tags', remindersEnabled: 'Reminders', followUpIntervalDays: 'Follow-up interval',
    isOutreach: 'Outreach', requiresCall: 'Requires call', sourceLink: 'Source link', skippedOn: 'Skipped', reviewFlags: 'Review flags',
  };
  for (const k of Object.keys(names)) {
    const va = (a as unknown as Record<string, unknown>)[k];
    const vb = (b as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    if (k === 'description' || k === 'checklist') out.push(`${names[k]} updated`);
    else out.push(`${names[k]}: ${label(k, va)} → ${label(k, vb)}`);
  }
  return out;
}

function pick(t: Task, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = (t as unknown as Record<string, unknown>)[k];
  return out;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const firstLine = (s: string) => s.split(/\r?\n/).find((l) => l.trim())?.trim().slice(0, 120) ?? 'Untitled source';
const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));

function sanitizeLinks(p: TaskPatch): TaskPatch {
  return p.sourceLink === undefined ? p : { ...p, sourceLink: safeLink(p.sourceLink) };
}

/** Only http(s), mailto and Outlook deep links are kept as source links. */
export function safeLink(link: string): string {
  const l = (link ?? '').trim();
  if (!l) return '';
  try {
    const u = new URL(l);
    return ['http:', 'https:', 'mailto:', 'ms-outlook:'].includes(u.protocol) ? u.toString() : '';
  } catch {
    return '';
  }
}

