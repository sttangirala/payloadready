import { useMemo, useState } from 'react';
import type { Status, Task } from '../../shared/types';
import { IMPORTANCES, IMPORTANCE_LABEL, STATUSES, STATUS_LABEL } from '../../shared/types';
import { isMe } from '../../shared/followup';
import { useSnap } from '../store';

export interface FilterState {
  q: string;
  owner: string; // '' any, '__me', '__others', or exact
  category: string;
  company: string;
  importance: string;
  status: string;
  dateField: 'dueDate' | 'nextActionDate' | 'completedAt' | 'updatedAt';
  from: string;
  to: string;
}

export const EMPTY_FILTERS: FilterState = { q: '', owner: '', category: '', company: '', importance: '', status: '', dateField: 'dueDate', from: '', to: '' };

export function useFilters(initial: Partial<FilterState> = {}) {
  const [f, setF] = useState<FilterState>({ ...EMPTY_FILTERS, ...initial });
  return { f, setF, set: <K extends keyof FilterState>(k: K, v: FilterState[K]) => setF((x) => ({ ...x, [k]: v })) };
}

export function applyFilters(tasks: Task[], f: FilterState, settings: { myName: string; myAliases: string[] }): Task[] {
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return tasks.filter((t) => {
    if (words.length) {
      const hay = [t.title, t.description, t.company, t.contact, t.owner, t.waitingOn, t.nextAction, t.engagement, t.tags.join(' '), t.notes.map((n) => n.body).join(' ')].join(' ').toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (f.owner === '__me' && t.owner.trim() && !isMe(t.owner, settings)) return false;
    if (f.owner === '__others' && (!t.owner.trim() || isMe(t.owner, settings))) return false;
    if (f.owner && !f.owner.startsWith('__') && t.owner !== f.owner) return false;
    if (f.category && (f.category === '__none' ? t.categoryId : t.categoryId !== f.category)) return false;
    if (f.company && t.company !== f.company) return false;
    if (f.importance && t.importance !== f.importance) return false;
    if (f.status && t.status !== (f.status as Status)) return false;
    if (f.from || f.to) {
      const raw = t[f.dateField];
      const d = raw ? String(raw).slice(0, 10) : '';
      if (!d) return false;
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
    }
    return true;
  });
}

export function FilterBar({ f, set, reset, statuses = STATUSES as unknown as Status[], hideStatus }: { f: FilterState; set: <K extends keyof FilterState>(k: K, v: FilterState[K]) => void; reset: () => void; statuses?: Status[]; hideStatus?: boolean }) {
  const { snap } = useSnap();
  const owners = useMemo(() => [...new Set(snap.tasks.map((t) => t.owner).filter((o) => o.trim() && !isMe(o, snap.settings)))].sort(), [snap]);
  const companies = useMemo(() => [...new Set(snap.tasks.map((t) => t.company).filter(Boolean))].sort(), [snap]);
  const active = JSON.stringify({ ...f, dateField: '' }) !== JSON.stringify({ ...EMPTY_FILTERS, dateField: '' });
  return (
    <div className="filters" role="search">
      <input className="filter-q" type="search" aria-label="Search tasks" placeholder="Search…" value={f.q} onChange={(e) => set('q', e.target.value)} />
      <select aria-label="Owner" value={f.owner} onChange={(e) => set('owner', e.target.value)}>
        <option value="">Any owner</option>
        <option value="__me">Mine</option>
        <option value="__others">Others’</option>
        {owners.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <select aria-label="Category" value={f.category} onChange={(e) => set('category', e.target.value)}>
        <option value="">Any category</option>
        <option value="__none">No category</option>
        {snap.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label="Company" value={f.company} onChange={(e) => set('company', e.target.value)}>
        <option value="">Any company</option>
        {companies.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select aria-label="Priority" value={f.importance} onChange={(e) => set('importance', e.target.value)}>
        <option value="">Any priority</option>
        {IMPORTANCES.map((i) => <option key={i} value={i}>{IMPORTANCE_LABEL[i]}</option>)}
      </select>
      {!hideStatus && (
        <select aria-label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      )}
      <span className="date-filter">
        <select aria-label="Date field" value={f.dateField} onChange={(e) => set('dateField', e.target.value as FilterState['dateField'])}>
          <option value="dueDate">Due</option>
          <option value="nextActionDate">Next action</option>
          <option value="completedAt">Completed</option>
          <option value="updatedAt">Updated</option>
        </select>
        <input type="date" aria-label="From date" value={f.from} onChange={(e) => set('from', e.target.value)} />
        <span aria-hidden="true">–</span>
        <input type="date" aria-label="To date" value={f.to} onChange={(e) => set('to', e.target.value)} />
      </span>
      {active && <button className="link-btn" onClick={reset}>Clear filters</button>}
    </div>
  );
}
