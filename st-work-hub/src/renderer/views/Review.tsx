import { useEffect, useState } from 'react';
import type { DailyReview } from '../../shared/ipc';
import { formatDate } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';
import { Section, SpinnerText, TaskRow } from '../components/ui';

export function ReviewView() {
  const { snap, taskById } = useSnap();
  const [review, setReview] = useState<DailyReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api().dailyReview().then(setReview).catch((e) => setError(e.message));
  }, [snap]);
  if (error) return <div className="view"><p className="notice notice-error">{error}</p></div>;
  if (!review) return <div className="view"><SpinnerText>Preparing your review…</SpinnerText></div>;
  const rows = (ids: string[], extra?: (id: string) => string | undefined) => {
    const ts = ids.map((id) => taskById(id)).filter((t): t is NonNullable<typeof t> => !!t);
    return ts.length ? <ul className="task-list">{ts.map((t) => <TaskRow key={t.id} task={t} extra={extra?.(t.id)} />)}</ul> : <p className="muted">None.</p>;
  };
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Daily review</h1>
          <p className="sub">{formatDate(review.today)} — wrap up today and line up tomorrow.</p>
        </div>
      </header>
      <div className="review-grid">
        <Section title="Completed today" count={review.completed.length} id="rv-done">{rows(review.completed)}</Section>
        <Section title="Newly blocked or waiting" count={review.newlyBlocked.length} id="rv-blocked">{rows(review.newlyBlocked)}</Section>
        <Section title="Unfinished (still actionable)" count={review.unfinished.length} id="rv-unfinished">{rows(review.unfinished)}</Section>
        <Section title="Tomorrow’s suggested priorities" count={review.tomorrow.length} id="rv-tomorrow">
          {rows(review.tomorrow.map((x) => x.taskId), (id) => review.tomorrow.find((x) => x.taskId === id)?.reasons[0])}
        </Section>
      </div>
    </div>
  );
}
