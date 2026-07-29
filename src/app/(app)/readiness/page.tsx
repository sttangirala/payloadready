"use client";

import { useState } from "react";
import { Plus, Trash2, Info, History } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";
import {
  useActiveMission,
  useMissionChecklist,
  useMissionDecisions,
  useMissionEvidence,
  useMissionIssues,
  useMissionReadinessReviews,
  useStore,
  useUserById,
} from "@/lib/store";
import { calculateReadiness, computeWarnings, overdueItems } from "@/lib/readiness";
import { READINESS_DECISION_META, SEVERITY_META } from "@/components/shared/status-meta";
import type { ReadinessDecisionValue } from "@/lib/types";
import { cn, formatDate, daysUntil } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function ReadinessPage() {
  const mission = useActiveMission();
  const items = useMissionChecklist();
  const evidence = useMissionEvidence();
  const issues = useMissionIssues();
  const decisions = useMissionDecisions();
  const reviews = useMissionReadinessReviews();
  const users = useStore((s) => s.users);
  const recordReadinessReview = useStore((s) => s.recordReadinessReview);
  const currentUserId = useStore((s) => s.currentUserId);
  const { push } = useToast();

  const [decision, setDecision] = useState<ReadinessDecisionValue>("conditionally_ready");
  const [comments, setComments] = useState("");
  const [conditions, setConditions] = useState<{ text: string; ownerId: string }[]>([{ text: "", ownerId: users[0]?.id ?? "" }]);
  const [reasons, setReasons] = useState<string[]>([""]);
  const [nextReviewDate, setNextReviewDate] = useState("");

  if (!mission) return null;

  const readiness = calculateReadiness(items);
  const warnings = computeWarnings(mission, items, issues, decisions);
  const overdue = overdueItems(items);
  const criticalHigh = issues.filter((i) => (i.severity === "critical" || i.severity === "high") && i.state !== "resolved");
  const pendingDecisions = decisions.filter((d) => d.status === "pending_approval" || d.status === "analysis_required" || d.status === "proposed");
  const acceptedEvidence = evidence.filter((e) => e.reviewStatus === "accepted").length;
  const blockedItems = items.filter((i) => i.status === "blocked");
  const missionId = mission.id;

  function submit() {
    recordReadinessReview({
      missionId,
      decision,
      score: readiness.score,
      comments,
      recordedById: currentUserId,
      conditions: decision === "conditionally_ready" ? conditions.filter((c) => c.text.trim()) : undefined,
      reasons: decision === "not_ready" ? reasons.filter((r) => r.trim()) : undefined,
      nextReviewDate: decision !== "ready" ? nextReviewDate || undefined : undefined,
    });
    push({ kind: "success", title: `Recorded: ${READINESS_DECISION_META[decision].label}` });
    setComments("");
  }

  const requiresConditions = decision === "conditionally_ready";
  const requiresReasons = decision === "not_ready";
  const canSubmit = !requiresConditions || conditions.some((c) => c.text.trim());
  const canSubmitReasons = !requiresReasons || reasons.some((r) => r.trim());

  return (
    <div>
      <PageHeader title="Readiness decision" description={`${mission.name} · Launch-integration readiness review`} />

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                Readiness summary
                <Tooltip label="Coordination indicator only — not a certification of flightworthiness, safety, or regulatory compliance.">
                  <Info className="h-3.5 w-3.5 text-slate-400" />
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4">
                <div className="text-4xl font-semibold tabular text-navy-950">{readiness.score}%</div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={cn("h-full rounded-full", readiness.score >= 80 ? "bg-green-600" : readiness.score >= 55 ? "bg-amber-600" : "bg-red-600")}
                      style={{ width: `${readiness.score}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    {readiness.byStatus.accepted ?? 0} of {readiness.countable} counted requirements accepted
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniStat label="Accepted evidence" value={acceptedEvidence} />
                <MiniStat label="Blocked requirements" value={blockedItems.length} tone={blockedItems.length ? "red" : "default"} />
                <MiniStat label="Critical / high issues" value={criticalHigh.length} tone={criticalHigh.length ? "red" : "default"} />
                <MiniStat label="Overdue actions" value={overdue.length} tone={overdue.length ? "amber" : "default"} />
                <MiniStat label="Pending decisions" value={pendingDecisions.length} tone={pendingDecisions.length ? "amber" : "default"} />
                <MiniStat label="Days to integration" value={daysUntil(mission.integrationDate)} />
              </div>

              {warnings.length > 0 && (
                <div className="mt-4 space-y-2">
                  {warnings.map((w) => (
                    <div key={w.id} className={cn("rounded-md border px-3 py-2 text-[12.5px]", w.level === "critical" ? "border-red-700/20 bg-red-100 text-red-700" : "border-amber-700/20 bg-amber-100 text-amber-700")}>
                      {w.message}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-md bg-surface-muted p-3 text-[12px] leading-relaxed text-slate-500">
                This score is a coordination indicator based on checklist status, weighted by priority. It does not by itself establish flightworthiness,
                regulatory compliance, or launch approval. Final determinations remain with qualified mission personnel, regulatory authorities, launch
                providers, and integrators.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category-level readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {readiness.byCategory.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-56 shrink-0 truncate text-[12.5px] text-navy-900">{c.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <div className={cn("h-full rounded-full", c.score >= 80 ? "bg-green-600" : c.score >= 50 ? "bg-amber-600" : "bg-red-600")} style={{ width: `${c.score}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[12px] tabular text-slate-500">{c.score}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top launch-integration threats</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {criticalHigh.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">No critical or high-severity issues open.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {criticalHigh.map((issue) => (
                    <li key={issue.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[13px] font-medium text-navy-900">{issue.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone={SEVERITY_META[issue.severity].tone}>{SEVERITY_META[issue.severity].label}</Badge>
                        <span className="text-[11.5px] text-slate-500">+{issue.scheduleImpactDays}d</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Decision history
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reviews.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">No readiness decisions recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {reviews.map((r) => (
                    <ReviewHistoryRow key={r.id} review={r} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Record a readiness decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Decision</Label>
                <div className="grid grid-cols-1 gap-2">
                  {(["ready", "conditionally_ready", "not_ready"] as ReadinessDecisionValue[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setDecision(v)}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-left text-[13px] font-medium transition-colors",
                        decision === v ? "border-navy-800 bg-blue-100/50 text-navy-950" : "border-border text-slate-600 hover:bg-surface-muted"
                      )}
                    >
                      {READINESS_DECISION_META[v].label}
                      <Badge tone={READINESS_DECISION_META[v].tone}>{v === decision ? "Selected" : ""}</Badge>
                    </button>
                  ))}
                </div>
              </div>

              {requiresConditions && (
                <div>
                  <Label>Conditions (required)</Label>
                  <div className="space-y-2">
                    {conditions.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={c.text}
                          onChange={(e) => setConditions(conditions.map((x, xi) => (xi === i ? { ...x, text: e.target.value } : x)))}
                          placeholder="e.g. Resolve battery safety rejection before shipment"
                        />
                        <Select
                          className="w-32"
                          value={c.ownerId}
                          onChange={(e) => setConditions(conditions.map((x, xi) => (xi === i ? { ...x, ownerId: e.target.value } : x)))}
                          options={users.map((u) => ({ value: u.id, label: u.name.split(" ")[0] }))}
                        />
                        <button onClick={() => setConditions(conditions.filter((_, xi) => xi !== i))} className="text-slate-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setConditions([...conditions, { text: "", ownerId: users[0]?.id ?? "" }])}>
                      <Plus className="h-3 w-3" /> Add condition
                    </Button>
                  </div>
                </div>
              )}

              {requiresReasons && (
                <div>
                  <Label>Reasons (required)</Label>
                  <div className="space-y-2">
                    {reasons.map((r, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={r} onChange={(e) => setReasons(reasons.map((x, xi) => (xi === i ? e.target.value : x)))} placeholder="e.g. Environmental test campaign incomplete" />
                        <button onClick={() => setReasons(reasons.filter((_, xi) => xi !== i))} className="text-slate-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setReasons([...reasons, ""])}>
                      <Plus className="h-3 w-3" /> Add reason
                    </Button>
                  </div>
                </div>
              )}

              {decision !== "ready" && (
                <div>
                  <Label>Next review date</Label>
                  <Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
                </div>
              )}

              <div>
                <Label>Supporting comments</Label>
                <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Context for this decision…" />
              </div>

              <Button className="w-full justify-center" onClick={submit} disabled={!canSubmit || !canSubmitReasons}>
                Record decision
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "red" | "amber" }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted/50 p-2.5">
      <div className="text-[10.5px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("text-lg font-semibold tabular", tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-navy-950")}>{value}</div>
    </div>
  );
}

function ReviewHistoryRow({ review }: { review: ReturnType<typeof useMissionReadinessReviews>[number] }) {
  const recorder = useUserById(review.recordedById);
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone={READINESS_DECISION_META[review.decision].tone}>{READINESS_DECISION_META[review.decision].label}</Badge>
          <span className="text-[12px] text-slate-500">{review.score}% readiness</span>
        </div>
        <span className="text-[11.5px] text-slate-400">{formatDate(review.recordedAt, "MMM d, yyyy h:mm a")}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
        <Avatar user={recorder} size="sm" /> {recorder?.name}
      </div>
      {review.comments && <p className="mt-1.5 text-[12.5px] text-navy-800">{review.comments}</p>}
      {review.conditions && review.conditions.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-slate-600">
          {review.conditions.map((c, i) => (
            <li key={i}>{c.text}</li>
          ))}
        </ul>
      )}
      {review.reasons && review.reasons.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-slate-600">
          {review.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
