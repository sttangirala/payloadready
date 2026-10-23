// Timezone-aware calendar-date helpers. Calendar dates are plain YYYY-MM-DD strings interpreted in
// the user's configured timezone; arithmetic on them is done in UTC so DST never shifts a day.

export type ISODate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isISODate = (s: unknown): s is ISODate => typeof s === 'string' && DATE_RE.test(s);

export function resolveTimezone(tz: string | undefined | null): string {
  if (tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      /* fall through to system zone */
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** The calendar date of `instant` in `tz`. */
export function dateInZone(instant: Date, tz: string): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimezone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hour of day (0-23) of `instant` in `tz`. */
export function hourInZone(instant: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: resolveTimezone(tz), hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(instant)
    .find((p) => p.type === 'hour')?.value;
  return Number(h ?? 0);
}

export const todayIn = (tz: string, now: Date = new Date()) => dateInZone(now, tz);

function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

/** 0 = Sunday ... 6 = Saturday */
export const weekday = (d: ISODate) => toUTC(d).getUTCDay();

export function addBusinessDays(d: ISODate, n: number): ISODate {
  let cur = d;
  let left = n;
  while (left > 0) {
    cur = addDays(cur, 1);
    const w = weekday(cur);
    if (w !== 0 && w !== 6) left--;
  }
  return cur;
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** Next occurrence of weekday `w` strictly after `from` (or `from` itself if includeToday). */
export function nextWeekday(from: ISODate, w: number, includeToday = false): ISODate {
  let cur = includeToday ? from : addDays(from, 1);
  while (weekday(cur) !== w) cur = addDays(cur, 1);
  return cur;
}

export const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function formatDate(d: ISODate | null | undefined, today?: ISODate): string {
  if (!d) return '';
  if (today) {
    const diff = diffDays(today, d);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
  }
  const x = toUTC(d);
  return x.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatTimestamp(iso: string, tz: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: resolveTimezone(tz),
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Parse an explicit date phrase relative to `today`. Returns null if the phrase has no date.
 * Supports: today, tomorrow, weekday names ("Tuesday", "next Tuesday"), "this weekend",
 * "next week", "in N days", M/D[/YY], "Oct 30", "October 30", and YYYY-MM-DD.
 */
export function parseDatePhrase(phrase: string, today: ISODate): ISODate | null {
  const s = phrase.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/\btoday\b|\beod\b|end of (the )?day/.test(s)) return today;
  if (/\btomorrow\b/.test(s)) return addDays(today, 1);
  if (/\b(this )?weekend\b/.test(s)) return nextWeekday(today, 6, true);
  if (/\bnext week\b/.test(s)) return nextWeekday(today, 1);
  if (/\bend of (the )?week\b/.test(s)) return nextWeekday(today, 5, true);
  if ((m = s.match(/\bin (\d{1,2}) days?\b/))) return addDays(today, Number(m[1]));
  if ((m = s.match(/\b(next )?(sun|mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?)(day)?\b/))) {
    const key = m[2].slice(0, 3);
    const idx = WEEKDAY_NAMES.findIndex((n) => n.startsWith(key));
    if (idx >= 0) {
      const d = nextWeekday(today, idx);
      return m[1] ? (diffDays(today, d) < 7 ? addDays(d, 7) : d) : d;
    }
  }
  if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
    let d = `${year}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`;
    if (!m[3] && diffDays(today, d) < -60) d = `${year + 1}${d.slice(4)}`;
    return isValid(d) ? d : null;
  }
  if ((m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)?\b/))) {
    const month = MONTHS.indexOf(m[1].slice(0, 3)) + 1;
    const year = Number(today.slice(0, 4));
    let d = `${year}-${pad(month)}-${pad(Number(m[2]))}`;
    if (diffDays(today, d) < -60) d = `${year + 1}${d.slice(4)}`;
    return isValid(d) ? d : null;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
function isValid(d: ISODate): boolean {
  return fromUTC(toUTC(d)) === d;
}
