// PayloadReady domain model
// This mirrors the relational schema in /schema/schema.sql, expressed as
// TypeScript types for the local seeded data layer.

export type Role = "administrator" | "program_manager" | "engineer" | "reviewer" | "executive";

export type Priority = "low" | "medium" | "high" | "critical";
export type Severity = "low" | "medium" | "high" | "critical";

export type ChecklistStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected"
  | "blocked"
  | "not_applicable";

export type EvidenceReviewStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected"
  | "superseded";

export type EvidenceType =
  | "test_report"
  | "analysis"
  | "certificate"
  | "drawing"
  | "interface_document"
  | "safety_document"
  | "regulatory_filing"
  | "approval"
  | "shipping_record"
  | "other";

export type IssueState = "open" | "monitoring" | "mitigating" | "resolved" | "accepted_risk";

export type DecisionStatus =
  | "proposed"
  | "analysis_required"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "deferred";

export type ReadinessDecisionValue = "ready" | "conditionally_ready" | "not_ready";

export type ChecklistCategoryKey =
  | "mission_payload_definition"
  | "mechanical_interfaces"
  | "electrical_interfaces"
  | "comms_rf"
  | "environmental_testing"
  | "safety_hazardous_systems"
  | "regulatory_licensing"
  | "software_operational_readiness"
  | "shipping_delivery"
  | "launch_provider_documentation";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  avatarColor: string;
  initials: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  missionId: string;
  key: "design_freeze" | "environmental_testing" | "documentation_submission" | "payload_delivery" | "integration" | "launch";
  label: string;
  date: string;
  status: "complete" | "on_track" | "at_risk" | "missed";
}

export interface Mission {
  id: string;
  organizationId: string;
  name: string;
  payloadName: string;
  missionType: string;
  formFactor?: string;
  launchProvider: string;
  integrator: string;
  targetLaunchDate: string;
  payloadDeliveryDate: string;
  integrationDate: string;
  phase: string;
  missionLeadId: string;
  createdAt: string;
}

export interface MissionMember {
  missionId: string;
  userId: string;
  roleOnMission: string;
}

export interface ChecklistItem {
  id: string;
  missionId: string;
  category: ChecklistCategoryKey;
  title: string;
  description: string;
  requirementSource: string;
  ownerId: string;
  reviewerId?: string;
  dueDate: string;
  priority: Priority;
  status: ChecklistStatus;
  evidenceStatus: "none" | "pending" | "accepted" | "rejected";
  dependencies: string[]; // checklist item ids
  notes: string;
  relatedIssueId?: string;
  notApplicableReason?: string;
  updatedAt: string;
  createdAt: string;
}

export interface EvidenceRecord {
  id: string;
  missionId: string;
  documentName: string;
  documentNumber: string;
  revision: string;
  evidenceType: EvidenceType;
  relatedChecklistItemIds: string[];
  uploadedById: string;
  submittedDate: string;
  reviewerId?: string;
  reviewStatus: EvidenceReviewStatus;
  reviewComments?: string;
  sourceRef: string; // simulated file metadata / URL
  superseded: boolean;
  supersedesId?: string;
  versionNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  missionId: string;
  title: string;
  description: string;
  severity: Severity;
  scheduleImpactDays: number;
  affectedMilestone: Milestone["key"] | "none";
  affectedChecklistItemIds: string[];
  ownerId: string;
  dueDate: string;
  rootCause: string;
  recoveryPlan: string;
  escalated: boolean;
  state: IssueState;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  missionId: string;
  statement: string;
  context: string;
  optionsConsidered: string[];
  ownerId: string;
  approverId: string;
  dueDate: string;
  status: DecisionStatus;
  finalDecision?: string;
  rationale?: string;
  relatedRequirementIds: string[];
  relatedIssueIds: string[];
  dateDecided?: string;
  createdAt: string;
}

export interface ReadinessReviewRecord {
  id: string;
  missionId: string;
  decision: ReadinessDecisionValue;
  score: number;
  conditions?: { text: string; ownerId: string }[];
  reasons?: string[];
  nextReviewDate?: string;
  comments: string;
  recordedById: string;
  recordedAt: string;
}

export interface ActivityEvent {
  id: string;
  missionId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  missionId: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: string;
}

export interface ReportSnapshot {
  id: string;
  missionId: string;
  generatedAt: string;
  generatedById: string;
  readinessScore: number;
  decision: ReadinessDecisionValue | "undetermined";
}

export const CHECKLIST_CATEGORIES: { key: ChecklistCategoryKey; label: string }[] = [
  { key: "mission_payload_definition", label: "Mission & Payload Definition" },
  { key: "mechanical_interfaces", label: "Mechanical Interfaces" },
  { key: "electrical_interfaces", label: "Electrical Interfaces" },
  { key: "comms_rf", label: "Communications & RF" },
  { key: "environmental_testing", label: "Environmental Testing" },
  { key: "safety_hazardous_systems", label: "Safety & Hazardous Systems" },
  { key: "regulatory_licensing", label: "Regulatory & Licensing" },
  { key: "software_operational_readiness", label: "Software & Operational Readiness" },
  { key: "shipping_delivery", label: "Shipping & Payload Delivery" },
  { key: "launch_provider_documentation", label: "Launch-Provider Documentation" },
];

export const MILESTONE_LABELS: Record<Milestone["key"], string> = {
  design_freeze: "Design Freeze",
  environmental_testing: "Environmental Testing",
  documentation_submission: "Documentation Submission",
  payload_delivery: "Payload Delivery",
  integration: "Integration",
  launch: "Launch",
};
