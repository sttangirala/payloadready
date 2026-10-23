// End-to-end tests against the real built Electron app (run: npm run test:e2e; on Linux CI use xvfb-run).

import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHOTS = path.join(__dirname, '..', 'test-results', 'screens');
fs.mkdirSync(SHOTS, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stwh-e2e-'));

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const env = { ...process.env, ST_WORK_HUB_DATA_DIR: dataDir } as Record<string, string>;
  delete env.NODE_OPTIONS;
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist', 'main', 'main.js'), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env,
  });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE:', m.text()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible({ timeout: 30_000 });
  return { app, page };
}

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();

test.describe.serial('ST Work Hub', () => {
  let app: ElectronApplication;
  let page: Page;

  test('opens on Today with demo data and a recommended next task', async () => {
    ({ app, page } = await launch());
    await expect(page.getByLabel('Next recommended task')).toBeVisible();
    await expect(page.getByText('Demo data is loaded')).toBeVisible();
    // Owned-by-others and deferred items are not in the queue.
    const queue = page.locator('section[aria-labelledby="today-queue"]');
    await expect(queue.getByText('[Demo] Review Curtis NDA')).toHaveCount(0);
    await expect(queue.getByText('[Demo] Follow up with Paulina after her Monday event')).toHaveCount(0);
    await expect(page.locator('section[aria-labelledby="today-fu"]').getByText('[Demo] Update Sobo profile on Crunchbase')).toBeVisible();
    await shot(page, '01-today');
  });

  test('quick capture, edit in panel, status change reflected in other views', async () => {
    await page.keyboard.press('n');
    await page.getByLabel('What needs doing?').fill('E2E: send pricing sheet to Northwind');
    await page.getByRole('button', { name: 'Add to Inbox' }).click();
    await nav(page, 'Inbox');
    await expect(page.getByText('E2E: send pricing sheet to Northwind')).toBeVisible();
    await page.getByRole('button', { name: 'Open E2E: send pricing sheet to Northwind' }).click();
    const panel = page.getByRole('complementary', { name: 'Task details' });
    await panel.getByLabel('Next concrete action').fill('Attach the Q4 sheet');
    await panel.getByLabel('Next concrete action').press('Enter');
    await panel.getByLabel('Status').selectOption('in_progress');
    await shot(page, '02-panel');
    await nav(page, 'Board');
    await expect(page.getByLabel('In Progress column', { exact: false }).getByText('E2E: send pricing sheet to Northwind')).toBeVisible();
    await shot(page, '03-board');
    await nav(page, 'Today');
    await expect(page.locator('section[aria-labelledby="today-queue"]').getByText('E2E: send pricing sheet to Northwind')).toBeVisible();
  });

  test('board drag and drop changes status', async () => {
    await page.getByRole('button', { name: 'Close details' }).click();
    await nav(page, 'Board');
    const card = page.locator('.card', { hasText: '[Demo] Review three new expert applications' });
    await card.dragTo(page.getByLabel('Scheduled column', { exact: false }));
    await expect(page.getByLabel('Scheduled column', { exact: false }).getByText('[Demo] Review three new expert applications')).toBeVisible();
    await nav(page, 'List');
    await page.getByLabel('Search tasks').fill('expert applications');
    await expect(page.locator('table').getByText('Scheduled')).toBeVisible();
    await shot(page, '04-list');
  });

  test('intake suggestions are reviewed before adding; duplicates flagged', async () => {
    await page.getByRole('button', { name: /Capture/ }).first().click();
    await page.getByRole('tab', { name: 'Meeting notes' }).click();
    await page.getByLabel('Paste text').fill('Partner sync notes\n- Robert to send Crunchbase credentials for the Sobo profile update\n- I will prepare the monthly investor update by Friday\n- Naresh and Aaron will fix the signup error');
    await page.getByRole('button', { name: 'Suggest tasks for review' }).click();
    await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible();
    await expect(page.getByText('Possible duplicate').first()).toBeVisible();
    await shot(page, '05-intake-review');
    const before = await page.locator('.proposal').count();
    await page.locator('.proposal').filter({ hasText: 'investor' }).getByRole('button', { name: /Merge into this/ }).first().click();
    await expect(page.locator('.proposal')).toHaveCount(before - 1);
  });

  test('focus mode works through one task at a time', async () => {
    await page.keyboard.press('Escape');
    await nav(page, 'Today');
    await page.getByRole('button', { name: 'Work on Next Task' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Why now:')).toBeVisible();
    const first = await dialog.locator('.focus-title').textContent();
    await shot(page, '06-focus');
    await dialog.getByRole('button', { name: 'Skip…' }).click();
    await dialog.getByLabel('Reason for skipping').fill('Need numbers first');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.locator('.focus-title')).not.toHaveText(first ?? '');
    await page.keyboard.press('Escape');
  });

  test('assistant answers from saved data with cited records', async () => {
    await nav(page, 'Assistant');
    await page.getByRole('button', { name: 'What am I waiting on Robert for?' }).click();
    await expect(page.locator('.msg-assistant').getByText('Based on:')).toBeVisible();
    await expect(page.locator('.cites').getByText('[Demo] Update Sobo profile on Crunchbase')).toBeVisible();
    await page.getByLabel('Ask the assistant').fill('Draft a follow-up to Stephanie');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.locator('.msg-assistant').last()).toContainText('closed contact');
    await shot(page, '07-assistant');
  });

  test('other views render', async () => {
    for (const [name, file] of [['Waiting', '08-waiting'], ['Follow-ups', '09-followups'], ['Projects', '10-projects'], ['Daily review', '11-review'], ['Settings', '12-settings']] as const) {
      await nav(page, name);
      await page.waitForTimeout(250);
      await shot(page, file);
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await nav(page, 'Today');
    await shot(page, '13-today-dark');
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  });

  test('data survives an application restart', async () => {
    await app.close();
    ({ app, page } = await launch());
    await nav(page, 'List');
    await page.getByLabel('Search tasks').fill('pricing sheet');
    await expect(page.getByText('E2E: send pricing sheet to Northwind')).toBeVisible();
    await expect(page.locator('table').getByText('In Progress')).toBeVisible();
    await page.getByRole('button', { name: /E2E: send pricing sheet/ }).click();
    await expect(page.getByRole('complementary', { name: 'Task details' }).getByLabel('Next concrete action')).toHaveValue('Attach the Q4 sheet');
    expect(fs.existsSync(path.join(dataDir, 'st-work-hub.sqlite'))).toBe(true);
    expect(fs.readdirSync(path.join(dataDir, 'backups')).length).toBeGreaterThan(0);
    await app.close();
  });
});
