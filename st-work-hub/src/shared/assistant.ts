// Deterministic assistant: answers common questions straight from saved task data and always lists
// the records that support the answer. Used offline / without an API key, and as grounding for the
// AI assistant when a key is configured.

import { addDays, diffDays, formatDate, ISODate } from './dates';
import { followUpInfo, isClosedContactTask, ownedByMe } from './followup';
import { buildQueue, classifyTask, needsCall, QueueContext } from './queue';
import type { Activity, Source, Task } from './types';
import { isOpen, STATUS_LABEL } from './types';

export interface LocalAnswer {
  intent: string;
  text: string;
  taskIds: string[];
  /** Follow-up draft text suggested for a single task (never sent). */
  draft?: { taskId: string; text: string };
  /** The question looks like pasted notes that should go through intake. */
  suggestIntake?: boolean;
}

export interface AssistantContext extends QueueContext {
  activity: Activity[];
  sources: Source[];
  nowIso: string;
}

const line = (t: Task, extra = '') => `• ${t.title}${extra ? ` — ${extra}` : ''}`;

export function answerLocally(question: string, ctx: AssistantContext): LocalAnswer {
  const q = question.trim();
  const ql = q.toLowerCase();
  const open = ctx.tasks.filter((t) => isOpen(t.status));

  if (q.length > 280 || /\b(organi[sz]e|parse|extract tasks|turn (this|these) into tasks)\b/.test(ql)) {
    return {
      intent: 'intake',
      text: 'This looks like notes to organize. I’ll run them through Intake so you can review each suggested task before anything is saved.',
      taskIds: [],
      suggestIntake: true,
    };
  }

  let m: RegExpMatchArray | null;

  if ((m = ql.match(/draft (?:a )?follow[- ]?up (?:to|for|with) ([a-z][a-z .'-]+)/))) {
    const name = m[1].trim().replace(/[?.!]$/, '');
    const t = open.find((x) => matchesPerson(x, name) && (x.status === 'waiting' || x.isOutreach));
    if (!t) return { intent: 'draft', text: `I couldn’t find an open follow-up involving “${name}”.`, taskIds: [] };
    if (isClosedContactTask(t, ctx.contacts)) {
      return { intent: 'draft', text: `${t.contact} is a closed contact, so I won’t draft outreach.`, taskIds: [t.id] };
    }
    const who = t.waitingOn || t.contact || name;
    const text = `Hi ${who.split(' ')[0]},\n\nJust following up on ${t.title.replace(/^\[Demo\]\s*/, '').toLowerCase()}. ${
      t.nextAction ? `${t.nextAction} ` : ''
    }Let me know what works on your end.\n\nThanks,\n${ctx.settings.myName === 'Me' ? '' : ctx.settings.myName}`.trim();
    return { intent: 'draft', text: `Draft for “${t.title}” (not sent — copy it into Outlook when ready):`, taskIds: [t.id], draft: { taskId: t.id, text } };
  }

  if ((m = ql.match(/waiting (?:on|for) ([a-z][a-z .'-]*?)(?: for| about|\?|$)/)) && !/^(someone|anyone|others?|people)$/.test(m[1].trim())) {
    const name = m[1].trim();
    const hits = ctx.tasks.filter((t) => isOpen(t.status) && (contains(t.waitingOn, name) || (t.status === 'waiting' && contains(t.contact, name)) || contains(t.owner, name)));
    if (!hits.length) return { intent: 'waiting_on', text: `Nothing open is waiting on ${cap(name)}.`, taskIds: [] };
    const lines = hits.map((t) => {
      if (t.status === 'waiting') {
        const fu = followUpInfo(t, ctx.settings, ctx.categories, ctx.contacts, ctx.today);
        return line(t, `${t.description || t.nextAction || 'waiting'} (follow-up: ${fu.date ? formatDate(fu.date, ctx.today) : 'n/a'})`);
      }
      return line(t, `${cap(name)} owns this (${STATUS_LABEL[t.status]})`);
    });
    return { intent: 'waiting_on', text: `Here’s what involves ${cap(name)}:\n${lines.join('\n')}`, taskIds: hits.map((t) => t.id) };
  }

  if (/follow[- ]?ups?/.test(ql)) {
    const rows = ctx.tasks
      .filter((t) => t.status === 'waiting')
      .map((t) => ({ t, fu: followUpInfo(t, ctx.settings, ctx.categories, ctx.contacts, ctx.today) }))
      .filter((r) => r.fu.state !== 'blocked_closed_contact');
    const due = rows.filter((r) => r.fu.state === 'due' || r.fu.state === 'overdue');
    const upcoming = rows.filter((r) => r.fu.state === 'scheduled' && r.fu.date && diffDays(ctx.today, r.fu.date) <= 7);
    const scheduledOutreach = open.filter(
      (t) => t.status === 'scheduled' && t.isOutreach && t.nextActionDate && t.nextActionDate > ctx.today && diffDays(ctx.today, t.nextActionDate) <= 7 && !isClosedContactTask(t, ctx.contacts),
    );
    const parts: string[] = [];
    parts.push(due.length ? `Due now (${due.length}):\n${due.map((r) => line(r.t, r.fu.basis)).join('\n')}` : 'No follow-ups are due right now.');
    const up = [...upcoming.map((r) => line(r.t, `follow up ${formatDate(r.fu.date, ctx.today)}`)), ...scheduledOutreach.map((t) => line(t, `scheduled ${formatDate(t.nextActionDate, ctx.today)}`))];
    if (up.length) parts.push(`Coming up this week:\n${up.join('\n')}`);
    return { intent: 'followups', text: parts.join('\n\n'), taskIds: [...due.map((r) => r.t.id), ...upcoming.map((r) => r.t.id), ...scheduledOutreach.map((t) => t.id)] };
  }

  if (/changed|since yesterday|what'?s new|recent(ly)? (updated|changed)/.test(ql)) {
    const since = new Date(new Date(ctx.nowIso).getTime() - 86_400_000).toISOString();
    const recent = ctx.activity.filter((a) => a.createdAt >= since && a.taskId);
    const byTask = new Map<string, Activity[]>();
    for (const a of recent) byTask.set(a.taskId!, [...(byTask.get(a.taskId!) ?? []), a]);
    if (!byTask.size) return { intent: 'changes', text: 'No task changes in the last 24 hours.', taskIds: [] };
    const lines = [...byTask.entries()].map(([id, acts]) => {
      const t = ctx.tasks.find((x) => x.id === id);
      return `• ${t?.title ?? '(deleted task)'} — ${acts.map((a) => a.summary).slice(0, 3).join('; ')}`;
    });
    return { intent: 'changes', text: `Changes in the last 24 hours:\n${lines.join('\n')}`, taskIds: [...byTask.keys()].filter((id) => ctx.tasks.some((t) => t.id === id)) };
  }

  if (/without (making )?(any )?(phone )?calls|no calls|don'?t (need|require) (a )?call/.test(ql)) {
    const queue = buildQueue(ctx).filter((e) => !needsCall(e.task));
    return listAnswer('no_calls', 'Tasks in your queue that don’t need a call:', queue.map((e) => e.task), ctx.today, 'None of your actionable tasks avoid calls right now.');
  }

  if ((m = ql.match(/(\d{1,3})\s*(?:min|minute)/)) || /quick (wins?|tasks?)/.test(ql)) {
    const limit = m ? Number(m[1]) : 30;
    const queue = buildQueue(ctx).filter((e) => e.task.effortMinutes != null && e.task.effortMinutes <= limit);
    const unknown = buildQueue(ctx).filter((e) => e.task.effortMinutes == null).length;
    const res = listAnswer('effort', `Actionable tasks estimated at ${limit} minutes or less:`, queue.map((e) => e.task), ctx.today, `Nothing actionable is estimated at ${limit} minutes or less.`, (t) => `~${t.effortMinutes} min`);
    if (unknown) res.text += `\n\n(${unknown} actionable task${unknown === 1 ? ' has' : 's have'} no effort estimate and ${unknown === 1 ? 'is' : 'are'} not included.)`;
    return res;
  }

  if (/what should i (work on|do)|today|priorit|next task|focus/.test(ql)) {
    const queue = buildQueue(ctx).slice(0, ctx.settings.todayLimit);
    if (!queue.length) return { intent: 'today', text: 'Nothing is actionable for you right now. Check the Inbox or Waiting view.', taskIds: [] };
    const lines = queue.map((e, i) => `${i + 1}. ${e.task.title} — ${e.reasons.slice(0, 2).join(' ')}`);
    return { intent: 'today', text: `Here’s your queue for today:\n${lines.join('\n')}`, taskIds: queue.map((e) => e.task.id) };
  }

  if (/^(what|which).*\bwaiting\b/.test(ql) || /^waiting\b/.test(ql)) {
    const w = ctx.tasks.filter((t) => t.status === 'waiting');
    return listAnswer('waiting', 'Waiting on someone:', w, ctx.today, 'Nothing is waiting on anyone.', (t) => `on ${t.waitingOn || 'unspecified'}`);
  }

  if (/overdue|late|behind/.test(ql)) {
    const od = open.filter((t) => t.dueDate && t.dueDate < ctx.today && ownedByMe(t, ctx.settings));
    return listAnswer('overdue', 'Overdue deadlines:', od, ctx.today, 'No overdue deadlines.', (t) => `due ${formatDate(t.dueDate, ctx.today)}`);
  }

  if (/tomorrow/.test(ql)) {
    const tq = buildQueue({ ...ctx, today: addDays(ctx.today, 1) }).slice(0, ctx.settings.todayLimit);
    return listAnswer('tomorrow', 'Suggested priorities for tomorrow:', tq.map((e) => e.task), ctx.today, 'Nothing queued for tomorrow yet.');
  }

  // "Show everything related to Brenda" / free-text search.
  m = ql.match(/(?:related to|about|regarding|involving|for|with|on)\s+([a-z0-9][a-z0-9 .&'-]*?)\??$/) ?? ql.match(/^(?:show|find|search)\s+(?:me\s+)?(?:everything\s+)?([a-z0-9][a-z0-9 .&'-]*?)\??$/);
  const term = (m ? m[1] : q).replace(/^(everything|all|tasks|anything)\s+/, '').trim();
  const hits = searchTasks(term, ctx);
  if (!hits.length) {
    return {
      intent: 'search',
      text: `I couldn’t find tasks matching “${term}”. Try: “What should I work on today?”, “What follow-ups are due?”, “What am I waiting on Robert for?”, or “What can I finish in 30 minutes?”`,
      taskIds: [],
    };
  }
  return listAnswer('search', `Everything related to “${term}”:`, hits, ctx.today, '', (t) => STATUS_LABEL[t.status] + (t.owner && !ownedByMe(t, ctx.settings) ? ` · owner ${t.owner}` : ''));
}

export function searchTasks(term: string, ctx: AssistantContext): Task[] {
  const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  return ctx.tasks.filter((t) => {
    const src = t.sourceId ? ctx.sources.find((s) => s.id === t.sourceId)?.rawText ?? '' : '';
    const hay = [t.title, t.description, t.company, t.contact, t.owner, t.waitingOn, t.engagement, t.nextAction, t.notes.map((n) => n.body).join(' '), src].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

function listAnswer(intent: string, header: string, tasks: Task[], today: ISODate, empty: string, extra?: (t: Task) => string): LocalAnswer {
  if (!tasks.length) return { intent, text: empty, taskIds: [] };
  const lines = tasks.map((t) => line(t, extra ? extra(t) : t.dueDate ? `due ${formatDate(t.dueDate, today)}` : ''));
  return { intent, text: `${header}\n${lines.join('\n')}`, taskIds: tasks.map((t) => t.id) };
}

function matchesPerson(t: Task, name: string) {
  return contains(t.waitingOn, name) || contains(t.contact, name) || contains(t.title, name);
}
const contains = (hay: string, needle: string) => !!hay && hay.toLowerCase().includes(needle.toLowerCase());
const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Explains why a task is not in today's queue, for "why isn't X here?" UI affordances. */
export function whyNotInQueue(task: Task, ctx: QueueContext): string {
  return classifyTask(task, ctx).explanation;
}
