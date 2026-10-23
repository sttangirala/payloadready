import { useMemo } from 'react';
import { classifyTask, overdueTasks } from '../../shared/queue';
import { followUpInfo } from '../../shared/followup';
import { formatDate } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';
import { EmptyState, Icon, Section, TaskMeta, TaskRow } from '../components/ui';

export function TodayView() {
  const { snap, queue, queueCtx, setFocusOpen, setView, run, select } = useSnap();
  const today = snap.meta.today;
  const limit = snap.settings.todayLimit;
  const work = queue.filter((e) => e.kind !== 'follow_up');
  const followUps = queue.filter((e) => e.kind === 'follow_up');
  const overdue = overdueTasks(queueCtx);
  const waiting = snap.tasks.filter((t) => t.status === 'waiting' && classifyTask(t, queueCtx).excluded === 'waiting');
  const inboxCount = snap.tasks.filter((t) => t.status === 'inbox').length + snap.proposals.filter((p) => p.origin === 'intake').length;
  const next = queue[0];
  const manual = queue.some((e) => e.task.manualRank != null);

  const hidden = useMemo(
    () =>
      snap.tasks
        .map((t) => ({ t, c: classifyTask(t, queueCtx) }))
        .filter(({ c }) => c.excluded && ['deferred', 'scheduled_later', 'owned_by_other', 'closed_contact', 'blocked_dependency', 'skipped_today'].includes(c.excluded)),
    [snap.tasks, queueCtx],
  );

  const move = (id: string, delta: number) => {
    const ids = queue.map((e) => e.task.id);
    const i = ids.indexOf(id);
    const j = Math.max(0, Math.min(ids.length - 1, i + delta));
    ids.splice(i, 1);
    ids.splice(j, 0, id);
    void run(() => api().setManualOrder(ids));
  };

  const longDate = new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Today</h1>
          <p className="sub">{longDate} · {snap.meta.timezone}</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setFocusOpen(true)} disabled={!queue.length}>
          <Icon name="play" size={16} /> Work on Next Task
        </button>
      </header>

      {next ? (
        <section className="next-card" aria-label="Next recommended task">
          <span className="label">Next recommended</span>
          <button className="next-title" onClick={() => select(next.task.id)}>{next.task.title}</button>
          <TaskMeta task={next.task} />
          <p className="why">
            <strong>Why it matters:</strong> {next.reasons.join(' ')}
          </p>
          {(next.task.nextAction || next.task.coordinationStep) && (
            <p className="next-action">→ {next.kind === 'coordinate' ? next.task.coordinationStep : next.task.nextAction || next.task.coordinationStep}</p>
          )}
        </section>
      ) : (
        <EmptyState title="Nothing needs your attention right now.">
          <p>Capture new work with the + button, or check what you are waiting on.</p>
        </EmptyState>
      )}

      <div className="today-grid">
        <Section
          title="Your queue"
          count={work.length}
          id="today-queue"
          action={manual ? <button className="link-btn" onClick={() => run(() => api().setManualOrder([]), 'Back to automatic order')}>Reset to automatic order</button> : undefined}
        >
          {work.length ? (
            <ol className="task-list">
              {work.slice(0, limit).map((e) => (
                <TaskRow key={e.task.id} task={e.task} extra={e.reasons[0]}>
                  <button className="icon-btn" aria-label={`Move ${e.task.title} up`} onClick={() => move(e.task.id, -1)}><Icon name="up" size={14} /></button>
                  <button className="icon-btn" aria-label={`Move ${e.task.title} down`} onClick={() => move(e.task.id, 1)}><Icon name="down" size={14} /></button>
                </TaskRow>
              ))}
            </ol>
          ) : (
            <p className="muted">No tasks to do right now.</p>
          )}
          {work.length > limit && <p className="hint">+{work.length - limit} more in the queue (see List view or Focus mode).</p>}
        </Section>

        <div className="today-side">
          <Section title="Follow-ups due now" count={followUps.length} id="today-fu">
            {followUps.length ? (
              <ul className="task-list">
                {followUps.map((e) => <TaskRow key={e.task.id} task={e.task} extra={e.followUp?.basis} />)}
              </ul>
            ) : (
              <p className="muted">No follow-ups due.</p>
            )}
          </Section>

          {overdue.length > 0 && (
            <Section title="Overdue deadlines" count={overdue.length} id="today-overdue">
              <ul className="task-list">
                {overdue.map((t) => <TaskRow key={t.id} task={t} />)}
              </ul>
            </Section>
          )}

          <Section title="Waiting on others" count={waiting.length} id="today-waiting" action={<button className="link-btn" onClick={() => setView('waiting')}>View all</button>}>
            {waiting.length ? (
              <ul className="task-list compact">
                {waiting.slice(0, 5).map((t) => {
                  const fu = followUpInfo(t, snap.settings, snap.categories, snap.contacts, today);
                  return <TaskRow key={t.id} task={t} extra={fu.date ? `Follow up ${formatDate(fu.date, today)}` : undefined} />;
                })}
              </ul>
            ) : (
              <p className="muted">Nothing waiting.</p>
            )}
          </Section>

          <Section title="New incoming" count={inboxCount} id="today-inbox" action={<button className="link-btn" onClick={() => setView('inbox')}>Review inbox</button>}>
            <p className="muted">{inboxCount ? `${inboxCount} item${inboxCount === 1 ? '' : 's'} need${inboxCount === 1 ? 's' : ''} triage.` : 'Inbox is clear.'}</p>
          </Section>
        </div>
      </div>

      {hidden.length > 0 && (
        <details className="hidden-list">
          <summary>Not in today’s queue ({hidden.length}) — deferred, owned by others, or suppressed</summary>
          <ul className="task-list compact">
            {hidden.map(({ t, c }) => <TaskRow key={t.id} task={t} extra={c.explanation} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
