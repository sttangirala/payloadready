import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/main/db';
import { Repo } from '../src/main/repo';
import { Services } from '../src/main/services';

export const TODAY = '2026-10-23'; // a Friday
export const NOW = new Date('2026-10-23T15:00:00Z'); // 11:00 in New York

export function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stwh-test-'));
}

export async function openApp(dir: string, opts: { demo?: boolean; today?: () => string } = {}) {
  const store = await Store.open(path.join(dir, 'st-work-hub.sqlite'));
  const repo = new Repo(store, opts.today ?? (() => TODAY));
  repo.ensureDefaults(opts.demo ?? false);
  repo.updateSettings({ timezone: 'America/New_York' });
  const services = new Services(repo, null, {
    dataDir: dir,
    backupDir: path.join(dir, 'backups'),
    schemaVersion: () => store.schemaVersion(),
    now: () => NOW,
  });
  return { store, repo, services };
}

export function queueCtx(repo: Repo, today = TODAY) {
  return {
    today,
    settings: repo.getSettings(),
    categories: repo.listCategories(),
    contacts: repo.listContacts(),
    tasks: repo.listTasks(),
  };
}
