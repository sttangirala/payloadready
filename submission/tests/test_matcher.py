"""Tests for the Campus Identity Collision resolver.

Run with:  python -m unittest discover -s tests -v
(from the submission/ directory)
"""
from __future__ import annotations

import csv
import io
import re
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

SUBMISSION_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SUBMISSION_ROOT))

from src import main as main_mod  # noqa: E402
from src import matcher  # noqa: E402
from src import policy  # noqa: E402
from src.models import Application, BannerRecord, Transcript  # noqa: E402

DATA_DIR = SUBMISSION_ROOT / "challenge-data"
COMMITTED_DECISIONS = SUBMISSION_ROOT / "decisions.csv"

EXPECTED_BUCKETS = {
    "APP-88421": ("A00012345", "AUTO_MATCH"),
    "APP-90001": ("A00030001", "AUTO_MATCH"),
    "APP-90002": ("A00030002", "AUTO_MATCH"),
    "APP-91002": ("A00040001", "HITL_REVIEW"),
    "APP-93015": ("A00050099", "HITL_REVIEW"),
    "APP-94001": ("A00060001", "AUTO_MATCH"),
    "APP-92010": ("", "HITL_REVIEW"),
    "APP-95001": ("A00080001", "HITL_REVIEW"),
    "APP-96001": ("A00090001", "DO_NOT_WRITE"),
    "APP-97001": ("A00000001", "DO_NOT_WRITE"),
    "APP-98001": ("A00011111", "AUTO_MATCH"),
    "APP-99001": ("", "HITL_REVIEW"),
}

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_SSN_LAST4_RE = re.compile(r"\b\d{4}\b")
_FULL_DOB_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{4}\b")

# The known SSN last-4 values present in the sample data -- used to check
# that notes never leak them verbatim (a bare 4-digit number alone isn't
# proof of a leak, since e.g. a year could appear, so we check the exact
# known sensitive values).
KNOWN_SSN_LAST4 = {"4421", "5567", "7788", "6602", "2211", "1234", "9090", "3344", "0000", "8181"}


def run_pipeline(tmp_output: Path):
    return main_mod.run(DATA_DIR, tmp_output)


class TestEndToEndDecisions(unittest.TestCase):
    """Runs the real program against the real challenge-data extract."""

    @classmethod
    def setUpClass(cls):
        cls.output_path = SUBMISSION_ROOT / "tests" / "_tmp_decisions.csv"
        cls.decisions = run_pipeline(cls.output_path)
        cls.by_app = {d.app_id: d for d in cls.decisions}

    @classmethod
    def tearDownClass(cls):
        if cls.output_path.exists():
            cls.output_path.unlink()

    def test_one_decision_per_application(self):
        applications = main_mod.load_applications(DATA_DIR / "applications.csv")
        self.assertEqual(set(self.by_app.keys()), set(applications.keys()))
        self.assertEqual(len(self.decisions), len(applications))

    def test_no_transcript_missing_or_orphaned(self):
        applications = main_mod.load_applications(DATA_DIR / "applications.csv")
        transcripts = main_mod.load_transcripts(DATA_DIR / "transcripts.csv")
        # cross_validate raises on any mismatch; call it directly too.
        main_mod.cross_validate(applications, transcripts)
        self.assertEqual(set(applications.keys()), set(transcripts.keys()))

    def test_expected_bucket_and_candidate_per_application(self):
        for app_id, (expected_banner_id, expected_bucket) in EXPECTED_BUCKETS.items():
            with self.subTest(app_id=app_id):
                decision = self.by_app[app_id]
                self.assertEqual(decision.bucket, expected_bucket)
                self.assertEqual(decision.banner_id, expected_banner_id)

    def test_expected_bucket_totals(self):
        auto = sum(1 for d in self.decisions if d.bucket == "AUTO_MATCH")
        review = sum(1 for d in self.decisions if d.bucket == "HITL_REVIEW")
        blocked = sum(1 for d in self.decisions if d.bucket == "DO_NOT_WRITE")
        self.assertEqual((auto, review, blocked), (5, 5, 2))

    def test_every_write_credits_is_no(self):
        for decision in self.decisions:
            self.assertEqual(decision.write_credits, "no")

    def test_credits_not_evaluated_reason_present_everywhere(self):
        for decision in self.decisions:
            self.assertIn(policy.CREDITS_NOT_EVALUATED, decision.reasons)

    def test_no_new_banner_person_created(self):
        banner = main_mod.load_banner(DATA_DIR / "banner.csv")
        for decision in self.decisions:
            if decision.banner_id:
                self.assertIn(decision.banner_id, banner)

    def test_test_record_blocked(self):
        decision = self.by_app["APP-97001"]
        self.assertEqual(decision.bucket, "DO_NOT_WRITE")
        self.assertIn(policy.TEST_RECORD, decision.reasons)

    def test_deceased_record_blocked(self):
        decision = self.by_app["APP-96001"]
        self.assertEqual(decision.bucket, "DO_NOT_WRITE")
        self.assertIn(policy.DECEASED_RECORD, decision.reasons)

    def test_international_applicants_held_not_discarded(self):
        for app_id in ("APP-91002", "APP-99001"):
            decision = self.by_app[app_id]
            self.assertEqual(decision.bucket, "HITL_REVIEW")
            self.assertIn(policy.INTERNATIONAL_HOLD, decision.reasons)

    def test_dual_enroll_existing_reused_not_duplicated(self):
        decision = self.by_app["APP-94001"]
        self.assertEqual(decision.banner_id, "A00060001")
        self.assertIn(policy.DUAL_ENROLL_EXISTING, decision.reasons)

    def test_filename_conflict_produces_review(self):
        decision = self.by_app["APP-93015"]
        self.assertEqual(decision.bucket, "HITL_REVIEW")
        self.assertIn(policy.FILENAME_CONFLICT, decision.reasons)

    def test_dob_conflict_produces_review(self):
        decision = self.by_app["APP-95001"]
        self.assertEqual(decision.bucket, "HITL_REVIEW")
        self.assertIn(policy.DOB_CONFLICT, decision.reasons)

    def test_shared_email_never_solely_drives_auto_match(self):
        # APP-90001 / APP-90002 share an email but land on two distinct
        # AUTO_MATCH targets, proving email alone isn't the discriminator
        # -- and SHARED_EMAIL is only ever informational, never the
        # reason a bucket flips.
        d1, d2 = self.by_app["APP-90001"], self.by_app["APP-90002"]
        self.assertIn(policy.SHARED_EMAIL, d1.reasons)
        self.assertIn(policy.SHARED_EMAIL, d2.reasons)
        self.assertNotEqual(d1.banner_id, d2.banner_id)
        self.assertEqual(d1.bucket, "AUTO_MATCH")
        self.assertEqual(d2.bucket, "AUTO_MATCH")

    def test_generated_csv_matches_committed_csv(self):
        self.assertTrue(COMMITTED_DECISIONS.exists(), "decisions.csv must be committed in submission/")
        with self.output_path.open(newline="", encoding="utf-8") as fh:
            generated_rows = list(csv.reader(fh))
        with COMMITTED_DECISIONS.open(newline="", encoding="utf-8") as fh:
            committed_rows = list(csv.reader(fh))
        self.assertEqual(generated_rows, committed_rows)

    def test_notes_contain_no_sensitive_data(self):
        for decision in self.decisions:
            self.assertIsNone(_EMAIL_RE.search(decision.notes), decision.app_id)
            self.assertIsNone(_FULL_DOB_RE.search(decision.notes), decision.app_id)
            for ssn in KNOWN_SSN_LAST4:
                self.assertNotIn(ssn, decision.notes)

    def test_console_output_contains_no_sensitive_data(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            main_mod.print_summary(self.decisions)
        output = buf.getvalue()
        self.assertIsNone(_EMAIL_RE.search(output))
        self.assertIsNone(_FULL_DOB_RE.search(output))
        for ssn in KNOWN_SSN_LAST4:
            self.assertNotIn(ssn, output)


class TestSubprocessCLI(unittest.TestCase):
    """Exercises the documented `python -m src.main` command directly and
    checks stdout never leaks sensitive fields."""

    def test_cli_run_and_safe_stdout(self):
        output_path = SUBMISSION_ROOT / "tests" / "_tmp_cli_decisions.csv"
        try:
            result = subprocess.run(
                [sys.executable, "-m", "src.main", "--data-dir", "challenge-data", "--output", str(output_path)],
                cwd=str(SUBMISSION_ROOT),
                capture_output=True,
                text=True,
                check=True,
            )
            self.assertIn("Processed 12 applications", result.stdout)
            self.assertIsNone(_EMAIL_RE.search(result.stdout))
            self.assertIsNone(_EMAIL_RE.search(result.stderr))
            for ssn in KNOWN_SSN_LAST4:
                self.assertNotIn(ssn, result.stdout)
            self.assertTrue(output_path.exists())
        finally:
            if output_path.exists():
                output_path.unlink()


class TestMatcherUnit(unittest.TestCase):
    """Direct unit tests of matcher.py policy behavior using synthetic
    records, isolated from the sample dataset."""

    def _banner(self, **overrides):
        base = dict(
            banner_id="A00099999", pidm="1", legal_first="Sam", legal_last="Rivera",
            preferred_name="Sam", dob_iso="2000-01-01", email="srivera@school.edu",
            ssn_last4="1111", student_status="AS", student_type="Degree",
            deceased=False, posted_transfer_credits=0,
        )
        base.update(overrides)
        return BannerRecord(**base)

    def _app(self, **overrides):
        base = dict(
            app_id="APP-TEST", first="Sam", last="Rivera", dob_iso="2000-01-01",
            email="sam@personal.com", ssn_last4="1111", term="Fall 2026", app_type="Transfer",
        )
        base.update(overrides)
        return Application(**base)

    def _transcript(self, **overrides):
        base = dict(
            file_name="A00099999_School_p001.pdf", app_id="APP-TEST", ocr_name="RIVERA, SAM",
            ocr_dob_iso="2000-01-01", source_institution="School", ocr_confidence=0.9,
        )
        base.update(overrides)
        return Transcript(**base)

    def test_ssn_last4_never_sole_or_decisive(self):
        # Same SSN last4, but name/DOB/filename all disagree -> must not match.
        rec = self._banner(banner_id="A00011111", legal_first="Alex", legal_last="Nguyen", ssn_last4="1111")
        app = self._app(first="Casey", last="Doe", dob_iso="1990-05-05", ssn_last4="1111")
        transcript = self._transcript(file_name="NOID_p001.pdf", ocr_name="DOE, CASEY", ocr_dob_iso="1990-05-05")
        banner_by_id = {rec.banner_id: rec}
        decision = matcher.evaluate(app, transcript, banner_by_id, {})
        self.assertEqual(decision.banner_id, "")
        self.assertNotIn(policy.LAST4_SUPPORT_ONLY, decision.reasons)

    def test_shared_email_never_sole_or_decisive(self):
        recA = self._banner(banner_id="A00011111", legal_first="Pat", legal_last="Lee", email="family@x.com")
        app = self._app(first="Jordan", last="Kim", email="family@x.com", ssn_last4="9999", dob_iso="1990-05-05")
        transcript = self._transcript(file_name="NOID_p001.pdf", ocr_name="KIM, JORDAN", ocr_dob_iso="1990-05-05")
        decision = matcher.evaluate(app, transcript, {recA.banner_id: recA}, {"family@x.com": 2})
        self.assertEqual(decision.banner_id, "")
        self.assertEqual(decision.bucket, "HITL_REVIEW")

    def test_strong_evidence_yields_auto_match(self):
        rec = self._banner()
        app = self._app()
        transcript = self._transcript()
        decision = matcher.evaluate(app, transcript, {rec.banner_id: rec}, {})
        self.assertEqual(decision.bucket, "AUTO_MATCH")
        self.assertEqual(decision.banner_id, rec.banner_id)

    def test_no_existing_person_is_held_not_created(self):
        app = self._app()
        transcript = self._transcript(file_name="NOID_p001.pdf")
        decision = matcher.evaluate(app, transcript, {}, {})
        self.assertEqual(decision.bucket, "HITL_REVIEW")
        self.assertEqual(decision.banner_id, "")
        self.assertIn(policy.NO_EXISTING_PERSON, decision.reasons)

    def test_confidence_is_within_bounds(self):
        rec = self._banner()
        app = self._app()
        transcript = self._transcript()
        decision = matcher.evaluate(app, transcript, {rec.banner_id: rec}, {})
        self.assertGreaterEqual(decision.confidence, 0.0)
        self.assertLessEqual(decision.confidence, 1.0)


class TestValidationFailsClosed(unittest.TestCase):
    def test_duplicate_app_id_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "applications.csv").write_text(
                "app_id,first,last,dob,email,ssn_last4,term,app_type\n"
                "APP-1,A,B,01/01/2000,a@x.com,1111,Fall 2026,Transfer\n"
                "APP-1,C,D,01/01/2000,c@x.com,2222,Fall 2026,Transfer\n"
            )
            with self.assertRaises(main_mod.DataValidationError):
                main_mod.load_applications(tmp_path / "applications.csv")

    def test_missing_column_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "banner.csv").write_text("banner_id,pidm\nA1,1\n")
            with self.assertRaises(main_mod.DataValidationError):
                main_mod.load_banner(tmp_path / "banner.csv")

    def test_invalid_dob_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "applications.csv").write_text(
                "app_id,first,last,dob,email,ssn_last4,term,app_type\n"
                "APP-1,A,B,13/40/2000,a@x.com,1111,Fall 2026,Transfer\n"
            )
            with self.assertRaises(main_mod.DataValidationError):
                main_mod.load_applications(tmp_path / "applications.csv")


if __name__ == "__main__":
    unittest.main()
