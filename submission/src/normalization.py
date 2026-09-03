"""Normalization helpers: names and dates.

Every function here is pure and side-effect free so it can be unit
tested directly. None of these functions print or log their inputs.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Optional, Set

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


class DateParseError(ValueError):
    """Raised when a DOB string cannot be safely, unambiguously parsed."""


def parse_dob_slash(value: str) -> str:
    """Parse the applications.csv DOB format.

    The supplied data is MM/DD/YYYY except where the month field is not a
    valid month (e.g. "22/08/1999"), in which case it is unambiguously
    DD/MM/YYYY because no valid MM/DD interpretation exists. This mirrors
    the "unambiguous DOB formats used in the supplied data" normalization
    requirement -- it is not a general-purpose date guesser.
    """
    value = (value or "").strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", value)
    if not m:
        raise DateParseError("unrecognized application DOB format")
    a, b, year = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    if 1 <= a <= 12 and 1 <= b <= 31:
        month, day = a, b
    elif 1 <= b <= 12 and 1 <= a <= 31:
        # First field isn't a valid month -> must be DD/MM/YYYY.
        month, day = b, a
    else:
        raise DateParseError("application DOB has no valid month/day interpretation")
    return _to_iso(year, month, day)


def parse_dob_iso(value: str) -> str:
    """Parse the banner.csv DOB format (already YYYY-MM-DD)."""
    value = (value or "").strip()
    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", value)
    if not m:
        raise DateParseError("unrecognized banner DOB format")
    year, month, day = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return _to_iso(year, month, day)


def parse_dob_ocr(value: str) -> Optional[str]:
    """Parse the transcripts.csv DOB format, e.g. "12 Mar 1998".

    Returns None (rather than raising) when the field is blank, since a
    missing OCR DOB is non-blocking evidence, not a data-integrity error.
    Raises DateParseError for a present-but-unparseable value.
    """
    value = (value or "").strip()
    if not value:
        return None
    m = re.fullmatch(r"(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})", value)
    if not m:
        raise DateParseError("unrecognized transcript OCR DOB format")
    day = int(m.group(1))
    month_key = m.group(2).lower()[:3]
    year = int(m.group(3))
    if month_key not in _MONTHS:
        raise DateParseError("unrecognized month name in transcript OCR DOB")
    return _to_iso(year, _MONTHS[month_key], day)


def _to_iso(year: int, month: int, day: int) -> str:
    try:
        return date(year, month, day).isoformat()
    except ValueError as exc:
        raise DateParseError("DOB is not a real calendar date") from exc


_PUNCT_RE = re.compile(r"[^A-Za-z0-9]+")


def normalize_token(text: str) -> str:
    """Lowercase, strip punctuation/hyphens/whitespace, for one name token."""
    return _PUNCT_RE.sub(" ", (text or "").strip().lower()).strip()


def name_tokens(*parts: str) -> Set[str]:
    """Split one or more raw name strings into a set of comparable tokens.

    Handles hyphenated surnames ("Garcia-Lopez" -> {garcia, lopez}),
    "LAST, FIRST" transcript strings, middle initials, and surrounding
    whitespace/case. Single-letter tokens (initials, e.g. "D.") are kept
    as-is so callers can do initial-aware comparison.
    """
    tokens: Set[str] = set()
    for part in parts:
        if not part:
            continue
        cleaned = part.replace(",", " ")
        for raw in _PUNCT_RE.sub(" ", cleaned).split():
            norm = raw.strip().lower()
            if norm:
                tokens.add(norm)
    return tokens


def parse_ocr_name(ocr_name: str) -> Set[str]:
    """Token set for an OCR'd transcript name in either name-order."""
    return name_tokens(ocr_name)


def first_name_compatible(app_first_token: str, banner_first_tokens: Set[str]) -> bool:
    """True if an applicant's first name is consistent with Banner's.

    Supports exact match and initial-only applicant data (e.g. "D."
    matching "David") without treating an initial as a strong signal on
    its own -- callers combine this with last-name and DOB evidence.
    """
    app_first_token = normalize_token(app_first_token)
    if not app_first_token:
        return False
    if app_first_token in banner_first_tokens:
        return True
    if len(app_first_token) == 1:
        return any(bt.startswith(app_first_token) for bt in banner_first_tokens)
    return False
