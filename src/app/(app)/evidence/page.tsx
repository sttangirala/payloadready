"use client";

import { useState } from "react";
import { Plus, FolderCheck, Check, X as XIcon, RefreshCw } from "lucide-react";
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
import { useMissionEvidence, useMissionChecklist, useStore, useActiveMission, useUserById } from "@/lib/store";
import type { EvidenceRecord, EvidenceType } from "@/lib/types";
import { EVIDENCE_STATUS_META, EVIDENCE_STATUS_OPTIONS } from "@/components/shared/status-meta";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  test_report: "Test report",
  analysis: "Analysis",
  certificate: "Certificate",
  drawing: "Drawing",
  interface_document: "Interface document",
  safety_document: "Safety document",
  regulatory_filing: "Regulatory filing",
  approval: "Approval",
  shipping_record: "Shipping record",
  other: "Other",
};

export default function EvidencePage() {
  const evidence = useMissionEvidence();
  const checklist = useMissionChecklist();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = evidence.filter((e) => {
    if (search && !e.documentName.toLowerCase().includes(search.toLowerCase()) && !e.documentNumber.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && e.reviewStatus !== status) return false;
    if (type !== "all" && e.evidenceType !== type) return false;
    return true;
  });

  const open = evidence.find((e) => e.id === openId);

  return (
    <div>
      <PageHeader
        title="Evidence library"
        description={`${evidence.filter((e) => e.reviewStatus === "accepted").length} of ${evidence.length} records accepted`}
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add evidence
          </Button>
        }
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search evidence…" />
        <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={EVIDENCE_STATUS_OPTIONS.map((s) => ({ value: s, label: EVIDENCE_STATUS_META[s].label }))} />
        <FilterSelect value={type} onChange={setType} placeholder="All types" options={Object.entries(EVIDENCE_TYPE_LABELS).map(([v, label]) => ({ value: v, label }))} />
        <span className="ml-auto text-[12.5px] text-slate-500">{filtered.length} records</span>
      </FilterBar>

      <div className="p-6">
        {filtered.length === 0 ? (
          <EmptyState icon={FolderCheck} title="No evidence records match your filters" description="Add evidence or clear filters to see more." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-[11.5px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Document</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Rev</th>
                  <th className="px-3 py-2 font-medium">Linked items</th>
                  <th className="px-3 py-2 font-medium">Submitted</th>
                  <th className="px-3 py-2 font-medium">Reviewer</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <EvidenceRow key={e.id} record={e} checklistCount={e.relatedChecklistItemIds.length} onOpen={() => setOpenId(e.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && <EvidenceDetailDrawer record={open} onClose={() => setOpenId(null)} />}
      <UploadEvidenceDialog open={uploadOpen} onClose={() => setUploadOpen(false)} checklistItems={checklist} />
    </div>
  );
}

function EvidenceRow({ record, checklistCount, onOpen }: { record: EvidenceRecord; checklistCount: number; onOpen: () => void }) {
  const reviewer = useUserById(record.reviewerId);
  return (
    <tr onClick={onOpen} className="cursor-pointer border-b border-border bg-surface last:border-0 hover:bg-surface-muted">
      <td className="px-3 py-2.5">
        <div className="font-medium text-navy-950">{record.documentName}</div>
        <div className="text-[11.5px] text-slate-500">{record.documentNumber}</div>
      </td>
      <td className="px-3 py-2.5 text-slate-600">{EVIDENCE_TYPE_LABELS[record.evidenceType]}</td>
      <td className="px-3 py-2.5 text-slate-600">{record.revision}</td>
      <td className="px-3 py-2.5 text-slate-600">{checklistCount}</td>
      <td className="px-3 py-2.5 text-slate-600">{formatDate(record.submittedDate)}</td>
      <td className="px-3 py-2.5">
        <Avatar user={reviewer} size="sm" />
      </td>
      <td className="px-3 py-2.5">
        <Badge tone={EVIDENCE_STATUS_META[record.reviewStatus].tone}>{EVIDENCE_STATUS_META[record.reviewStatus].label}</Badge>
        {record.superseded && <span className="ml-1.5 text-[11px] text-slate-400">(superseded)</span>}
      </td>
    </tr>
  );
}

function EvidenceDetailDrawer({ record, onClose }: { record: EvidenceRecord; onClose: () => void }) {
  const reviewEvidence = useStore((s) => s.reviewEvidence);
  const supersedeEvidence = useStore((s) => s.supersedeEvidence);
  const checklist = useMissionChecklist();
  const uploadedBy = useUserById(record.uploadedById);
  const reviewer = useUserById(record.reviewerId);
  const { push } = useToast();
  const [comments, setComments] = useState(record.reviewComments ?? "");
  const [resubmitOpen, setResubmitOpen] = useState(false);

  const linkedItems = checklist.filter((i) => record.relatedChecklistItemIds.includes(i.id));

  return (
    <>
      <Drawer open onClose={onClose} eyebrow={EVIDENCE_TYPE_LABELS[record.evidenceType]} title={record.documentName}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={EVIDENCE_STATUS_META[record.reviewStatus].tone}>{EVIDENCE_STATUS_META[record.reviewStatus].label}</Badge>
            <Badge tone="neutral">Rev {record.revision}</Badge>
            {record.superseded && <Badge tone="neutral">Superseded</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="text-[11.5px] uppercase tracking-wide text-slate-500">Document number</div>
              <div className="text-navy-900">{record.documentNumber}</div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wide text-slate-500">Submitted</div>
              <div className="text-navy-900">{formatDate(record.submittedDate)}</div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wide text-slate-500">Uploaded by</div>
              <div className="flex items-center gap-1.5 text-navy-900">
                <Avatar user={uploadedBy} size="sm" /> {uploadedBy?.name}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wide text-slate-500">Reviewer</div>
              <div className="flex items-center gap-1.5 text-navy-900">{reviewer ? <><Avatar user={reviewer} size="sm" /> {reviewer.name}</> : "Unassigned"}</div>
            </div>
          </div>

          <div>
            <div className="text-[11.5px] uppercase tracking-wide text-slate-500">Source</div>
            <div className="mt-0.5 rounded-md bg-surface-muted px-2.5 py-1.5 font-mono text-[12px] text-navy-800">{record.sourceRef}</div>
          </div>

          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-slate-500">Version note</div>
            <p className="text-[13px] text-navy-800">{record.versionNote}</p>
          </div>

          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-slate-500">Related checklist requirements</div>
            {linkedItems.length === 0 ? (
              <p className="text-[12.5px] text-slate-400">Not linked to any checklist item.</p>
            ) : (
              <ul className="space-y-1">
                {linkedItems.map((i) => (
                  <li key={i.id} className="text-[13px] text-navy-900">
                    {i.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label>Review comments</Label>
            <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Add review notes…" />
          </div>

          {(record.reviewStatus === "submitted" || record.reviewStatus === "under_review") && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  reviewEvidence(record.id, "accepted", comments);
                  push({ kind: "success", title: "Evidence accepted" });
                  onClose();
                }}
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (!comments.trim()) {
                    push({ kind: "error", title: "Add a rejection comment before rejecting evidence." });
                    return;
                  }
                  reviewEvidence(record.id, "rejected", comments);
                  push({ kind: "error", title: "Evidence rejected" });
                  onClose();
                }}
              >
                <XIcon className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}

          {record.reviewStatus === "rejected" && !record.superseded && (
            <Button variant="outline" onClick={() => setResubmitOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Upload revised version
            </Button>
          )}
        </div>
      </Drawer>

      <ResubmitDialog
        open={resubmitOpen}
        onClose={() => setResubmitOpen(false)}
        record={record}
        onSubmit={(versionNote) => {
          supersedeEvidence(record.id, {
            missionId: record.missionId,
            documentName: record.documentName,
            documentNumber: record.documentNumber,
            revision: nextRevision(record.revision),
            evidenceType: record.evidenceType,
            relatedChecklistItemIds: record.relatedChecklistItemIds,
            uploadedById: record.uploadedById,
            submittedDate: new Date().toISOString().slice(0, 10),
            reviewerId: record.reviewerId,
            reviewStatus: "submitted",
            sourceRef: `/evidence/${record.documentNumber}-rev${nextRevision(record.revision)}.pdf`,
            versionNote,
          });
          push({ kind: "success", title: "Revised evidence submitted", description: "Resubmitted for review." });
          setResubmitOpen(false);
          onClose();
        }}
      />
    </>
  );
}

function nextRevision(rev: string) {
  const code = rev.charCodeAt(0);
  return String.fromCharCode(code + 1);
}

function ResubmitDialog({
  open,
  onClose,
  record,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  record: EvidenceRecord;
  onSubmit: (versionNote: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Upload revised version — ${record.documentName}`}
      description={`This will supersede Revision ${record.revision} and resubmit for review as Revision ${nextRevision(record.revision)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(note || "Revised submission addressing reviewer comments.")}>Resubmit for review</Button>
        </>
      }
    >
      <Label htmlFor="note">What changed</Label>
      <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Added cell lot acceptance test data and vendor traceability records." />
      <p className="mt-2 text-[12px] text-slate-500">This simulates a file upload — no external storage is required for the demo.</p>
    </Dialog>
  );
}

function UploadEvidenceDialog({
  open,
  onClose,
  checklistItems,
}: {
  open: boolean;
  onClose: () => void;
  checklistItems: ReturnType<typeof useMissionChecklist>;
}) {
  const mission = useActiveMission();
  const users = useStore((s) => s.users);
  const addEvidence = useStore((s) => s.addEvidence);
  const { push } = useToast();

  const [documentName, setDocumentName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("test_report");
  const [relatedItemId, setRelatedItemId] = useState("");
  const [uploadedById, setUploadedById] = useState(users[0]?.id ?? "");

  function submit() {
    if (!mission || !documentName.trim()) return;
    addEvidence({
      missionId: mission.id,
      documentName: documentName.trim(),
      documentNumber: documentNumber || `MER-${Math.floor(Math.random() * 900 + 100)}`,
      revision: "A",
      evidenceType,
      relatedChecklistItemIds: relatedItemId ? [relatedItemId] : [],
      uploadedById,
      submittedDate: new Date().toISOString().slice(0, 10),
      reviewStatus: "submitted",
      sourceRef: `/evidence/${documentName.trim().toLowerCase().replace(/\s+/g, "-")}-revA.pdf`,
      versionNote: "Initial submission.",
      superseded: false,
    });
    push({ kind: "success", title: "Evidence submitted", description: documentName });
    setDocumentName("");
    setDocumentNumber("");
    setRelatedItemId("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add evidence"
      description="Simulated upload — attaches file metadata to the mission record."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!documentName.trim()}>
            Submit for review
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="docName">Document name</Label>
          <Input id="docName" value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="e.g. EMI/EMC Self-Compatibility Test Report" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="docNumber">Document number</Label>
            <Input id="docNumber" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="MER-XXX" />
          </div>
          <div>
            <Label>Evidence type</Label>
            <Select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
              options={Object.entries(EVIDENCE_TYPE_LABELS).map(([v, label]) => ({ value: v, label }))}
            />
          </div>
          <div>
            <Label>Related checklist item</Label>
            <Select
              value={relatedItemId}
              onChange={(e) => setRelatedItemId(e.target.value)}
              placeholder="None"
              options={checklistItems.map((i) => ({ value: i.id, label: i.title }))}
            />
          </div>
          <div>
            <Label>Uploaded by</Label>
            <Select value={uploadedById} onChange={(e) => setUploadedById(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
