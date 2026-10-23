import { useMemo, useState } from 'react';
import type { Task } from '../../shared/types';
import { IMPORTANCE_LABEL, isOpen, STATUS_LABEL } from '../../shared/types';
import { followUpInfo, isMe } from '../../shared/followup';
import { classifyTask, delegatedTasks } from '../../shared/queue';
import { diffDays, formatDate } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';
import { EmptyState, PriorityMark, Section, StatusBadge, TaskRow, CategoryTag } from '../components/ui';
import { applyFilters, EMPTY_FILTERS, FilterBar, useFilters } from '../components/Filters';

type SortKey = 'title' | 'status' | 'importance' | 'dueDate' | 'nextActionDate' | 'owner' | 'updatedAt';
const IMP_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function TaskTable({ tasks }: { tasks: Task[] }) {
  const { snap, select, selectedId } = useSnap();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'dueDate', dir: 1 });
  const sorted = useMemo(() => {
    const val = (t: Task): string | number => {
      if (sort.key === 'importance') return IMP_ORDER[t.importance];
      const v = t[sort.key];
      return v == null || v === '' ? '￿' : String(v).toLowerCase();
    };
    return [...tasks].sort((a, b) => (val(a) < val(b) ? -sort.dir : val(a) > val(b) ? sort.dir : 0));
  }, [tasks, sort]);
  const th = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}
      </button>
    </th>
  );
  if (!tasks.length) return <EmptyState title="No tasks match these filters." />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {th('title', 'Task')}
            {th('status', 'Status')}
            <th scope="col">Category</th>
            {th('owner', 'Owner')}
            {th('importance', 'Priority')}
            {th('dueDate', 'Due')}
            {th('nextActionDate', 'Next action')}
            {th('updatedAt', 'Updated')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className={selectedId === t.id ? 'is-selected' : ''}>
              <td>
                <button className="link-btn strong" onClick={() => select(t.id)}>
                  <PriorityMark task={t} /> {t.title}
                </button>
                {(t.company || t.contact) && <div className="hint">{[t.contact, t.company].filter(Boolean).join(' · ')}</div>}
              </td>
              <td><StatusBadge status={t.status} /></td>
              <td><CategoryTag cat={snap.categories.find((c) => c.id === t.categoryId)} /></td>
              <td>{t.owner || <span className="muted">—</span>}</td>
              <td>{IMPORTANCE_LABEL[t.importance]}{t.urgency === 'urgent' ? ' · urgent' : ''}</td>
              <td className={t.dueDate && t.dueDate < snap.meta.today && isOpen(t.status) ? 'danger' : ''}>{formatDate(t.dueDate, snap.meta.today)}</td>
              <td>{formatDate(t.nextActionDate, snap.meta.today)}</td>
              <td className="muted">{formatDate(t.updatedAt.slice(0, 10), snap.meta.today)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListView() {
  const { snap } = useSnap();
  const { f, set, setF } = useFilters();
  const [includeClosed, setIncludeClosed] = useState(false);
  const base = includeClosed || f.status === 'done' || f.status === 'closed' ? snap.tasks : snap.tasks.filter((t) => isOpen(t.status));
  const tasks = applyFilters(base, f, snap.settings);
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>All tasks</h1>
          <p className="sub">{tasks.length} shown</p>
        </div>
        <label className="check-line">
          <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} /> Include done & closed
        </label>
      </header>
      <FilterBar f={f} set={set} reset={() => setF(EMPTY_FILTERS)} />
      <TaskTable tasks={tasks} />
    </div>
  );
}

export function CompletedView() {
  const { snap } = useSnap();
  const { f, set, setF } = useFilters({ dateField: 'completedAt' });
  const tasks = applyFilters(snap.tasks.filter((t) => !isOpen(t.status)), f, snap.settings).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Completed</h1>
          <p className="sub">Done and closed tasks, newest first. {tasks.length} shown.</p>
        </div>
      </header>
      <FilterBar f={f} set={set} reset={() => setF({ ...EMPTY_FILTERS, dateField: 'completedAt' })} statuses={['done', 'closed']} />
      {tasks.length ? (
        <ul className="task-list">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} extra={t.completedAt ? `${STATUS_LABEL[t.status]} ${formatDate(t.completedAt.slice(0, 10), snap.meta.today)}` : undefined} />
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing completed yet." />
      )}
    </div>
  );
}

export function WaitingView() {
  const { snap, queueCtx, run } = useSnap();
  const today = snap.meta.today;
  const waiting = snap.tasks.filter((t) => t.status === 'waiting');
  const groups = new Map<string, Task[]>();
  for (const t of waiting) {
    const k = t.waitingOn.trim() || 'Unspecified';
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const delegated = delegatedTasks(queueCtx).filter((t) => t.status !== 'waiting');
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Waiting</h1>
          <p className="sub">Blocked by someone else. These stay out of your actionable queue until a follow-up is due.</p>
        </div>
      </header>
      {!waiting.length && !delegated.length && <EmptyState title="You’re not waiting on anyone." />}
      {[...groups.entries()].sort().map(([who, items]) => (
        <Section key={who} title={`Waiting on ${who}`} count={items.length} id={`w-${who}`}>
          <ul className="task-list">
            {items.map((t) => {
              const fu = followUpInfo(t, snap.settings, snap.categories, snap.contacts, today);
              const label = fu.state === 'blocked_closed_contact' ? fu.basis : fu.state === 'overdue' ? `Follow-up overdue by ${fu.daysOverdue}d` : fu.state === 'due' ? 'Follow up today' : `Follow up ${formatDate(fu.date, today)}`;
              return (
                <TaskRow key={t.id} task={t} extra={<span title={fu.basis}>{label}{t.waitingSince ? ` · waiting ${diffDays(t.waitingSince, today)}d` : ''}</span>}>
                  {fu.state !== 'blocked_closed_contact' && (
                    <button className="btn btn-small" onClick={() => run(() => api().logFollowUpSent(t.id), 'Follow-up logged')}>Followed up</button>
                  )}
                  <button className="btn btn-small" onClick={() => run(() => api().updateTask(t.id, { status: 'ready' }), 'Unblocked')}>Got reply</button>
                </TaskRow>
              );
            })}
          </ul>
        </Section>
      ))}
      {delegated.length > 0 && (
        <Section title="Owned by others" count={delegated.length} id="delegated">
          <p className="hint">Not your action unless you add a coordination step.</p>
          <ul className="task-list">
            {delegated.map((t) => <TaskRow key={t.id} task={t} extra={t.coordinationStep ? `Your step: ${t.coordinationStep}` : classifyTask(t, queueCtx).explanation} />)}
          </ul>
        </Section>
      )}
    </div>
  );
}

export function FollowUpsView() {
  const { snap, queueCtx, run } = useSnap();
  const today = snap.meta.today;
  const rows = snap.tasks
    .filter((t) => isOpen(t.status) && t.status !== 'inbox')
    .map((t) => {
      const fu = t.status === 'waiting' ? followUpInfo(t, snap.settings, snap.categories, snap.contacts, today) : null;
      const date = fu ? fu.date : t.nextActionDate;
      const basis = fu ? fu.basis : `Next-action date you set${t.status === 'scheduled' ? ' (scheduled)' : ''}.`;
      return { t, date, basis, suppressed: fu?.state === 'blocked_closed_contact' };
    })
    .filter((r) => r.date || r.suppressed);
  const mineOrCoord = (t: Task) => !t.owner.trim() || isMe(t.owner, snap.settings) || !!t.coordinationStep.trim();
  const overdue = rows.filter((r) => r.date && r.date < today && mineOrCoord(r.t));
  const due = rows.filter((r) => r.date === today && mineOrCoord(r.t));
  const upcoming = rows.filter((r) => r.date && r.date > today).sort((a, b) => a.date!.localeCompare(b.date!));
  const suppressed = rows.filter((r) => r.suppressed);
  const others = rows.filter((r) => r.date && r.date <= today && !mineOrCoord(r.t));

  const list = (items: typeof rows) => (
    <ul className="task-list">
      {items.map(({ t, date, basis }) => (
        <TaskRow key={t.id} task={t} extra={<span title={basis}>{date ? formatDate(date, today) : ''} — {basis}</span>}>
          {t.status === 'waiting' && classifyTask(t, queueCtx).excluded !== 'closed_contact' && (
            <button className="btn btn-small" onClick={() => run(() => api().logFollowUpSent(t.id), 'Follow-up logged')}>Followed up</button>
          )}
        </TaskRow>
      ))}
    </ul>
  );
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Follow-ups</h1>
          <p className="sub">Next-action dates and follow-up reminders. Default interval: {snap.settings.defaultFollowUpDays} {snap.settings.followUpBusinessDays ? 'business ' : ''}days (per-category and per-task overrides apply).</p>
        </div>
      </header>
      {!rows.length && <EmptyState title="No follow-ups scheduled." />}
      {overdue.length > 0 && <Section title="Overdue" count={overdue.length} id="fu-over">{list(overdue)}</Section>}
      {due.length > 0 && <Section title="Due today" count={due.length} id="fu-today">{list(due)}</Section>}
      {upcoming.length > 0 && <Section title="Upcoming" count={upcoming.length} id="fu-up">{list(upcoming)}</Section>}
      {others.length > 0 && <Section title="Due, but owned by others (no action for you)" count={others.length} id="fu-others">{list(others)}</Section>}
      {suppressed.length > 0 && <Section title="Suppressed — closed contacts" count={suppressed.length} id="fu-closed">{list(suppressed)}</Section>}
    </div>
  );
}

