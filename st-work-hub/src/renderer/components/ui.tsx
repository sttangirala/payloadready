// Small shared UI building blocks. All user/pasted text is rendered as React text nodes (escaped);
// nothing in the app uses dangerouslySetInnerHTML.

import { ReactNode, useEffect, useRef } from 'react';
import type { Category, Task } from '../../shared/types';
import { IMPORTANCE_LABEL, STATUS_LABEL } from '../../shared/types';
import { diffDays, formatDate } from '../../shared/dates';
import { isMe } from '../../shared/followup';
import { useSnap } from '../store';

export function Modal({ title, onClose, children, wide, footer, labelledBy }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[autofocus], input, textarea, select, button:not(.icon-btn)');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!items.length) return;
        const firstEl = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  const id = labelledBy ?? `modal-${title.replace(/\W+/g, '-')}`;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <header className="modal-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

const ICONS: Record<string, string> = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  waiting: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z',
  followups: 'M4 12h12M12 6l6 6-6 6M20 4v16',
  projects: 'M3 7h7l2 2h9v10H3z',
  completed: 'M5 12l5 5L20 7',
  assistant: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  review: 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9',
  notifications: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  contacts: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6L6 18M6 6l12 12',
  play: 'M7 4l13 8-13 8z',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  link: 'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ''} />
    </svg>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: Task['status'] }) {
  return <span className={`badge status-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function CategoryTag({ cat }: { cat?: Category }) {
  if (!cat) return null;
  return (
    <span className="cat-tag">
      <span className="cat-dot" style={{ background: cat.color }} aria-hidden="true" />
      {cat.name}
    </span>
  );
}

export function PriorityMark({ task }: { task: Task }) {
  if (task.importance !== 'critical' && task.importance !== 'high' && task.urgency !== 'urgent') return null;
  const label = `${IMPORTANCE_LABEL[task.importance]} importance${task.urgency === 'urgent' ? ', urgent' : ''}`;
  return <span className={`prio prio-${task.importance}${task.urgency === 'urgent' ? ' prio-urgent' : ''}`} title={label} aria-label={label} />;
}

export function DateChip({ date, kind, today }: { date: string | null; kind: 'due' | 'next'; today: string }) {
  if (!date) return null;
  const d = diffDays(today, date);
  const cls = kind === 'due' ? (d < 0 ? 'chip-danger' : d <= 1 ? 'chip-warn' : '') : d <= 0 ? 'chip-accent' : '';
  return (
    <span className={`chip ${cls}`}>
      {kind === 'due' ? 'Due ' : 'Next '}
      {formatDate(date, today)}
    </span>
  );
}

export function TaskMeta({ task, showStatus = true }: { task: Task; showStatus?: boolean }) {
  const { snap } = useSnap();
  const cat = snap.categories.find((c) => c.id === task.categoryId);
  const otherOwner = task.owner.trim() && !isMe(task.owner, snap.settings);
  return (
    <span className="task-meta">
      {showStatus && <StatusBadge status={task.status} />}
      <CategoryTag cat={cat} />
      {otherOwner && <span className="chip">Owner: {task.owner}</span>}
      {!task.owner.trim() && <span className="chip chip-warn">No owner</span>}
      {task.status === 'waiting' && task.waitingOn && <span className="chip">Waiting on {task.waitingOn}</span>}
      {(task.company || task.contact) && <span className="chip chip-quiet">{[task.contact, task.company].filter(Boolean).join(' · ')}</span>}
      <DateChip date={task.dueDate} kind="due" today={snap.meta.today} />
      {task.status !== 'waiting' && <DateChip date={task.nextActionDate} kind="next" today={snap.meta.today} />}
      {task.effortMinutes != null && <span className="chip chip-quiet">~{task.effortMinutes}m</span>}
      {task.isDemo && <span className="chip chip-demo">Demo</span>}
    </span>
  );
}

export function TaskRow({ task, children, extra }: { task: Task; children?: ReactNode; extra?: ReactNode }) {
  const { select, selectedId } = useSnap();
  return (
    <li className={`task-row ${selectedId === task.id ? 'is-selected' : ''}`}>
      <button className="task-row-main" onClick={() => select(task.id)} aria-label={`Open ${task.title}`}>
        <span className="task-row-title">
          <PriorityMark task={task} />
          {task.title}
        </span>
        <TaskMeta task={task} />
        {extra && <span className="task-row-extra">{extra}</span>}
      </button>
      {children && <span className="task-row-actions">{children}</span>}
    </li>
  );
}

export function Section({ title, count, children, action, id }: { title: string; count?: number; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h3 id={id}>
          {title}
          {count != null && <span className="count">{count}</span>}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SpinnerText({ children }: { children: ReactNode }) {
  return (
    <span className="spinner-text" role="status">
      <span className="spinner" aria-hidden="true" />
      {children}
    </span>
  );
}
