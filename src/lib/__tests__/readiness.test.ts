import { describe, it, expect } from "vitest";
import { calculateReadiness, computeWarnings, overdueItems } from "../readiness";
import type { ChecklistItem, Issue, Decision, Mission } from "../types";
import { addDays, formatISO } from "date-fns";

const iso = (offset: number) => formatISO(addDays(new Date(), offset), { representation: "date" });

function makeItem(overrides: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: "chk-x",
    missionId: "mission-1",
    category: "mechanical_interfaces",
    title: "Test item",
    description: "desc",
    requirementSource: "src",
    ownerId: "u-1",
    dueDate: iso(10),
    priority: "medium",
    status: "not_started",
    evidenceStatus: "none",
    dependencies: [],
    notes: "",
    updatedAt: iso(-1),
    createdAt: iso(-10),
    ...overrides,
  };
}

const baseMission: Mission = {
  id: "mission-1",
  organizationId: "org-1",
  name: "Test Mission",
  payloadName: "Payload",
  missionType: "Tech demo",
  launchProvider: "Provider",
  integrator: "Integrator",
  targetLaunchDate: iso(90),
  payloadDeliveryDate: iso(30),
  integrationDate: iso(60),
  phase: "Integration & Test",
  missionLeadId: "u-1",
  createdAt: iso(-100),
};

describe("calculateReadiness", () => {
  it("scores an all-accepted checklist at 100", () => {
    const items = [
      makeItem({ id: "a", status: "accepted", priority: "critical" }),
      makeItem({ id: "b", status: "accepted", priority: "medium" }),
    ];
    expect(calculateReadiness(items).score).toBe(100);
  });

  it("scores an all-not-started checklist at 0", () => {
    const items = [makeItem({ id: "a", status: "not_started" }), makeItem({ id: "b", status: "not_started" })];
    expect(calculateReadiness(items).score).toBe(0);
  });

  it("excludes not_applicable items from the score", () => {
    const items = [
      makeItem({ id: "a", status: "accepted" }),
      makeItem({ id: "b", status: "not_applicable" }),
    ];
    const result = calculateReadiness(items);
    expect(result.score).toBe(100);
    expect(result.excluded).toBe(1);
    expect(result.countable).toBe(1);
  });

  it("weights critical items more heavily than low-priority items", () => {
    // One accepted critical item + one not-started low item should score
    // higher than the reverse, because critical items carry more weight.
    const criticalWins = calculateReadiness([
      makeItem({ id: "a", status: "accepted", priority: "critical" }),
      makeItem({ id: "b", status: "not_started", priority: "low" }),
    ]).score;

    const lowWins = calculateReadiness([
      makeItem({ id: "a", status: "not_started", priority: "critical" }),
      makeItem({ id: "b", status: "accepted", priority: "low" }),
    ]).score;

    expect(criticalWins).toBeGreaterThan(lowWins);
  });

  it("gives blocked and rejected items zero completion credit", () => {
    const items = [makeItem({ id: "a", status: "blocked", priority: "high" })];
    expect(calculateReadiness(items).score).toBe(0);
  });

  it("computes per-category scores independently", () => {
    const items = [
      makeItem({ id: "a", category: "mechanical_interfaces", status: "accepted" }),
      makeItem({ id: "b", category: "electrical_interfaces", status: "not_started" }),
    ];
    const result = calculateReadiness(items);
    const mech = result.byCategory.find((c) => c.category === "mechanical_interfaces")!;
    const elec = result.byCategory.find((c) => c.category === "electrical_interfaces")!;
    expect(mech.score).toBe(100);
    expect(elec.score).toBe(0);
  });
});

describe("computeWarnings", () => {
  it("flags a blocked critical item", () => {
    const items = [makeItem({ id: "a", status: "blocked", priority: "critical", title: "Critical thing" })];
    const warnings = computeWarnings(baseMission, items, [], []);
    expect(warnings.some((w) => w.id === "blocked-critical")).toBe(true);
  });

  it("flags rejected evidence", () => {
    const items = [makeItem({ id: "a", status: "in_progress", evidenceStatus: "rejected" })];
    const warnings = computeWarnings(baseMission, items, [], []);
    expect(warnings.some((w) => w.id === "rejected-evidence")).toBe(true);
  });

  it("flags unresolved critical issues but not resolved ones", () => {
    const openIssue: Issue = {
      id: "iss-1",
      missionId: "mission-1",
      title: "Big problem",
      description: "",
      severity: "critical",
      scheduleImpactDays: 5,
      affectedMilestone: "integration",
      affectedChecklistItemIds: [],
      ownerId: "u-1",
      dueDate: iso(5),
      rootCause: "",
      recoveryPlan: "",
      escalated: true,
      state: "open",
      createdAt: iso(-2),
      updatedAt: iso(-1),
    };
    const warningsOpen = computeWarnings(baseMission, [], [openIssue], []);
    expect(warningsOpen.some((w) => w.id === "critical-issues")).toBe(true);

    const resolvedIssue: Issue = { ...openIssue, state: "resolved" };
    const warningsResolved = computeWarnings(baseMission, [], [resolvedIssue], []);
    expect(warningsResolved.some((w) => w.id === "critical-issues")).toBe(false);
  });

  it("flags when the integration deadline is inside 30 days", () => {
    const nearMission = { ...baseMission, integrationDate: iso(10) };
    const warnings = computeWarnings(nearMission, [], [], []);
    expect(warnings.some((w) => w.id === "integration-window")).toBe(true);
  });

  it("flags a pending decision that blocks dependent, non-accepted work", () => {
    const items = [makeItem({ id: "chk-1", status: "blocked" })];
    const decision: Decision = {
      id: "dec-1",
      missionId: "mission-1",
      statement: "Approve config",
      context: "",
      optionsConsidered: [],
      ownerId: "u-1",
      approverId: "u-2",
      dueDate: iso(3),
      status: "pending_approval",
      relatedRequirementIds: ["chk-1"],
      relatedIssueIds: [],
      createdAt: iso(-5),
    };
    const warnings = computeWarnings(baseMission, items, [], [decision]);
    expect(warnings.some((w) => w.id === "pending-decisions")).toBe(true);
  });

  it("does not flag a pending decision once its related item is accepted", () => {
    const items = [makeItem({ id: "chk-1", status: "accepted" })];
    const decision: Decision = {
      id: "dec-1",
      missionId: "mission-1",
      statement: "Approve config",
      context: "",
      optionsConsidered: [],
      ownerId: "u-1",
      approverId: "u-2",
      dueDate: iso(3),
      status: "pending_approval",
      relatedRequirementIds: ["chk-1"],
      relatedIssueIds: [],
      createdAt: iso(-5),
    };
    const warnings = computeWarnings(baseMission, items, [], [decision]);
    expect(warnings.some((w) => w.id === "pending-decisions")).toBe(false);
  });
});

describe("overdueItems", () => {
  it("returns items past due date that are not accepted or N/A", () => {
    const items = [
      makeItem({ id: "a", status: "in_progress", dueDate: iso(-3) }),
      makeItem({ id: "b", status: "accepted", dueDate: iso(-3) }),
      makeItem({ id: "c", status: "not_applicable", dueDate: iso(-3) }),
      makeItem({ id: "d", status: "blocked", dueDate: iso(5) }),
    ];
    const overdue = overdueItems(items);
    expect(overdue.map((i) => i.id)).toEqual(["a"]);
  });
});
