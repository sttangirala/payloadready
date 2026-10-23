import { formatTimestamp } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';
import { EmptyState } from '../components/ui';

export function NotificationsView() {
  const { snap, run, select } = useSnap();
  const nowIso = new Date().toISOString();
  const active = snap.notifications.filter((n) => !n.snoozedUntil || n.snoozedUntil <= nowIso);
  const snoozed = snap.notifications.filter((n) => n.snoozedUntil && n.snoozedUntil > nowIso);
  const untilTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(snap.settings.reminderHour, 0, 0, 0);
    return Math.max(5, Math.round((d.getTime() - Date.now()) / 60_000));
  };
  const item = (n: (typeof snap.notifications)[number], isSnoozed: boolean) => (
    <li key={n.id} className={`notif ${n.readAt ? 'is-read' : ''}`}>
      <div className="notif-main">
        <button
          className="link-btn strong"
          onClick={() => {
            if (n.taskId) select(n.taskId);
            void api().readNotification(n.id);
          }}
        >
          {n.title}
        </button>
        <p className="hint">{n.body}</p>
        <span className="note-time">
          {formatTimestamp(n.createdAt, snap.settings.timezone)}
          {isSnoozed && n.snoozedUntil && ` · snoozed until ${formatTimestamp(n.snoozedUntil, snap.settings.timezone)}`}
        </span>
      </div>
      <div className="row">
        <button className="btn btn-small" onClick={() => run(() => api().snoozeNotification(n.id, 60), 'Snoozed 1 hour')}>1h</button>
        <button className="btn btn-small" onClick={() => run(() => api().snoozeNotification(n.id, untilTomorrow()), 'Snoozed until tomorrow')}>Tomorrow</button>
        <button className="btn btn-small" onClick={() => run(() => api().dismissNotification(n.id))}>Dismiss</button>
        {n.taskId && (
          <button className="btn btn-small" title="Stop reminders for this task" onClick={() => run(() => api().disableTaskReminders(n.taskId!), 'Reminders off for this task')}>
            Mute task
          </button>
        )}
      </div>
    </li>
  );
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Notifications</h1>
          <p className="sub">
            Each reminder fires once per item and date; changing a date or logging a follow-up resets it. Desktop reminders:{' '}
            {snap.settings.desktopNotifications ? `on, after ${snap.settings.reminderHour}:00` : 'off'}.
          </p>
        </div>
        {active.length > 0 && <button className="btn" onClick={() => run(async () => { for (const n of active) await api().dismissNotification(n.id); })}>Dismiss all</button>}
      </header>
      {!snap.notifications.length && <EmptyState title="No notifications." />}
      {active.length > 0 && <ul className="notif-list">{active.map((n) => item(n, false))}</ul>}
      {snoozed.length > 0 && (
        <>
          <h3 className="sub-head">Snoozed</h3>
          <ul className="notif-list">{snoozed.map((n) => item(n, true))}</ul>
        </>
      )}
    </div>
  );
}
