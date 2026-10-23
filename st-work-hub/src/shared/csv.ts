import type { Category, Task } from './types';
import { IMPORTANCE_LABEL, STATUS_LABEL } from './types';

const COLUMNS: [string, (t: Task, cats: Category[]) => string][] = [
  ['ID', (t) => t.id],
  ['Title', (t) => t.title],
  ['Status', (t) => STATUS_LABEL[t.status]],
  ['Importance', (t) => IMPORTANCE_LABEL[t.importance]],
  ['Urgency', (t) => t.urgency],
  ['Category', (t, c) => c.find((x) => x.id === t.categoryId)?.name ?? ''],
  ['Owner', (t) => t.owner],
  ['Company', (t) => t.company],
  ['Contact', (t) => t.contact],
  ['Engagement', (t) => t.engagement],
  ['Due date', (t) => t.dueDate ?? ''],
  ['Next-action date', (t) => t.nextActionDate ?? ''],
  ['Effort (min)', (t) => (t.effortMinutes == null ? '' : String(t.effortMinutes))],
  ['Next action', (t) => t.nextAction],
  ['Waiting on', (t) => t.waitingOn],
  ['Blockers', (t) => t.blockers],
  ['Tags', (t) => t.tags.join('; ')],
  ['Source link', (t) => t.sourceLink],
  ['Description', (t) => t.description],
  ['Created', (t) => t.createdAt],
  ['Updated', (t) => t.updatedAt],
  ['Completed', (t) => t.completedAt ?? ''],
];

function cell(v: string): string {
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function tasksToCsv(tasks: Task[], categories: Category[]): string {
  const header = COLUMNS.map(([h]) => cell(h)).join(',');
  const rows = tasks.map((t) => COLUMNS.map(([, f]) => cell(f(t, categories))).join(','));
  return [header, ...rows].join('\r\n') + '\r\n';
}
