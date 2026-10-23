// One-task-at-a-time focus mode.

import { useEffect, useMemo, useState } from 'react';
import type { Source } from '../../shared/types';
import { positionExplanation } from '../../shared/queue';
import { addDays, formatDate } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';
import { Modal, TaskMeta, EmptyState } from './ui';
import { SourceViewer } from './SourceViewer';

type Mode = null | 'note' | 'defer' | 'waiting' | 'skip';

const KIND_LABEL = { do: 'Do it', follow_up: 'Follow up now', coordinate: 'Coordinate', revisit: 'Revisit' } as const;

export function FocusMode() {
  const { snap, queue, setFocusOpen, run, select } = useSnap();
  const [currentId, setCurrentId] = useState<string | null>(queue[0]?.task.id ?? null);
  const [mode, setMode] = useState<Mode>(null);
  const [input, setInput] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const today = snap.meta.today;

  const index = useMemo(() => queue.findIndex((e) => e.task.id === currentId), [queue, currentId]);
  // When the current task leaves the queue (completed, deferred, waiting, skipped) move on.
  useEffect(() => {
    if (index === -1 && queue.length) setCurrentId(queue[0].task.id);
    if (!queue.length) setCurrentId(null);
  }, [index, queue]);

  const entry = index >= 0 ? queue[index] : undefined;
  const close = () => setFocusOpen(false);

  if (!entry) {
    return (
      <Modal title="Focus" onClose={close}>
        <EmptyState title="Nothing actionable right now.">
          <p>Everything left is waiting on someone, deferred, or in the Inbox for triage.</p>
        </EmptyState>
      </Modal>
    );
  }
  const t = entry.task;
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    await run(fn, msg);
    setMode(null);
    setInput('');
  };
  const move = (delta: number) => {
    const ids = queue.map((e) => e.task.id);
    const i = ids.indexOf(t.id);
    const j = Math.max(0, Math.min(ids.length - 1, i + delta));
    ids.splice(i, 1);
    ids.splice(j, 0, t.id);
    void run(() => api().setManualOrder(ids), 'Queue order updated');
  };

  return (
    <Modal title="Focus — one task at a time" onClose={close} wide>
      <div className="focus">
        <div className="focus-kicker">
          <span className={`badge kind-${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
          <span className="hint">{positionExplanation(queue, index)}</span>
        </div>
        <h2 className="focus-title">{t.title}</h2>
        <TaskMeta task={t} />
        <div className="focus-why">
          <strong>Why now:</strong>
          <ul>{entry.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        {(t.nextAction || t.coordinationStep) && (
          <div className="focus-next">
            <span className="label">Next action</span>
            <p>{entry.kind === 'coordinate' ? t.coordinationStep : t.nextAction || t.coordinationStep}</p>
          </div>
        )}
        {t.description && <p className="pre focus-desc">{t.description}</p>}
        {t.checklist.length > 0 && (
          <ul className="checklist">
            {t.checklist.map((c) => (
              <li key={c.id}>
                <label>
                  <input type="checkbox" checked={c.done} onChange={() => run(() => api().updateTask(t.id, { checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }))} />
                  <span className={c.done ? 'strike' : ''}>{c.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {t.notes.length > 0 && (
          <div className="focus-notes">
            <span className="label">Recent notes</span>
            {t.notes.slice(-3).map((n) => <p key={n.id} className="pre">{n.body}</p>)}
          </div>
        )}

        {mode && (
          <form
            className="focus-form"
            onSubmit={(e) => {
              e.preventDefault();
              const v = input.trim();
              if (mode === 'note' && v) void act(() => api().addNote(t.id, v), 'Note added');
              if (mode === 'defer' && v) void act(() => api().updateTask(t.id, { nextActionDate: v, manualRank: null }), `Deferred to ${formatDate(v)}`);
              if (mode === 'waiting' && v) void act(() => api().updateTask(t.id, { status: 'waiting', waitingOn: v, waitingSince: today, nextActionDate: null }), `Waiting on ${v}`);
              if (mode === 'skip') void act(() => api().skipTask(t.id, v), 'Skipped for today');
            }}
          >
            {mode === 'note' && <textarea autoFocus rows={3} aria-label="Progress note" value={input} onChange={(e) => setInput(e.target.value)} placeholder="What did you do / learn?" />}
            {mode === 'defer' && (
              <>
                <input autoFocus type="date" aria-label="Defer until" min={addDays(today, 1)} value={input} onChange={(e) => setInput(e.target.value)} />
                <span className="quick-dates">
                  {[1, 3, 7].map((n) => (
                    <button type="button" key={n} className="btn btn-small" onClick={() => setInput(addDays(today, n))}>+{n}d</button>
                  ))}
                </span>
              </>
            )}
            {mode === 'waiting' && <input autoFocus aria-label="Waiting on whom" list="people" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Who are you waiting on?" />}
            {mode === 'skip' && <input autoFocus aria-label="Reason for skipping" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Why skip? (optional)" />}
            <button className="btn btn-primary" type="submit">Save</button>
            <button className="btn" type="button" onClick={() => setMode(null)}>Cancel</button>
          </form>
        )}

        <div className="focus-actions">
          {t.status !== 'in_progress' && entry.kind === 'do' && (
            <button className="btn" onClick={() => act(() => api().updateTask(t.id, { status: 'in_progress' }), 'Started')}>Start</button>
          )}
          {entry.kind === 'follow_up' ? (
            <button className="btn btn-primary" onClick={() => act(() => api().logFollowUpSent(t.id), 'Follow-up logged')}>I sent the follow-up</button>
          ) : (
            <button className="btn btn-primary" onClick={() => act(() => api().updateTask(t.id, { status: 'done' }), 'Completed')}>Complete</button>
          )}
          <button className="btn" onClick={() => setMode('note')}>Add note</button>
          <button className="btn" onClick={() => { setMode('defer'); setInput(addDays(today, 1)); }}>Defer…</button>
          <button className="btn" onClick={() => { setMode('waiting'); setInput(t.waitingOn); }}>Waiting on…</button>
          <button className="btn" onClick={() => setMode('skip')}>Skip…</button>
          {t.sourceId && (
            <button className="btn" onClick={async () => { const s = await run(() => api().getSource(t.sourceId!)); if (s) setSource(s); }}>
              Open source
            </button>
          )}
          {t.sourceLink && <button className="btn" onClick={() => run(() => api().openExternal(t.sourceLink))}>Open link</button>}
        </div>
        <div className="focus-nav">
          <button className="btn btn-small" disabled={index === 0} onClick={() => move(-1)} aria-label="Move earlier in the queue">↑ Earlier</button>
          <button className="btn btn-small" disabled={index === queue.length - 1} onClick={() => move(1)} aria-label="Move later in the queue">↓ Later</button>
          <span className="grow" />
          <button className="btn btn-small" disabled={index === 0} onClick={() => setCurrentId(queue[index - 1].task.id)}>‹ Previous</button>
          <span className="hint">{index + 1} / {queue.length}</span>
          <button className="btn btn-small" disabled={index === queue.length - 1} onClick={() => setCurrentId(queue[index + 1].task.id)}>Next ›</button>
          <button className="btn btn-small" onClick={() => { select(t.id); close(); }}>Open details</button>
        </div>
      </div>
      {source && <SourceViewer source={source} onClose={() => setSource(null)} />}
    </Modal>
  );
}
