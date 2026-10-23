// Offline (no-AI) intake parser. Splits pasted text into candidate tasks using simple, predictable
// rules. Everything it extracts is tagged as explicit (quoted from the text) or inferred; anything it
// cannot find is left blank and flagged for review. Pasted text is treated purely as data.

import { parseDatePhrase, ISODate } from './dates';
import { isMe } from './followup';
import type { Category, Contact, FieldProvenance, Settings, SourceKind, TaskPatch } from './types';

export interface DraftSuggestion {
  fields: TaskPatch;
  provenance: Record<string, FieldProvenance>;
  flags: string[];
  rationale: string;
  /** Existing task id the AI believes this duplicates. */
  aiDuplicateId?: string;
}

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ['Fundraising', /\b(investor|fundrais|raise|round|term sheet|cap table|pitch deck|vc|angel)\b/i],
  ['Product and Technical Issues', /\b(bug|error|signup|sign-up|login|outage|crash|broken|technical|api|deploy|credential)\b/i],
  ['Experts', /\b(expert|consultant|advisor network|specialist)\b/i],
  ['Partners', /\b(partner|referral|reseller|affiliate)\b/i],
  ['Subscribers', /\b(subscriber|subscription|renewal|churn|account manager)\b/i],
  ['Client Engagements', /\b(engagement|client|deliverable|kickoff|sow)\b/i],
  ['Prospects and Sales', /\b(prospect|demo|pricing|proposal|lead|expo|conference|pipeline|nda)\b/i],
  ['Internal Operations', /\b(process|hiring|payroll|invoice|ops|operations|policy|crunchbase|admin)\b/i],
];

const ACTION_RE =
  /\b(please|can you|could you|need to|needs to|we should|i will|i'll|will send|will review|follow up|follow-up|schedule|set up|send|review|prepare|draft|update|confirm|share|call|email|reach out|get back|todo|action)\b/i;

const BULLET_RE = /^\s*(?:[-*•▪◦]|\d+[.)]|\[[ xX]?\]|action( item)?:|todo:|ai:|next step:)\s*/i;

function splitCandidates(text: string, kind: SourceKind): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (kind === 'quick') {
    const joined = lines.filter(Boolean).join(' ');
    return joined ? [joined] : [];
  }
  // Drop quoted email history and headers; they are context, not new asks.
  const body: string[] = [];
  for (const l of lines) {
    if (/^on .+ wrote:$/i.test(l) || /^-{2,}\s*original message/i.test(l)) break;
    if (/^(from|to|cc|bcc|sent|date|subject):/i.test(l)) continue;
    if (l.startsWith('>')) continue;
    body.push(l);
  }
  const bulleted = body.filter((l) => BULLET_RE.test(l) && l.replace(BULLET_RE, '').length > 3);
  if (kind === 'list' || bulleted.length >= 2) {
    const items = (bulleted.length ? bulleted : body.filter(Boolean)).map((l) => l.replace(BULLET_RE, '').trim());
    return items.filter((l) => l.length > 3);
  }
  // Prose: split into sentences and keep those that read like requests or commitments.
  const sentences = body
    .join(' ')
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && ACTION_RE.test(s) && !/^(thanks|thank you|best|regards|cheers)\b/i.test(s));
  return sentences.slice(0, 15);
}

function titleFrom(s: string): string {
  let t = s.replace(/\s+/g, ' ').replace(/^(please|can you|could you|we need to|need to|i need to|todo:?)\s+/i, '').trim();
  t = t.replace(/[.?!]+$/, '');
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 110 ? `${t.slice(0, 107)}…` : t;
}

function inferCategory(s: string, categories: Category[]): { id: string; name: string } | null {
  for (const [name, re] of CATEGORY_KEYWORDS) {
    if (re.test(s)) {
      const cat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (cat) return { id: cat.id, name: cat.name };
    }
  }
  return null;
}

export interface IntakeContext {
  today: ISODate;
  settings: Settings;
  categories: Category[];
  contacts: Contact[];
  knownCompanies: string[];
}

export function parseIntakeLocally(text: string, kind: SourceKind, ctx: IntakeContext): DraftSuggestion[] {
  return splitCandidates(text, kind).map((line) => analyzeLine(line, kind, ctx));
}

function analyzeLine(line: string, kind: SourceKind, ctx: IntakeContext): DraftSuggestion {
  const fields: TaskPatch = { title: titleFrom(line), status: 'inbox' };
  const provenance: Record<string, FieldProvenance> = { title: { basis: 'explicit', evidence: line } };
  const flags: string[] = [];
  const inferred: string[] = [];
  let m: RegExpMatchArray | null;

  // Owner: "Robert to review", "Robert will review", "@Robert", "Owner: Robert", "I'll ..."
  if ((m = line.match(/\bowner:\s*([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i)) || (m = line.match(/@([A-Z][a-z]+)/))) {
    fields.owner = m[1];
    provenance.owner = { basis: 'explicit', evidence: m[0] };
  } else if ((m = line.match(/^(?:[-*•]\s*)?([A-Z][a-z]+)(?: and ([A-Z][a-z]+))? (?:to|will|is going to|owns)\b/))) {
    const owner = m[2] ? `${m[1]} and ${m[2]}` : m[1];
    if (!isMe(m[1], ctx.settings) && !/^(we|they|you|it|this|that|please|then)$/i.test(m[1])) {
      fields.owner = owner;
      provenance.owner = { basis: 'explicit', evidence: m[0] };
    }
  } else if (/\b(i will|i'll|i need to|i should|i am going to)\b/i.test(line)) {
    fields.owner = ctx.settings.myName;
    provenance.owner = { basis: 'explicit', evidence: line.match(/\b(i will|i'll|i need to|i should|i am going to)\b/i)![0] };
  }
  if (!fields.owner && kind !== 'quick') {
    fields.owner = '';
    flags.push('Owner not stated in the source — please assign.');
  }

  // Waiting: "waiting on Robert for credentials", "Brenda will get back to us"
  if ((m = line.match(/\bwaiting (?:on|for) ([A-Z][a-z]+)/))) {
    fields.status = 'waiting';
    fields.waitingOn = m[1];
    fields.waitingSince = ctx.today;
    provenance.waitingOn = { basis: 'explicit', evidence: m[0] };
  } else if ((m = line.match(/\b([A-Z][a-z]+) (?:will get back|to get back|will reply|will respond|will send)/))) {
    fields.status = 'waiting';
    fields.waitingOn = m[1];
    fields.waitingSince = ctx.today;
    provenance.waitingOn = { basis: 'explicit', evidence: m[0] };
  }

  // Dates: only an explicit "by/due/deadline" phrase becomes a due date. Other date mentions become
  // a next-action date (revisit), never a deadline.
  if ((m = line.match(/\b(?:by|due|deadline|no later than|before)\s+((?:next |this )?[a-z0-9/,-]+(?: \d{1,2}(?:st|nd|rd|th)?)?)/i))) {
    const d = parseDatePhrase(m[1], ctx.today);
    if (d) {
      fields.dueDate = d;
      provenance.dueDate = { basis: 'explicit', evidence: m[0] };
    }
  }
  if (!fields.dueDate && (m = line.match(/\b(?:on|after|next|this|tomorrow|today)\b[^.,;]*/i))) {
    const d = parseDatePhrase(m[0], ctx.today);
    if (d) {
      fields.nextActionDate = d;
      provenance.nextActionDate = { basis: 'explicit', evidence: m[0].trim() };
      if (/\bafter\b/i.test(m[0])) flags.push('Revisit date derived from "after …" — confirm the exact day.');
    }
  }

  // Contact & company: only names already known to the app are matched (never invented).
  for (const c of ctx.contacts) {
    const first = c.name.split(' ')[0];
    const re = new RegExp(`\\b(${escapeRe(c.name)}|${escapeRe(first)})\\b`, 'i');
    if (re.test(line)) {
      fields.contact = c.name;
      provenance.contact = { basis: 'inferred', evidence: line.match(re)![0] };
      inferred.push('contact');
      if (c.company && !fields.company) {
        fields.company = c.company;
        provenance.company = { basis: 'inferred', evidence: `${c.name} is linked to ${c.company}` };
        inferred.push('company');
      }
      if (c.status === 'closed') flags.push(`${c.name} is a closed contact — no new outreach recommended.`);
      break;
    }
  }
  for (const co of ctx.knownCompanies) {
    if (!fields.company && co && new RegExp(`\\b${escapeRe(co)}\\b`, 'i').test(line)) {
      fields.company = co;
      provenance.company = { basis: 'explicit', evidence: co };
    }
  }

  const cat = inferCategory(line, ctx.categories);
  if (cat) {
    fields.categoryId = cat.id;
    provenance.categoryId = { basis: 'inferred', evidence: `keyword match → ${cat.name}` };
    inferred.push('categoryId');
  } else {
    flags.push('Category not clear — please choose one.');
  }

  if (/\b(call|phone|dial)\b/i.test(line)) fields.requiresCall = true;
  if (/\b(follow up|follow-up|reach out|email|send|reply|outreach)\b/i.test(line)) fields.isOutreach = true;

  fields.inferredFields = inferred;
  fields.reviewFlags = flags.slice();
  return {
    fields,
    provenance,
    flags,
    rationale: 'Extracted by the offline parser from a line that reads like a request or commitment.',
  };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
