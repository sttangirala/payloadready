// Review card for a pending suggestion (from intake or the assistant). Nothing is changed until the
// user presses an apply button; the user can edit fields first.

import { useState } from 'react';
import type { Proposal, Task, TaskPatch } from '../../shared/types';
import { IMPORTANCE_LABEL, STATUS_LABEL } from '../../shared/types';
import { formatDate } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';

const EDITABLE: { key: keyof TaskPatch; label: string; type: 'text' | 'date' | 'status' | 'category' | 'number' }[] = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'owner', label: 'Owner', type: 'text' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'categoryId', label: 'Category', type: 'category' },
  { key: 'dueDate', label: 'Due date', type: 'date' },
  { key: 'nextActionDate', label: 'Next-action date', type: 'date' },
  { key: 'waitingOn', label: 'Waiting on', type: 'text' },
  { key: 'nextAction', label: 'Next action', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'contact', label: 'Contact', type: 'text' },
  { key: 'effortMinutes', label: 'Effort (min)', type: 'number' },
];

export function ProposalCard({ p }: { p: Proposal }) {
  if (p.kind === 'update') return <UpdateProposal p={p} />;
  if (p.kind === 'draft') return <DraftProposal p={p} />;
  return <CreateProposal p={p} />;
}

function Provenance({ p, k }: { p: Proposal; k: string }) {
  const prov = p.provenance[k];
  if (!prov) return null;
  return (
    <span className={`prov prov-${prov.basis}`} title={prov.evidence ? `“${prov.evidence}”` : undefined}>
      {prov.basis === 'explicit' ? 'stated' : 'inferred'}
    </span>
  );
}

function CreateProposal({ p }: { p: Proposal }) {
  const { run, select } = useSnap();
  const [f, setF] = useState<TaskPatch>(p.fields);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof TaskPatch, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const apply = async (opts?: { mergeIntoTaskId?: string }) => {
    setBusy(true);
    const t = await run(() => api().applyProposal(p.id, f, opts), opts?.mergeIntoTaskId ? 'Merged into existing task' : 'Task added');
    setBusy(false);
    if (t) select(t.id);
  };
  return (
    <article className="proposal" aria-label={`Suggestion: ${f.title}`}>
      <header className="proposal-head">
        <span className="badge">{p.engine === 'ai' ? 'AI suggestion' : 'Parser suggestion'}</span>
        <span className="hint">{p.rationale}</span>
      </header>
      <div className="proposal-grid">
        {EDITABLE.map(({ key, label, type }) => (
          <label key={key} className="field compact">
            <span className="label">
              {label} <Provenance p={p} k={key} />
            </span>
            <EditInput type={type} value={(f as Record<string, unknown>)[key]} onChange={(v) => set(key, v)} />
          </label>
        ))}
      </div>
      {p.provenance.title?.evidence && (
        <blockquote className="evidence" title="Quote from the source">
          “{p.provenance.title.evidence}”
        </blockquote>
      )}
      {p.flags.length > 0 && (
        <ul className="flags">
          {p.flags.map((fl) => (
            <li key={fl} className="flag">⚑ {fl}</li>
          ))}
        </ul>
      )}
      {p.duplicates.length > 0 && (
        <div className="dups" role="alert">
          <strong>Possible duplicate{p.duplicates.length > 1 ? 's' : ''}:</strong>
          <ul>
            {p.duplicates.map((d) => (
              <li key={d.taskId}>
                <button className="link-btn" onClick={() => select(d.taskId)}>{d.title}</button> <span className="hint">({d.reason})</span>{' '}
                <button className="btn btn-small" disabled={busy} onClick={() => apply({ mergeIntoTaskId: d.taskId })}>
                  Merge into this
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <footer className="proposal-actions">
        <button className="btn" disabled={busy} onClick={() => run(() => api().rejectProposal(p.id))}>Skip</button>
        <button className="btn btn-primary" disabled={busy || !String(f.title ?? '').trim()} onClick={() => apply()}>
          {p.duplicates.length ? 'Create anyway' : 'Add task'}
        </button>
      </footer>
    </article>
  );
}

function EditInput({ type, value, onChange }: { type: string; value: unknown; onChange: (v: unknown) => void }) {
  const { snap } = useSnap();
  if (type === 'status')
    return (
      <select value={String(value ?? 'ready')} onChange={(e) => onChange(e.target.value)}>
        {(['ready', 'waiting', 'scheduled', 'in_progress', 'inbox'] as const).map((s) => (
          <option key={s} value={s}>{s === 'inbox' ? 'Ready (default)' : STATUS_LABEL[s]}</option>
        ))}
      </select>
    );
  if (type === 'category')
    return (
      <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— Choose —</option>
        {snap.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    );
  if (type === 'date') return <input type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} />;
  if (type === 'number') return <input type="number" min={0} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
  return <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="(not stated)" />;
}

function fmt(k: string, v: unknown, snap: ReturnType<typeof useSnap>['snap']): string {
  if (v === null || v === undefined || v === '') return '(blank)';
  if (k === 'status') return STATUS_LABEL[v as Task['status']] ?? String(v);
  if (k === 'importance') return IMPORTANCE_LABEL[v as Task['importance']] ?? String(v);
  if (k === 'categoryId') return snap.categories.find((c) => c.id === v)?.name ?? '(none)';
  if (/Date$/.test(k)) return formatDate(String(v));
  return String(v);
}

function UpdateProposal({ p }: { p: Proposal }) {
  const { snap, run, taskById, select } = useSnap();
  const task = taskById(p.taskId);
  const keys = Object.keys(p.fields) as (keyof TaskPatch)[];
  const [accepted, setAccepted] = useState<Set<string>>(new Set(keys));
  const [conflict, setConflict] = useState<string | null>(null);
  if (!task) return null;
  const changed = task.updatedAt !== p.baseUpdatedAt;
  const apply = async (confirmCurrent: boolean) => {
    const overrides: Record<string, unknown> = {};
    for (const k of keys) overrides[k] = accepted.has(k) ? (p.fields as Record<string, unknown>)[k] : (task as unknown as Record<string, unknown>)[k];
    try {
      await api().applyProposal(p.id, overrides as TaskPatch, { confirmCurrent });
      setConflict(null);
    } catch (e) {
      if ((e as Error).name === 'ConflictError') setConflict((e as Error).message);
      else await run(() => Promise.reject(e));
    }
  };
  return (
    <article className="proposal" aria-label={`Proposed change to ${task.title}`}>
      <header className="proposal-head">
        <span className="badge">{p.engine === 'ai' ? 'AI proposal' : 'Proposal'}</span>
        <button className="link-btn" onClick={() => select(task.id)}>{task.title}</button>
      </header>
      <p className="hint">{p.rationale}</p>
      <table className="diff">
        <thead>
          <tr><th scope="col">Apply</th><th scope="col">Field</th><th scope="col">Current</th><th scope="col">Proposed</th></tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Apply ${k}`}
                  checked={accepted.has(k)}
                  onChange={() => setAccepted((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                />
              </td>
              <td>{k}</td>
              <td>{fmt(k, (task as unknown as Record<string, unknown>)[k], snap)}</td>
              <td><strong>{fmt(k, (p.fields as Record<string, unknown>)[k], snap)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.flags.map((fl) => <p key={fl} className="flag">⚑ {fl}</p>)}
      {(changed || conflict) && (
        <p className="flag" role="alert">⚠ {conflict ?? 'This task was edited after the proposal was made. The “Current” column shows its latest values.'}</p>
      )}
      <footer className="proposal-actions">
        <button className="btn" onClick={() => run(() => api().rejectProposal(p.id))}>Dismiss</button>
        <button className="btn btn-primary" disabled={!accepted.size} onClick={() => apply(changed || !!conflict)}>
          {changed || conflict ? 'Apply against current values' : 'Apply selected changes'}
        </button>
      </footer>
    </article>
  );
}

function DraftProposal({ p }: { p: Proposal }) {
  const { run, taskById, select, toast } = useSnap();
  const task = taskById(p.taskId);
  const [text, setText] = useState(p.draftText);
  return (
    <article className="proposal" aria-label="Follow-up draft">
      <header className="proposal-head">
        <span className="badge">Draft — not sent</span>
        {task && <button className="link-btn" onClick={() => select(task.id)}>{task.title}</button>}
      </header>
      <p className="hint">{p.rationale}</p>
      <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} aria-label="Draft text" />
      <footer className="proposal-actions">
        <button className="btn" onClick={() => run(() => api().rejectProposal(p.id))}>Dismiss</button>
        <button
          className="btn"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast('Draft copied. Paste it into Outlook to send.', 'success');
          }}
        >
          Copy draft
        </button>
        {task && task.status === 'waiting' && (
          <button
            className="btn btn-primary"
            onClick={async () => {
              await run(() => api().logFollowUpSent(task.id, `Follow-up sent:\n${text}`), 'Logged as sent');
              await run(() => api().applyProposal(p.id));
            }}
          >
            I sent it — log follow-up
          </button>
        )}
      </footer>
    </article>
  );
}
