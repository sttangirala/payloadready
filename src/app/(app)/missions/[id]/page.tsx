"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { useStore, useUserById } from "@/lib/store";
import { CHECKLIST_STATUS_META, ISSUE_STATE_META, DECISION_STATUS_META } from "@/components/shared/status-meta";
import { formatDate, daysUntil } from "@/lib/utils";
import { MILESTONE_LABELS } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

export default function MissionWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const mission = useStore((s) => s.missions.find((m) => m.id === id));
  const setActiveMission = useStore((s) => s.setActiveMission);
  const updateMission = useStore((s) => s.updateMission);
  const checklistItems = useStore((s) => s.checklistItems.filter((i) => i.missionId === id));
  const issues = useStore((s) => s.issues.filter((i) => i.missionId === id));
  const decisions = useStore((s) => s.decisions.filter((d) => d.missionId === id));
  const milestones = useStore((s) => s.milestones.filter((m) => m.missionId === id));
  const activity = useStore((s) => s.activity.filter((a) => a.missionId === id)).slice(0, 6);
  const users = useStore((s) => s.users);
  const lead = useUserById(mission?.missionLeadId);
  const { push } = useToast();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(mission);

  useEffect(() => {
    setActiveMission(id);
  }, [id, setActiveMission]);

  useEffect(() => {
    setForm(mission);
  }, [mission]);

  if (!mission || !form) return null;

  const openIssues = issues.filter((i) => i.state !== "resolved");
  const openDecisions = decisions.filter((d) => d.status !== "approved" && d.status !== "rejected");

  return (
    <div>
      <PageHeader
        title={mission.name}
        description="Mission workspace"
        actions={
          editing ? (
            <Button
              onClick={() => {
                updateMission(mission.id, form);
                setEditing(false);
                push({ kind: "success", title: "Mission details updated" });
              }}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Mission overview</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payload / spacecraft name">
                    <Input value={form.payloadName} onChange={(e) => setForm({ ...form, payloadName: e.target.value })} />
                  </Field>
                  <Field label="Mission type">
                    <Input value={form.missionType} onChange={(e) => setForm({ ...form, missionType: e.target.value })} />
                  </Field>
                  <Field label="Form factor">
                    <Input value={form.formFactor ?? ""} onChange={(e) => setForm({ ...form, formFactor: e.target.value })} />
                  </Field>
                  <Field label="Phase">
                    <Input value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} />
                  </Field>
                  <Field label="Launch provider">
                    <Input value={form.launchProvider} onChange={(e) => setForm({ ...form, launchProvider: e.target.value })} />
                  </Field>
                  <Field label="Integrator">
                    <Input value={form.integrator} onChange={(e) => setForm({ ...form, integrator: e.target.value })} />
                  </Field>
                  <Field label="Payload delivery date">
                    <Input type="date" value={form.payloadDeliveryDate} onChange={(e) => setForm({ ...form, payloadDeliveryDate: e.target.value })} />
                  </Field>
                  <Field label="Integration date">
                    <Input type="date" value={form.integrationDate} onChange={(e) => setForm({ ...form, integrationDate: e.target.value })} />
                  </Field>
                  <Field label="Target launch date">
                    <Input type="date" value={form.targetLaunchDate} onChange={(e) => setForm({ ...form, targetLaunchDate: e.target.value })} />
                  </Field>
                  <Field label="Mission lead">
                    <Select value={form.missionLeadId} onChange={(e) => setForm({ ...form, missionLeadId: e.target.value })} options={users.map((u) => ({ value: u.id, label: u.name }))} />
                  </Field>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-4 text-[13px]">
                  <Detail label="Payload / spacecraft" value={mission.payloadName} />
                  <Detail label="Mission type" value={mission.missionType} />
                  <Detail label="Form factor" value={mission.formFactor ?? "—"} />
                  <Detail label="Phase" value={mission.phase} />
                  <Detail label="Launch provider" value={mission.launchProvider} />
                  <Detail label="Integrator" value={mission.integrator} />
                  <Detail label="Payload delivery date" value={formatDate(mission.payloadDeliveryDate)} />
                  <Detail label="Integration date" value={`${formatDate(mission.integrationDate)} (${daysUntil(mission.integrationDate)}d)`} />
                  <Detail label="Target launch date" value={formatDate(mission.targetLaunchDate)} />
                  <Detail label="Mission lead" value={lead?.name ?? "—"} />
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Milestone dates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[13px] text-navy-900">{MILESTONE_LABELS[m.key]}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[12.5px] text-slate-500">{formatDate(m.date)}</span>
                      <Badge tone={m.status === "complete" ? "green" : m.status === "on_track" ? "blue" : m.status === "at_risk" ? "amber" : "red"}>{m.status.replace("_", " ")}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent updates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">No recent activity.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {activity.map((a) => (
                    <ActivityLine key={a.id} actorId={a.actorId} action={a.action} entityLabel={a.entityLabel} timestamp={a.timestamp} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mission team</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <Avatar user={u} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-navy-900">{u.name}</div>
                      <div className="truncate text-[11.5px] text-slate-500">{u.title}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open issues</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {openIssues.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">None open.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {openIssues.map((i) => (
                    <li key={i.id} className="px-4 py-2.5">
                      <Link href="/issues" className="text-[13px] font-medium text-navy-900 hover:underline">
                        {i.title}
                      </Link>
                      <div className="mt-1">
                        <Badge tone={ISSUE_STATE_META[i.state].tone}>{ISSUE_STATE_META[i.state].label}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open decisions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {openDecisions.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">None open.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {openDecisions.map((d) => (
                    <li key={d.id} className="px-4 py-2.5">
                      <Link href="/decisions" className="text-[13px] font-medium text-navy-900 hover:underline">
                        {d.statement}
                      </Link>
                      <div className="mt-1">
                        <Badge tone={DECISION_STATUS_META[d.status].tone}>{DECISION_STATUS_META[d.status].label}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked checklist snapshot</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {checklistItems.slice(0, 6).map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-4 py-2.5">
                    <Link href="/checklist" className="truncate text-[12.5px] text-navy-900 hover:underline">
                      {i.title}
                    </Link>
                    <Badge tone={CHECKLIST_STATUS_META[i.status].tone}>{CHECKLIST_STATUS_META[i.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-navy-900">{value}</dd>
    </div>
  );
}

function ActivityLine({ actorId, action, entityLabel, timestamp }: { actorId: string; action: string; entityLabel: string; timestamp: string }) {
  const user = useUserById(actorId);
  return (
    <li className="flex items-start gap-2.5 px-4 py-2.5">
      <Avatar user={user} size="sm" />
      <div className="text-[12.5px] leading-snug">
        <span className="font-medium text-navy-900">{user?.name}</span> <span className="text-slate-500">{action}</span>{" "}
        <span className="font-medium text-navy-900">{entityLabel}</span>
        <div className="text-[11px] text-slate-400">{formatDate(timestamp, "MMM d, h:mm a")}</div>
      </div>
    </li>
  );
}
