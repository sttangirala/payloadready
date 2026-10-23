import { useEffect, useState } from 'react';
import type { Settings } from '../../shared/types';
import type { ConnectorStatus } from '../../main/connectors/types';
import { api } from '../api';
import { useSnap } from '../store';
import { Modal } from '../components/ui';

const ZONES = ['', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];

export function SettingsView() {
  const { snap, run, toast } = useSnap();
  const s = snap.settings;
  const [key, setKey] = useState('');
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [catName, setCatName] = useState('');
  useEffect(() => {
    api().connectors().then(setConnectors).catch(() => {});
  }, []);
  const save = (patch: Partial<Settings>) => run(() => api().updateSettings(patch));
  const demoCount = snap.tasks.filter((t) => t.isDemo).length;

  return (
    <div className="view settings">
      <header className="view-head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Changes save immediately.</p>
        </div>
      </header>

      <section className="settings-group" aria-labelledby="set-you">
        <h2 id="set-you">You</h2>
        <div className="grid2">
          <TextSetting label="Your name (used for ownership)" value={s.myName} onSave={(v) => save({ myName: v || 'Me' })} />
          <TextSetting label="Other names that mean you (comma separated)" value={s.myAliases.join(', ')} onSave={(v) => save({ myAliases: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
          <label className="field">
            <span className="label">Timezone</span>
            <select value={ZONES.includes(s.timezone) ? s.timezone : '__custom'} onChange={(e) => e.target.value !== '__custom' && save({ timezone: e.target.value })}>
              {ZONES.map((z) => <option key={z} value={z}>{z || `System (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}</option>)}
              {!ZONES.includes(s.timezone) && <option value="__custom">{s.timezone}</option>}
            </select>
          </label>
          <label className="field">
            <span className="label">Appearance</span>
            <select value={s.theme} onChange={(e) => save({ theme: e.target.value as Settings['theme'] })}>
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <NumberSetting label="Tasks shown in Today’s queue" value={s.todayLimit} onSave={(v) => save({ todayLimit: v })} />
        </div>
      </section>

      <section className="settings-group" aria-labelledby="set-fu">
        <h2 id="set-fu">Follow-ups & reminders</h2>
        <div className="grid2">
          <NumberSetting label="Default follow-up interval (days)" value={s.defaultFollowUpDays} onSave={(v) => save({ defaultFollowUpDays: v })} />
          <label className="check-line">
            <input type="checkbox" checked={s.followUpBusinessDays} onChange={(e) => save({ followUpBusinessDays: e.target.checked })} /> Count business days only
          </label>
          <label className="check-line">
            <input type="checkbox" checked={s.desktopNotifications} onChange={(e) => save({ desktopNotifications: e.target.checked })} /> Desktop reminders
          </label>
          <label className="check-line">
            <input type="checkbox" checked={s.inAppNotifications} onChange={(e) => save({ inAppNotifications: e.target.checked })} /> In-app notification center
          </label>
          <NumberSetting label="Don’t remind before (hour, 0–23, local)" value={s.reminderHour} onSave={(v) => save({ reminderHour: v })} />
        </div>
        <p className="hint">Per-category intervals are below; any task can override its own interval in the details panel.</p>
      </section>

      <section className="settings-group" aria-labelledby="set-cat">
        <h2 id="set-cat">Categories</h2>
        <table className="table compact">
          <thead><tr><th scope="col">Color</th><th scope="col">Name</th><th scope="col">Follow-up days</th><th scope="col" /></tr></thead>
          <tbody>
            {snap.categories.map((c) => (
              <tr key={c.id}>
                <td><input type="color" aria-label={`Color for ${c.name}`} value={c.color} onChange={(e) => run(() => api().saveCategory({ ...c, color: e.target.value }))} /></td>
                <td><TextSetting label="" value={c.name} onSave={(v) => run(() => api().saveCategory({ ...c, name: v }))} /></td>
                <td>
                  <input
                    type="number"
                    min={1}
                    aria-label={`Follow-up days for ${c.name}`}
                    defaultValue={c.followUpDays ?? ''}
                    placeholder="default"
                    onBlur={(e) => run(() => api().saveCategory({ ...c, followUpDays: e.target.value ? Math.max(1, Number(e.target.value)) : null }))}
                  />
                </td>
                <td><button className="link-btn" onClick={() => run(() => api().deleteCategory(c.id))}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (catName.trim()) { void run(() => api().saveCategory({ name: catName.trim() })); setCatName(''); } }}>
          <input aria-label="New category" placeholder="New category" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <button className="btn" type="submit">Add category</button>
        </form>
      </section>

      <section className="settings-group" aria-labelledby="set-cap">
        <h2 id="set-cap">Quick capture</h2>
        <div className="grid2">
          <label className="check-line">
            <input type="checkbox" checked={s.quickCaptureEnabled} onChange={(e) => save({ quickCaptureEnabled: e.target.checked })} /> Global shortcut (works when the app is in the background)
          </label>
          <TextSetting label="Shortcut (Electron accelerator)" value={s.quickCaptureShortcut} onSave={(v) => save({ quickCaptureShortcut: v })} />
        </div>
        <p className="hint">Examples: CommandOrControl+Shift+Space, Alt+CommandOrControl+N. Inside the app, press N for quick capture.</p>
      </section>

      <section className="settings-group" aria-labelledby="set-ai">
        <h2 id="set-ai">AI (optional)</h2>
        <p className="hint">
          Everything works without AI. With an Anthropic API key, intake and the assistant use Claude. The key is encrypted with the macOS Keychain-backed
          safeStorage, kept in the main process, and never shown again or exposed to this window.
        </p>
        <div className="grid2">
          <label className="check-line">
            <input type="checkbox" checked={s.aiEnabled} onChange={(e) => save({ aiEnabled: e.target.checked })} /> Enable AI features
          </label>
          <TextSetting label="Model" value={s.aiModel} onSave={(v) => save({ aiModel: v || 'claude-opus-5-5' })} />
        </div>
        <p>
          API key: <strong>{snap.meta.aiKeyConfigured ? 'configured' : 'not set'}</strong>
          {!snap.meta.secureStorageAvailable && ' — OS secure storage unavailable; a key would be kept for this session only.'}
        </p>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => api().setApiKey(key));
            if (r) {
              setKey('');
              toast(r.storedIn === 'keychain' ? 'API key saved securely.' : 'API key kept for this session only.', 'success');
            }
          }}
        >
          <input type="password" autoComplete="off" aria-label="Anthropic API key" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn" type="submit" disabled={!key.trim()}>Save key</button>
          {snap.meta.aiKeyConfigured && <button className="btn" type="button" onClick={() => run(() => api().clearApiKey(), 'API key removed')}>Remove key</button>}
          <button className="btn" type="button" onClick={async () => { const st = await run(() => api().aiStatus()); if (st) toast(st.available ? 'AI is available.' : st.reason, st.available ? 'success' : 'info'); }}>Check status</button>
        </form>
      </section>

      <section className="settings-group" aria-labelledby="set-int">
        <h2 id="set-int">Integrations</h2>
        {connectors.map((c) => (
          <div key={c.id} className="connector">
            <strong>{c.name}</strong> <span className="badge badge-muted">Not available yet</span>
            <p className="hint">{c.description} Planned read-only scopes: {c.plannedScopes.join(', ')}.</p>
          </div>
        ))}
      </section>

      <section className="settings-group" aria-labelledby="set-data">
        <h2 id="set-data">Data, backup & export</h2>
        <dl className="paths">
          <dt>Database</dt><dd><code>{snap.meta.dbPath}</code></dd>
          <dt>Automatic backups (daily, last 14 kept)</dt><dd><code>{snap.meta.backupDir}</code></dd>
          <dt>Schema version</dt><dd>{snap.meta.schemaVersion} · app {snap.meta.appVersion}</dd>
        </dl>
        <div className="row wrap">
          <button className="btn" onClick={async () => { const r = await run(() => api().exportJson()); if (r) toast(`Exported to ${r.path}`, 'success'); }}>Export JSON (full)</button>
          <button className="btn" onClick={async () => { const r = await run(() => api().exportCsv()); if (r) toast(`Exported to ${r.path}`, 'success'); }}>Export tasks CSV</button>
          <button className="btn" onClick={async () => { const r = await run(() => api().restoreJson()); if (r) toast(`Restored ${r.tasks} tasks. Previous data backed up to ${r.backupPath}`, 'success'); }}>Restore from JSON…</button>
          <button className="btn" onClick={async () => { const r = await run(() => api().backupNow()); if (r) toast(`Backup saved: ${r.path}`, 'success'); }}>Back up now</button>
          <button className="btn" onClick={() => run(() => api().openDataFolder())}>Open data folder</button>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="set-demo">
        <h2 id="set-demo">Demo data</h2>
        <p className="hint">{demoCount ? `${demoCount} demo tasks are loaded (marked “Demo”).` : 'No demo data loaded.'}</p>
        {demoCount ? (
          <button className="btn btn-danger-quiet" onClick={() => setConfirmDemo(true)}>Remove demo data</button>
        ) : (
          <button className="btn" onClick={() => run(() => api().loadDemo(), 'Demo data loaded')}>Load demo data</button>
        )}
      </section>

      {confirmDemo && (
        <Modal
          title="Remove demo data?"
          onClose={() => setConfirmDemo(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDemo(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => { const r = await run(() => api().removeDemo()); setConfirmDemo(false); if (r) toast(`Removed ${r.removed} demo tasks.`, 'success'); }}>Remove</button>
            </>
          }
        >
          <p>All tasks, contacts, projects and sources marked as demo will be deleted. Your own data is not affected.</p>
        </Modal>
      )}
    </div>
  );
}

function TextSetting({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const input = <input aria-label={label || undefined} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
  if (!label) return input;
  return (
    <label className="field">
      <span className="label">{label}</span>
      {input}
    </label>
  );
}

function NumberSetting({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input type="number" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => Number(v) !== value && Number.isFinite(Number(v)) && onSave(Number(v))} />
    </label>
  );
}
