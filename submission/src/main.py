"""CLI entry point: load extracts, apply policy, write decisions.csv.

    python -m src.main --data-dir challenge-data --output decisions.csv

Fails closed (raises DataValidationError, exit code 2) on missing
columns, duplicate application IDs, duplicate/missing transcript rows,
invalid DOB formats, malformed confidence values, or unrecognized
app_type/student_type values. Error messages name the file, app_id (when
known), and field name only -- never the offending value, per the
no-sensitive-data-in-logs requirement.
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Dict, List

from . import normalization as norm
from . import matcher
from .models import Application, BannerRecord, Transcript

KNOWN_APP_TYPES = {"Transfer", "Continuing", "International", "DegreeSeeking"}
KNOWN_STUDENT_TYPES = {"Degree", "DualEnroll", "Employee"}

APPLICATIONS_COLUMNS = {"app_id", "first", "last", "dob", "email", "ssn_last4", "term", "app_type"}
BANNER_COLUMNS = {
    "banner_id", "pidm", "legal_first", "legal_last", "preferred_name", "dob",
    "email", "ssn_last4", "student_status", "student_type", "deceased",
    "posted_transfer_credits",
}
TRANSCRIPT_COLUMNS = {
    "file_name", "app_id", "ocr_name", "ocr_dob", "source_institution", "ocr_confidence",
}


class DataValidationError(Exception):
    """Raised for any fail-closed input problem. Message must stay safe:
    file name / app_id / field name only, never the field's value."""


def _read_csv(path: Path) -> List[dict]:
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        rows = [row for row in reader if any((v or "").strip() for v in row.values())]
        return rows, reader.fieldnames or []


def _require_columns(fieldnames, required, filename):
    missing = required - set(fieldnames)
    if missing:
        raise DataValidationError(
            f"{filename}: missing required column(s): {', '.join(sorted(missing))}"
        )


def load_applications(path: Path) -> Dict[str, Application]:
    rows, fieldnames = _read_csv(path)
    _require_columns(fieldnames, APPLICATIONS_COLUMNS, path.name)
    out: Dict[str, Application] = {}
    for row in rows:
        app_id = row["app_id"].strip()
        if not app_id:
            raise DataValidationError(f"{path.name}: row with blank app_id")
        if app_id in out:
            raise DataValidationError(f"{path.name}: duplicate app_id {app_id}")
        try:
            dob_iso = norm.parse_dob_slash(row["dob"])
        except norm.DateParseError as exc:
            raise DataValidationError(f"{path.name}: {app_id}: invalid field 'dob' ({exc})") from exc
        app_type = row["app_type"].strip()
        if app_type not in KNOWN_APP_TYPES:
            raise DataValidationError(f"{path.name}: {app_id}: unsupported field 'app_type'")
        out[app_id] = Application(
            app_id=app_id,
            first=row["first"].strip(),
            last=row["last"].strip(),
            dob_iso=dob_iso,
            email=row["email"].strip().lower(),
            ssn_last4=row["ssn_last4"].strip(),
            term=row["term"].strip(),
            app_type=app_type,
        )
    return out


def load_banner(path: Path) -> Dict[str, BannerRecord]:
    rows, fieldnames = _read_csv(path)
    _require_columns(fieldnames, BANNER_COLUMNS, path.name)
    out: Dict[str, BannerRecord] = {}
    for row in rows:
        banner_id = row["banner_id"].strip()
        if not banner_id:
            raise DataValidationError(f"{path.name}: row with blank banner_id")
        if banner_id in out:
            raise DataValidationError(f"{path.name}: duplicate banner_id {banner_id}")
        try:
            dob_iso = norm.parse_dob_iso(row["dob"])
        except norm.DateParseError as exc:
            raise DataValidationError(
                f"{path.name}: {banner_id}: invalid field 'dob' ({exc})"
            ) from exc
        deceased_raw = row["deceased"].strip().upper()
        if deceased_raw not in {"Y", "N"}:
            raise DataValidationError(f"{path.name}: {banner_id}: unsupported field 'deceased'")
        student_type = row["student_type"].strip()
        if student_type not in KNOWN_STUDENT_TYPES:
            raise DataValidationError(f"{path.name}: {banner_id}: unsupported field 'student_type'")
        try:
            credits = int(row["posted_transfer_credits"].strip())
        except ValueError as exc:
            raise DataValidationError(
                f"{path.name}: {banner_id}: invalid field 'posted_transfer_credits'"
            ) from exc
        out[banner_id] = BannerRecord(
            banner_id=banner_id,
            pidm=row["pidm"].strip(),
            legal_first=row["legal_first"].strip(),
            legal_last=row["legal_last"].strip(),
            preferred_name=row["preferred_name"].strip(),
            dob_iso=dob_iso,
            email=row["email"].strip().lower(),
            ssn_last4=row["ssn_last4"].strip(),
            student_status=row["student_status"].strip(),
            student_type=student_type,
            deceased=(deceased_raw == "Y"),
            posted_transfer_credits=credits,
        )
    return out


def load_transcripts(path: Path) -> Dict[str, Transcript]:
    rows, fieldnames = _read_csv(path)
    _require_columns(fieldnames, TRANSCRIPT_COLUMNS, path.name)
    out: Dict[str, Transcript] = {}
    for row in rows:
        app_id = row["app_id"].strip()
        if not app_id:
            raise DataValidationError(f"{path.name}: row with blank app_id")
        if app_id in out:
            raise DataValidationError(f"{path.name}: duplicate transcript row for {app_id}")
        try:
            ocr_dob_iso = norm.parse_dob_ocr(row["ocr_dob"])
        except norm.DateParseError as exc:
            raise DataValidationError(
                f"{path.name}: {app_id}: invalid field 'ocr_dob' ({exc})"
            ) from exc
        try:
            confidence = float(row["ocr_confidence"].strip())
        except ValueError as exc:
            raise DataValidationError(
                f"{path.name}: {app_id}: malformed field 'ocr_confidence'"
            ) from exc
        if not (0.0 <= confidence <= 1.0):
            raise DataValidationError(
                f"{path.name}: {app_id}: field 'ocr_confidence' out of range"
            )
        out[app_id] = Transcript(
            file_name=row["file_name"].strip(),
            app_id=app_id,
            ocr_name=row["ocr_name"].strip(),
            ocr_dob_iso=ocr_dob_iso,
            source_institution=row["source_institution"].strip(),
            ocr_confidence=confidence,
        )
    return out


def cross_validate(applications: Dict[str, Application], transcripts: Dict[str, Transcript]) -> None:
    app_ids = set(applications)
    transcript_ids = set(transcripts)
    missing = app_ids - transcript_ids
    if missing:
        raise DataValidationError(
            f"applications.csv: {len(missing)} application(s) have no transcript row"
        )
    orphaned = transcript_ids - app_ids
    if orphaned:
        raise DataValidationError(
            f"transcripts.csv: {len(orphaned)} transcript row(s) reference an unknown app_id"
        )


def run(data_dir: Path, output_path: Path) -> List:
    applications = load_applications(data_dir / "applications.csv")
    banner = load_banner(data_dir / "banner.csv")
    transcripts = load_transcripts(data_dir / "transcripts.csv")
    cross_validate(applications, transcripts)

    email_counts = matcher.count_emails(list(applications.values()))

    decisions = []
    for app_id in sorted(applications):
        app = applications[app_id]
        transcript = transcripts[app_id]
        decision = matcher.evaluate(app, transcript, banner, email_counts)
        decisions.append(decision)

    with output_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["app_id", "banner_id", "bucket", "confidence", "reasons", "write_credits", "notes"])
        for decision in decisions:
            writer.writerow(decision.as_row())

    return decisions


def print_summary(decisions: List) -> None:
    total = len(decisions)
    auto = sum(1 for d in decisions if d.bucket == "AUTO_MATCH")
    review = sum(1 for d in decisions if d.bucket == "HITL_REVIEW")
    blocked = sum(1 for d in decisions if d.bucket == "DO_NOT_WRITE")
    credits = sum(1 for d in decisions if d.write_credits == "yes")
    print(
        f"Processed {total} applications: {auto} auto-matched, "
        f"{review} held for review, {blocked} blocked, {credits} credit posts."
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Campus Identity Collision resolver")
    parser.add_argument("--data-dir", required=True, help="Directory containing the input extracts")
    parser.add_argument("--output", required=True, help="Path to write decisions.csv")
    args = parser.parse_args(argv)

    data_dir = Path(args.data_dir)
    output_path = Path(args.output)

    try:
        decisions = run(data_dir, output_path)
    except DataValidationError as exc:
        print(f"Input validation failed: {exc}", file=sys.stderr)
        return 2

    print_summary(decisions)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
