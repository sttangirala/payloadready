// Duplicate detection for intake: token-overlap similarity on titles plus contact/company matches.

import type { DuplicateMatch, Task } from './types';
import { isOpen } from './types';

const STOP = new Set(
  'a an the to for of on in at by with and or re fw fwd about from up out is are be this that it my our your me we i please follow followup follow-up send get call email check'.split(' '),
);

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
      .map((w) => w.replace(/(ing|ed|s)$/, '')),
  );
}

export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size) * 0.6 + (inter / (A.size + B.size - inter)) * 0.4;
}

export interface DupCandidate {
  title: string;
  contact?: string;
  company?: string;
}

export function findDuplicates(candidate: DupCandidate, tasks: Task[], threshold = 0.5): DuplicateMatch[] {
  const out: DuplicateMatch[] = [];
  for (const t of tasks) {
    if (!isOpen(t.status) && !recent(t)) continue;
    let score = similarity(candidate.title, t.title);
    const reasons: string[] = [];
    if (score >= 0.35) reasons.push(`similar title (${Math.round(score * 100)}%)`);
    const sameContact = !!candidate.contact && candidate.contact.toLowerCase() === t.contact.toLowerCase();
    const sameCompany = !!candidate.company && candidate.company.toLowerCase() === t.company.toLowerCase();
    if (sameContact) {
      score += 0.25;
      reasons.push(`same contact (${t.contact})`);
    } else if (sameCompany) {
      score += 0.15;
      reasons.push(`same company (${t.company})`);
    }
    if (score >= threshold && reasons.length) {
      out.push({ taskId: t.id, title: t.title, score: Math.min(1, Number(score.toFixed(2))), reason: reasons.join(', ') });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

function recent(t: Task): boolean {
  if (!t.completedAt) return false;
  return Date.now() - new Date(t.completedAt).getTime() < 14 * 86_400_000;
}

/** Stable hash of normalized source text, used to flag re-imported emails/notes. */
export function textHash(text: string): string {
  const norm = text.replace(/\s+/g, ' ').trim().toLowerCase();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < norm.length; i++) {
    const ch = norm.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
