"use client";

import { useState } from "react";
import { Plus, GitPullRequestArrow } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, SearchInput, FilterSelect } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Drawer } from "@/components/ui/drawer";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMissionDecisions, useStore, useActiveMission, useUserById } from "@/lib/store";
import type { Decision, DecisionStatus } from "@/lib/types";
import { DECISION_STATUS_META, DECISION_STATUS_OPTIONS } from "@/components/shared/status-meta";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function DecisionsPage() {
  const decisions = useMissionDecisions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = decisions.filter((d) => {
    if (search && !d.statement.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && d.status !== status) return false;
    return true;
  });

  const pendingThreatening = filtered.filter(
    (d) => (d.status === "pending_approval" || d.status === "analysis_required") && daysUntil(d.dueDate) <= 10
  );

  const open = decisions.find((d) => d.id === openId);

  return (
    <div>
      <PageHeader
        title="Decisions & approvals"
        description={`${decisions.filter((d) => d.status === "pending_approval" || d.status === "analysis_required" || d.status === "proposed").length} awaiting resolution`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New decision
          </Button>
        }
      />

      {pendingThreatening.length > 0 && (
        <div className="border-b border-amber-700/20 bg-amber-100 px-6 py-2.5 text-[13px] text-amber-700">
          {pendingThreatening.length} decision{pendingThreatening.length > 1 ? "s" : ""} due within 10 days and may threaten the schedule if unresolved.
        </div>
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search decisions…" />
        <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={DECISION_STATUS_OPTIONS.map((s) => ({ value: s, label: DECISION_STATUS_META[s].label }))} />
        <span className="ml-auto text-[12.5px] text-slate-500">{filtered.length} decisions</span>
      </FilterBar>

      <div className="p-6">
        {filtered.length === 0 ? (
          <EmptyState icon={GitPullRequestArrow} title="No decisions match your filters" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-[11.5px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Decision</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Approver</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <DecisionRow key={d.id} decision={d} onOpen={() => setOpenId(d.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && <DecisionDrawer decision={open} onClose={() => setOpenId(null)} />}
      <CreateDecisionDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function DecisionRow({ decision, onOpen }: { decision: Decision; onOpen: () => void }) {
  const owner = useUserById(decision.ownerId);
  const approver = useUserById(decision.approverId);
  const overdue = daysUntil(decision.dueDate) < 0 && decision.status !== "approved" && decision.status !== "rejected" && decision.status !== "deferred";
  return (
    <tr onClick={onOpen} className="cursor-pointer border-b border-border bg-surface last:border-0 hover:bg-surface-muted">
      <td className="px-3 py-2.5 font-medium text-navy-950">{decision.statement}</td>
      <td className="px-3 py-2.5 text-slate-600">{owner?.name}</td>
      <td className="px-3 py-2.5 text-slate-600">{approver?.name}</td>
      <td className={cn("px-3 py-2.5", overdue ? "font-medium text-red-700" : "text-slate-600")}>{formatDate(decision.dueDate)}</td>
      <td className="px-3 py-2.5">
        <Badge tone={DECISION_STATUS_META[decision.status].tone}>{DECISION_STATUS_META[decision.status].label}</Badge>
      </td>
    </tr>
  );
}

function DecisionDrawer({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  const updateDecision = useStore((s) => s.updateDecision);
  const users = useStore((s) => s.users);
  const { push } = useToast();
  const [finalDecision, setFinalDecision] = useState(decision.finalDecision ?? "");
  const [rationale, setRationale] = useState(decision.rationale ?? "");

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Decision"
      title={decision.statement}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              updateDecision(decision.id, { finalDecision, rationale });
              push({ kind: "success", title: "Decision updated" });
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Badge tone={DECISION_STATUS_META[decision.status].tone}>{DECISION_STATUS_META[decision.status].label}</Badge>

        <div>
          <div className="mb-1 text-[11.5px] uppercase tracking-wide text-slate-500">Context</div>
          <p className="text-[13px] leading-relaxed text-navy-800">{decision.context}</p>
        </div>

        {decision.optionsConsidered.length > 0 && (
          <div>
            <div className="mb-1 text-[11.5px] uppercase tracking-wide text-slate-500">Options considered</div>
            <ul className="list-disc space-y-1 pl-4">
              {decision.optionsConsidered.map((o, i) => (
                <li key={i} className="text-[13px] text-navy-800">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Owner</Label>
            <Select value={decision.ownerId} onChange={(e) => updateDecision(decision.id, { ownerId: e.target.value })} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
          <div>
            <Label>Approver</Label>
            <Select value={decision.approverId} onChange={(e) => updateDecision(decision.id, { approverId: e.target.value })} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={decision.dueDate} onChange={(e) => updateDecision(decision.id, { dueDate: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={decision.status}
              onChange={(e) => updateDecision(decision.id, { status: e.target.value as DecisionStatus })}
              options={DECISION_STATUS_OPTIONS.map((s) => ({ value: s, label: DECISION_STATUS_META[s].label }))}
            />
          </div>
        </div>

        <div>
          <Label>Final decision</Label>
          <Textarea rows={2} value={finalDecision} onChange={(e) => setFinalDecision(e.target.value)} placeholder="What was decided…" />
        </div>
        <div>
          <Label>Rationale</Label>
          <Textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why…" />
        </div>

        {decision.status !== "approved" && decision.status !== "rejected" && (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                updateDecision(decision.id, {
                  status: "approved",
                  finalDecision: finalDecision || "Approved as proposed.",
                  rationale,
                  dateDecided: new Date().toISOString().slice(0, 10),
                });
                push({ kind: "success", title: "Decision approved" });
                onClose();
              }}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                updateDecision(decision.id, {
                  status: "rejected",
                  finalDecision: finalDecision || "Rejected.",
                  rationale,
                  dateDecided: new Date().toISOString().slice(0, 10),
                });
                push({ kind: "info", title: "Decision rejected" });
                onClose();
              }}
            >
              Reject
            </Button>
          </div>
        )}

        {decision.dateDecided && <p className="text-[12px] text-slate-400">Decided {formatDate(decision.dateDecided)}</p>}
      </div>
    </Drawer>
  );
}

function CreateDecisionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mission = useActiveMission();
  const users = useStore((s) => s.users);
  const addDecision = useStore((s) => s.addDecision);
  const { push } = useToast();

  const [statement, setStatement] = useState("");
  const [context, setContext] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [approverId, setApproverId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  function submit() {
    if (!mission || !statement.trim()) return;
    addDecision({
      missionId: mission.id,
      statement: statement.trim(),
      context,
      optionsConsidered: [],
      ownerId,
      approverId,
      dueDate,
      status: "proposed",
      relatedRequirementIds: [],
      relatedIssueIds: [],
    });
    push({ kind: "success", title: "Decision proposed", description: statement });
    setStatement("");
    setContext("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New decision"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!statement.trim()}>
            Propose decision
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="statement">Decision statement</Label>
          <Textarea id="statement" rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="context">Context</Label>
          <Textarea id="context" rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Owner</Label>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
          <div>
            <Label>Approver</Label>
            <Select value={approverId} onChange={(e) => setApproverId(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
          <div>
            <Label htmlFor="due">Due date</Label>
            <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
