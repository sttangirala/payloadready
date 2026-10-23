// Deterministic prioritization. Produces the Today queue (and the Focus-mode order) with an
// explanation for every position. No AI involved; the same inputs always give the same order.

import { diffDays, formatDate, ISODate } from './dates';
import { findContact, followUpInfo, FollowUpInfo, isMe, ownedByMe } from './followup';
import type { Category, Contact, Settings, Task } from './types';
import { isOpen } from './types';

export type QueueKind = 'do' | 'follow_up' | 'coordinate' | 'revisit';

export interface QueueEntry {
  task: Task;
  kind: QueueKind;
  score: number;
  reasons: string[];
  followUp?: FollowUpInfo;
}

export type ExclusionReason =
  | 'closed'
  | 'inbox'
  | 'deferred'
  | 'waiting'
  | 'owned_by_other'
  | 'blocked_dependency'
  | 'closed_contact'
  | 'scheduled_later'
  | 'skipped_today';

export interface Classification {
  entry?: QueueEntry;
  excluded?: ExclusionReason;
  explanation: string;
}

export interface QueueContext {
  today: ISODate;
  settings: Settings;
  categories: Category[];
  contacts: Contact[];
  tasks: Task[];
}

const IMPORTANCE_POINTS = { critical: 30, high: 20, medium: 10, low: 0 } as const;
const URGENCY_POINTS = { urgent: 20, soon: 10, none: 0 } as const;

export function classifyTask(task: Task, ctx: QueueContext): Classification {
  const { today, settings } = ctx;
  if (!isOpen(task.status)) return { excluded: 'closed', explanation: 'Completed or closed.' };
  if (task.status === 'inbox') return { excluded: 'inbox', explanation: 'Awaiting triage in the Inbox.' };

  const mine = ownedByMe(task, settings);
  const contact = findContact(task, ctx.contacts);

  // Outreach to a closed contact is never recommended.
  if (contact?.status === 'closed' && (task.isOutreach || task.status === 'waiting')) {
    return { excluded: 'closed_contact', explanation: `${contact.name} is a closed contact; no outreach.` };
  }

  // Unfinished dependencies block the task.
  const blockers = task.dependsOn
    .map((id) => ctx.tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t && isOpen(t.status));
  if (blockers.length) {
    return {
      excluded: 'blocked_dependency',
      explanation: `Blocked by: ${blockers.map((b) => b.title).join(', ')}.`,
    };
  }

  if (task.skippedOn === today) {
    return { excluded: 'skipped_today', explanation: `Skipped today${task.skipReason ? `: ${task.skipReason}` : ''}.` };
  }

  if (task.status === 'waiting') {
    const fu = followUpInfo(task, settings, ctx.categories, ctx.contacts, today);
    if (!mine && !task.coordinationStep.trim()) {
      return { excluded: 'owned_by_other', explanation: `Owned by ${task.owner}; no coordination step for you.` };
    }
    if (fu.state === 'due' || fu.state === 'overdue') {
      const reasons = [fu.basis];
      let score = 35 + Math.min(fu.daysOverdue * 3, 30);
      if (fu.state === 'overdue') reasons.push(`Follow-up is ${fu.daysOverdue} day${fu.daysOverdue === 1 ? '' : 's'} overdue.`);
      score += addImportance(task, reasons);
      score += addDeadline(task, today, reasons);
      return { entry: { task, kind: 'follow_up', score, reasons, followUp: fu }, explanation: reasons.join(' ') };
    }
    return {
      excluded: 'waiting',
      explanation: fu.date ? `Waiting on ${task.waitingOn || 'someone'}; follow up ${formatDate(fu.date, today)}.` : 'Waiting.',
    };
  }

  // Deferred: stays out of today's queue until its next-action date.
  if (task.nextActionDate && task.nextActionDate > today) {
    return {
      excluded: task.status === 'scheduled' ? 'scheduled_later' : 'deferred',
      explanation: `Deferred until ${formatDate(task.nextActionDate, today)}.`,
    };
  }
  if (task.status === 'scheduled' && !task.nextActionDate && !(task.dueDate && task.dueDate <= today)) {
    return { excluded: 'scheduled_later', explanation: 'Scheduled without a date — set a next-action date.' };
  }

  if (!mine && !task.coordinationStep.trim()) {
    return { excluded: 'owned_by_other', explanation: `Owned by ${task.owner}; no coordination step for you.` };
  }

  const reasons: string[] = [];
  let score = 0;
  let kind: QueueKind = mine ? 'do' : 'coordinate';
  if (!mine) {
    reasons.push(`${task.owner} owns this; your coordination step: ${task.coordinationStep}.`);
  }
  score += addDeadline(task, today, reasons);
  score += addImportance(task, reasons);
  if (task.urgency !== 'none') {
    score += URGENCY_POINTS[task.urgency];
    reasons.push(task.urgency === 'urgent' ? 'Marked urgent.' : 'Marked time-sensitive (soon).');
  }
  if (task.status === 'in_progress') {
    score += 15;
    reasons.push('Already in progress — finishing beats starting.');
  }
  if (task.nextActionDate && task.nextActionDate <= today) {
    const late = diffDays(task.nextActionDate, today);
    score += 10 + Math.min(late, 10);
    if (task.status === 'scheduled') kind = 'revisit';
    reasons.push(late === 0 ? 'Next-action date is today.' : `Next-action date passed ${late} day${late === 1 ? '' : 's'} ago.`);
  }
  if (task.effortMinutes != null && task.effortMinutes <= 30) {
    score += 5;
    reasons.push(`Quick win (~${task.effortMinutes} min).`);
  }
  if (!task.owner.trim()) reasons.push('Owner not set — assumed yours.');
  if (!reasons.length) reasons.push('Ready to work; no deadline pressure.');
  return { entry: { task, kind, score, reasons }, explanation: reasons.join(' ') };
}

function addImportance(task: Task, reasons: string[]): number {
  const pts = IMPORTANCE_POINTS[task.importance];
  if (task.importance === 'critical' || task.importance === 'high') reasons.push(`${task.importance === 'critical' ? 'Critical' : 'High'} importance.`);
  return pts;
}

function addDeadline(task: Task, today: ISODate, reasons: string[]): number {
  if (!task.dueDate) return 0;
  const d = diffDays(today, task.dueDate);
  if (d < 0) {
    reasons.push(`Overdue: deadline was ${formatDate(task.dueDate)} (${-d} day${d === -1 ? '' : 's'} ago).`);
    return 50 + Math.min(-d * 2, 20);
  }
  if (d === 0) {
    reasons.push('Deadline is today.');
    return 40;
  }
  if (d <= 3) {
    reasons.push(`Deadline in ${d} day${d === 1 ? '' : 's'} (${formatDate(task.dueDate)}).`);
    return 25;
  }
  if (d <= 7) {
    reasons.push(`Deadline within a week (${formatDate(task.dueDate)}).`);
    return 10;
  }
  return 0;
}

/** The actionable queue, manual overrides first, then by score. */
export function buildQueue(ctx: QueueContext): QueueEntry[] {
  const entries = ctx.tasks.map((t) => classifyTask(t, ctx).entry).filter((e): e is QueueEntry => !!e);
  return entries.sort((a, b) => {
    const ra = a.task.manualRank;
    const rb = b.task.manualRank;
    if (ra != null || rb != null) {
      if (ra == null) return 1;
      if (rb == null) return -1;
      if (ra !== rb) return ra - rb;
    }
    if (b.score !== a.score) return b.score - a.score;
    const da = a.task.dueDate ?? '9999-12-31';
    const db = b.task.dueDate ?? '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return a.task.createdAt < b.task.createdAt ? -1 : 1;
  });
}

/** Why the task sits where it does in the queue (used in Focus mode and Today). */
export function positionExplanation(queue: QueueEntry[], index: number): string {
  const e = queue[index];
  if (!e) return '';
  if (e.task.manualRank != null) return `You placed this manually at position ${index + 1}.`;
  const next = queue[index + 1];
  const head = `#${index + 1} of ${queue.length} (score ${e.score}).`;
  return next ? `${head} Ahead of "${next.task.title}" (score ${next.score}).` : head;
}

/** Overdue deadlines among open tasks I'm responsible for (owned or coordinating). */
export function overdueTasks(ctx: QueueContext): Task[] {
  return ctx.tasks.filter(
    (t) =>
      isOpen(t.status) &&
      t.dueDate != null &&
      t.dueDate < ctx.today &&
      (ownedByMe(t, ctx.settings) || !!t.coordinationStep.trim()),
  );
}

export function waitingTasks(ctx: QueueContext): Task[] {
  return ctx.tasks.filter((t) => t.status === 'waiting');
}

/** Open tasks owned by other people, regardless of status. */
export function delegatedTasks(ctx: QueueContext): Task[] {
  return ctx.tasks.filter((t) => isOpen(t.status) && t.owner.trim() && !isMe(t.owner, ctx.settings));
}

const CALL_RE = /\b(call|phone|dial|ring|zoom|meet(ing)?|talk to|speak with)\b/i;
export function needsCall(task: Task): boolean {
  return task.requiresCall || task.tags.some((t) => /^(call|phone|meeting)$/i.test(t)) || CALL_RE.test(`${task.title} ${task.nextAction}`);
}
