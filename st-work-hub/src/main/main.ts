// Electron main process: window, IPC handlers, reminder scheduler, global quick-capture shortcut.

import { app, BrowserWindow, dialog, globalShortcut, ipcMain, IpcMainInvokeEvent, net, Notification, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Store } from './db';
import { ConflictError, Repo, safeLink } from './repo';
import { Services } from './services';
import { AiService } from './ai';
import { CredentialStore } from './credentials';
import { OutlookConnector } from './connectors/outlook';
import { API_METHODS } from '../shared/ipc';
import type { Api } from '../shared/ipc';
import { resolveTimezone, todayIn } from '../shared/dates';
import type { AppSnapshot } from '../shared/types';

const DEV_URL = process.env.ST_WORK_HUB_DEV_URL;
const dataDir = process.env.ST_WORK_HUB_DATA_DIR || app.getPath('userData');
const dbPath = path.join(dataDir, 'st-work-hub.sqlite');
const backupDir = path.join(dataDir, 'backups');
if (process.env.ST_WORK_HUB_DATA_DIR) app.setPath('userData', dataDir);

let win: BrowserWindow | null = null;
let repo: Repo;
let services: Services;
let creds: CredentialStore;
let ai: AiService;
const outlook = new OutlookConnector();
let lastToday = '';
let shortcutRegistered = '';
let lastNotificationCount = -1;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(start).catch((e) => {
    dialog.showErrorBox('ST Work Hub failed to start', String(e?.stack ?? e));
    app.quit();
  });
}

async function start() {
  fs.mkdirSync(dataDir, { recursive: true });
  const wasm = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
  const store = await Store.open(dbPath, wasm);
  repo = new Repo(store, () => todayIn(repo.getSettings().timezone));
  creds = new CredentialStore(dataDir);
  ai = new AiService(() => creds.get(), () => repo.getSettings(), () => net.isOnline());
  services = new Services(repo, ai, { dataDir, backupDir, schemaVersion: () => store.schemaVersion() });
  repo.ensureDefaults(process.env.ST_WORK_HUB_NO_DEMO !== '1');
  try {
    services.dailyBackupIfNeeded();
  } catch (e) {
    console.error('Backup failed:', (e as Error).message);
  }
  registerIpc();
  createWindow();
  applyShortcut();
  lastToday = repo.today();
  setInterval(tick, 60_000);
  setTimeout(tick, 5_000);

  app.on('activate', () => showWindow());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    try {
      store.close();
    } catch {
      /* already closed */
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: 'ST Work Hub',
    backgroundColor: '#f6f5f2',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });
  win.once('ready-to-show', () => win?.show());
  // Never navigate away from the app or open new windows; external links go to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppUrl(url)) {
      e.preventDefault();
      openExternalSafe(url);
    }
  });
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.on('closed', () => (win = null));
}

function showWindow() {
  if (!win) createWindow();
  else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

function isAppUrl(url: string) {
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
}

function openExternalSafe(url: string): boolean {
  const safe = safeLink(url);
  if (!safe) return false;
  void shell.openExternal(safe);
  return true;
}

function broadcast(event: string, payload?: unknown) {
  win?.webContents.send(`st:event:${event}`, payload);
}

function applyShortcut() {
  const s = repo.getSettings();
  if (shortcutRegistered) {
    globalShortcut.unregister(shortcutRegistered);
    shortcutRegistered = '';
  }
  if (!s.quickCaptureEnabled || !s.quickCaptureShortcut) return;
  try {
    const ok = globalShortcut.register(s.quickCaptureShortcut, () => {
      showWindow();
      broadcast('quick-capture');
    });
    if (ok) shortcutRegistered = s.quickCaptureShortcut;
  } catch {
    /* invalid accelerator string; reported via snapshot */
  }
}

function tick() {
  try {
    const today = repo.today();
    if (today !== lastToday) {
      lastToday = today;
      services.dailyBackupIfNeeded();
      broadcast('changed');
    }
    const toShow = services.checkReminders();
    const count = repo.listNotifications().length;
    if (toShow.length || count !== lastNotificationCount) broadcast('changed');
    lastNotificationCount = count;
    if (Notification.isSupported()) {
      for (const n of toShow.slice(0, 5)) {
        const note = new Notification({ title: n.title, body: n.body, silent: false });
        note.on('click', () => {
          showWindow();
          if (n.taskId) broadcast('open-task', n.taskId);
        });
        note.show();
        repo.markDesktopShown(n.id);
      }
      // Anything beyond 5 is still listed in the in-app notification center, just not popped up.
      for (const n of toShow.slice(5)) repo.markDesktopShown(n.id);
    }
  } catch (e) {
    console.error('Reminder check failed:', (e as Error).message);
  }
}

function snapshot(): AppSnapshot {
  const settings = repo.getSettings();
  return {
    tasks: repo.listTasks(),
    categories: repo.listCategories(),
    contacts: repo.listContacts(),
    projects: repo.listProjects(),
    sources: repo.listSources().map((s) => ({ ...s, rawText: s.rawText.length > 2000 ? `${s.rawText.slice(0, 2000)}…` : s.rawText })),
    proposals: repo.listProposals().filter((p) => p.status === 'pending'),
    batches: repo.listBatches().slice(0, 50),
    notifications: repo.listNotifications(),
    settings,
    meta: {
      today: repo.today(),
      timezone: resolveTimezone(settings.timezone),
      dataDir,
      dbPath,
      backupDir,
      schemaVersion: repo.store.schemaVersion(),
      aiKeyConfigured: !!creds.get(),
      secureStorageAvailable: creds.secureStorageAvailable(),
      appVersion: app.getVersion(),
    },
  };
}

async function saveFile(defaultName: string, content: string, filters: Electron.FileFilter[]) {
  const res = await dialog.showSaveDialog(win!, { defaultPath: path.join(app.getPath('documents'), defaultName), filters });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, content, { mode: 0o600 });
  return { path: res.filePath };
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Handlers that mutate data trigger a 'changed' broadcast so every view refreshes. */
const READ_ONLY = new Set<keyof Api>(['snapshot', 'activity', 'getSource', 'aiStatus', 'connectors', 'dailyReview', 'openDataFolder', 'openExternal', 'exportJson', 'exportCsv', 'backupNow']);

function handlers(): Api {
  return {
    snapshot: async () => snapshot(),
    createTask: async (patch) => repo.createTask(patch),
    updateTask: async (id, patch) => repo.updateTask(String(id), patch),
    deleteTask: async (id) => repo.deleteTask(String(id)),
    addNote: async (taskId, body) => repo.addNote(String(taskId), String(body ?? '')),
    logFollowUpSent: async (taskId, note) => repo.logFollowUpSent(String(taskId), note ? String(note) : undefined),
    skipTask: async (taskId, reason) => repo.skipTask(String(taskId), String(reason ?? '')),
    setManualOrder: async (ids) => repo.setManualOrder(Array.isArray(ids) ? ids.map(String) : []),
    activity: async (taskId) => repo.listActivity({ taskId: taskId ? String(taskId) : undefined, limit: 300 }),
    getSource: async (id) => repo.getSource(String(id)) ?? null,
    saveCategory: async (c) => repo.saveCategory(c),
    deleteCategory: async (id) => repo.deleteCategory(String(id)),
    saveContact: async (c) => repo.saveContact(c),
    deleteContact: async (id) => repo.deleteContact(String(id)),
    saveProject: async (p) => repo.saveProject(p),
    deleteProject: async (id) => repo.deleteProject(String(id)),
    quickCapture: async (title, notes) => services.quickCapture(String(title ?? ''), String(notes ?? '')),
    intake: async (req) => services.intake(req),
    applyProposal: async (id, overrides, opts) => repo.applyProposal(String(id), overrides ?? {}, opts ?? {}),
    rejectProposal: async (id) => repo.rejectProposal(String(id)),
    ask: async (q, history, useAi) => services.ask(String(q ?? ''), Array.isArray(history) ? history : [], !!useAi),
    dailyReview: async () => services.dailyReview(),
    snoozeNotification: async (id, minutes) => repo.snoozeNotification(String(id), new Date(Date.now() + Math.max(5, Number(minutes) || 60) * 60_000).toISOString()),
    readNotification: async (id) => repo.markNotificationRead(String(id)),
    dismissNotification: async (id) => repo.dismissNotification(String(id)),
    disableTaskReminders: async (taskId) => {
      repo.updateTask(String(taskId), { remindersEnabled: false });
      for (const n of repo.listNotifications()) if (n.taskId === taskId) repo.dismissNotification(n.id);
    },
    updateSettings: async (patch) => {
      const s = repo.updateSettings(patch ?? {});
      applyShortcut();
      return s;
    },
    setApiKey: async (key) => ({ storedIn: creds.set(String(key ?? '')) }),
    clearApiKey: async () => creds.clear(),
    aiStatus: async () => ai.status(),
    connectors: async () => [outlook.status()],
    exportJson: async () => saveFile(`st-work-hub-export-${stamp()}.json`, services.exportJson(), [{ name: 'JSON', extensions: ['json'] }]),
    exportCsv: async () => saveFile(`st-work-hub-tasks-${stamp()}.csv`, services.exportCsv(), [{ name: 'CSV', extensions: ['csv'] }]),
    restoreJson: async () => {
      const res = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (res.canceled || !res.filePaths[0]) return null;
      const confirm = await dialog.showMessageBox(win!, {
        type: 'warning',
        buttons: ['Cancel', 'Replace my data'],
        defaultId: 0,
        cancelId: 0,
        message: 'Restore from this export?',
        detail: 'All current data will be replaced. A backup of the current database is saved first.',
      });
      if (confirm.response !== 1) return null;
      return services.restoreJson(fs.readFileSync(res.filePaths[0], 'utf8'));
    },
    backupNow: async () => ({ path: services.backup('manual') }),
    openDataFolder: async () => {
      await shell.openPath(dataDir);
    },
    loadDemo: async () => repo.loadDemo(),
    removeDemo: async () => ({ removed: repo.removeDemo() }),
    openExternal: async (url) => openExternalSafe(String(url ?? '')),
  };
}

function registerIpc() {
  const h = handlers();
  for (const name of API_METHODS) {
    ipcMain.handle(`st:${name}`, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (!isAppUrl(event.senderFrame?.url ?? '')) return { __error: 'Blocked: request did not come from the app window.' };
      try {
        const fn = h[name] as (...a: unknown[]) => Promise<unknown>;
        const out = await fn(...args);
        if (!READ_ONLY.has(name)) broadcast('changed');
        return out ?? null;
      } catch (e) {
        const err = e as Error;
        return { __error: err.message || 'Something went wrong.', name: err instanceof ConflictError ? 'ConflictError' : err.name };
      }
    });
  }
}
