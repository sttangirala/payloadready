"""Plain data containers for the identity-resolution pipeline.

Kept dependency-free (dataclasses only) so the models can be shared by
main.py, matcher.py and the tests without any risk of leaking sensitive
fields into logs -- callers are responsible for only printing the safe
subset (app_id / banner_id / bucket / reasons).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class Application:
    app_id: str
    first: str
    last: str
    dob_iso: str  # normalized YYYY-MM-DD
    email: str
    ssn_last4: str
    term: str
    app_type: str


@dataclass(frozen=True)
class BannerRecord:
    banner_id: str
    pidm: str
    legal_first: str
    legal_last: str
    preferred_name: str
    dob_iso: str
    email: str
    ssn_last4: str
    student_status: str
    student_type: str
    deceased: bool
    posted_transfer_credits: int


@dataclass(frozen=True)
class Transcript:
    file_name: str
    app_id: str
    ocr_name: str
    ocr_dob_iso: Optional[str]  # None when unparseable but non-blocking
    source_institution: str
    ocr_confidence: float


@dataclass
class Decision:
    app_id: str
    banner_id: str
    bucket: str
    confidence: float
    reasons: list = field(default_factory=list)
    write_credits: str = "no"
    notes: str = ""

    def as_row(self) -> list:
        return [
            self.app_id,
            self.banner_id,
            self.bucket,
            f"{self.confidence:.2f}",
            ";".join(self.reasons),
            self.write_credits,
            self.notes,
        ]
