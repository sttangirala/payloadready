import { useState } from 'react';
import { formatTimestamp } from '../../shared/dates';
import type { Source } from '../../shared/types';
import { api } from '../api';
import { useSnap } from '../store';
import { ProposalCard } from '../components/ProposalCard';
import { SourceViewer } from '../components/SourceViewer';
import { EmptyState, Section, TaskRow } from '../components/ui';

export function InboxView() {
  const { snap, run, openCapture } = useSnap();
  const [source, setSource] = useState<Source | null>(null);
  const inboxTasks = snap.tasks.filter((t) => t.status === 'inbox');
  const intake = snap.proposals.filter((p) => p.origin === 'intake');
  const assistant = snap.proposals.filter((p) => p.origin === 'assistant');
  const batches = snap.batches.filter((b) => intake.some((p) => p.batchId === b.id));
  const recentNotices = snap.batches.filter((b) => b.status === 'reviewed' && b.notice && Date.now() - new Date(b.createdAt).getTime() < 10 * 60_000);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Inbox</h1>
          <p className="sub">Incoming items awaiting triage. Suggestions are only added when you confirm them.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => openCapture('email')}>Paste email</button>
          <button className="btn" onClick={() => openCapture('meeting')}>Paste notes</button>
          <button className="btn btn-primary" onClick={() => openCapture('quick')}>Quick task</button>
        </div>
      </header>

      {recentNotices.map((b) => <p key={b.id} className="notice">{b.notice}</p>)}

      {!inboxTasks.length && !intake.length && !assistant.length && (
        <EmptyState title="Inbox zero.">
          <p>Paste an email, meeting notes, or a list of responsibilities to get task suggestions.</p>
        </EmptyState>
      )}

      {batches.map((b) => {
        const src = snap.sources.find((s) => s.id === b.sourceId);
        const items = intake.filter((p) => p.batchId === b.id);
        return (
          <Section
            key={b.id}
            id={`batch-${b.id}`}
            title={`Suggestions from “${src?.title ?? 'pasted text'}”`}
            count={items.length}
            action={
              <span className="row">
                <span className="hint">{b.engine === 'ai' ? 'AI' : 'Offline parser'} · {formatTimestamp(b.createdAt, snap.settings.timezone)}</span>
                <button className="link-btn" onClick={async () => { const s = await run(() => api().getSource(b.sourceId)); if (s) setSource(s); }}>View original</button>
                <button className="link-btn" onClick={() => run(async () => { for (const p of items) await api().rejectProposal(p.id); }, 'Suggestions dismissed')}>Dismiss all</button>
              </span>
            }
          >
            {b.notice && <p className="notice">{b.notice}</p>}
            <div className="proposal-list">{items.map((p) => <ProposalCard key={p.id} p={p} />)}</div>
          </Section>
        );
      })}

      {assistant.length > 0 && (
        <Section title="Assistant proposals" count={assistant.length} id="assistant-proposals">
          <div className="proposal-list">{assistant.map((p) => <ProposalCard key={p.id} p={p} />)}</div>
        </Section>
      )}

      {inboxTasks.length > 0 && (
        <Section title="Captured tasks to triage" count={inboxTasks.length} id="inbox-tasks">
          <ul className="task-list">
            {inboxTasks.map((t) => (
              <TaskRow key={t.id} task={t}>
                <button className="btn btn-small" onClick={() => run(() => api().updateTask(t.id, { status: 'ready' }))}>Ready</button>
                <button className="btn btn-small" onClick={() => run(() => api().updateTask(t.id, { status: 'closed' }))}>No action</button>
              </TaskRow>
            ))}
          </ul>
        </Section>
      )}
      {source && <SourceViewer source={source} onClose={() => setSource(null)} />}
    </div>
  );
}
