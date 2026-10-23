import { useEffect, useRef, useState } from 'react';
import type { AssistantAnswer } from '../../shared/types';
import type { ChatTurn } from '../../shared/ipc';
import { api } from '../api';
import { useSnap } from '../store';
import { ProposalCard } from '../components/ProposalCard';
import { SpinnerText } from '../components/ui';

const EXAMPLES = [
  'What should I work on today?',
  'What follow-ups are due?',
  'What am I waiting on Robert for?',
  'Show everything related to Brenda',
  'What changed since yesterday?',
  'Give me tasks I can do without making calls',
  'What can I finish in 30 minutes?',
  'Draft a follow-up to Robert',
];

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  answer?: AssistantAnswer;
}

export function AssistantView() {
  const { snap, online, taskById, select, run } = useSnap();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const aiPossible = snap.meta.aiKeyConfigured && snap.settings.aiEnabled && online;
  const [useAi, setUseAi] = useState(aiPossible);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs, busy]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput('');
    const history: ChatTurn[] = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    const answer = await run(() => api().ask(question, history, useAi && aiPossible));
    setBusy(false);
    if (answer) setMsgs((m) => [...m, { role: 'assistant', text: answer.text, answer }]);
  };

  return (
    <div className="view view-chat">
      <header className="view-head">
        <div>
          <h1>Assistant</h1>
          <p className="sub">
            Answers come from your saved tasks and cite them. Proposed changes wait for your confirmation. Drafts are never sent.
          </p>
        </div>
        <label className="check-line">
          <input type="checkbox" checked={useAi && aiPossible} disabled={!aiPossible} onChange={(e) => setUseAi(e.target.checked)} />
          Use AI {aiPossible ? `(${snap.settings.aiModel})` : !online ? '— offline' : '— not configured'}
        </label>
      </header>
      <div className="chat" aria-live="polite">
        {!msgs.length && (
          <div className="examples">
            <p className="muted">Try asking:</p>
            {EXAMPLES.map((e) => (
              <button key={e} className="chip-btn" onClick={() => ask(e)}>
                {e}
              </button>
            ))}
            <p className="hint">You can also paste meeting notes here and say “Organize these meeting notes”.</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <p className="pre">{m.text}</p>
            {m.answer && (
              <>
                {m.answer.notice && <p className="notice">{m.answer.notice}</p>}
                {m.answer.taskIds.length > 0 && (
                  <div className="cites">
                    <span className="label">Based on:</span>
                    {m.answer.taskIds.map((id) => {
                      const t = taskById(id);
                      return t ? (
                        <button key={id} className="chip-btn" onClick={() => select(id)}>
                          {t.title}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
                <span className="hint">{m.answer.engine === 'ai' ? 'AI answer' : 'Built-in answer (no AI)'}</span>
                {m.answer.proposalIds.map((pid) => {
                  const p = snap.proposals.find((x) => x.id === pid);
                  return p ? <ProposalCard key={pid} p={p} /> : null;
                })}
              </>
            )}
          </div>
        ))}
        {busy && (
          <div className="msg msg-assistant">
            <SpinnerText>{useAi && aiPossible ? 'Thinking…' : 'Looking through your tasks…'}</SpinnerText>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <textarea
          aria-label="Ask the assistant"
          rows={2}
          value={input}
          placeholder="Ask about your work, or paste notes to organize…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(input);
            }
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
