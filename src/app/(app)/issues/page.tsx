"use client";

import { useState } from "react";
import { Plus, AlertTriangle, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, SearchInput, FilterSelect } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Drawer } from "@/components/ui/drawer";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMissionIssues, useMissionChecklist, useStore, useActiveMission, useUserById } from "@/lib/store";
import type { Issue, IssueState, Severity } from "@/lib/types";
import { MILESTONE_LABELS } from "@/lib/types";
import { ISSUE_STATE_META, ISSUE_STATE_OPTIONS, SEVERITY_META } from "@/components/shared/status-meta";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function IssuesPage() {
  const issues = useMissionIssues();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [state, setState] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = issues.filter((i) => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (severity !== "all" && i.severity !== severity) return false;
    if (state !== "all" && i.state !== state) return false;
    return true;
  });

  const open = issues.find((i) => i.id === openId);

  return (
    <div>
      <PageHeader
        title="Issues & recovery actions"
        description={`${issues.filter((i) => i.state !== "resolved").length} open of ${issues.length} total`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New issue
          </Button>
        }
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search issues…" />
        <FilterSelect value={severity} onChange={setSeverity} placeholder="All severities" options={(["critical", "high", "medium", "low"] as Severity[]).map((s) => ({ value: s, label: SEVERITY_META[s].label }))} />
        <FilterSelect value={state} onChange={setState} placeholder="All states" options={ISSUE_STATE_OPTIONS.map((s) => ({ value: s, label: ISSUE_STATE_META[s].label }))} />
        <span className="ml-auto text-[12.5px] text-slate-500">{filtered.length} issues</span>
      </FilterBar>

      <div className="overflow-x-auto p-6">
        {filtered.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No issues match your filters" description="Nothing threatening readiness right now, or try clearing filters." />
        ) : (
          <div className="flex min-w-[900px] gap-4">
            {ISSUE_STATE_OPTIONS.map((s) => (
              <div key={s} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-navy-950">
                    <Badge tone={ISSUE_STATE_META[s].tone} dot>
                      {ISSUE_STATE_META[s].label}
                    </Badge>
                  </span>
                  <span className="text-[11.5px] text-slate-400">{filtered.filter((i) => i.state === s).length}</span>
                </div>
                <div className="space-y-2">
                  {filtered
                    .filter((i) => i.state === s)
                    .map((issue) => (
                      <IssueCard key={issue.id} issue={issue} onOpen={() => setOpenId(issue.id)} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && <IssueDrawer issue={open} onClose={() => setOpenId(null)} />}
      <CreateIssueDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function IssueCard({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
  const owner = useUserById(issue.ownerId);
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-md border border-border bg-surface p-3 text-left shadow-sm hover:border-border-strong hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium leading-snug text-navy-950">{issue.title}</span>
        {issue.escalated && <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge tone={SEVERITY_META[issue.severity].tone}>{SEVERITY_META[issue.severity].label}</Badge>
        <span className="text-[11px] text-slate-500">+{issue.scheduleImpactDays}d</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Avatar user={owner} size="sm" />
        <span className="text-[11px] text-slate-500">Due {formatDate(issue.dueDate)}</span>
      </div>
    </button>
  );
}

function IssueDrawer({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const updateIssue = useStore((s) => s.updateIssue);
  const users = useStore((s) => s.users);
  const checklist = useMissionChecklist();
  const { push } = useToast();
  const [recoveryPlan, setRecoveryPlan] = useState(issue.recoveryPlan);
  const [resolutionNotes, setResolutionNotes] = useState(issue.resolutionNotes ?? "");

  const affectedItems = checklist.filter((i) => issue.affectedChecklistItemIds.includes(i.id));

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={SEVERITY_META[issue.severity].label + " severity"}
      title={issue.title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              updateIssue(issue.id, { recoveryPlan, resolutionNotes });
              push({ kind: "success", title: "Issue updated" });
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ISSUE_STATE_META[issue.state].tone}>{ISSUE_STATE_META[issue.state].label}</Badge>
          <Badge tone={SEVERITY_META[issue.severity].tone}>{SEVERITY_META[issue.severity].label}</Badge>
          {issue.escalated && <Badge tone="red">Escalated</Badge>}
        </div>

        <p className="text-[13.5px] leading-relaxed text-navy-800">{issue.description}</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>State</Label>
            <Select
              value={issue.state}
              onChange={(e) => updateIssue(issue.id, { state: e.target.value as IssueState })}
              options={ISSUE_STATE_OPTIONS.map((s) => ({ value: s, label: ISSUE_STATE_META[s].label }))}
            />
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={issue.ownerId} onChange={(e) => updateIssue(issue.id, { ownerId: e.target.value })} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={issue.dueDate} onChange={(e) => updateIssue(issue.id, { dueDate: e.target.value })} />
          </div>
          <div>
            <Label>Schedule impact (days)</Label>
            <Input type="number" value={issue.scheduleImpactDays} onChange={(e) => updateIssue(issue.id, { scheduleImpactDays: Number(e.target.value) })} />
          </div>
        </div>

        <div className="rounded-md bg-surface-muted px-3 py-2 text-[12.5px] text-slate-600">
          <span className="font-medium text-navy-900">Affects: </span>
          {MILESTONE_LABELS[issue.affectedMilestone as keyof typeof MILESTONE_LABELS] ?? "No specific milestone"}
        </div>

        <div>
          <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-slate-500">Root cause</div>
          <p className="text-[13px] text-navy-800">{issue.rootCause || "Not yet documented."}</p>
        </div>

        <div>
          <Label>Recovery plan</Label>
          <Textarea rows={3} value={recoveryPlan} onChange={(e) => setRecoveryPlan(e.target.value)} />
        </div>

        {affectedItems.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-slate-500">Affected checklist items</div>
            <ul className="space-y-1">
              {affectedItems.map((i) => (
                <li key={i.id} className="text-[13px] text-navy-900">
                  {i.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <Label>Resolution notes</Label>
          <Textarea rows={2} value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Document how this was resolved…" />
        </div>

        {issue.state !== "resolved" && (
          <Button
            variant="secondary"
            onClick={() => {
              updateIssue(issue.id, { state: "resolved", resolutionNotes: resolutionNotes || "Resolved." });
              push({ kind: "success", title: "Issue resolved" });
              onClose();
            }}
          >
            Mark resolved
          </Button>
        )}
      </div>
    </Drawer>
  );
}

function CreateIssueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mission = useActiveMission();
  const users = useStore((s) => s.users);
  const addIssue = useStore((s) => s.addIssue);
  const { push } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleImpactDays, setScheduleImpactDays] = useState(0);

  function submit() {
    if (!mission || !title.trim()) return;
    addIssue({
      missionId: mission.id,
      title: title.trim(),
      description,
      severity,
      scheduleImpactDays,
      affectedMilestone: "none",
      affectedChecklistItemIds: [],
      ownerId,
      dueDate,
      rootCause: "",
      recoveryPlan: "",
      escalated: severity === "critical",
      state: "open",
    });
    push({ kind: "success", title: "Issue opened", description: title });
    setTitle("");
    setDescription("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New issue"
      description="Record anything threatening readiness or the launch-integration schedule."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Open issue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Severity</Label>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} options={(["low", "medium", "high", "critical"] as Severity[]).map((s) => ({ value: s, label: SEVERITY_META[s].label }))} />
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
          <div>
            <Label htmlFor="due">Due date</Label>
            <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="impact">Schedule impact (days)</Label>
            <Input id="impact" type="number" value={scheduleImpactDays} onChange={(e) => setScheduleImpactDays(Number(e.target.value))} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
