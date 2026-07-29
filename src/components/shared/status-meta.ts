import type { Tone } from "@/components/ui/badge";
import type {
  ChecklistStatus,
  EvidenceReviewStatus,
  IssueState,
  DecisionStatus,
  Priority,
  Severity,
  ReadinessDecisionValue,
} from "@/lib/types";

export const CHECKLIST_STATUS_META: Record<ChecklistStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "blue" },
  submitted: { label: "Submitted", tone: "blue" },
  under_review: { label: "Under review", tone: "amber" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  blocked: { label: "Blocked", tone: "red" },
  not_applicable: { label: "Not applicable", tone: "neutral" },
};

export const EVIDENCE_STATUS_META: Record<EvidenceReviewStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "blue" },
  under_review: { label: "Under review", tone: "amber" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  superseded: { label: "Superseded", tone: "neutral" },
};

export const ISSUE_STATE_META: Record<IssueState, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "red" },
  monitoring: { label: "Monitoring", tone: "amber" },
  mitigating: { label: "Mitigating", tone: "blue" },
  resolved: { label: "Resolved", tone: "green" },
  accepted_risk: { label: "Accepted risk", tone: "neutral" },
};

export const DECISION_STATUS_META: Record<DecisionStatus, { label: string; tone: Tone }> = {
  proposed: { label: "Proposed", tone: "neutral" },
  analysis_required: { label: "Analysis required", tone: "amber" },
  pending_approval: { label: "Pending approval", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  deferred: { label: "Deferred", tone: "neutral" },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "blue" },
  high: { label: "High", tone: "amber" },
  critical: { label: "Critical", tone: "red" },
};

export const SEVERITY_META: Record<Severity, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "blue" },
  high: { label: "High", tone: "amber" },
  critical: { label: "Critical", tone: "red" },
};

export const READINESS_DECISION_META: Record<ReadinessDecisionValue, { label: string; tone: Tone }> = {
  ready: { label: "Ready", tone: "green" },
  conditionally_ready: { label: "Conditionally ready", tone: "amber" },
  not_ready: { label: "Not ready", tone: "red" },
};

export const CHECKLIST_STATUS_OPTIONS: ChecklistStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "blocked",
  "not_applicable",
];

export const EVIDENCE_STATUS_OPTIONS: EvidenceReviewStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "superseded",
];

export const ISSUE_STATE_OPTIONS: IssueState[] = ["open", "monitoring", "mitigating", "resolved", "accepted_risk"];

export const DECISION_STATUS_OPTIONS: DecisionStatus[] = [
  "proposed",
  "analysis_required",
  "pending_approval",
  "approved",
  "rejected",
  "deferred",
];
