import { useState } from 'react';
import type { SourceKind } from '../../shared/types';
import { api } from '../api';
import { useSnap } from '../store';
import { Modal, SpinnerText } from './ui';

const TABS: { kind: SourceKind; label: string; hint: string }[] = [
  { kind: 'quick', label: 'Quick task', hint: 'Goes straight to the Inbox. No AI involved.' },
  { kind: 'email', label: 'Email / thread', hint: 'Paste a single email or a whole thread. Quoted history is treated as context.' },
  { kind: 'meeting', label: 'Meeting notes', hint: 'Paste notes or a transcript. Action items become suggestions.' },
  { kind: 'list', label: 'List of responsibilities', hint: 'One item per line or bullet.' },
];

export function CaptureDialog() {
  const { snap, capture, closeCapture, run, setView, online } = useSnap();
  const [kind, setKind] = useState<SourceKind>(capture.kind);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const aiPossible = snap.meta.aiKeyConfigured && snap.settings.aiEnabled && online;
  const [useAi, setUseAi] = useState(aiPossible);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (kind === 'quick') {
        const t = await run(() => api().quickCapture(text, notes), 'Added to Inbox');
        if (t) closeCapture();
      } else {
        const res = await run(() => api().intake({ kind, text, title, link, useAi: useAi && aiPossible }));
        if (res) {
          closeCapture();
          setView('inbox');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const tab = TABS.find((t) => t.kind === kind)!;
  return (
    <Modal
      title="Capture"
      onClose={closeCapture}
      wide={kind !== 'quick'}
      footer={
        <>
          <span className="hint grow">{tab.hint}</span>
          <button className="btn" onClick={closeCapture}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={submit}>
            {busy ? <SpinnerText>{kind === 'quick' ? 'Saving…' : useAi && aiPossible ? 'Analyzing with AI…' : 'Analyzing…'}</SpinnerText> : kind === 'quick' ? 'Add to Inbox' : 'Suggest tasks for review'}
          </button>
        </>
      }
    >
      <div className="tabs" role="tablist" aria-label="Capture type">
        {TABS.map((t) => (
          <button key={t.kind} role="tab" aria-selected={kind === t.kind} className={`tab ${kind === t.kind ? 'is-active' : ''}`} onClick={() => setKind(t.kind)}>
            {t.label}
          </button>
        ))}
      </div>
      {kind === 'quick' ? (
        <>
          <label className="field">
            <span className="label">What needs doing?</span>
            <input
              autoFocus
              className="input-big"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void submit()}
              placeholder="e.g. Send Brenda the engagement agenda"
            />
          </label>
          <label className="field">
            <span className="label">Notes (optional)</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </>
      ) : (
        <>
          <label className="field">
            <span className="label">Paste text</span>
            <textarea autoFocus rows={14} className="mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste here. It is stored verbatim as the source and treated only as data." />
          </label>
          <div className="grid2">
            <label className="field">
              <span className="label">Title (optional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Partner sync 10/23" />
            </label>
            <label className="field">
              <span className="label">Source link (optional)</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://outlook.office.com/…" />
            </label>
          </div>
          <label className="check-line">
            <input type="checkbox" checked={useAi && aiPossible} disabled={!aiPossible} onChange={(e) => setUseAi(e.target.checked)} />
            Use AI to split and organize
            {!aiPossible && (
              <span className="hint"> — {!online ? 'offline' : !snap.meta.aiKeyConfigured ? 'add an API key in Settings' : 'AI is turned off in Settings'}; the offline parser will be used.</span>
            )}
          </label>
        </>
      )}
    </Modal>
  );
}
