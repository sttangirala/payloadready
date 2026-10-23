import type { Source } from '../../shared/types';
import { formatTimestamp } from '../../shared/dates';
import { api } from '../api';
import { useSnap } from '../store';
import { Modal } from './ui';

/** Shows original pasted text verbatim as plain text (never interpreted as HTML). */
export function SourceViewer({ source, onClose }: { source: Source; onClose: () => void }) {
  const { snap, run } = useSnap();
  return (
    <Modal
      title={`Original source: ${source.title}`}
      onClose={onClose}
      wide
      footer={
        <>
          {source.link && (
            <button className="btn" onClick={() => run(() => api().openExternal(source.link))}>
              Open original link
            </button>
          )}
          <button className="btn" onClick={() => void navigator.clipboard.writeText(source.rawText)}>Copy text</button>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <p className="hint">
        {source.kind} · captured {formatTimestamp(source.createdAt, snap.settings.timezone)}
        {source.isDemo && ' · demo'}
      </p>
      <pre className="source-text">{source.rawText}</pre>
    </Modal>
  );
}
