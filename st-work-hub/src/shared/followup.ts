// Ownership and follow-up rules. Pure functions so every view, the assistant, the reminder
// scheduler, and the tests all apply exactly the same logic.

import { addBusinessDays, addDays, diffDays, formatDate, ISODate } from './dates';
import type { Category, Contact, Settings, Task } from './types';

export function isMe(name: string, settings: Pick<Settings, 'myName' | 'myAliases'>): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return n === settings.myName.trim().toLowerCase() || settings.myAliases.some((a) => a.trim().toLowerCase() === n);
}

/** Blank owner is treated as mine (unassigned work lands with me) but flagged in the UI. */
export function ownedByMe(task: Task, settings: Settings): boolean {
  return !task.owner.trim() || isMe(task.owner, settings);
}

export function findContact(task: Task, contacts: Contact[]): Contact | undefined {
  const c = task.contact.trim().toLowerCase();
  if (!c) return undefined;
  return contacts.find((x) => x.name.trim().toLowerCase() === c);
}

/** A closed contact must not receive new outreach recommendations. */
export function isClosedContactTask(task: Task, contacts: Contact[]): boolean {
  return findContact(task, contacts)?.status === 'closed';
}

export type FollowUpState = 'not_waiting' | 'scheduled' | 'due' | 'overdue' | 'blocked_closed_contact';

export interface FollowUpInfo {
  state: FollowUpState;
  date: ISODate | null;
  intervalDays: number;
  basis: string;
  daysOverdue: number;
}

export function followUpInterval(task: Task, settings: Settings, categories: Category[]): number {
  if (task.followUpIntervalDays != null) return task.followUpIntervalDays;
  const cat = categories.find((c) => c.id === task.categoryId);
  if (cat?.followUpDays != null) return cat.followUpDays;
  return settings.defaultFollowUpDays;
}

/**
 * When should I chase a task that is waiting on someone? The answer separates
 * "waiting for a reply" (scheduled) from "need to send a follow-up now" (due/overdue), and always
 * carries a human-readable basis.
 */
export function followUpInfo(
  task: Task,
  settings: Settings,
  categories: Category[],
  contacts: Contact[],
  today: ISODate,
): FollowUpInfo {
  const interval = followUpInterval(task, settings, categories);
  if (task.status !== 'waiting') {
    return { state: 'not_waiting', date: null, intervalDays: interval, basis: '', daysOverdue: 0 };
  }
  const who = task.waitingOn || task.contact || 'someone';
  if (isClosedContactTask(task, contacts)) {
    return {
      state: 'blocked_closed_contact',
      date: null,
      intervalDays: interval,
      basis: `${task.contact} is marked as a closed contact, so no follow-up is suggested.`,
      daysOverdue: 0,
    };
  }
  let date: ISODate;
  let basis: string;
  const unit = settings.followUpBusinessDays ? 'business day' : 'day';
  const plural = interval === 1 ? '' : 's';
  if (task.nextActionDate) {
    date = task.nextActionDate;
    basis = `You set a follow-up date of ${formatDate(date)} for ${who}.`;
  } else {
    const anchor = task.lastFollowUpDate ?? task.waitingSince ?? task.updatedAt.slice(0, 10);
    const anchorLabel = task.lastFollowUpDate ? 'last follow-up sent' : 'waiting since';
    date = settings.followUpBusinessDays ? addBusinessDays(anchor, interval) : addDays(anchor, interval);
    basis = `Waiting on ${who}: ${anchorLabel} ${formatDate(anchor)} + ${interval} ${unit}${plural} interval → ${formatDate(date)}.`;
  }
  const delta = diffDays(date, today);
  const state: FollowUpState = delta > 0 ? 'overdue' : delta === 0 ? 'due' : 'scheduled';
  return { state, date, intervalDays: interval, basis, daysOverdue: Math.max(0, delta) };
}

/**
 * The patch to apply when the user records that they sent a follow-up. Moves the anchor to today and
 * clears any explicit follow-up date so the next reminder is a full interval away (no immediate
 * duplicate reminder).
 */
export function followUpSentPatch(today: ISODate): Partial<Task> {
  return { lastFollowUpDate: today, nextActionDate: null, status: 'waiting' };
}
