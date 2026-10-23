// Task construction and normalization helpers.

import type { Task, TaskPatch } from './types';
import { IMPORTANCES, PATCHABLE_FIELDS, STATUSES, URGENCIES } from './types';
import { isISODate } from './dates';

export function newId(prefix = ''): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}_${rnd}` : rnd;
}

export function blankTask(now: string, patch: TaskPatch = {}): Task {
  const base: Task = {
    id: newId('t'),
    title: '',
    description: '',
    categoryId: null,
    company: '',
    contact: '',
    engagement: '',
    projectId: null,
    owner: 'Me',
    coordinationStep: '',
    status: 'inbox',
    importance: 'medium',
    urgency: 'none',
    dueDate: null,
    nextActionDate: null,
    effortMinutes: null,
    nextAction: '',
    blockers: '',
    dependsOn: [],
    waitingOn: '',
    waitingSince: null,
    lastFollowUpDate: null,
    followUpIntervalDays: null,
    isOutreach: false,
    requiresCall: false,
    tags: [],
    sourceId: null,
    sourceLink: '',
    manualRank: null,
    skippedOn: null,
    skipReason: '',
    remindersEnabled: true,
    inferredFields: [],
    reviewFlags: [],
    checklist: [],
    notes: [],
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  return { ...base, ...sanitizePatch(patch) };
}

/**
 * Whitelist and type-check a patch. Unknown keys are dropped; invalid values are dropped rather than
 * coerced so bad AI output can never corrupt a record.
 */
export function sanitizePatch(input: unknown): TaskPatch {
  if (!input || typeof input !== 'object') return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PATCHABLE_FIELDS) {
    if (!(key in src)) continue;
    const v = src[key];
    switch (key) {
      case 'status':
        if (STATUSES.includes(v as never)) out[key] = v;
        break;
      case 'importance':
        if (IMPORTANCES.includes(v as never)) out[key] = v;
        break;
      case 'urgency':
        if (URGENCIES.includes(v as never)) out[key] = v;
        break;
      case 'dueDate':
      case 'nextActionDate':
      case 'waitingSince':
      case 'lastFollowUpDate':
      case 'skippedOn':
        if (v === null || isISODate(v)) out[key] = v;
        break;
      case 'effortMinutes':
      case 'followUpIntervalDays':
      case 'manualRank':
        if (v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0)) out[key] = v === null ? null : Math.round(v as number);
        break;
      case 'categoryId':
      case 'projectId':
      case 'sourceId':
        if (v === null || typeof v === 'string') out[key] = v || null;
        break;
      case 'isOutreach':
      case 'requiresCall':
      case 'remindersEnabled':
        if (typeof v === 'boolean') out[key] = v;
        break;
      case 'dependsOn':
      case 'tags':
      case 'inferredFields':
      case 'reviewFlags':
        if (Array.isArray(v)) out[key] = v.filter((x) => typeof x === 'string').map((x) => (x as string).slice(0, 500));
        break;
      case 'checklist':
        if (Array.isArray(v))
          out[key] = v
            .filter((x) => x && typeof x === 'object' && typeof (x as { text?: unknown }).text === 'string')
            .map((x) => {
              const item = x as { id?: unknown; text: string; done?: unknown };
              return { id: typeof item.id === 'string' ? item.id : newId('c'), text: item.text.slice(0, 500), done: item.done === true };
            });
        break;
      default:
        if (typeof v === 'string') out[key] = v.slice(0, key === 'description' ? 20000 : 2000);
    }
  }
  return out as TaskPatch;
}
