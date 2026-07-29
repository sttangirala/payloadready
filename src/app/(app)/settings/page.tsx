"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useActiveMission, useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { CHECKLIST_CATEGORIES } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  program_manager: "Program manager",
  engineer: "Engineer",
  reviewer: "Reviewer",
  executive: "Executive",
};

const ROLE_PERMISSIONS: Record<Role, string> = {
  administrator: "Full access to all missions, settings, and user management.",
  program_manager: "Manage mission details, checklist, issues, decisions, and reports.",
  engineer: "Update assigned checklist work and submit evidence.",
  reviewer: "Review evidence and contribute to decisions.",
  executive: "Read-only access to dashboards and reports.",
};

const TABS = [
  { value: "organization", label: "Organization" },
  { value: "mission", label: "Mission" },
  { value: "users", label: "Users & roles" },
  { value: "templates", label: "Checklist templates" },
  { value: "notifications", label: "Notifications" },
  { value: "audit", label: "Audit log" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("organization");
  const org = useStore((s) => s.organizations[0]);
  const mission = useActiveMission();
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const activity = useStore((s) => s.activity);
  const { push } = useToast();

  const [notifPrefs, setNotifPrefs] = useState({ overdue: true, rejections: true, decisions: true, digest: false });

  return (
    <div>
      <PageHeader title="Settings" description="Organization, mission, users, and system configuration" />
      <div className="border-b border-border bg-surface px-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="mx-auto max-w-3xl p-6">
        {tab === "organization" && org && (
          <Card>
            <CardHeader>
              <CardTitle>Organization settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization name</Label>
                <Input defaultValue={org.name} onBlur={() => push({ kind: "success", title: "Organization name saved" })} />
              </div>
              <div className="text-[12.5px] text-slate-500">Created {formatDate(org.createdAt)}</div>
            </CardContent>
          </Card>
        )}

        {tab === "mission" && mission && (
          <Card>
            <CardHeader>
              <CardTitle>Mission settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] text-slate-600">
              <p>
                Edit mission fields — dates, launch provider, integrator, and phase — from the{" "}
                <a href={`/missions/${mission.id}`} className="font-medium text-navy-800 hover:underline">
                  mission workspace
                </a>
                .
              </p>
              <p>Status configuration (checklist and evidence status vocabularies) is fixed for this MVP and applies consistently across all missions.</p>
            </CardContent>
          </Card>
        )}

        {tab === "users" && (
          <Card>
            <CardHeader>
              <CardTitle>Users & roles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar user={u} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-navy-950">
                        {u.name}
                        {u.id === currentUserId && <Badge tone="blue">You</Badge>}
                      </div>
                      <div className="text-[11.5px] text-slate-500">{u.email}</div>
                      <div className="mt-1 text-[11.5px] text-slate-400">{ROLE_PERMISSIONS[u.role]}</div>
                    </div>
                    <Badge tone="neutral">{ROLE_LABELS[u.role]}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {tab === "templates" && (
          <Card>
            <CardHeader>
              <CardTitle>Checklist template management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-[13px] text-slate-500">
                Every mission is seeded from a category structure covering the ten readiness areas below. New missions can start from the standard
                CubeSat template, a hosted-payload template, or a blank workspace during onboarding.
              </p>
              <ul className="grid grid-cols-2 gap-2">
                {CHECKLIST_CATEGORIES.map((c) => (
                  <li key={c.key} className="rounded-md border border-border px-3 py-2 text-[12.5px] text-navy-900">
                    {c.label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {tab === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle>Notification preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "overdue" as const, label: "Overdue checklist items", desc: "Get notified when an assigned item passes its due date." },
                { key: "rejections" as const, label: "Evidence rejections", desc: "Get notified when evidence you submitted is rejected." },
                { key: "decisions" as const, label: "Decisions awaiting approval", desc: "Get notified when a decision needs your approval." },
                { key: "digest" as const, label: "Weekly readiness digest", desc: "A weekly summary of readiness score and open items." },
              ].map((p) => (
                <label key={p.key} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                  <span>
                    <span className="block text-[13px] font-medium text-navy-900">{p.label}</span>
                    <span className="block text-[12px] text-slate-500">{p.desc}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notifPrefs[p.key]}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, [p.key]: e.target.checked })}
                    className="mt-1 h-4 w-4 shrink-0 accent-navy-900"
                  />
                </label>
              ))}
              <Button onClick={() => push({ kind: "success", title: "Notification preferences saved" })}>Save preferences</Button>
            </CardContent>
          </Card>
        )}

        {tab === "audit" && (
          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[28rem] overflow-y-auto p-0">
              <ul className="divide-y divide-border">
                {activity.map((a) => {
                  const actor = users.find((u) => u.id === a.actorId);
                  return (
                    <li key={a.id} className="px-4 py-2.5 text-[12.5px]">
                      <span className="font-medium text-navy-900">{actor?.name ?? "Unknown user"}</span> <span className="text-slate-500">{a.action}</span>{" "}
                      <span className="font-medium text-navy-900">{a.entityLabel}</span>
                      <span className="ml-2 text-[11px] text-slate-400">{formatDate(a.timestamp, "MMM d, yyyy h:mm a")}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
