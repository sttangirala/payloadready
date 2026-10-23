import { useState } from 'react';
import type { Status, Task } from '../../shared/types';
import { STATUS_LABEL } from '../../shared/types';
import { diffDays } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';
import { Modal, PriorityMark, TaskMeta } from '../components/ui';
import { applyFilters, FilterBar, useFilters } from '../components/Filters';

const COLUMNS: Status[] = ['inbox', 'ready', 'in_progress', 'waiting', 'scheduled', 'done'];

export function BoardView() {
  const { snap, run, select } = useSnap();
  const { f, set, setF } = useFilters();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [askWaiting, setAskWaiting] = useState<Task | null>(null);
  const [who, setWho] = useState('');
  const tasks = applyFilters(snap.tasks, f, snap.settings).filter(
    (t) => t.status !== 'closed' && (t.status !== 'done' || (t.completedAt && diffDays(t.completedAt.slice(0, 10), snap.meta.today) <= 7)),
  );

  const moveTo = (t: Task, status: Status) => {
    if (t.status === status) return;
    if (status === 'waiting' && !t.waitingOn) {
      setAskWaiting(t);
      setWho('');
      return;
    }
    void run(() => api().updateTask(t.id, { status }));
  };

  const onKey = (e: React.KeyboardEvent, t: Task) => {
    if (e.key === 'Enter') select(t.id);
    if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const i = COLUMNS.indexOf(t.status);
      const next = COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
      moveTo(t, next);
    }
  };

  return (
    <div className="view view-board">
      <header className="view-head">
        <div>
          <h1>Board</h1>
          <p className="sub">Drag cards between columns, or focus a card and press Alt+←/→. Done shows the last 7 days.</p>
        </div>
      </header>
      <FilterBar f={f} set={set} reset={() => setF({ ...f, q: '', owner: '', category: '', company: '', importance: '', status: '', from: '', to: '' })} hideStatus />
      <div className="board">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col);
          return (
            <section
              key={col}
              className={`column ${over === col ? 'is-over' : ''}`}
              aria-label={`${STATUS_LABEL[col]} column, ${items.length} tasks`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver((o) => (o === col ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const t = snap.tasks.find((x) => x.id === (dragId ?? e.dataTransfer.getData('text/plain')));
                if (t) moveTo(t, col);
                setDragId(null);
              }}
            >
              <h2 className="column-head">
                {STATUS_LABEL[col]} <span className="count">{items.length}</span>
              </h2>
              <ul className="cards">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className={`card ${dragId === t.id ? 'is-dragging' : ''}`}
                    draggable
                    tabIndex={0}
                    aria-label={t.title}
                    onDragStart={(e) => {
                      setDragId(t.id);
                      e.dataTransfer.setData('text/plain', t.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => select(t.id)}
                    onKeyDown={(e) => onKey(e, t)}
                  >
                    <span className="card-title">
                      <PriorityMark task={t} />
                      {t.title}
                    </span>
                    <TaskMeta task={t} showStatus={false} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {askWaiting && (
        <Modal
          title="Waiting on whom?"
          onClose={() => setAskWaiting(null)}
          footer={
            <>
              <button className="btn" onClick={() => setAskWaiting(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!who.trim()}
                onClick={async () => {
                  await run(() => api().updateTask(askWaiting.id, { status: 'waiting', waitingOn: who.trim() }));
                  setAskWaiting(null);
                }}
              >
                Mark waiting
              </button>
            </>
          }
        >
          <label className="field">
            <span className="label">Person or team you are waiting on for “{askWaiting.title}”</span>
            <input autoFocus list="people" value={who} onChange={(e) => setWho(e.target.value)} />
          </label>
        </Modal>
      )}
    </div>
  );
}
