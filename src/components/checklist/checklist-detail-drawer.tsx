"use client";

import { useState, useEffect } from "react";
import { Link2, AlertOctagon } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label, Textarea, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useStore, useMissionEvidence, useMissionIssues, useUserById } from "@/lib/store";
import { CHECKLIST_CATEGORIES, type ChecklistStatus, type Priority } from "@/lib/types";
import { CHECKLIST_STATUS_META, CHECKLIST_STATUS_OPTIONS, PRIORITY_META, EVIDENCE_STATUS_META } from "@/components/shared/status-meta";
import { formatDate, isOverdue } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export function ChecklistDetailDrawer({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const item = useStore((s) => s.checklistItems.find((i) => i.id === itemId));
  const users = useStore((s) => s.users);
  const updateChecklistItem = useStore((s) => s.updateChecklistItem);
  const setChecklistStatus = useStore((s) => s.setChecklistStatus);
  const evidence = useMissionEvidence();
  const issues = useMissionIssues();
  const owner = useUserById(item?.ownerId);
  const reviewer = useUserById(item?.reviewerId);
  const { push } = useToast();

  const [notes, setNotes] = useState(item?.notes ?? "");
  const [naReason, setNaReason] = useState("");
  const [naOpen, setNaOpen] = useState(false);

  useEffect(() => {
    setNotes(item?.notes ?? "");
  }, [item?.id, item?.notes]);

  if (!item) return null;

  const relatedIssue = issues.find((i) => i.id === item.relatedIssueId);
  const overdue = isOverdue(item.dueDate) && item.status !== "accepted" && item.status !== "not_applicable";

  return (
    <>
      <Drawer
        open={!!itemId}
        onClose={onClose}
        eyebrow={CHECKLIST_CATEGORIES.find((c) => c.key === item.category)?.label}
        title={item.title}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                updateChecklistItem(item.id, { notes });
                push({ kind: "success", title: "Changes saved" });
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CHECKLIST_STATUS_META[item.status].tone}>{CHECKLIST_STATUS_META[item.status].label}</Badge>
            <Badge tone={PRIORITY_META[item.priority].tone}>{PRIORITY_META[item.priority].label} priority</Badge>
            {overdue && (
              <Badge tone="red" dot>
                Overdue
              </Badge>
            )}
            <Badge tone={item.evidenceStatus === "accepted" ? "green" : item.evidenceStatus === "rejected" ? "red" : item.evidenceStatus === "pending" ? "amber" : "neutral"}>
              Evidence: {item.evidenceStatus}
            </Badge>
          </div>

          <p className="text-[13.5px] leading-relaxed text-navy-800">{item.description}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select
                value={item.status}
                onChange={(e) => setChecklistStatus(item.id, e.target.value as ChecklistStatus)}
                options={CHECKLIST_STATUS_OPTIONS.map((s) => ({ value: s, label: CHECKLIST_STATUS_META[s].label }))}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={item.priority}
                onChange={(e) => updateChecklistItem(item.id, { priority: e.target.value as Priority })}
                options={(["low", "medium", "high", "critical"] as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
              />
            </div>
            <div>
              <Label>Owner</Label>
              <Select
                value={item.ownerId}
                onChange={(e) => updateChecklistItem(item.id, { ownerId: e.target.value }, "reassigned")}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
              />
            </div>
            <div>
              <Label>Reviewer</Label>
              <Select
                value={item.reviewerId ?? ""}
                onChange={(e) => updateChecklistItem(item.id, { reviewerId: e.target.value || undefined })}
                placeholder="Unassigned"
                options={users.map((u) => ({ value: u.id, label: u.name }))}
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={item.dueDate} onChange={(e) => updateChecklistItem(item.id, { dueDate: e.target.value })} />
            </div>
            <div>
              <Label>Requirement source</Label>
              <Input value={item.requirementSource} onChange={(e) => updateChecklistItem(item.id, { requirementSource: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-md bg-surface-muted px-3 py-2 text-[12.5px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Avatar user={owner} size="sm" /> {owner?.name}
            </span>
            {reviewer && (
              <span className="flex items-center gap-1.5">
                → reviewed by <Avatar user={reviewer} size="sm" /> {reviewer.name}
              </span>
            )}
            <span className="ml-auto">Updated {formatDate(item.updatedAt, "MMM d")}</span>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context for reviewers or teammates…" />
          </div>

          {item.notApplicableReason && (
            <div className="rounded-md border border-border-strong bg-surface-muted p-3 text-[12.5px] text-slate-600">
              <span className="font-medium text-navy-900">Marked not applicable: </span>
              {item.notApplicableReason}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="mb-0">Linked evidence</Label>
            </div>
            {evidence.filter((e) => e.relatedChecklistItemIds.includes(item.id)).length === 0 ? (
              <p className="text-[12.5px] text-slate-400">No evidence linked yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {evidence
                  .filter((e) => e.relatedChecklistItemIds.includes(item.id))
                  .map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="flex items-center gap-2 text-[12.5px] text-navy-900">
                        <Link2 className="h-3.5 w-3.5 text-slate-400" />
                        {e.documentName} <span className="text-slate-400">Rev {e.revision}</span>
                      </span>
                      <Badge tone={EVIDENCE_STATUS_META[e.reviewStatus].tone}>{EVIDENCE_STATUS_META[e.reviewStatus].label}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {relatedIssue && (
            <div className="rounded-md border border-red-700/20 bg-red-100 p-3">
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-700">
                <AlertOctagon className="h-3.5 w-3.5" /> Related issue
              </div>
              <div className="mt-1 text-[13px] text-navy-900">{relatedIssue.title}</div>
            </div>
          )}

          {item.dependencies.length > 0 && (
            <div>
              <Label>Dependencies</Label>
              <p className="text-[12.5px] text-slate-500">{item.dependencies.join(", ")}</p>
            </div>
          )}

          {item.status !== "not_applicable" && (
            <button onClick={() => setNaOpen(true)} className="text-[12.5px] font-medium text-slate-500 hover:text-navy-800 hover:underline">
              Mark as not applicable…
            </button>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={naOpen}
        onClose={() => setNaOpen(false)}
        title="Mark item as not applicable"
        description="This excludes the item from the readiness score. Provide a reason for the record."
        confirmLabel="Mark not applicable"
        onConfirm={() => {
          if (item) updateChecklistItem(item.id, { status: "not_applicable", notApplicableReason: naReason || "No reason provided." }, "marked not applicable");
          setNaReason("");
        }}
      />
    </>
  );
}
