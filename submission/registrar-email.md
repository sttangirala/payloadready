Subject: Tonight's Prism batch — identity decisions ready, 5 clear to write, 5 need your review, 2 blocked

Priya,

I ran tonight's Prism batch (12 applications) against Banner and the
matching policy from your emails. Here is where every application
landed. No writes have happened yet — this is the decision list for
approval, not a completed job.

**5 approved for automated Banner identity writeback (AUTO_MATCH):**
APP-88421 → A00012345, APP-90001 → A00030001, APP-90002 → A00030002,
APP-94001 → A00060001, APP-98001 → A00011111. Each of these has an
independently corroborated filename, name, and date of birth with no
contradictions — including the two Nguyen siblings on the shared family
email, which resolved to two distinct, correct people on name+DOB
evidence alone, not the email.

**5 held for your review (HITL_REVIEW):**
- APP-91002 (→ A00040001) and APP-99001 (no candidate found) — both
  international applicants, held per your instruction rather than
  skipped or auto-written, even though APP-91002's match evidence is
  otherwise strong.
- APP-93015 — proposed candidate A00050099, but the transcript
  filename pointed at a different existing person. Cover-sheet reuse,
  most likely; the application/transcript identity itself checks out
  independently, but I won't write past a filename conflict.
- APP-92010 — no candidate proposed. The filename points to an
  existing employee record whose birth year doesn't match the
  applicant; I did not propose that record as the target, and no other
  Banner person matches.
- APP-95001 (→ A00080001, tentative) — the transcript's OCR date of
  birth conflicts with Banner's, and OCR confidence on that page is
  low. Name and filename otherwise line up.

**2 blocked from writing (DO_NOT_WRITE):**
- APP-96001 → A00090001 is a deceased Banner record. Per the mapping
  spec this should escalate to Admissions rather than be written or
  quietly dropped.
- APP-97001 → A00000001 is the test/dummy record.

**Transfer credit:** zero posts, for all 12 applications, including the
5 approved matches. The batch contains no evaluated courses,
equivalencies, accepted hours, or grades — only OCR'd transcript
metadata. Identity and credit are separate decisions in this system;
confirming who someone is doesn't tell us what to post for them. Two of
the candidates involved (APP-90002's and APP-95001's) also already
carry posted transfer credit in Banner, so those are additionally
flagged not to be posted again once evaluated data does arrive.

**Why this is safer for Monday:** every write this batch could produce
tonight is one where filename, name, and DOB agree with no
contradictions and no policy block — nothing here would need to be
unwound in October. Everything with a real question behind it (a
shared family email, a reused cover sheet, a birth-year mismatch, weak
OCR, an international hold, a deceased or test record) is surfaced for
you by name of the problem, not silently guessed at or silently
dropped.

**What I need from you:**
1. Approve (or redirect) the 5 `HITL_REVIEW` rows above — in particular
   confirm APP-93015's proposed candidate, and tell me whether APP-92010
   should go to Admissions to locate the correct record.
2. Confirm APP-96001 should be escalated to Admissions as a deceased
   record rather than closed out here.
3. Nothing is needed on the 5 `AUTO_MATCH` or the test record
   (APP-97001) — those are ready to proceed / already excluded.

Full detail, reason codes, and confidence scores are in the attached
`decisions.csv`. Call me if anything above needs to move before
Monday.

— (Prepared by AI-assisted tooling on your written instructions; see
`prompts.md` for the full record.)
