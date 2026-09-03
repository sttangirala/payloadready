"""Encoded safety policy for the Campus Identity Collision writeback.

Policy hierarchy applied throughout this module and matcher.py, highest
wins on conflict:
  1. The registrar's (Priya Nandakumar) most recent written instructions
     in emails.txt.
  2. Nonconflicting provisions of mapping-spec.txt (unsigned draft).
  3. IT's (Ken Ito) instructions, only where they do not conflict with
     the registrar.

Concretely, this means the following mapping-spec.txt / IT provisions are
deliberately NOT implemented, because the registrar's emails override
them:
  - mapping-spec.txt #2 "SSN last4 ... is sufficient for an automated
    match" -- OVERRULED. SSN last4 is support-only (registrar: multiple
    siblings/records are not uniquely identified by weak keys; IT's
    "SSN last four is unique and sufficient" is also overruled).
  - mapping-spec.txt #1 ranks email above name+DOB -- OVERRULED. The
    registrar states email is not unique ("three Nguyen children on
    nguyenfamily@gmail.com") and must never independently establish
    identity.
  - IT: "Match on email. Email is unique in our IdP." -- OVERRULED by
    the registrar's explicit correction in the same thread.
  - IT: "Filename Banner ID is authoritative" -- OVERRULED. The registrar
    and mapping-spec.txt #10 agree filenames are useful but not solely
    authoritative ("scanners reuse cover sheets" / "wrong at least twice
    a week").
  - IT: "International students without SSN should be skipped" --
    OVERRULED. The registrar: "Do not skip internationals ... Hold them
    for me, don't drop them."
  - IT: "please write transfer hours to SHAINST for anyone you match" --
    OVERRULED. No evaluated course/credit-hour data exists in the
    supplied files (see main.py), so write_credits is "no" for every
    row regardless of identity confidence. Identity matching and
    transfer-credit posting are separate decisions.
"""
from __future__ import annotations

# --- Buckets -----------------------------------------------------------
AUTO_MATCH = "AUTO_MATCH"
HITL_REVIEW = "HITL_REVIEW"
DO_NOT_WRITE = "DO_NOT_WRITE"

# --- Reason codes (all defined/glossed in README.md) --------------------
FILENAME_ID = "FILENAME_ID"
NAME_CORROBORATED = "NAME_CORROBORATED"
DOB_CORROBORATED = "DOB_CORROBORATED"
LAST4_SUPPORT_ONLY = "LAST4_SUPPORT_ONLY"
SHARED_EMAIL = "SHARED_EMAIL"
FILENAME_CONFLICT = "FILENAME_CONFLICT"
DOB_CONFLICT = "DOB_CONFLICT"
INTERNATIONAL_HOLD = "INTERNATIONAL_HOLD"
NO_EXISTING_PERSON = "NO_EXISTING_PERSON"
NO_DEFENSIBLE_CANDIDATE = "NO_DEFENSIBLE_CANDIDATE"
DUAL_ENROLL_EXISTING = "DUAL_ENROLL_EXISTING"
TEST_RECORD = "TEST_RECORD"
DECEASED_RECORD = "DECEASED_RECORD"
CREDITS_NOT_EVALUATED = "CREDITS_NOT_EVALUATED"
EXISTING_TRANSFER_CREDIT = "EXISTING_TRANSFER_CREDIT"
LOW_OCR_CONFIDENCE = "LOW_OCR_CONFIDENCE"
NAME_MISMATCH = "NAME_MISMATCH"
NOT_STUDENT_RECORD = "NOT_STUDENT_RECORD"

# --- Thresholds ----------------------------------------------------------
# Below this OCR confidence, the transcript's own evidence is treated as
# too weak to help *corroborate* a match (it can still trigger a hold).
LOW_OCR_CONFIDENCE_THRESHOLD = 0.75

INTERNATIONAL_APP_TYPE = "International"

# Confidence contribution of each independent, present piece of identity
# evidence when it corroborates (not conflicts). These are documented in
# README.md as heuristic weights, not calibrated probabilities.
WEIGHT_FILENAME = 0.40
WEIGHT_NAME = 0.30
WEIGHT_DOB = 0.30
CONFLICT_PENALTY = 0.25

# Applied instead of CONFLICT_PENALTY when a candidate was proposed by
# independent name+DOB corroboration (not the filename) despite a
# rejected/conflicting filename lead: the filename mechanism being wrong
# (e.g. a reused scanner cover sheet) does not itself weaken the
# candidate's own name/DOB evidence, so a present supporting SSN
# last-4 match adds confidence rather than the standard conflict
# penalty being subtracted.
INDEPENDENT_LAST4_SUPPORT_BONUS = 0.20
