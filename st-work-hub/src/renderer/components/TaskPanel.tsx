// Task details panel. Manual edits save directly (text fields on blur, selects on change).

import { useEffect, useState } from 'react';
import type { Activity, Source, Task, TaskPatch } from '../../shared/types';
import { IMPORTANCES, IMPORTANCE_LABEL, STATUSES, STATUS_LABEL, URGENCIES, URGENCY_LABEL, isOpen } from '../../shared/types';
import { classifyTask } from '../../shared/queue';
import { followUpInfo, isMe } from '../../shared/followup';
import { formatDate, formatTimestamp } from '../../shared/dates';
import { newId } from '../../shared/task';
import { api } from '../api';
import { useSnap } from '../store';
import { Icon, Modal } from './ui';
import { SourceViewer } from './SourceViewer';

export function TaskPanel() {
  const { snap, selectedId, select, taskById } = useSnap();
  const task = taskById(selectedId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.modal')) select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);
  if (!selectedId) return null;
  if (!task) {
    return (
      <aside className="panel" aria-label="Task details">
        <div className="panel-head">
          <p>This task no longer exists.</p>
          <button className="icon-btn" aria-label="Close details" onClick={() => select(null)}>
            <Icon name="x" />
          </button>
        </div>
      </aside>
    );
  }
  return <TaskEditor key={task.id} task={task} today={snap.meta.today} />;
}

function TaskEditor({ task, today }: { task: Task; today: string }) {
  const { snap, queueCtx, select, run } = useSnap();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [note, setNote] = useState('');
  const [check, setCheck] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let live = true;
    api().activity(task.id).then((a) => live && setActivity(a)).catch(() => {});
    return () => {
      live = false;
    };
  }, [task.id, task.updatedAt]);

  const save = (patch: TaskPatch) => run(() => api().updateTask(task.id, patch));
  const inferred = (k: string) => task.inferredFields.includes(k);
  const mine = !task.owner.trim() || isMe(task.owner, snap.settings);
  const classification = classifyTask(task, queueCtx);
  const fu = task.status === 'waiting' ? followUpInfo(task, snap.settings, snap.categories, snap.contacts, today) : null;
  const otherTasks = snap.tasks.filter((t) => t.id !== task.id && isOpen(t.status));

  const openSource = async () => {
    if (!task.sourceId) return;
    const s = await run(() => api().getSource(task.sourceId!));
    if (s) {
      setSource(s);
      setShowSource(true);
    }
  };

  return (
    <aside className="panel" aria-label="Task details">
      <div className="panel-head">
        <span className="panel-kicker">{task.isDemo ? 'Demo task' : 'Task'}</span>
        <button className="icon-btn" aria-label="Close details" onClick={() => select(null)}>
          <Icon name="x" />
        </button>
      </div>
      <TextField label="Title" value={task.title} onSave={(v) => save({ title: v })} big />

      <div className="queue-why" role="note">
        {classification.entry ? (
          <>
            <strong>In today’s queue.</strong> {classification.entry.reasons.join(' ')}
          </>
        ) : (
          <>
            <strong>Not in today’s queue.</strong> {classification.explanation}
          </>
        )}
      </div>

      {task.reviewFlags.length > 0 && (
        <div className="flags" role="note" aria-label="Needs review">
          {task.reviewFlags.map((f) => (
            <div key={f} className="flag">
              <span>⚑ {f}</span>
              <button className="link-btn" onClick={() => save({ reviewFlags: task.reviewFlags.filter((x) => x !== f) })}>
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="quick-actions">
        {task.status !== 'in_progress' && isOpen(task.status) && <button className="btn" onClick={() => save({ status: 'in_progress' })}>Start</button>}
        {isOpen(task.status) && <button className="btn btn-primary" onClick={() => save({ status: 'done' })}>Complete</button>}
        {!isOpen(task.status) && <button className="btn" onClick={() => save({ status: 'ready' })}>Reopen</button>}
        {task.status === 'waiting' && (
          <button className="btn" onClick={() => run(() => api().logFollowUpSent(task.id), 'Follow-up logged. Next reminder after the interval.')}>
            Log follow-up sent
          </button>
        )}
        {task.sourceId && <button className="btn" onClick={openSource}>View source</button>}
        {task.sourceLink && <button className="btn" onClick={() => run(() => api().openExternal(task.sourceLink))}>Open link</button>}
      </div>

      <div className="grid2">
        <SelectField label="Status" value={task.status} options={STATUSES.map((s) => [s, STATUS_LABEL[s]])} onSave={(v) => save({ status: v as Task['status'] })} />
        <SelectField
          label="Category"
          inferred={inferred('categoryId')}
          value={task.categoryId ?? ''}
          options={[['', '— None —'], ...snap.categories.map((c) => [c.id, c.name] as [string, string])]}
          onSave={(v) => save({ categoryId: v || null })}
        />
        <SelectField label="Importance" value={task.importance} options={IMPORTANCES.map((s) => [s, IMPORTANCE_LABEL[s]])} onSave={(v) => save({ importance: v as Task['importance'] })} />
        <SelectField label="Urgency" value={task.urgency} options={URGENCIES.map((s) => [s, URGENCY_LABEL[s]])} onSave={(v) => save({ urgency: v as Task['urgency'] })} />
        <TextField label="Owner" inferred={inferred('owner')} value={task.owner} list="people" placeholder="Me, or a name" onSave={(v) => save({ owner: v })} />
        <NumberField label="Effort (minutes)" inferred={inferred('effortMinutes')} value={task.effortMinutes} onSave={(v) => save({ effortMinutes: v })} />
        <DateField label="Due date (real deadline only)" value={task.dueDate} onSave={(v) => save({ dueDate: v })} />
        <DateField label="Next-action / defer until" value={task.nextActionDate} onSave={(v) => save({ nextActionDate: v })} />
      </div>
      {!mine && (
        <TextField
          label={`Your coordination step (${task.owner} owns this)`}
          value={task.coordinationStep}
          placeholder="Leave blank if you have no action"
          onSave={(v) => save({ coordinationStep: v })}
        />
      )}
      <TextField label="Next concrete action" inferred={inferred('nextAction')} value={task.nextAction} onSave={(v) => save({ nextAction: v })} />

      {(task.status === 'waiting' || task.waitingOn) && (
        <fieldset className="box">
          <legend>Waiting</legend>
          <div className="grid2">
            <TextField label="Waiting on" value={task.waitingOn} list="people" onSave={(v) => save({ waitingOn: v })} />
            <DateField label="Waiting since" value={task.waitingSince} onSave={(v) => save({ waitingSince: v })} />
            <DateField label="Last follow-up sent" value={task.lastFollowUpDate} onSave={(v) => save({ lastFollowUpDate: v })} />
            <NumberField label="Follow-up interval (days, blank = default)" value={task.followUpIntervalDays} onSave={(v) => save({ followUpIntervalDays: v })} />
          </div>
          {fu && <p className="hint">Reminder basis: {fu.basis}</p>}
        </fieldset>
      )}

      <TextArea label="Description" value={task.description} onSave={(v) => save({ description: v })} />

      <div className="grid2">
        <TextField label="Company" inferred={inferred('company')} value={task.company} list="companies" onSave={(v) => save({ company: v })} />
        <TextField label="Contact" inferred={inferred('contact')} value={task.contact} list="people" onSave={(v) => save({ contact: v })} />
        <TextField label="Engagement" value={task.engagement} onSave={(v) => save({ engagement: v })} />
        <SelectField
          label="Project"
          value={task.projectId ?? ''}
          options={[['', '— None —'], ...snap.projects.map((p) => [p.id, p.name] as [string, string])]}
          onSave={(v) => save({ projectId: v || null })}
        />
      </div>

      <div className="checks">
        <label>
          <input type="checkbox" checked={task.isOutreach} onChange={(e) => save({ isOutreach: e.target.checked })} /> Involves outreach
        </label>
        <label>
          <input type="checkbox" checked={task.requiresCall} onChange={(e) => save({ requiresCall: e.target.checked })} /> Needs a call / meeting
        </label>
        <label>
          <input type="checkbox" checked={task.remindersEnabled} onChange={(e) => save({ remindersEnabled: e.target.checked })} /> Reminders on
        </label>
      </div>

      <TextArea label="Blockers" value={task.blockers} rows={2} onSave={(v) => save({ blockers: v })} />
      <div className="field">
        <span className="label">Depends on</span>
        <ul className="dep-list">
          {task.dependsOn.map((id) => {
            const d = snap.tasks.find((t) => t.id === id);
            return (
              <li key={id}>
                <span className={d && !isOpen(d.status) ? 'strike' : ''}>{d?.title ?? '(removed task)'}</span>
                <button className="link-btn" onClick={() => save({ dependsOn: task.dependsOn.filter((x) => x !== id) })}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <select
          aria-label="Add dependency"
          value=""
          onChange={(e) => e.target.value && save({ dependsOn: [...task.dependsOn, e.target.value] })}
        >
          <option value="">+ Add a task this depends on…</option>
          {otherTasks.filter((t) => !task.dependsOn.includes(t.id)).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <TextField label="Tags (comma separated)" value={task.tags.join(', ')} onSave={(v) => save({ tags: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
      <TextField label="Source link" value={task.sourceLink} placeholder="https://… (e.g. Outlook web link)" onSave={(v) => save({ sourceLink: v })} />

      <div className="field">
        <span className="label">Checklist</span>
        <ul className="checklist">
          {task.checklist.map((c) => (
            <li key={c.id}>
              <label>
                <input type="checkbox" checked={c.done} onChange={() => save({ checklist: task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} />
                <span className={c.done ? 'strike' : ''}>{c.text}</span>
              </label>
              <button className="link-btn" aria-label={`Remove ${c.text}`} onClick={() => save({ checklist: task.checklist.filter((x) => x.id !== c.id) })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!check.trim()) return;
            void save({ checklist: [...task.checklist, { id: newId('c'), text: check.trim(), done: false }] });
            setCheck('');
          }}
        >
          <input aria-label="New checklist item" placeholder="Add a step…" value={check} onChange={(e) => setCheck(e.target.value)} />
          <button className="btn" type="submit">Add</button>
        </form>
      </div>

      <div className="field">
        <span className="label">Notes</span>
        <ul className="notes">
          {task.notes.map((n) => (
            <li key={n.id}>
              <span className="note-time">{formatTimestamp(n.createdAt, snap.settings.timezone)}</span>
              <p className="pre">{n.body}</p>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            void run(() => api().addNote(task.id, note.trim()));
            setNote('');
          }}
        >
          <input aria-label="New note" placeholder="Add a progress note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" type="submit">Add</button>
        </form>
      </div>

      <details className="history">
        <summary>Activity history ({activity.length})</summary>
        <ul>
          {activity.map((a) => (
            <li key={a.id}>
              <span className="note-time">{formatTimestamp(a.createdAt, snap.settings.timezone)}</span> {a.summary}
            </li>
          ))}
        </ul>
      </details>
      <p className="hint">
        Created {formatTimestamp(task.createdAt, snap.settings.timezone)} · Updated {formatTimestamp(task.updatedAt, snap.settings.timezone)}
        {task.completedAt && ` · Completed ${formatDate(task.completedAt.slice(0, 10))}`}
      </p>
      <div className="danger-zone">
        <button className="btn btn-danger-quiet" onClick={() => setConfirmDelete(true)}>
          Delete task
        </button>
      </div>
      {confirmDelete && (
        <Modal
          title="Delete this task?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await run(() => api().deleteTask(task.id), 'Task deleted');
                  select(null);
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p>“{task.title}” and its notes will be permanently deleted. Consider “Closed / No Action” to keep the history instead.</p>
        </Modal>
      )}
      {showSource && source && <SourceViewer source={source} onClose={() => setShowSource(false)} />}
    </aside>
  );
}

// ---------- field components ----------

function InferredMark({ on }: { on?: boolean }) {
  return on ? <span className="inferred" title="Inferred by AI or the intake parser — verify">inferred</span> : null;
}

function TextField({ label, value, onSave, big, list, placeholder, inferred }: { label: string; value: string; onSave: (v: string) => void; big?: boolean; list?: string; placeholder?: string; inferred?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="field">
      <span className="label">
        {label} <InferredMark on={inferred} />
      </span>
      <input
        className={big ? 'input-big' : ''}
        value={v}
        list={list}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

function TextArea({ label, value, onSave, rows = 4 }: { label: string; value: string; onSave: (v: string) => void; rows?: number }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="field">
      <span className="label">{label}</span>
      <textarea rows={rows} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </label>
  );
}

function NumberField({ label, value, onSave, inferred }: { label: string; value: number | null; onSave: (v: number | null) => void; inferred?: boolean }) {
  const [v, setV] = useState(value == null ? '' : String(value));
  useEffect(() => setV(value == null ? '' : String(value)), [value]);
  return (
    <label className="field">
      <span className="label">
        {label} <InferredMark on={inferred} />
      </span>
      <input
        type="number"
        min={0}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = v.trim() === '' ? null : Math.max(0, Math.round(Number(v)));
          if (n !== value && (n === null || Number.isFinite(n))) onSave(n);
        }}
      />
    </label>
  );
}

function DateField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <span className="date-row">
        <input type="date" value={value ?? ''} onChange={(e) => onSave(e.target.value || null)} />
        {value && (
          <button className="link-btn" type="button" onClick={() => onSave(null)} aria-label={`Clear ${label}`}>
            Clear
          </button>
        )}
      </span>
    </label>
  );
}

function SelectField({ label, value, options, onSave, inferred }: { label: string; value: string; options: [string, string][]; onSave: (v: string) => void; inferred?: boolean }) {
  return (
    <label className="field">
      <span className="label">
        {label} <InferredMark on={inferred} />
      </span>
      <select value={value} onChange={(e) => onSave(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
