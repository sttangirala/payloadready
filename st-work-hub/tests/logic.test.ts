import { describe, expect, it } from 'vitest';
import { addBusinessDays, dateInZone, nextWeekday, parseDatePhrase } from '../src/shared/dates';
import { sanitizePatch } from '../src/shared/task';
import { validateIntakeTask } from '../src/main/ai';
import { DEFAULT_SETTINGS } from '../src/shared/types';
import { makeDefaultCategories } from '../src/shared/demo';
import { similarity } from '../src/shared/duplicates';
import { tasksToCsv } from '../src/shared/csv';
import { blankTask } from '../src/shared/task';

const TODAY = '2026-10-23'; // Friday

describe('dates', () => {
  it('is timezone aware', () => {
    const instant = new Date('2026-10-24T02:30:00Z');
    expect(dateInZone(instant, 'America/Los_Angeles')).toBe('2026-10-23');
    expect(dateInZone(instant, 'Europe/London')).toBe('2026-10-24');
  });
  it('parses explicit phrases relative to today', () => {
    expect(parseDatePhrase('by Friday', TODAY)).toBe('2026-10-30');
    expect(parseDatePhrase('on Tuesday', TODAY)).toBe('2026-10-27');
    expect(parseDatePhrase('tomorrow', TODAY)).toBe('2026-10-24');
    expect(parseDatePhrase('this weekend', TODAY)).toBe('2026-10-24');
    expect(parseDatePhrase('11/3', TODAY)).toBe('2026-11-03');
    expect(parseDatePhrase('Nov 5th', TODAY)).toBe('2026-11-05');
    expect(parseDatePhrase('Jan 5', TODAY)).toBe('2027-01-05');
    expect(parseDatePhrase('sometime soon', TODAY)).toBeNull();
  });
  it('business days skip weekends', () => {
    expect(addBusinessDays(TODAY, 1)).toBe('2026-10-26');
    expect(nextWeekday(TODAY, 1, true)).toBe('2026-10-26');
  });
});

describe('sanitizePatch', () => {
  it('drops unknown keys and invalid values', () => {
    const p = sanitizePatch({ status: 'deleted', dueDate: 'next week', importance: 'high', id: 'x', __proto__: { a: 1 }, effortMinutes: -5, title: 'ok' });
    expect(p).toEqual({ importance: 'high', title: 'ok' });
  });
});

describe('AI intake validation', () => {
  const ctx = { today: TODAY, settings: DEFAULT_SETTINGS, categories: makeDefaultCategories(), contacts: [], knownCompanies: [] };
  const base = {
    title: 'Send pricing to Acme', description: '', owner: null, owner_basis: 'missing' as const, status: 'ready' as const, waiting_on: null,
    due_date: '2026-10-30', due_date_evidence: 'by end of month', next_action_date: null, next_action_date_evidence: null, next_action: null,
    company: 'Acme', contact: null, category: 'Prospects and Sales', effort_minutes: null, requires_call: false, is_outreach: true,
    evidence_quote: 'send pricing to Acme', inferred_fields: ['company'], flags: [], possible_duplicate_task_id: null,
  };
  it('drops a deadline whose evidence is not in the source', () => {
    const d = validateIntakeTask(base, 'Can you send pricing to Acme when you get a chance?', ctx);
    expect(d.fields.dueDate).toBeUndefined();
    expect(d.flags.join(' ')).toMatch(/deadline was suggested but not stated/);
    expect(d.fields.owner).toBe('');
    expect(d.provenance.company.basis).toBe('inferred');
  });
  it('keeps a deadline that is quoted from the source', () => {
    const d = validateIntakeTask({ ...base, due_date_evidence: 'by Friday' }, 'Please send pricing to Acme by Friday.', ctx);
    expect(d.fields.dueDate).toBe('2026-10-30');
    expect(d.provenance.dueDate).toEqual({ basis: 'explicit', evidence: 'by Friday' });
  });
});

describe('duplicates & csv', () => {
  it('similar titles score high, unrelated low', () => {
    expect(similarity('Update Sobo profile on Crunchbase', 'Update the Crunchbase profile')).toBeGreaterThan(0.5);
    expect(similarity('Update Sobo profile on Crunchbase', 'Prepare investor update')).toBeLessThan(0.4);
  });
  it('csv neutralizes formula injection', () => {
    const t = blankTask(new Date().toISOString(), { title: '=HYPERLINK("http://x")' });
    expect(tasksToCsv([t], [])).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});

describe('links', () => {
  it('only safe link schemes are stored', async () => {
    const { safeLink } = await import('../src/main/repo');
    expect(safeLink('javascript:alert(1)')).toBe('');
    expect(safeLink('file:///etc/passwd')).toBe('');
    expect(safeLink('https://outlook.office.com/mail/id/1')).toBe('https://outlook.office.com/mail/id/1');
  });
});
