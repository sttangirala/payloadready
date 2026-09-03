"""Deterministic identity-resolution matcher.

Implements the safety policy in policy.py against evidence assembled by
main.py's loaders. No function in this module accepts application ID as
a branch condition -- every decision path is driven by extracted
evidence (filename candidate, name-token overlap, DOB agreement, Banner
record flags), so the same code handles every row generically.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Dict, List, Optional

from . import normalization as norm
from . import policy
from .models import Application, BannerRecord, Decision, Transcript

_FILENAME_ID_RE = re.compile(r"^(A\d+)_")


def extract_filename_candidate(file_name: str) -> Optional[str]:
    """Pull a leading Banner-ID-shaped token off a transcript filename.

    Per mapping-spec.txt #3, a filename starting "A00..._" names a
    candidate Banner ID. This is evidence only -- never authoritative by
    itself (registrar: "scanner cover sheets may be reused").
    """
    m = _FILENAME_ID_RE.match(file_name or "")
    return m.group(1) if m else None


def banner_full_tokens(rec: BannerRecord):
    return norm.name_tokens(rec.legal_first, rec.legal_last, rec.preferred_name)


def banner_last_tokens(rec: BannerRecord):
    return norm.name_tokens(rec.legal_last)


def banner_first_tokens(rec: BannerRecord):
    return norm.name_tokens(rec.legal_first, rec.preferred_name)


def names_corroborate(app: Application, ocr_tokens, rec: BannerRecord) -> bool:
    """True if the applicant's (and/or transcript's) name is consistent
    with the candidate Banner record, tolerating hyphens, preferred
    names, initials, and East-Asian first/last order swaps (token-set
    comparison is inherently order independent).
    """
    app_tokens = norm.name_tokens(app.first, app.last)
    banner_tokens = banner_full_tokens(rec)

    def token_set_consistent(tokens) -> bool:
        if not tokens:
            return False
        # Last-name evidence must be present in Banner's name tokens.
        last_norm = norm.normalize_token(app.last)
        has_last_overlap = bool(tokens & banner_last_tokens(rec)) or (
            last_norm in banner_tokens
        )
        # First-name evidence: exact/initial match against Banner first
        # or preferred name tokens.
        has_first_overlap = norm.first_name_compatible(app.first, banner_first_tokens(rec))
        # East Asian order swap: full token sets are equal regardless of
        # which column held "first" vs "last".
        order_swap_match = tokens == banner_tokens or tokens.issubset(banner_tokens)
        return (has_last_overlap and has_first_overlap) or order_swap_match

    if token_set_consistent(app_tokens):
        return True
    if ocr_tokens and token_set_consistent(ocr_tokens):
        return True
    return False


def dob_agrees(a: Optional[str], b: Optional[str]) -> Optional[bool]:
    """None when either side is unavailable (no evidence either way)."""
    if not a or not b:
        return None
    return a == b


def find_name_dob_candidates(
    app: Application,
    ocr_tokens,
    ocr_dob_iso: Optional[str],
    banner_by_id: Dict[str, BannerRecord],
    exclude_ids: set,
) -> List[BannerRecord]:
    """Fallback search across the full Banner extract, used only when the
    filename candidate is absent or has been rejected as conflicting.
    Requires name AND DOB agreement (against app DOB and/or OCR DOB) so a
    single weak signal can never produce a proposed candidate.
    """
    hits = []
    for rec in banner_by_id.values():
        if rec.banner_id in exclude_ids:
            continue
        if rec.student_type not in ("Degree", "DualEnroll"):
            continue
        if not names_corroborate(app, ocr_tokens, rec):
            continue
        agree_app = dob_agrees(app.dob_iso, rec.dob_iso)
        agree_ocr = dob_agrees(ocr_dob_iso, rec.dob_iso)
        if agree_app or agree_ocr:
            hits.append(rec)
    return hits


def is_blocked(rec: BannerRecord) -> Optional[str]:
    """Return a blocking reason code, or None if the record is writable."""
    if rec.banner_id == "A00000001" or "test" in banner_full_tokens(rec):
        return policy.TEST_RECORD
    if rec.deceased:
        return policy.DECEASED_RECORD
    return None


def evaluate(
    app: Application,
    transcript: Transcript,
    banner_by_id: Dict[str, BannerRecord],
    email_counts: Dict[str, int],
) -> Decision:
    ocr_tokens = norm.parse_ocr_name(transcript.ocr_name)
    filename_id = extract_filename_candidate(transcript.file_name)
    filename_rec = banner_by_id.get(filename_id) if filename_id else None

    reasons: List[str] = []
    notes = ""
    candidate: Optional[BannerRecord] = None
    candidate_source_is_filename = False
    filename_conflict = False

    if email_counts.get(app.email, 0) > 1:
        reasons.append(policy.SHARED_EMAIL)

    if filename_id:
        if filename_rec is None:
            # Filename names a Banner ID that doesn't exist in the extract.
            filename_conflict = True
        else:
            name_ok = names_corroborate(app, ocr_tokens, filename_rec)
            dob_app_ok = dob_agrees(app.dob_iso, filename_rec.dob_iso)
            dob_ocr_ok = dob_agrees(transcript.ocr_dob_iso, filename_rec.dob_iso)
            dob_conflict = (dob_app_ok is False) or (dob_ocr_ok is False)
            # A non-student (e.g. Employee) Banner record is never a
            # defensible writeback target for a student application, no
            # matter how well the name lines up -- treat the filename
            # candidate as rejected, same as a name mismatch, so it
            # falls through to the alternate-candidate search below
            # rather than being proposed (registrar: "Do not propose
            # that employee as the target").
            non_student = filename_rec.student_type not in ("Degree", "DualEnroll")
            if name_ok and not dob_conflict and not non_student:
                candidate = filename_rec
                candidate_source_is_filename = True
                reasons.append(policy.FILENAME_ID)
                reasons.append(policy.NAME_CORROBORATED)
                if dob_app_ok or dob_ocr_ok:
                    reasons.append(policy.DOB_CORROBORATED)
            elif name_ok and dob_conflict and not non_student:
                # Filename + name line up, but a DOB source disagrees
                # with Banner. Too fragile to auto-write; still the most
                # defensible proposed candidate.
                candidate = filename_rec
                candidate_source_is_filename = True
                reasons.append(policy.FILENAME_ID)
                reasons.append(policy.NAME_CORROBORATED)
                reasons.append(policy.DOB_CONFLICT)
            else:
                filename_conflict = True
                if non_student:
                    reasons.append(policy.NOT_STUDENT_RECORD)
                # Only surface DOB_CONFLICT here when the name otherwise
                # matched: a DOB comparison is only meaningful evidence
                # about *this* candidate once the name has tied the
                # applicant to them. A name mismatch alone is already
                # fully explained by FILENAME_CONFLICT below.
                if name_ok and dob_conflict:
                    reasons.append(policy.DOB_CONFLICT)

    if filename_conflict:
        reasons.append(policy.FILENAME_CONFLICT)
        exclude = {filename_id} if filename_id else set()
        alternates = find_name_dob_candidates(
            app, ocr_tokens, transcript.ocr_dob_iso, banner_by_id, exclude
        )
        if len(alternates) == 1:
            candidate = alternates[0]
            candidate_source_is_filename = False
            reasons.append(policy.NAME_CORROBORATED)
            reasons.append(policy.DOB_CORROBORATED)
        else:
            candidate = None

    if candidate is None and not filename_id:
        alternates = find_name_dob_candidates(
            app, ocr_tokens, transcript.ocr_dob_iso, banner_by_id, set()
        )
        if len(alternates) == 1:
            candidate = alternates[0]
            candidate_source_is_filename = False
            reasons.append(policy.NAME_CORROBORATED)
            reasons.append(policy.DOB_CORROBORATED)

    if app.ssn_last4 and candidate and app.ssn_last4 == candidate.ssn_last4:
        reasons.append(policy.LAST4_SUPPORT_ONLY)

    if candidate is None:
        # A prior candidate that was actively rejected on DOB grounds
        # (DOB_CONFLICT already recorded above) is a different situation
        # from nobody-by-this-name-existing: there was a defensible lead,
        # it just didn't hold up. Say so distinctly rather than implying
        # no Banner person was ever found.
        if policy.DOB_CONFLICT in reasons:
            reasons.append(policy.NO_DEFENSIBLE_CANDIDATE)
        else:
            reasons.append(policy.NO_EXISTING_PERSON)

    # write_credits is always "no": the supplied extracts contain no
    # evaluated courses, equivalencies, accepted hours, or grades, so no
    # automated post can ever be defensible from this data alone.
    reasons.append(policy.CREDITS_NOT_EVALUATED)
    if candidate is not None and candidate.posted_transfer_credits > 0:
        reasons.append(policy.EXISTING_TRANSFER_CREDIT)

    if candidate is not None and candidate.student_type == "DualEnroll":
        reasons.append(policy.DUAL_ENROLL_EXISTING)

    if transcript.ocr_confidence < policy.LOW_OCR_CONFIDENCE_THRESHOLD:
        reasons.append(policy.LOW_OCR_CONFIDENCE)

    block_reason = is_blocked(candidate) if candidate is not None else None
    if candidate is not None and candidate.student_type == "Employee":
        block_reason = block_reason or policy.NOT_STUDENT_RECORD

    is_international = app.app_type == policy.INTERNATIONAL_APP_TYPE
    if is_international:
        reasons.append(policy.INTERNATIONAL_HOLD)

    has_conflict = policy.DOB_CONFLICT in reasons or policy.FILENAME_CONFLICT in reasons
    # A candidate proposed via independent name+DOB corroboration despite
    # a rejected filename lead (not one accepted straight from the
    # filename) is evaluated differently: the filename mechanism being
    # wrong doesn't itself weaken that independent evidence.
    filename_conflict_independent = (
        policy.FILENAME_CONFLICT in reasons and not candidate_source_is_filename
    )
    confidence = _score_confidence(
        filename_ok=candidate_source_is_filename and policy.FILENAME_ID in reasons,
        name_ok=policy.NAME_CORROBORATED in reasons,
        dob_ok=policy.DOB_CORROBORATED in reasons,
        dob_conflict=policy.DOB_CONFLICT in reasons,
        filename_conflict_independent=filename_conflict_independent,
        last4_support=policy.LAST4_SUPPORT_ONLY in reasons,
        candidate_present=candidate is not None,
    )

    if candidate is not None and block_reason:
        bucket = policy.DO_NOT_WRITE
        reasons.append(block_reason)
        notes = _blocked_note(block_reason)
    elif candidate is None:
        bucket = policy.HITL_REVIEW
        notes = _no_candidate_note(is_international)
    elif is_international:
        bucket = policy.HITL_REVIEW
        notes = "Strong local match evidence, but held per registrar policy for international applicants."
    elif has_conflict:
        bucket = policy.HITL_REVIEW
        notes = _conflict_note(reasons)
    else:
        bucket = policy.AUTO_MATCH
        notes = "Filename, name, and DOB independently corroborate an existing Banner person."

    banner_id_out = candidate.banner_id if candidate is not None else ""
    return Decision(
        app_id=app.app_id,
        banner_id=banner_id_out,
        bucket=bucket,
        confidence=confidence,
        reasons=_dedupe(reasons),
        write_credits="no",
        notes=notes,
    )


def _dedupe(items: List[str]) -> List[str]:
    seen = []
    for item in items:
        if item not in seen:
            seen.append(item)
    return seen


def _score_confidence(
    filename_ok,
    name_ok,
    dob_ok,
    dob_conflict,
    filename_conflict_independent,
    last4_support,
    candidate_present,
) -> float:
    if not candidate_present:
        return 0.0
    score = 0.0
    if filename_ok:
        score += policy.WEIGHT_FILENAME
    if name_ok:
        score += policy.WEIGHT_NAME
    if dob_ok:
        score += policy.WEIGHT_DOB
    if dob_conflict:
        # A DOB source actively disagreeing with this specific
        # candidate is genuine conflicting identity evidence.
        score -= policy.CONFLICT_PENALTY
    if filename_conflict_independent and last4_support:
        # The candidate didn't come from the (rejected) filename at
        # all -- it was independently corroborated by name and DOB.
        # A supporting (non-decisive) SSN last-4 match on top of that
        # independent corroboration is additional support, not a
        # reason to discount the identity evidence the way a directly
        # conflicting DOB would be.
        score += policy.INDEPENDENT_LAST4_SUPPORT_BONUS
    score = max(0.0, min(score, 0.99))
    return round(score, 2)


def _blocked_note(reason: str) -> str:
    mapping = {
        policy.TEST_RECORD: "Candidate Banner record is a test/dummy record and must not be written.",
        policy.DECEASED_RECORD: "Candidate Banner record is flagged deceased and must not be written.",
        policy.NOT_STUDENT_RECORD: "Filename candidate is an employee record, not a matching student.",
    }
    return mapping.get(reason, "Candidate Banner record is blocked by policy.")


def _no_candidate_note(is_international: bool) -> str:
    if is_international:
        return "No existing Banner person could be defensibly identified; international applicant held, not discarded."
    return "No defensible existing Banner person was identified from the supplied evidence."


def _conflict_note(reasons: List[str]) -> str:
    if policy.FILENAME_CONFLICT in reasons:
        return "Transcript filename points to a different identity than the application; held for manual verification."
    if policy.DOB_CONFLICT in reasons:
        return "Date of birth evidence conflicts across sources; held for manual verification."
    return "Conflicting identity evidence; held for manual verification."


def count_emails(applications: List[Application]) -> Dict[str, int]:
    counts: Dict[str, int] = defaultdict(int)
    for app in applications:
        if app.email:
            counts[app.email] += 1
    return counts
