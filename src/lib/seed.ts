import { addDays, formatISO } from "date-fns";
import type {
  User,
  Organization,
  Mission,
  Milestone,
  ChecklistItem,
  ChecklistCategoryKey,
  ChecklistStatus,
  EvidenceRecord,
  Issue,
  Decision,
  ActivityEvent,
  Notification,
  ReadinessReviewRecord,
} from "./types";

// All organizations, people, providers, and records below are fictional and
// illustrative only. PayloadReady does not represent real spaceflight data.

const iso = (d: Date) => formatISO(d, { representation: "date" });
const today = new Date();
const d = (offset: number) => iso(addDays(today, offset));

export const DEMO_USERS: User[] = [
  { id: "u-ava", name: "Ava Torres", email: "ava.torres@meridianorbital.example", role: "administrator", title: "Program Manager", avatarColor: "bg-navy-700", initials: "AT" },
  { id: "u-daniel", name: "Daniel Kim", email: "daniel.kim@meridianorbital.example", role: "program_manager", title: "Launch Integration Manager", avatarColor: "bg-blue-600", initials: "DK" },
  { id: "u-priya", name: "Priya Natarajan", email: "priya.n@meridianorbital.example", role: "engineer", title: "Systems Engineer", avatarColor: "bg-green-700", initials: "PN" },
  { id: "u-marcus", name: "Marcus Webb", email: "marcus.webb@meridianorbital.example", role: "reviewer", title: "Mission Assurance Lead", avatarColor: "bg-amber-700", initials: "MW" },
  { id: "u-sofia", name: "Sofia Alvarez", email: "sofia.alvarez@meridianorbital.example", role: "engineer", title: "Test & Integration Engineer", avatarColor: "bg-navy-600", initials: "SA" },
  { id: "u-grace", name: "Grace Chen", email: "grace.chen@meridianorbital.example", role: "executive", title: "VP of Engineering", avatarColor: "bg-red-700", initials: "GC" },
];

export const CURRENT_USER_ID = "u-ava";

export const DEMO_ORG: Organization = {
  id: "org-meridian",
  name: "Meridian Orbital Systems (fictional)",
  createdAt: d(-400),
};

export const DEMO_MISSION: Mission = {
  id: "mission-pathfinder-1",
  organizationId: DEMO_ORG.id,
  name: "Pathfinder-1",
  payloadName: "Pathfinder-1 12U Bus",
  missionType: "In-orbit technology demonstration",
  formFactor: "12U CubeSat",
  launchProvider: "Solstice Launch Services (fictional)",
  integrator: "Orbital Bridge Integration (fictional)",
  targetLaunchDate: d(76),
  payloadDeliveryDate: d(24),
  integrationDate: d(47),
  phase: "Integration & Test",
  missionLeadId: "u-ava",
  createdAt: d(-180),
};

export const DEMO_MILESTONES: Milestone[] = [
  { id: "m-freeze", missionId: DEMO_MISSION.id, key: "design_freeze", label: "Design Freeze", date: d(-95), status: "complete" },
  { id: "m-env", missionId: DEMO_MISSION.id, key: "environmental_testing", label: "Environmental Testing", date: d(8), status: "at_risk" },
  { id: "m-doc", missionId: DEMO_MISSION.id, key: "documentation_submission", label: "Documentation Submission", date: d(20), status: "at_risk" },
  { id: "m-delivery", missionId: DEMO_MISSION.id, key: "payload_delivery", label: "Payload Delivery", date: d(24), status: "at_risk" },
  { id: "m-integration", missionId: DEMO_MISSION.id, key: "integration", label: "Integration", date: d(47), status: "on_track" },
  { id: "m-launch", missionId: DEMO_MISSION.id, key: "launch", label: "Launch", date: d(76), status: "on_track" },
];

type ItemSeed = {
  id: string;
  category: ChecklistCategoryKey;
  title: string;
  description: string;
  requirementSource: string;
  owner: string;
  reviewer?: string;
  status: ChecklistStatus;
  priority: ChecklistItem["priority"];
  dueOffset: number;
  evidenceStatus: ChecklistItem["evidenceStatus"];
  notes: string;
  relatedIssueId?: string;
  dependencies?: string[];
};

const raw: ItemSeed[] = [
  // Mission & payload definition (4)
  { id: "chk-001", category: "mission_payload_definition", title: "Mission Concept of Operations", description: "Top-level ConOps describing mission objectives, orbit, and payload operating modes.", requirementSource: "Program Requirements Doc PR-100", owner: "u-ava", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -70, evidenceStatus: "accepted", notes: "Baselined at PDR." },
  { id: "chk-002", category: "mission_payload_definition", title: "Payload Requirements Document", description: "Functional and performance requirements for the demonstration payload.", requirementSource: "Program Requirements Doc PR-101", owner: "u-priya", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -70, evidenceStatus: "accepted", notes: "Rev B baselined." },
  { id: "chk-003", category: "mission_payload_definition", title: "Interface Control Document — Bus/Payload", description: "ICD capturing mechanical, electrical, and data interfaces between bus and payload.", requirementSource: "ICD-200", owner: "u-priya", reviewer: "u-daniel", status: "accepted", priority: "critical", dueOffset: -55, evidenceStatus: "accepted", notes: "Signed by both teams." },
  { id: "chk-004", category: "mission_payload_definition", title: "Concept of Operations Review Closure", description: "Close-out of ConOps review action items.", requirementSource: "PR-100 Action Log", owner: "u-ava", status: "in_progress", priority: "medium", dueOffset: 6, evidenceStatus: "pending", notes: "Two of five actions remain open." },

  // Mechanical interfaces (5)
  { id: "chk-010", category: "mechanical_interfaces", title: "Mechanical ICD — Deployer Interface", description: "Envelope, rail dimensions, and separation system interface with the deployer.", requirementSource: "Launch Provider Mechanical ICD LP-M-04", owner: "u-priya", reviewer: "u-daniel", status: "accepted", priority: "critical", dueOffset: -60, evidenceStatus: "accepted", notes: "Matches deployer envelope with margin." },
  { id: "chk-011", category: "mechanical_interfaces", title: "Structural Analysis Report", description: "Finite-element analysis demonstrating positive margins under launch loads.", requirementSource: "LP-M-04 §3.2", owner: "u-priya", reviewer: "u-marcus", status: "accepted", priority: "critical", dueOffset: -40, evidenceStatus: "accepted", notes: "Positive margins on all load cases." },
  {
    id: "chk-012",
    category: "mechanical_interfaces",
    title: "Mass Properties Report (Rev C)",
    description: "Updated mass, center-of-gravity, and moment-of-inertia report reflecting the as-built flight unit, required before the mechanical fit check.",
    requirementSource: "LP-M-04 §4.1",
    owner: "u-priya",
    reviewer: "u-daniel",
    status: "blocked",
    priority: "critical",
    dueOffset: -6,
    evidenceStatus: "none",
    notes: "Rev C update is overdue. Blocking the mechanical fit-check date with the integrator.",
    relatedIssueId: "iss-mass-props",
  },
  { id: "chk-013", category: "mechanical_interfaces", title: "Separation System Functional Test", description: "Functional verification of separation switches and deployable mechanisms.", requirementSource: "LP-M-04 §5.0", owner: "u-sofia", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -20, evidenceStatus: "accepted", notes: "All switches verified nominal." },
  { id: "chk-014", category: "mechanical_interfaces", title: "Coordinate Frame & Alignment Report", description: "As-built alignment of payload optical bench relative to bus reference frame.", requirementSource: "ICD-200 §2.4", owner: "u-priya", status: "in_progress", priority: "medium", dueOffset: 12, evidenceStatus: "pending", notes: "Metrology scheduled next week." },

  // Electrical interfaces (5)
  { id: "chk-020", category: "electrical_interfaces", title: "Electrical ICD — Power & Data", description: "Power bus voltages, connector pinouts, and data bus protocol definitions.", requirementSource: "ICD-200 §3", owner: "u-priya", reviewer: "u-daniel", status: "accepted", priority: "critical", dueOffset: -58, evidenceStatus: "accepted", notes: "Concurred by integrator." },
  { id: "chk-021", category: "electrical_interfaces", title: "Power Budget & Margin Analysis", description: "Orbit-average and worst-case power budget with margin against generation.", requirementSource: "PR-101 §5", owner: "u-priya", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -35, evidenceStatus: "accepted", notes: "22% margin at worst-case beta angle." },
  { id: "chk-022", category: "electrical_interfaces", title: "Grounding & Bonding Report", description: "Grounding scheme and bonding resistance measurements for flight unit.", requirementSource: "LP-E-02 §2", owner: "u-sofia", reviewer: "u-marcus", status: "under_review", priority: "medium", dueOffset: 9, evidenceStatus: "pending", notes: "Measurements complete, report drafted, awaiting MA review." },
  { id: "chk-023", category: "electrical_interfaces", title: "EMI/EMC Self-Compatibility Test", description: "Electromagnetic compatibility testing between payload and bus electronics.", requirementSource: "LP-E-02 §4", owner: "u-sofia", status: "not_started", priority: "medium", dueOffset: 22, evidenceStatus: "none", notes: "Awaiting chamber availability." },
  { id: "chk-024", category: "electrical_interfaces", title: "Harness Continuity & Isolation Test", description: "Point-to-point continuity and isolation verification for the flight harness.", requirementSource: "ICD-200 §3.6", owner: "u-sofia", reviewer: "u-priya", status: "in_progress", priority: "high", dueOffset: 7, evidenceStatus: "pending", notes: "Continuity checks complete; isolation testing in progress." },

  // Communications & RF (4)
  { id: "chk-030", category: "comms_rf", title: "RF Link Budget", description: "Uplink and downlink link budget for the mission ground station network.", requirementSource: "PR-101 §6", owner: "u-priya", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -45, evidenceStatus: "accepted", notes: "6 dB margin on downlink at worst case." },
  { id: "chk-031", category: "comms_rf", title: "RF Compatibility Test with Ground Station", description: "End-to-end RF compatibility test with the mission's primary ground station.", requirementSource: "PR-101 §6.3", owner: "u-sofia", reviewer: "u-daniel", status: "accepted", priority: "high", dueOffset: -15, evidenceStatus: "accepted", notes: "Passed at nominal and fringe signal levels." },
  { id: "chk-032", category: "comms_rf", title: "Transmit Power Spectral Density Report", description: "Measured spectral density and out-of-band emissions of the transmitter.", requirementSource: "LP-R-01 §2", owner: "u-sofia", status: "in_progress", priority: "medium", dueOffset: -2, evidenceStatus: "pending", notes: "Bench measurements complete, report in draft and overdue." },
  { id: "chk-033", category: "comms_rf", title: "Command Authentication Verification", description: "Verification that uplink commands require valid authentication.", requirementSource: "PR-101 §6.5", owner: "u-priya", reviewer: "u-marcus", status: "accepted", priority: "critical", dueOffset: -18, evidenceStatus: "accepted", notes: "Verified against three invalid-command test cases." },

  // Environmental testing (5)
  { id: "chk-040", category: "environmental_testing", title: "Environmental Test Plan", description: "Test plan covering vibration, thermal-vacuum, and shock qualification.", requirementSource: "LP-T-01", owner: "u-sofia", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -50, evidenceStatus: "accepted", notes: "Approved by mission assurance." },
  { id: "chk-041", category: "environmental_testing", title: "Thermal-Vacuum Test Report", description: "Hot/cold cycling and functional performance under vacuum.", requirementSource: "LP-T-01 §3", owner: "u-sofia", reviewer: "u-marcus", status: "accepted", priority: "critical", dueOffset: -22, evidenceStatus: "accepted", notes: "All functional checks nominal at temperature extremes." },
  {
    id: "chk-042",
    category: "environmental_testing",
    title: "Random Vibration Test Report — Flight Unit",
    description: "Qualification-level random vibration test on the flight unit along three axes, including pre/post functional checks.",
    requirementSource: "LP-T-01 §2",
    owner: "u-sofia",
    reviewer: "u-marcus",
    status: "under_review",
    priority: "critical",
    dueOffset: 5,
    evidenceStatus: "pending",
    notes: "Test report uploaded; awaiting mission assurance review before acceptance.",
  },
  {
    id: "chk-043",
    category: "environmental_testing",
    title: "Shock Test Report",
    description: "Pyroshock qualification test covering separation shock levels.",
    requirementSource: "LP-T-01 §4",
    owner: "u-sofia",
    status: "blocked",
    priority: "high",
    dueOffset: 3,
    evidenceStatus: "none",
    notes: "Blocked pending delivery of the external shock-test fixture from the test vendor.",
    relatedIssueId: "iss-external-artifact",
  },
  { id: "chk-044", category: "environmental_testing", title: "Post-Environmental Functional Test", description: "Full functional test following completion of the environmental campaign.", requirementSource: "LP-T-01 §5", owner: "u-priya", status: "not_started", priority: "high", dueOffset: 18, evidenceStatus: "none", notes: "Cannot start until vibration and shock testing close out." },

  // Safety & hazardous systems (5)
  { id: "chk-050", category: "safety_hazardous_systems", title: "Missile System Prelaunch Safety Package Outline", description: "Outline package identifying hazardous systems and planned safety verifications.", requirementSource: "LP-S-01", owner: "u-marcus", reviewer: "u-ava", status: "accepted", priority: "critical", dueOffset: -65, evidenceStatus: "accepted", notes: "Accepted by launch provider safety panel at Phase 0/I review." },
  {
    id: "chk-051",
    category: "safety_hazardous_systems",
    title: "Battery Safety Data Package",
    description: "Cell-level test data, battery assembly drawings, and protection circuit verification supporting battery safety approval.",
    requirementSource: "LP-S-01 §6 (Battery Safety)",
    owner: "u-priya",
    reviewer: "u-marcus",
    status: "blocked",
    priority: "critical",
    dueOffset: -3,
    evidenceStatus: "rejected",
    notes: "Submission rejected — cell lot acceptance test data and vendor traceability records were missing. Resubmission required.",
    relatedIssueId: "iss-battery-safety",
  },
  { id: "chk-052", category: "safety_hazardous_systems", title: "Pressure Vessel Waiver Justification", description: "Justification that no pressurized systems requiring waiver are present.", requirementSource: "LP-S-01 §4", owner: "u-marcus", status: "accepted", priority: "medium", dueOffset: -30, evidenceStatus: "accepted", notes: "No pressure vessels on the payload; documented as N/A with justification." },
  {
    id: "chk-053",
    category: "safety_hazardous_systems",
    title: "Deployment Switch Configuration Sign-off",
    description: "Final sign-off on the remove-before-flight and deployment switch configuration used to inhibit RF and deployables before separation.",
    requirementSource: "LP-S-01 §7",
    owner: "u-daniel",
    reviewer: "u-marcus",
    status: "under_review",
    priority: "critical",
    dueOffset: 4,
    evidenceStatus: "pending",
    notes: "Awaiting approval of the deployment-switch configuration decision before this item can close.",
  },
  { id: "chk-054", category: "safety_hazardous_systems", title: "Battery Thermal Runaway Test", description: "Abuse testing demonstrating no propagation of thermal runaway between cells.", requirementSource: "LP-S-01 §6.3", owner: "u-priya", reviewer: "u-marcus", status: "accepted", priority: "critical", dueOffset: -28, evidenceStatus: "accepted", notes: "No propagation observed across three abuse tests." },

  // Regulatory & licensing (4)
  { id: "chk-060", category: "regulatory_licensing", title: "Orbital Debris Assessment (illustrative)", description: "Illustrative orbital debris mitigation assessment for the mission profile.", requirementSource: "Program Requirements Doc PR-102", owner: "u-ava", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -48, evidenceStatus: "accepted", notes: "Documented illustrative disposal approach; not a substitute for a real regulatory filing." },
  {
    id: "chk-061",
    category: "regulatory_licensing",
    title: "Experimental Spectrum Authorization Filing (illustrative)",
    description: "Illustrative filing tracking item for an experimental spectrum authorization covering the mission's uplink and downlink frequencies. This entry tracks internal coordination only and does not represent legal or regulatory approval.",
    requirementSource: "PR-102 §3 (illustrative)",
    owner: "u-daniel",
    reviewer: "u-ava",
    status: "under_review",
    priority: "high",
    dueOffset: 14,
    evidenceStatus: "pending",
    notes: "Filing package assembled and marked pending. Approval status remains with the applicable regulatory authority — this record does not imply approval.",
  },
  { id: "chk-062", category: "regulatory_licensing", title: "Frequency Coordination Confirmation (illustrative)", description: "Illustrative frequency coordination confirmation from the applicable frequency-management body.", requirementSource: "PR-102 §3.1 (illustrative)", owner: "u-daniel", status: "in_progress", priority: "medium", dueOffset: -4, evidenceStatus: "pending", notes: "Coordination request submitted; confirmation is overdue." },
  { id: "chk-063", category: "regulatory_licensing", title: "Export Control Classification Record", description: "Internal classification record for hardware and technical data export control status.", requirementSource: "Internal Compliance Policy", owner: "u-ava", reviewer: "u-marcus", status: "accepted", priority: "medium", dueOffset: -80, evidenceStatus: "accepted", notes: "Classification recorded and filed with compliance lead." },

  // Software & operational readiness (4)
  { id: "chk-070", category: "software_operational_readiness", title: "Flight Software Version Description", description: "Version description document for the flight software build intended for launch.", requirementSource: "PR-101 §7", owner: "u-priya", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -25, evidenceStatus: "accepted", notes: "Build v2.3.1 baselined." },
  { id: "chk-071", category: "software_operational_readiness", title: "Operations Concept & Command Sequences", description: "Nominal operations timeline and early-orbit command sequence plan.", requirementSource: "PR-100 §4", owner: "u-daniel", status: "in_progress", priority: "medium", dueOffset: -1, evidenceStatus: "pending", notes: "Early-orbit sequence in review and now overdue; nominal ops timeline complete." },
  { id: "chk-072", category: "software_operational_readiness", title: "Ground Segment Readiness Checklist", description: "Confirmation that ground station and mission operations tooling are ready to support early orbit operations.", requirementSource: "PR-100 §4.2", owner: "u-daniel", reviewer: "u-ava", status: "accepted", priority: "medium", dueOffset: -10, evidenceStatus: "accepted", notes: "Ground segment dry run completed successfully." },
  { id: "chk-073", category: "software_operational_readiness", title: "Fault Detection, Isolation & Recovery Test", description: "Test campaign for onboard FDIR responses to simulated fault conditions.", requirementSource: "PR-101 §7.4", owner: "u-priya", status: "in_progress", priority: "high", dueOffset: 11, evidenceStatus: "pending", notes: "6 of 9 fault scenarios tested to date." },

  // Shipping & payload delivery (3)
  { id: "chk-080", category: "shipping_delivery", title: "Shipping & Handling Procedure", description: "Procedure covering packaging, handling, and transport of the flight unit to the integrator.", requirementSource: "LP-M-06", owner: "u-sofia", reviewer: "u-daniel", status: "accepted", priority: "medium", dueOffset: -14, evidenceStatus: "accepted", notes: "Approved shipping procedure on file." },
  { id: "chk-081", category: "shipping_delivery", title: "Export & Customs Documentation", description: "Customs and export documentation required for transport to the integration site.", requirementSource: "Internal Compliance Policy", owner: "u-ava", status: "accepted", priority: "medium", dueOffset: -9, evidenceStatus: "accepted", notes: "Documentation package complete." },
  {
    id: "chk-082",
    category: "shipping_delivery",
    title: "Shipping Container Qualification Record",
    description: "Qualification record for the shock-isolating shipping container used to transport the flight unit.",
    requirementSource: "LP-M-06 §2",
    owner: "u-sofia",
    status: "accepted",
    priority: "low",
    dueOffset: -40,
    evidenceStatus: "accepted",
    notes: "Container qualified against transport vibration spectrum.",
  },

  // Launch-provider documentation (3)
  { id: "chk-090", category: "launch_provider_documentation", title: "Launch Provider Data Package Submission", description: "Consolidated data package required by the launch provider ahead of integration.", requirementSource: "LP-DOC-01", owner: "u-daniel", reviewer: "u-marcus", status: "accepted", priority: "high", dueOffset: -19, evidenceStatus: "accepted", notes: "Submitted and acknowledged by integrator." },
  { id: "chk-091", category: "launch_provider_documentation", title: "Integration Procedure Concurrence", description: "Mission concurrence on the integrator's mechanical and electrical integration procedures.", requirementSource: "LP-DOC-02", owner: "u-priya", reviewer: "u-daniel", status: "accepted", priority: "medium", dueOffset: -13, evidenceStatus: "accepted", notes: "Concurred with two minor redlines incorporated." },
  { id: "chk-092", category: "launch_provider_documentation", title: "Final Compliance Matrix Submission", description: "Final compliance matrix against all launch-provider mechanical, electrical, and safety requirements.", requirementSource: "LP-DOC-03", owner: "u-ava", reviewer: "u-marcus", status: "in_progress", priority: "high", dueOffset: 21, evidenceStatus: "pending", notes: "84% of requirement rows closed to date." },
];

export const DEMO_CHECKLIST_ITEMS: ChecklistItem[] = raw.map((r) => ({
  id: r.id,
  missionId: DEMO_MISSION.id,
  category: r.category,
  title: r.title,
  description: r.description,
  requirementSource: r.requirementSource,
  ownerId: r.owner,
  reviewerId: r.reviewer,
  dueDate: d(r.dueOffset),
  priority: r.priority,
  status: r.status,
  evidenceStatus: r.evidenceStatus,
  dependencies: r.dependencies ?? [],
  notes: r.notes,
  relatedIssueId: r.relatedIssueId,
  updatedAt: d(r.dueOffset - 3 > -120 ? r.dueOffset - 3 : -110),
  createdAt: d(-90),
}));

// Evidence records — one accepted record for each accepted checklist item,
// plus explicit narrative records for the highlighted demo problems.
const acceptedItems = DEMO_CHECKLIST_ITEMS.filter((i) => i.status === "accepted" && i.evidenceStatus === "accepted");

export const DEMO_EVIDENCE: EvidenceRecord[] = [
  ...acceptedItems.map((item, idx) => ({
    id: `ev-${item.id}`,
    missionId: DEMO_MISSION.id,
    documentName: item.title,
    documentNumber: `MER-${(idx + 100).toString().padStart(3, "0")}`,
    revision: "A",
    evidenceType: inferEvidenceType(item.category),
    relatedChecklistItemIds: [item.id],
    uploadedById: item.ownerId,
    submittedDate: d(-(30 + idx)),
    reviewerId: item.reviewerId ?? "u-marcus",
    reviewStatus: "accepted" as const,
    reviewComments: "Meets requirement source acceptance criteria.",
    sourceRef: `/evidence/${item.id}-revA.pdf`,
    superseded: false,
    versionNote: "Initial accepted revision.",
    createdAt: d(-(32 + idx)),
    updatedAt: d(-(29 + idx)),
  })),
  {
    id: "ev-vibration",
    missionId: DEMO_MISSION.id,
    documentName: "Random Vibration Test Report — Flight Unit",
    documentNumber: "MER-T-042",
    revision: "A",
    evidenceType: "test_report",
    relatedChecklistItemIds: ["chk-042"],
    uploadedById: "u-sofia",
    submittedDate: d(-2),
    reviewerId: "u-marcus",
    reviewStatus: "under_review",
    sourceRef: "/evidence/chk-042-vibration-revA.pdf",
    superseded: false,
    versionNote: "Initial submission covering all three axes and pre/post functionals.",
    createdAt: d(-2),
    updatedAt: d(-2),
  },
  {
    id: "ev-battery-rejected",
    missionId: DEMO_MISSION.id,
    documentName: "Battery Safety Data Package",
    documentNumber: "MER-S-051",
    revision: "A",
    evidenceType: "safety_document",
    relatedChecklistItemIds: ["chk-051"],
    uploadedById: "u-priya",
    submittedDate: d(-9),
    reviewerId: "u-marcus",
    reviewStatus: "rejected",
    reviewComments: "Cell lot acceptance test data and vendor traceability records were not included. Please resubmit with complete cell-level records per LP-S-01 §6.",
    sourceRef: "/evidence/chk-051-battery-revA.pdf",
    superseded: false,
    versionNote: "Initial submission — incomplete.",
    createdAt: d(-9),
    updatedAt: d(-3),
  },
  {
    id: "ev-fcc-filing",
    missionId: DEMO_MISSION.id,
    documentName: "Experimental Spectrum Authorization Filing (illustrative)",
    documentNumber: "MER-R-061",
    revision: "A",
    evidenceType: "regulatory_filing",
    relatedChecklistItemIds: ["chk-061"],
    uploadedById: "u-daniel",
    submittedDate: d(-4),
    reviewerId: "u-ava",
    reviewStatus: "submitted",
    reviewComments: "Filing package assembled internally; awaiting the applicable regulatory authority. This record tracks internal status only.",
    sourceRef: "/evidence/chk-061-spectrum-filing-revA.pdf",
    superseded: false,
    versionNote: "Initial internal filing package.",
    createdAt: d(-4),
    updatedAt: d(-4),
  },
];

function inferEvidenceType(cat: ChecklistCategoryKey): EvidenceRecord["evidenceType"] {
  switch (cat) {
    case "environmental_testing":
      return "test_report";
    case "mechanical_interfaces":
    case "electrical_interfaces":
      return "drawing";
    case "safety_hazardous_systems":
      return "safety_document";
    case "regulatory_licensing":
      return "regulatory_filing";
    case "shipping_delivery":
      return "shipping_record";
    case "launch_provider_documentation":
      return "approval";
    case "comms_rf":
      return "analysis";
    default:
      return "other";
  }
}

export const DEMO_ISSUES: Issue[] = [
  {
    id: "iss-mass-props",
    missionId: DEMO_MISSION.id,
    title: "Mass Properties Update Overdue",
    description: "The Rev C mass properties report reflecting the as-built flight unit is overdue, blocking the mechanical fit-check date with the integrator.",
    severity: "high",
    scheduleImpactDays: 5,
    affectedMilestone: "integration",
    affectedChecklistItemIds: ["chk-012"],
    ownerId: "u-priya",
    dueDate: d(2),
    rootCause: "As-built weighing was delayed by a conflict with vibration test facility scheduling.",
    recoveryPlan: "Complete final weighing this week and issue Rev C by end of week; hold fit-check date pending confirmation.",
    escalated: true,
    state: "mitigating",
    createdAt: d(-6),
    updatedAt: d(-1),
  },
  {
    id: "iss-external-artifact",
    missionId: DEMO_MISSION.id,
    title: "External Shock-Test Fixture Delayed",
    description: "The external test vendor supplying the shock-test fixture has slipped delivery, which may delay payload delivery to the integrator.",
    severity: "critical",
    scheduleImpactDays: 10,
    affectedMilestone: "payload_delivery",
    affectedChecklistItemIds: ["chk-043", "chk-044"],
    ownerId: "u-daniel",
    dueDate: d(5),
    rootCause: "Test vendor's fixture is booked by another customer program; new availability window is later than planned.",
    recoveryPlan: "Evaluate a secondary shock-test vendor and request an expedited slot; escalate to program management if unresolved by end of week.",
    escalated: true,
    state: "open",
    createdAt: d(-4),
    updatedAt: d(-1),
  },
  {
    id: "iss-battery-safety",
    missionId: DEMO_MISSION.id,
    title: "Battery Safety Documentation Gap",
    description: "The initial battery safety data package was rejected for missing cell-level acceptance test data and vendor traceability records.",
    severity: "high",
    scheduleImpactDays: 4,
    affectedMilestone: "documentation_submission",
    affectedChecklistItemIds: ["chk-051"],
    ownerId: "u-priya",
    dueDate: d(6),
    rootCause: "Cell vendor traceability records were not collected before the initial submission was assembled.",
    recoveryPlan: "Request complete traceability records from the cell vendor and resubmit the safety package with cell lot acceptance data included.",
    escalated: false,
    state: "open",
    createdAt: d(-3),
    updatedAt: d(-3),
  },
];

export const DEMO_DECISIONS: Decision[] = [
  {
    id: "dec-deployment-switch",
    missionId: DEMO_MISSION.id,
    statement: "Approve the deployment-switch configuration used to inhibit RF and deployables before separation.",
    context: "Two candidate configurations were evaluated for the remove-before-flight and deployment switch chain. Mission assurance needs a final sign-off before the safety package can be finalized.",
    optionsConsidered: [
      "Option A: Single deployment switch with redundant RBF pin inhibit.",
      "Option B: Dual redundant deployment switches with independent inhibit paths.",
    ],
    ownerId: "u-daniel",
    approverId: "u-marcus",
    dueDate: d(4),
    status: "pending_approval",
    relatedRequirementIds: ["chk-053"],
    relatedIssueIds: [],
    createdAt: d(-10),
  },
  {
    id: "dec-rf-margin-waiver",
    missionId: DEMO_MISSION.id,
    statement: "Determine whether a waiver is needed for downlink margin at extreme slant range.",
    context: "Link budget shows reduced but still positive margin at the far edge of the ground station's field of regard. Needs a formal disposition before the compliance matrix can close.",
    optionsConsidered: [
      "Accept as-is given positive margin at all commanded passes.",
      "Restrict operations to exclude lowest-elevation passes.",
    ],
    ownerId: "u-priya",
    approverId: "u-ava",
    dueDate: d(9),
    status: "analysis_required",
    relatedRequirementIds: ["chk-030"],
    relatedIssueIds: [],
    createdAt: d(-8),
  },
  {
    id: "dec-battery-vendor",
    missionId: DEMO_MISSION.id,
    statement: "Confirm primary battery cell vendor for flight units.",
    context: "Evaluated two qualified cell vendors on cost, lead time, and available heritage data.",
    optionsConsidered: ["Vendor A — longer heritage, longer lead time.", "Vendor B — shorter lead time, less flight heritage."],
    ownerId: "u-priya",
    approverId: "u-ava",
    dueDate: d(-45),
    status: "approved",
    finalDecision: "Vendor A selected based on flight heritage and acceptable lead time.",
    rationale: "Flight heritage reduces qualification risk for the safety review.",
    relatedRequirementIds: ["chk-051", "chk-054"],
    relatedIssueIds: [],
    dateDecided: d(-45),
    createdAt: d(-52),
  },
];

export const DEMO_READINESS_REVIEWS: ReadinessReviewRecord[] = [
  {
    id: "rr-1",
    missionId: DEMO_MISSION.id,
    decision: "not_ready",
    score: 51,
    reasons: ["Environmental test campaign incomplete", "Safety package not yet submitted"],
    nextReviewDate: d(-20),
    comments: "Early readiness check ahead of the environmental test campaign. Expected to improve once vibration and thermal-vacuum testing complete.",
    recordedById: "u-ava",
    recordedAt: d(-35),
  },
];

export const DEMO_ACTIVITY: ActivityEvent[] = [
  { id: "act-1", missionId: DEMO_MISSION.id, actorId: "u-sofia", action: "submitted evidence for", entityType: "checklist_item", entityId: "chk-042", entityLabel: "Random Vibration Test Report — Flight Unit", timestamp: d(-2) },
  { id: "act-2", missionId: DEMO_MISSION.id, actorId: "u-marcus", action: "rejected evidence for", entityType: "checklist_item", entityId: "chk-051", entityLabel: "Battery Safety Data Package", timestamp: d(-3) },
  { id: "act-3", missionId: DEMO_MISSION.id, actorId: "u-daniel", action: "opened issue", entityType: "issue", entityId: "iss-external-artifact", entityLabel: "External Shock-Test Fixture Delayed", timestamp: d(-4) },
  { id: "act-4", missionId: DEMO_MISSION.id, actorId: "u-daniel", action: "proposed decision", entityType: "decision", entityId: "dec-deployment-switch", entityLabel: "Deployment-Switch Configuration Approval", timestamp: d(-10) },
  { id: "act-5", missionId: DEMO_MISSION.id, actorId: "u-priya", action: "flagged overdue item", entityType: "checklist_item", entityId: "chk-012", entityLabel: "Mass Properties Report (Rev C)", timestamp: d(-1) },
  { id: "act-6", missionId: DEMO_MISSION.id, actorId: "u-ava", action: "recorded readiness decision", entityType: "readiness_review", entityId: "rr-1", entityLabel: "Not Ready", timestamp: d(-35) },
];

export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: "n-1", missionId: DEMO_MISSION.id, userId: CURRENT_USER_ID, message: "Battery Safety Data Package was rejected — resubmission needed.", read: false, createdAt: d(-3), entityType: "checklist_item", entityId: "chk-051" },
  { id: "n-2", missionId: DEMO_MISSION.id, userId: CURRENT_USER_ID, message: "Mass Properties Report (Rev C) is overdue.", read: false, createdAt: d(-1), entityType: "checklist_item", entityId: "chk-012" },
  { id: "n-3", missionId: DEMO_MISSION.id, userId: CURRENT_USER_ID, message: "Deployment-switch configuration decision is awaiting your approval chain.", read: false, createdAt: d(-1), entityType: "decision", entityId: "dec-deployment-switch" },
  { id: "n-4", missionId: DEMO_MISSION.id, userId: CURRENT_USER_ID, message: "Vibration test report was submitted for review.", read: true, createdAt: d(-2), entityType: "checklist_item", entityId: "chk-042" },
];
