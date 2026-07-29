import type { ChecklistItem, ChecklistCategoryKey, Issue, Decision, Mission } from "./types";
import { CHECKLIST_CATEGORIES } from "./types";
import { daysUntil } from "./utils";

/**
 * Readiness calculation
 * ----------------------
 * Each checklist item contributes a completion score based on its status.
 * Items are weighted by priority so that critical requirements move the
 * needle more than low-priority ones. "Not applicable" items are excluded
 * entirely so they neither help nor hurt the score.
 *
 * This produces a coordination indicator only — see the disclaimer shown
 * alongside every readiness figure in the product.
 */

export const STATUS_COMPLETION: Record<ChecklistItem["status"], number> = {
  accepted: 1,
  submitted: 0.7,
  under_review: 0.7,
  in_progress: 0.4,
  not_started: 0,
  rejected: 0,
  blocked: 0,
  not_applicable: 0, // excluded from denominator, value unused
};

export const PRIORITY_WEIGHT: Record<ChecklistItem["priority"], number> = {
  critical: 4,
  high: 2,
  medium: 1,
  low: 0.5,
};

export interface CategoryReadiness {
  category: ChecklistCategoryKey;
  label: string;
  score: number; // 0-100
  total: number;
  accepted: number;
  blocked: number;
}

export interface ReadinessResult {
  score: number; // 0-100, rounded
  totalItems: number;
  countable: number;
  excluded: number;
  byStatus: Record<ChecklistItem["status"], number>;
  byCategory: CategoryReadiness[];
}

export function calculateReadiness(items: ChecklistItem[]): ReadinessResult {
  const countable = items.filter((i) => i.status !== "not_applicable");

  let weightedSum = 0;
  let weightTotal = 0;
  const byStatus: Record<string, number> = {};

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    if (item.status === "not_applicable") continue;
    const w = PRIORITY_WEIGHT[item.priority];
    weightedSum += w * STATUS_COMPLETION[item.status];
    weightTotal += w;
  }

  const score = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : 0;

  const byCategory: CategoryReadiness[] = CHECKLIST_CATEGORIES.map(({ key, label }) => {
    const catItems = items.filter((i) => i.category === key);
    const catCountable = catItems.filter((i) => i.status !== "not_applicable");
    let ws = 0;
    let wt = 0;
    for (const item of catCountable) {
      const w = PRIORITY_WEIGHT[item.priority];
      ws += w * STATUS_COMPLETION[item.status];
      wt += w;
    }
    return {
      category: key,
      label,
      score: wt > 0 ? Math.round((ws / wt) * 100) : 0,
      total: catItems.length,
      accepted: catItems.filter((i) => i.status === "accepted").length,
      blocked: catItems.filter((i) => i.status === "blocked").length,
    };
  });

  return {
    score,
    totalItems: items.length,
    countable: countable.length,
    excluded: items.length - countable.length,
    byStatus: byStatus as Record<ChecklistItem["status"], number>,
    byCategory,
  };
}

export type WarningLevel = "critical" | "warning";

export interface ReadinessWarning {
  id: string;
  level: WarningLevel;
  message: string;
}

export function computeWarnings(
  mission: Mission,
  items: ChecklistItem[],
  issues: Issue[],
  decisions: Decision[]
): ReadinessWarning[] {
  const warnings: ReadinessWarning[] = [];

  const blockedCritical = items.filter((i) => i.status === "blocked" && i.priority === "critical");
  if (blockedCritical.length > 0) {
    warnings.push({
      id: "blocked-critical",
      level: "critical",
      message: `${blockedCritical.length} critical requirement${blockedCritical.length > 1 ? "s are" : " is"} blocked: ${blockedCritical.map((i) => i.title).join(", ")}.`,
    });
  }

  const rejected = items.filter((i) => i.status === "rejected" || i.evidenceStatus === "rejected");
  if (rejected.length > 0) {
    warnings.push({
      id: "rejected-evidence",
      level: "warning",
      message: `${rejected.length} item${rejected.length > 1 ? "s have" : " has"} rejected evidence requiring resubmission.`,
    });
  }

  const criticalIssues = issues.filter((i) => i.severity === "critical" && i.state !== "resolved" && i.state !== "accepted_risk");
  if (criticalIssues.length > 0) {
    warnings.push({
      id: "critical-issues",
      level: "critical",
      message: `${criticalIssues.length} unresolved critical issue${criticalIssues.length > 1 ? "s" : ""}: ${criticalIssues.map((i) => i.title).join(", ")}.`,
    });
  }

  const daysToIntegration = daysUntil(mission.integrationDate);
  if (daysToIntegration <= 30) {
    warnings.push({
      id: "integration-window",
      level: daysToIntegration <= 14 ? "critical" : "warning",
      message: `Integration date is ${daysToIntegration} day${daysToIntegration === 1 ? "" : "s"} away.`,
    });
  }

  const pendingBlockingDecisions = decisions.filter(
    (dec) =>
      (dec.status === "pending_approval" || dec.status === "analysis_required" || dec.status === "proposed") &&
      dec.relatedRequirementIds.some((id) => {
        const item = items.find((i) => i.id === id);
        return item && item.status !== "accepted" && item.status !== "not_applicable";
      })
  );
  if (pendingBlockingDecisions.length > 0) {
    warnings.push({
      id: "pending-decisions",
      level: "warning",
      message: `${pendingBlockingDecisions.length} pending decision${pendingBlockingDecisions.length > 1 ? "s" : ""} blocking dependent work.`,
    });
  }

  return warnings;
}

export function overdueItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter(
    (i) => i.status !== "accepted" && i.status !== "not_applicable" && daysUntil(i.dueDate) < 0
  );
}
