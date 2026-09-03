# Campus Identity Collision — Prism → Banner Identity Writeback

A deterministic, auditable CLI that reconciles a Prism admissions batch
(`applications.csv`, `transcripts.csv`) against a Banner extract
(`banner.csv`) and produces one reviewable decision per application. It
never writes to Banner itself — it produces `decisions.csv`, an artifact
a human (or a separate, audited writeback job) acts on.

## The challenge and the policy hierarchy

`emails.txt` records a real disagreement between the registrar (Priya
Nandakumar) and IT (Ken Ito) about how to resolve identity for tonight's
batch before Monday 8am registration. IT's instructions are faster but
unsafe (email is not unique here — the Nguyen siblings alone disprove
it); the registrar's final email overrides them explicitly and in
writing. This program applies:

1. **The registrar's most recent written instructions** (`emails.txt`) —
   highest priority.
2. **Nonconflicting provisions of `mapping-spec.txt`** — an unsigned
   draft that itself says the registrar's written instructions win.
3. **IT's instructions, only where they don't conflict with the
   registrar.**

Every place this program deliberately does *not* follow
`mapping-spec.txt` or Ken Ito's email is documented at the top of
`src/policy.py`, with the registrar quote that overrides it. In short:
email and SSN last-4 are downgraded from "authoritative" to
"support-only," the transcript filename is downgraded from
"authoritative" to "candidate, needs corroboration," and international
applicants without SSNs are held, never skipped.

## How to run the program

From the `submission/` directory, with Python 3 (standard library only,
no installs needed):

```bash
python -m src.main --data-dir challenge-data --output decisions.csv
```

This reads `challenge-data/applications.csv`, `challenge-data/banner.csv`,
and `challenge-data/transcripts.csv`, applies the policy, and writes
`decisions.csv`. Console output is a single safe aggregate line:

```text
Processed 12 applications: 5 auto-matched, 5 held for review, 2 blocked, 0 credit posts.
```

## How to run the tests

```bash
python -m unittest discover -s tests -v
```

26 tests, all passing, covering (among other things) the 16 required
checks in the assignment: one decision per application, no
missing/orphaned transcripts, shared email and SSN-last-4 never solely
driving an automatic decision, filename/DOB conflicts producing review,
internationals held not discarded, test/deceased records blocked, dual
enrollment reused not duplicated, no new Banner person ever created,
every `write_credits` is `no`, no sensitive data in notes or stdout, and
the program's own generated `decisions.csv` matching the committed one
byte-for-byte.

## Matching design and normalization rules

Implemented in `src/normalization.py` and `src/matcher.py`. Nothing in
the matcher branches on `app_id` — every decision is driven by evidence
extracted from the row (filename candidate, name tokens, DOB agreement,
Banner record flags), so the same code path handles all twelve
applications and would handle a thirteenth the same way.

Normalization handles:
- Case and surrounding whitespace.
- Hyphenated / punctuated surnames (`Garcia-Lopez` → tokens `{garcia,
  lopez}`).
- `LAST, FIRST` (transcript OCR) and `FIRST LAST` (application) name
  order.
- Middle initials and single-letter first names (`D.` is treated as
  compatible with `David`, never as strong evidence by itself).
- `MM/DD/YYYY` application DOBs, with the one row in the data
  (`22/08/1999`) recognized as `DD/MM/YYYY` because `22` is not a valid
  month — this is a data-driven, not hardcoded, unambiguity check.
- `YYYY-MM-DD` Banner DOBs and `DD Mon YYYY` transcript OCR DOBs.
- Preferred names (`preferred_name` is treated as an alias for
  `legal_first`).
- East Asian name-order differences: name comparison is a token-set
  comparison, so `Zhang / Wei` (application) matches `Wei / Zhang`
  (Banner's `legal_first`/`legal_last`) because the token sets are
  equal regardless of which column held which name.

### Matching algorithm (per application)

1. Extract a **filename candidate** Banner ID from the transcript
   filename (`^A\d+_` prefix). This is a lead, never a decision.
2. If the candidate exists in Banner: check whether the applicant's
   name (and/or the transcript's OCR name) is consistent with that
   record, and whether the applicant's DOB and/or the OCR DOB agree
   with the record's DOB.
   - Name **and** DOB agree, record is a real student (`Degree` or
     `DualEnroll`) → strong candidate, eligible for `AUTO_MATCH`.
   - Name agrees but a DOB source disagrees → still the most
     defensible candidate, but held (`DOB_CONFLICT`).
   - Name does not agree, the filename ID doesn't exist in Banner, or
     the record is not a student record (e.g. an `Employee`) → the
     filename lead is rejected (`FILENAME_CONFLICT`), and the program
     falls back to an independent search.
3. **Independent fallback search**: only used when there's no usable
   filename candidate. Scans the full Banner extract for a *unique*
   person whose name tokens are consistent with the applicant's (and/or
   OCR's) name **and** whose DOB agrees with the applicant's and/or
   OCR's DOB. If more than one person matches, or none do, no candidate
   is proposed — the row is held, `banner_id` left blank. This is how
   `APP-93015` (filename points to the wrong person; the true candidate
   is found independently) and `APP-92010` (filename points to an
   employee; no independent alternative exists) are resolved without
   ever hardcoding either app_id.
4. Blocking checks are then applied to whatever candidate was found:
   test/dummy record, deceased record. A blocked candidate can still be
   *proposed* (so the registrar/Admissions can see who it would have
   been) but the bucket becomes `DO_NOT_WRITE`.
5. International applicants (`app_type == International`) are always
   downgraded to `HITL_REVIEW`, even with a strong candidate — per the
   registrar's explicit instruction not to skip or auto-write them.
6. Email and SSN last-4 are logged as supporting evidence
   (`SHARED_EMAIL`, `LAST4_SUPPORT_ONLY`) when present, but never
   contribute to whether a candidate is proposed or a bucket is chosen.

Strong automatic matching (`AUTO_MATCH`) therefore always requires: an
existing Banner person, a filename candidate corroborated independently
by name and DOB, no material contradiction, and no blocking condition.

## Bucket semantics

- **`AUTO_MATCH`** — the identity evidence is strong and uncontradicted;
  this row is a defensible candidate for an automated Banner writeback
  (of identity only — see credits, below).
- **`HITL_REVIEW`** — either a defensible candidate exists but something
  about the evidence or the applicant's status means a human must
  approve before any write (conflicting evidence, international
  applicant, low-confidence OCR); or no defensible candidate exists at
  all, and the application must be queued for a human to locate the
  person (never silently dropped). `banner_id` may be populated with a
  *proposed* candidate — that is not permission to write it.
- **`DO_NOT_WRITE`** — a candidate was identified, but writing to it
  would violate a hard policy rule (test record, deceased record). No
  human review can turn this into a write; it needs escalation (per
  `mapping-spec.txt` #7, deceased records escalate to Admissions).

## Confidence semantics

`confidence` is confidence in the **proposed identity match**, not
confidence in the bucket decision or a calibrated probability. A record
can have `confidence` near 1.0 and still be `DO_NOT_WRITE` (e.g.
`APP-96001`: the deceased-record match is very likely correct — that's
exactly why it must not be written to). Do not read these numbers as
statistical probabilities; they are a simple, documented, additive
heuristic score computed in `src/matcher.py::_score_confidence`:

- `+0.40` if the filename candidate is corroborated and used.
- `+0.30` if name evidence is consistent with the candidate.
- `+0.30` if DOB evidence is consistent with the candidate.
- `-0.25` if any conflicting evidence was found (filename conflict or a
  DOB source disagreement), applied after the above.
- `0.00` whenever no candidate is proposed at all.

Roughly: **≥0.85** — filename, name, and DOB all agree with no
conflicts. **0.30–0.60** — a real candidate was found but with a
conflict or via independent corroboration only (no filename support).
**0.00** — no defensible candidate.

## Reason-code glossary

| Code | Meaning |
|---|---|
| `FILENAME_ID` | The transcript filename produced a candidate Banner ID that was used (with corroboration). |
| `NAME_CORROBORATED` | Applicant/OCR name evidence is consistent with the candidate's Banner name (legal or preferred). |
| `DOB_CORROBORATED` | Applicant and/or OCR date of birth agrees with the candidate's Banner DOB. |
| `LAST4_SUPPORT_ONLY` | SSN last-4 matches the candidate — logged as weak supporting evidence only, never decisive. |
| `SHARED_EMAIL` | This applicant's email is used by more than one application in the batch — a flag that email cannot be trusted to distinguish people, not a match signal. |
| `FILENAME_CONFLICT` | The filename's implied Banner ID does not hold up (wrong person, non-student record, or doesn't exist) and was rejected as the target. |
| `DOB_CONFLICT` | A DOB source (application or OCR) materially disagrees with the candidate's Banner DOB. |
| `INTERNATIONAL_HOLD` | Applicant is `app_type = International`; held per registrar instruction regardless of match strength. |
| `NO_EXISTING_PERSON` | No defensible existing Banner person could be identified from the evidence. |
| `DUAL_ENROLL_EXISTING` | The candidate is an existing dual-enrollment Banner person; matched to avoid creating a duplicate person at matriculation. |
| `TEST_RECORD` | The candidate is a test/dummy Banner record; blocked from any write. |
| `DECEASED_RECORD` | The candidate Banner record is flagged deceased; blocked from any write, escalate to Admissions. |
| `NOT_STUDENT_RECORD` | The filename pointed at a non-student Banner record (e.g. an Employee); rejected as a target. |
| `CREDITS_NOT_EVALUATED` | Emitted on every row: the supplied extracts contain no evaluated courses, equivalencies, accepted hours, or grades, so `write_credits` is always `no`. |
| `EXISTING_TRANSFER_CREDIT` | Banner already shows `posted_transfer_credits > 0` for this candidate; do not post again even once evaluated data exists. |
| `LOW_OCR_CONFIDENCE` | Transcript OCR confidence is below 0.75; the transcript's own evidence is weaker, reinforcing a hold where one already exists. |

## FERPA / data-minimization protections

- `decisions.csv` carries only `app_id`, `banner_id`, `bucket`,
  `confidence`, reason codes, `write_credits`, and a one-sentence note.
  No names, emails, SSNs, or DOBs ever appear in it.
- `notes` are template strings drawn from a fixed set in
  `src/matcher.py` — they never interpolate raw applicant data, so a
  name, email, or DOB can never leak into them by construction.
- Console output is a single aggregate summary line; validation errors
  name the file, `app_id` (not a person's name), and the offending
  *field name* — never the field's value (`src/main.py`'s
  `DataValidationError` messages are constructed this way throughout).
- No raw-data debug dumps, caches, or log files are created.
- `tests/test_matcher.py` asserts, over the real generated output and
  captured stdout, that no email address, full DOB, or known SSN
  last-4 value ever appears.

## Assumptions and limitations

- The one application DOB that isn't `MM/DD/YYYY` (`22/08/1999`) is
  resolved as `DD/MM/YYYY` because `22` cannot be a month — a
  data-driven disambiguation, not a general date-format guesser. Any
  other ambiguous DOB (both fields ≤12) would need registrar
  clarification; this program has none in the supplied batch.
  Genuinely malformed dates (not a real calendar date, or no
  interpretation at all) fail closed.
- The independent fallback search (used when the filename lead is
  rejected or absent) requires an *exact, unique* name+DOB match against
  the full Banner extract; this is intentionally strict — it will
  return no candidate rather than guess among multiple similarly-named
  people.
- `posted_transfer_credits` and `deceased` are treated as hard signals
  taken as given from the Banner extract; this program does not
  attempt to verify them independently.
- This tool proposes decisions; it does not connect to Banner, and it
  performs no writes of any kind.

## Why all credit writes are `no`

The supplied extracts (`applications.csv`, `banner.csv`,
`transcripts.csv`) contain no evaluated courses, no course
equivalencies, no accepted-hour counts, and no grades — only OCR'd
transcript metadata (name, DOB, source institution, confidence).
Identity matching and transfer-credit posting are separate decisions:
knowing *who* an applicant is says nothing about *what course work* was
evaluated and accepted for them. Because none of that evaluation data
exists in this batch, `write_credits` is `no` for all 12 applications,
including the 5 that are `AUTO_MATCH` on identity. `EXISTING_TRANSFER_CREDIT`
is also tracked separately, for the two candidates who already carry
posted transfer credit in Banner, so a future credit-posting job knows
not to post again once evaluated data does exist.

## Explicit refusals

1. **I refused to automate identity matching from email, SSN last four,
   or filename alone.** Each is logged as supporting evidence at most
   (`SHARED_EMAIL`, `LAST4_SUPPORT_ONLY`, `FILENAME_ID` always paired
   with independent name+DOB corroboration) and none can single-handedly
   produce an `AUTO_MATCH` — this is enforced by both the code path
   (`src/matcher.py::evaluate`) and dedicated tests.
2. **I refused to create new Banner people or silently discard unmatched
   international applicants.** The matcher's candidate search only ever
   looks up existing Banner IDs; there is no code path that constructs a
   new record. Every application with no defensible candidate — and
   every international applicant regardless of match strength — is
   emitted with `bucket = HITL_REVIEW`, never omitted from
   `decisions.csv`.
3. **I refused to post transfer credit without evaluated course and
   credit-hour data, even when identity confidence was high.**
   `write_credits` is unconditionally `"no"` for all 12 rows, including
   the 5 `AUTO_MATCH` identities, because the supplied files contain no
   evaluated-credit data at all.
