"use client";

import { useState } from "react";
import { Printer, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useActiveMission,
  useMissionChecklist,
  useMissionDecisions,
  useMissionEvidence,
  useMissionIssues,
  useMissionReadinessReviews,
} from "@/lib/store";
import { calculateReadiness, overdueItems } from "@/lib/readiness";
import { CHECKLIST_STATUS_META, READINESS_DECISION_META, SEVERITY_META } from "@/components/shared/status-meta";
import { formatDate, cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function ReportsPage() {
  const mission = useActiveMission();
  const items = useMissionChecklist();
  const evidence = useMissionEvidence();
  const issues = useMissionIssues();
  const decisions = useMissionDecisions();
  const reviews = useMissionReadinessReviews();
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  if (!mission) return null;

  const readiness = calculateReadiness(items);
  const overdue = overdueItems(items);
  const outstanding = items.filter((i) => i.status !== "accepted" && i.status !== "not_applicable");
  const rejectedEvidence = evidence.filter((e) => e.reviewStatus === "rejected" && !e.superseded);
  const missingEvidenceItems = items.filter((i) => i.evidenceStatus === "none" && i.status !== "not_applicable");
  const criticalIssues = issues.filter((i) => (i.severity === "critical" || i.severity === "high") && i.state !== "resolved");
  const pendingDecisions = decisions.filter((d) => d.status === "pending_approval" || d.status === "analysis_required" || d.status === "proposed");
  const latestReview = reviews[0];

  const recommendedActions = [
    ...criticalIssues.slice(0, 2).map((i) => `Resolve "${i.title}" — ${i.recoveryPlan || "recovery plan pending."}`),
    ...overdue.slice(0, 2).map((i) => `Close overdue item "${i.title}" (owner: assigned).`),
    ...pendingDecisions.slice(0, 2).map((d) => `Resolve pending decision: "${d.statement}".`),
  ].slice(0, 5);

  const execSummary = `${mission.name} readiness report — ${formatDate(new Date().toISOString())}\n\nOverall readiness: ${readiness.score}% (${
    latestReview ? READINESS_DECISION_META[latestReview.decision].label : "No decision recorded"
  }). ${readiness.byStatus.accepted ?? 0} of ${readiness.countable} counted requirements accepted. ${overdue.length} items overdue, ${criticalIssues.length} critical/high issues open, ${pendingDecisions.length} decisions pending. Integration is scheduled for ${formatDate(
    mission.integrationDate
  )}.`;

  return (
    <div>
      <PageHeader
        className="print:hidden"
        title="Reports"
        description="Printable leadership summary of launch-integration readiness"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(execSummary);
                setCopied(true);
                push({ kind: "success", title: "Executive summary copied" });
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy summary"}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print / export PDF
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-3xl p-6 print:max-w-none print:p-0">
        <div id="report" className="rounded-lg border border-border bg-surface p-8 print:border-0 print:p-0 print:shadow-none">
          <div className="mb-6 flex items-start justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-semibold text-navy-950">{mission.name} — Launch Integration Readiness Report</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                {mission.payloadName} · {mission.formFactor ?? mission.missionType}
              </p>
            </div>
            <div className="text-right text-[12px] text-slate-500">
              <div>Generated {formatDate(new Date().toISOString(), "MMM d, yyyy")}</div>
              <div>{mission.launchProvider}</div>
            </div>
          </div>

          <Section title="Mission summary">
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <ReportDetail label="Mission type" value={mission.missionType} />
              <ReportDetail label="Phase" value={mission.phase} />
              <ReportDetail label="Launch provider" value={mission.launchProvider} />
              <ReportDetail label="Integrator" value={mission.integrator} />
              <ReportDetail label="Payload delivery" value={formatDate(mission.payloadDeliveryDate)} />
              <ReportDetail label="Integration date" value={formatDate(mission.integrationDate)} />
              <ReportDetail label="Target launch date" value={formatDate(mission.targetLaunchDate)} />
            </dl>
          </Section>

          <Section title="Overall readiness">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-semibold tabular text-navy-950">{readiness.score}%</div>
              {latestReview ? (
                <Badge tone={READINESS_DECISION_META[latestReview.decision].tone}>{READINESS_DECISION_META[latestReview.decision].label}</Badge>
              ) : (
                <Badge tone="neutral">No decision recorded</Badge>
              )}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
              This is a coordination indicator based on checklist completion, weighted by priority. It does not by itself establish flightworthiness,
              regulatory compliance, or launch approval.
            </p>
          </Section>

          <Section title="Category-level status">
            <div className="space-y-2">
              {readiness.byCategory.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-52 shrink-0 text-[12.5px] text-navy-900">{c.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted print:border print:border-border-strong">
                    <div className={cn("h-full rounded-full", c.score >= 80 ? "bg-green-600" : c.score >= 50 ? "bg-amber-600" : "bg-red-600")} style={{ width: `${c.score}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[12px] text-slate-500">
                    {c.accepted}/{c.total} · {c.score}%
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Outstanding requirements">
            {outstanding.length === 0 ? (
              <p className="text-[13px] text-slate-500">All counted requirements are accepted.</p>
            ) : (
              <ul className="space-y-1 text-[12.5px]">
                {outstanding.slice(0, 12).map((i) => (
                  <li key={i.id} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
                    <span className="text-navy-900">{i.title}</span>
                    <Badge tone={CHECKLIST_STATUS_META[i.status].tone}>{CHECKLIST_STATUS_META[i.status].label}</Badge>
                  </li>
                ))}
                {outstanding.length > 12 && <li className="pt-1 text-slate-400">+ {outstanding.length - 12} more in the full checklist.</li>}
              </ul>
            )}
          </Section>

          <Section title="Missing or rejected evidence">
            {rejectedEvidence.length === 0 && missingEvidenceItems.length === 0 ? (
              <p className="text-[13px] text-slate-500">No outstanding evidence gaps.</p>
            ) : (
              <ul className="space-y-1 text-[12.5px] text-navy-900">
                {rejectedEvidence.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium">{e.documentName}</span> — rejected: {e.reviewComments}
                  </li>
                ))}
                {missingEvidenceItems.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <span className="font-medium">{i.title}</span> — no evidence submitted yet.
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Critical issues">
            {criticalIssues.length === 0 ? (
              <p className="text-[13px] text-slate-500">No open critical or high-severity issues.</p>
            ) : (
              <ul className="space-y-1.5 text-[12.5px]">
                {criticalIssues.map((i) => (
                  <li key={i.id} className="flex items-center justify-between">
                    <span className="text-navy-900">{i.title}</span>
                    <Badge tone={SEVERITY_META[i.severity].tone}>{SEVERITY_META[i.severity].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Pending decisions">
            {pendingDecisions.length === 0 ? (
              <p className="text-[13px] text-slate-500">No pending decisions.</p>
            ) : (
              <ul className="space-y-1 text-[12.5px] text-navy-900">
                {pendingDecisions.map((d) => (
                  <li key={d.id}>{d.statement}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Overdue actions">
            {overdue.length === 0 ? (
              <p className="text-[13px] text-slate-500">Nothing overdue.</p>
            ) : (
              <ul className="space-y-1 text-[12.5px] text-navy-900">
                {overdue.map((i) => (
                  <li key={i.id}>
                    {i.title} — due {formatDate(i.dueDate)}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recommended next actions">
            {recommendedActions.length === 0 ? (
              <p className="text-[13px] text-slate-500">No urgent actions identified.</p>
            ) : (
              <ol className="list-decimal space-y-1 pl-4 text-[12.5px] text-navy-900">
                {recommendedActions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            )}
          </Section>

          <div className="mt-6 rounded-md bg-surface-muted p-3 text-[11px] leading-relaxed text-slate-500">
            PayloadReady is a coordination and readiness-tracking tool. It does not certify flightworthiness, safety, regulatory compliance, or launch
            approval. Final determinations remain with qualified mission personnel, regulatory authorities, launch providers, and integrators. Report
            generated {formatDate(new Date().toISOString(), "MMM d, yyyy h:mm a")}.
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 break-inside-avoid">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function ReportDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-navy-900">{value}</dd>
    </div>
  );
}
