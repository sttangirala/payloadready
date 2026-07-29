"use client";

import Link from "next/link";
import {
  Gauge,
  CalendarClock,
  ListChecks,
  FolderCheck,
  AlertTriangle,
  Clock,
  GitPullRequestArrow,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  useActiveMission,
  useMissionActivity,
  useMissionChecklist,
  useMissionDecisions,
  useMissionEvidence,
  useMissionIssues,
  useMissionMilestones,
  useMissionReadinessReviews,
  useStore,
  useUserById,
} from "@/lib/store";
import { calculateReadiness, computeWarnings, overdueItems } from "@/lib/readiness";
import { CHECKLIST_STATUS_META, READINESS_DECISION_META, SEVERITY_META } from "@/components/shared/status-meta";
import { MILESTONE_LABELS } from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";

function ActivityRow({ actorId, action, entityLabel, timestamp }: { actorId: string; action: string; entityLabel: string; timestamp: string }) {
  const user = useUserById(actorId);
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Avatar user={user} size="sm" />
      <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
        <span className="font-medium text-navy-900">{user?.name ?? "Someone"}</span>{" "}
        <span className="text-slate-500">{action}</span> <span className="font-medium text-navy-900">{entityLabel}</span>
        <div className="text-[11.5px] text-slate-400">{formatDate(timestamp, "MMM d, h:mm a")}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const mission = useActiveMission();
  const items = useMissionChecklist();
  const evidence = useMissionEvidence();
  const issues = useMissionIssues();
  const decisions = useMissionDecisions();
  const milestones = useMissionMilestones();
  const activity = useMissionActivity().slice(0, 8);
  const readinessReviews = useMissionReadinessReviews();
  const users = useStore((s) => s.users);

  if (!mission) return null;

  const readiness = calculateReadiness(items);
  const warnings = computeWarnings(mission, items, issues, decisions);
  const overdue = overdueItems(items);
  const openIssues = issues.filter((i) => i.state !== "resolved");
  const criticalHighIssues = openIssues.filter((i) => i.severity === "critical" || i.severity === "high");
  const pendingDecisions = decisions.filter((d) => d.status === "pending_approval" || d.status === "analysis_required" || d.status === "proposed");
  const acceptedEvidence = evidence.filter((e) => e.reviewStatus === "accepted").length;
  const reviewedEvidence = evidence.filter((e) => e.reviewStatus === "accepted" || e.reviewStatus === "rejected").length;
  const evidenceAcceptanceRate = reviewedEvidence > 0 ? Math.round((acceptedEvidence / reviewedEvidence) * 100) : 0;
  const latestDecision = readinessReviews[0];

  const attentionItems = items
    .filter((i) => i.status === "blocked" || i.status === "rejected" || (i.priority === "critical" && overdue.some((o) => o.id === i.id)))
    .slice(0, 6);

  const upcomingDeadlines = [...items]
    .filter((i) => i.status !== "accepted" && i.status !== "not_applicable" && daysUntil(i.dueDate) >= 0)
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))
    .slice(0, 5);

  const scoreTone = readiness.score >= 80 ? "green" : readiness.score >= 55 ? "amber" : "red";

  return (
    <div>
      <PageHeader
        title="Program dashboard"
        description={`${mission.name} · ${mission.payloadName} · ${mission.formFactor ?? mission.missionType}`}
        actions={
          <Link href="/readiness">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-navy-900 bg-navy-900 px-3.5 text-sm font-medium text-white hover:bg-navy-800">
              Open readiness review <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        }
      />

      <div className="space-y-6 p-6">
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w) => (
              <div
                key={w.id}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-[13px]",
                  w.level === "critical" ? "border-red-700/20 bg-red-100 text-red-700" : "border-amber-700/20 bg-amber-100 text-amber-700"
                )}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {w.message}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Readiness score"
            value={`${readiness.score}%`}
            tone={scoreTone}
            icon={Gauge}
            tooltip="Weighted average of checklist completion, with critical requirements weighted more heavily. Accepted = 100%, under review/submitted = 70%, in progress = 40%, not started/blocked/rejected = 0%. This is a coordination indicator, not a certification."
            sub={latestDecision ? <Badge tone={READINESS_DECISION_META[latestDecision.decision].tone}>{READINESS_DECISION_META[latestDecision.decision].label}</Badge> : "No decision recorded"}
          />
          <StatCard
            label="Days to integration"
            value={daysUntil(mission.integrationDate)}
            icon={CalendarClock}
            tone={daysUntil(mission.integrationDate) <= 14 ? "red" : daysUntil(mission.integrationDate) <= 30 ? "amber" : "default"}
            sub={formatDate(mission.integrationDate)}
          />
          <StatCard
            label="Checklist completion"
            value={`${readiness.byStatus.accepted ?? 0}/${readiness.countable}`}
            icon={ListChecks}
            sub={`${overdue.length} overdue`}
          />
          <StatCard
            label="Evidence acceptance"
            value={`${evidenceAcceptanceRate}%`}
            icon={FolderCheck}
            sub={`${acceptedEvidence} of ${evidence.length} records accepted`}
          />
          <StatCard
            label="Open critical issues"
            value={criticalHighIssues.length}
            icon={AlertTriangle}
            tone={criticalHighIssues.length > 0 ? "red" : "default"}
            sub={`${openIssues.length} open total`}
          />
          <StatCard label="Overdue actions" value={overdue.length} icon={Clock} tone={overdue.length > 0 ? "amber" : "default"} sub="Past due date" />
          <StatCard
            label="Pending decisions"
            value={pendingDecisions.length}
            icon={GitPullRequestArrow}
            tone={pendingDecisions.length > 0 ? "amber" : "default"}
            sub="Awaiting approval"
          />
          <StatCard label="Categories on track" value={`${readiness.byCategory.filter((c) => c.score >= 80).length}/${readiness.byCategory.length}`} icon={Gauge} sub="≥ 80% complete" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Milestone timeline</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="flex min-w-[720px] items-center">
              {milestones.map((m, i) => (
                <div key={m.id} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div className={cn("h-px flex-1", i === 0 ? "bg-transparent" : "bg-border-strong")} />
                    <div
                      className={cn(
                        "h-3 w-3 shrink-0 rounded-full border-2",
                        m.status === "complete" && "border-green-600 bg-green-600",
                        m.status === "on_track" && "border-navy-800 bg-white",
                        m.status === "at_risk" && "border-amber-600 bg-amber-100",
                        m.status === "missed" && "border-red-600 bg-red-100"
                      )}
                    />
                    <div className={cn("h-px flex-1", i === milestones.length - 1 ? "bg-transparent" : "bg-border-strong")} />
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-[12px] font-medium text-navy-900">{MILESTONE_LABELS[m.key]}</div>
                    <div className="text-[11px] text-slate-500">{formatDate(m.date)}</div>
                    <Badge
                      className="mt-1"
                      tone={m.status === "complete" ? "green" : m.status === "on_track" ? "blue" : m.status === "at_risk" ? "amber" : "red"}
                    >
                      {m.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Items requiring attention</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {attentionItems.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">Nothing urgent right now.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {attentionItems.map((item) => {
                    const owner = users.find((u) => u.id === item.ownerId);
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <Link href="/checklist" className="truncate text-[13px] font-medium text-navy-900 hover:underline">
                            {item.title}
                          </Link>
                          <div className="text-[11.5px] text-slate-500">Due {formatDate(item.dueDate)}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Avatar user={owner} size="sm" />
                          <Badge tone={CHECKLIST_STATUS_META[item.status].tone}>{CHECKLIST_STATUS_META[item.status].label}</Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto py-1">
              {activity.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-slate-500">No activity yet.</p>
              ) : (
                activity.map((a) => <ActivityRow key={a.id} actorId={a.actorId} action={a.action} entityLabel={a.entityLabel} timestamp={a.timestamp} />)
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Top schedule threats</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {issues.filter((i) => i.state !== "resolved").length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">No open issues.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {[...issues]
                    .filter((i) => i.state !== "resolved")
                    .sort((a, b) => b.scheduleImpactDays - a.scheduleImpactDays)
                    .slice(0, 4)
                    .map((issue) => (
                      <li key={issue.id} className="px-4 py-2.5">
                        <Link href="/issues" className="text-[13px] font-medium text-navy-900 hover:underline">
                          {issue.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge tone={SEVERITY_META[issue.severity].tone}>{SEVERITY_META[issue.severity].label}</Badge>
                          <span className="text-[11.5px] text-slate-500">+{issue.scheduleImpactDays}d schedule impact</span>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending decisions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingDecisions.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">No pending decisions.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {pendingDecisions.map((dec) => (
                    <li key={dec.id} className="px-4 py-2.5">
                      <Link href="/decisions" className="text-[13px] font-medium text-navy-900 hover:underline">
                        {dec.statement}
                      </Link>
                      <div className="mt-1 text-[11.5px] text-slate-500">Due {formatDate(dec.dueDate)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming deadlines</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingDeadlines.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">Nothing due soon.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcomingDeadlines.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-4 py-2.5">
                      <Link href="/checklist" className="truncate text-[13px] font-medium text-navy-900 hover:underline">
                        {item.title}
                      </Link>
                      <span className="shrink-0 text-[11.5px] text-slate-500">{formatDate(item.dueDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
