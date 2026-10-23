// Renderer state: one snapshot of all data, refreshed whenever the main process reports a change,
// so every view always reflects the same saved state.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSnapshot, SourceKind, Task } from '../shared/types';
import { buildQueue, QueueContext, QueueEntry } from '../shared/queue';
import { api, bridge } from './api';

export type View =
  | 'today' | 'inbox' | 'board' | 'list' | 'waiting' | 'followups' | 'projects' | 'completed'
  | 'assistant' | 'review' | 'notifications' | 'contacts' | 'settings';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

interface Ctx {
  snap: AppSnapshot | null;
  loading: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  queueCtx: QueueContext | null;
  queue: QueueEntry[];
  taskById: (id: string | null | undefined) => Task | undefined;
  view: View;
  setView: (v: View) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  focusOpen: boolean;
  setFocusOpen: (b: boolean) => void;
  capture: { open: boolean; kind: SourceKind };
  openCapture: (kind?: SourceKind) => void;
  closeCapture: () => void;
  online: boolean;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  /** Run an API call; show errors as toasts. Returns undefined on failure. */
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;
}

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [capture, setCapture] = useState<{ open: boolean; kind: SourceKind }>({ open: false, kind: 'quick' });
  const [online, setOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const s = await api().snapshot();
      setSnap(s);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 3500);
  }, []);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string) => {
      try {
        const out = await fn();
        if (success) toast(success, 'success');
        return out;
      } catch (e) {
        toast((e as Error).message || 'Something went wrong.', 'error');
        return undefined;
      }
    },
    [toast],
  );

  useEffect(() => {
    let b;
    try {
      b = bridge();
    } catch (e) {
      setLoadError((e as Error).message);
      setLoading(false);
      return;
    }
    void refresh();
    const offs = [
      b.on('changed', () => void refresh()),
      b.on('quick-capture', () => setCapture({ open: true, kind: 'quick' })),
      b.on('open-task', (id) => {
        if (typeof id === 'string') setSelectedId(id);
      }),
    ];
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    // Pick up day rollover even if nothing else changes.
    const timer = setInterval(() => void refresh(), 5 * 60_000);
    return () => {
      offs.forEach((f) => f());
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(timer);
    };
  }, [refresh]);

  // Theme
  useEffect(() => {
    const theme = snap?.settings.theme ?? 'system';
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [snap?.settings.theme]);

  const queueCtx = useMemo<QueueContext | null>(
    () => (snap ? { today: snap.meta.today, settings: snap.settings, categories: snap.categories, contacts: snap.contacts, tasks: snap.tasks } : null),
    [snap],
  );
  const queue = useMemo(() => (queueCtx ? buildQueue(queueCtx) : []), [queueCtx]);
  const taskMap = useMemo(() => new Map((snap?.tasks ?? []).map((t) => [t.id, t])), [snap]);
  const taskById = useCallback((id: string | null | undefined) => (id ? taskMap.get(id) : undefined), [taskMap]);

  const value: Ctx = {
    snap,
    loading,
    loadError,
    refresh,
    queueCtx,
    queue,
    taskById,
    view,
    setView: (v) => setViewState(v),
    selectedId,
    select: setSelectedId,
    focusOpen,
    setFocusOpen,
    capture,
    openCapture: (kind = 'quick') => setCapture({ open: true, kind }),
    closeCapture: () => setCapture((c) => ({ ...c, open: false })),
    online,
    toasts,
    toast,
    run,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Ctx {
  const c = useContext(DataContext);
  if (!c) throw new Error('useData outside provider');
  return c;
}

/** Non-null snapshot accessor for views rendered after loading. */
export function useSnap() {
  const d = useData();
  return { ...d, snap: d.snap!, queueCtx: d.queueCtx! };
}
