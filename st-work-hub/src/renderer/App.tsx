import { useEffect, useMemo } from 'react';
import { useData, View } from './store';
import { Icon, SpinnerText } from './components/ui';
import { TaskPanel } from './components/TaskPanel';
import { CaptureDialog } from './components/CaptureDialog';
import { FocusMode } from './components/FocusMode';
import { TodayView } from './views/Today';
import { InboxView } from './views/Inbox';
import { BoardView } from './views/Board';
import { CompletedView, FollowUpsView, ListView, WaitingView } from './views/TaskViews';
import { ProjectsView } from './views/Projects';
import { AssistantView } from './views/Assistant';
import { ReviewView } from './views/Review';
import { NotificationsView } from './views/Notifications';
import { ContactsView } from './views/Contacts';
import { SettingsView } from './views/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';

const NAV: { view: View; label: string; key: string }[] = [
  { view: 'today', label: 'Today', key: '1' },
  { view: 'inbox', label: 'Inbox', key: '2' },
  { view: 'board', label: 'Board', key: '3' },
  { view: 'list', label: 'List', key: '4' },
  { view: 'waiting', label: 'Waiting', key: '5' },
  { view: 'followups', label: 'Follow-ups', key: '6' },
  { view: 'projects', label: 'Projects', key: '7' },
  { view: 'completed', label: 'Completed', key: '8' },
];
const NAV2: { view: View; label: string }[] = [
  { view: 'assistant', label: 'Assistant' },
  { view: 'review', label: 'Daily review' },
  { view: 'notifications', label: 'Notifications' },
  { view: 'contacts', label: 'Contacts' },
  { view: 'settings', label: 'Settings' },
];

export function App() {
  const d = useData();
  const { snap, loading, loadError, view, setView, selectedId, focusOpen, setFocusOpen, capture, openCapture, online, toasts, queue } = d;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.modal')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'c') {
        e.preventDefault();
        openCapture('quick');
      } else if (e.key === 'f') {
        e.preventDefault();
        setFocusOpen(true);
      } else {
        const nav = NAV.find((n) => n.key === e.key);
        if (nav) setView(nav.view);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openCapture, setFocusOpen, setView]);

  const counts = useMemo(() => {
    if (!snap) return {} as Record<string, number>;
    return {
      today: queue.length,
      inbox: snap.tasks.filter((t) => t.status === 'inbox').length + snap.proposals.length,
      waiting: snap.tasks.filter((t) => t.status === 'waiting').length,
      followups: queue.filter((e) => e.kind === 'follow_up').length,
      notifications: snap.notifications.filter((n) => !n.readAt && (!n.snoozedUntil || n.snoozedUntil <= new Date().toISOString())).length,
    } as Record<string, number>;
  }, [snap, queue]);

  if (loading) {
    return (
      <div className="center-screen">
        <SpinnerText>Opening ST Work Hub…</SpinnerText>
      </div>
    );
  }
  if (loadError || !snap) {
    return (
      <div className="center-screen">
        <div className="notice notice-error">
          <strong>ST Work Hub couldn’t load your data.</strong>
          <p>{loadError}</p>
          <button className="btn" onClick={() => void d.refresh()}>Try again</button>
        </div>
      </div>
    );
  }

  const people = [...new Set([snap.settings.myName, ...snap.contacts.map((c) => c.name), ...snap.tasks.flatMap((t) => [t.owner, t.waitingOn])].filter((x) => x && x.trim()))].sort();
  const companies = [...new Set([...snap.contacts.map((c) => c.company), ...snap.tasks.map((t) => t.company)].filter(Boolean))].sort();
  const demo = snap.tasks.some((t) => t.isDemo);

  return (
    <div className={`app ${selectedId ? 'has-panel' : ''}`}>
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">ST</span>
          <span>Work Hub</span>
        </div>
        <button className="btn btn-primary capture-btn" onClick={() => openCapture('quick')} title="Capture (N)">
          <Icon name="plus" size={16} /> Capture
        </button>
        <ul className="nav">
          {NAV.map((n) => (
            <li key={n.view}>
              <button className={`nav-item ${view === n.view ? 'is-active' : ''}`} aria-current={view === n.view ? 'page' : undefined} onClick={() => setView(n.view)} title={`${n.label} (${n.key})`}>
                <Icon name={n.view} />
                <span>{n.label}</span>
                {counts[n.view] ? <span className="nav-count">{counts[n.view]}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <ul className="nav nav-secondary">
          {NAV2.map((n) => (
            <li key={n.view}>
              <button className={`nav-item ${view === n.view ? 'is-active' : ''}`} aria-current={view === n.view ? 'page' : undefined} onClick={() => setView(n.view)}>
                <Icon name={n.view} />
                <span>{n.label}</span>
                {counts[n.view] ? <span className="nav-count">{counts[n.view]}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-foot">
          <span className={`dot ${online ? 'dot-ok' : 'dot-off'}`} aria-hidden="true" />
          {online ? 'Online' : 'Offline — AI unavailable'}
        </div>
      </nav>

      <main className="main" id="main">
        {demo && (
          <div className="banner" role="note">
            Demo data is loaded (items marked “Demo”).{' '}
            <button className="link-btn" onClick={() => setView('settings')}>Remove it in Settings</button>
          </div>
        )}
        {!online && <div className="banner banner-warn" role="status">You’re offline. Everything works except AI features.</div>}
        <ErrorBoundary resetKey={view}>
        {view === 'today' && <TodayView />}
        {view === 'inbox' && <InboxView />}
        {view === 'board' && <BoardView />}
        {view === 'list' && <ListView />}
        {view === 'waiting' && <WaitingView />}
        {view === 'followups' && <FollowUpsView />}
        {view === 'projects' && <ProjectsView />}
        {view === 'completed' && <CompletedView />}
        {view === 'assistant' && <AssistantView />}
        {view === 'review' && <ReviewView />}
        {view === 'notifications' && <NotificationsView />}
        {view === 'contacts' && <ContactsView />}
        {view === 'settings' && <SettingsView />}
        </ErrorBoundary>
      </main>

      <ErrorBoundary resetKey={selectedId ?? ''}>
        <TaskPanel />
      </ErrorBoundary>
      {capture.open && <CaptureDialog />}
      {focusOpen && <FocusMode />}

      <datalist id="people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      <datalist id="companies">{companies.map((c) => <option key={c} value={c} />)}</datalist>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
