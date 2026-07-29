"use client";

import { useMemo, useState } from "react";
import { Plus, LayoutGrid, Rows3, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, SearchInput, FilterSelect } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useMissionChecklist, useStore } from "@/lib/store";
import { CHECKLIST_CATEGORIES, type ChecklistItem } from "@/lib/types";
import { CHECKLIST_STATUS_META, CHECKLIST_STATUS_OPTIONS, PRIORITY_META } from "@/components/shared/status-meta";
import { calculateReadiness } from "@/lib/readiness";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import { ChecklistDetailDrawer } from "@/components/checklist/checklist-detail-drawer";
import { CreateChecklistItemDialog } from "@/components/checklist/create-item-dialog";

type ViewMode = "table" | "grouped";

export default function ChecklistPage() {
  const items = useMissionChecklist();
  const users = useStore((s) => s.users);
  const [view, setView] = useState<ViewMode>("grouped");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const readiness = useMemo(() => calculateReadiness(items), [items]);

  const filtered = items.filter((i) => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.requirementSource.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "all" && i.category !== category) return false;
    if (owner !== "all" && i.ownerId !== owner) return false;
    if (status !== "all" && i.status !== status) return false;
    if (priority !== "all" && i.priority !== priority) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aFlag = a.status === "blocked" || isOverdue(a.dueDate);
    const bFlag = b.status === "blocked" || isOverdue(b.dueDate);
    if (aFlag !== bFlag) return aFlag ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div>
      <PageHeader
        title="Readiness checklist"
        description={`${readiness.byStatus.accepted ?? 0} of ${readiness.countable} requirements accepted`}
        actions={
          <>
            <div className="flex items-center rounded-md border border-border-strong p-0.5">
              <button
                onClick={() => setView("grouped")}
                className={cn("flex items-center gap-1 rounded px-2 py-1 text-[12px] font-medium", view === "grouped" ? "bg-navy-900 text-white" : "text-slate-500")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grouped
              </button>
              <button
                onClick={() => setView("table")}
                className={cn("flex items-center gap-1 rounded px-2 py-1 text-[12px] font-medium", view === "table" ? "bg-navy-900 text-white" : "text-slate-500")}
              >
                <Rows3 className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New item
            </Button>
          </>
        }
      />

      <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-surface px-6 py-3">
        {readiness.byCategory.map((c) => (
          <button
            key={c.category}
            onClick={() => setCategory(category === c.category ? "all" : c.category)}
            className={cn(
              "flex min-w-[130px] flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition-colors",
              category === c.category ? "border-navy-800 bg-blue-100/50" : "border-border hover:bg-surface-muted"
            )}
          >
            <span className="truncate text-[11px] font-medium text-navy-900">{c.label}</span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={cn("h-full rounded-full", c.score >= 80 ? "bg-green-600" : c.score >= 50 ? "bg-amber-600" : "bg-red-600")}
                style={{ width: `${c.score}%` }}
              />
            </div>
            <span className="text-[10.5px] text-slate-500">
              {c.accepted}/{c.total} · {c.blocked > 0 ? `${c.blocked} blocked` : `${c.score}%`}
            </span>
          </button>
        ))}
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search checklist items…" />
        <FilterSelect value={category} onChange={setCategory} placeholder="All categories" options={CHECKLIST_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
        <FilterSelect value={owner} onChange={setOwner} placeholder="All owners" options={users.map((u) => ({ value: u.id, label: u.name }))} />
        <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={CHECKLIST_STATUS_OPTIONS.map((s) => ({ value: s, label: CHECKLIST_STATUS_META[s].label }))} />
        <FilterSelect value={priority} onChange={setPriority} placeholder="All priorities" options={(["critical", "high", "medium", "low"] as const).map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
        {(category !== "all" || owner !== "all" || status !== "all" || priority !== "all" || search) && (
          <button
            onClick={() => {
              setSearch("");
              setCategory("all");
              setOwner("all");
              setStatus("all");
              setPriority("all");
            }}
            className="text-[12.5px] font-medium text-navy-800 hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-[12.5px] text-slate-500">{sorted.length} items</span>
      </FilterBar>

      <div className="p-6">
        {sorted.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No checklist items match your filters" description="Try clearing filters or search terms." />
        ) : view === "table" ? (
          <ChecklistTable items={sorted} onOpen={setOpenItemId} users={users} />
        ) : (
          <div className="space-y-6">
            {CHECKLIST_CATEGORIES.filter((c) => sorted.some((i) => i.category === c.key)).map((c) => (
              <div key={c.key}>
                <h3 className="mb-2 text-[13px] font-semibold text-navy-950">{c.label}</h3>
                <ChecklistTable items={sorted.filter((i) => i.category === c.key)} onOpen={setOpenItemId} users={users} compact />
              </div>
            ))}
          </div>
        )}
      </div>

      <ChecklistDetailDrawer itemId={openItemId} onClose={() => setOpenItemId(null)} />
      <CreateChecklistItemDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ChecklistTable({
  items,
  onOpen,
  users,
  compact,
}: {
  items: ChecklistItem[];
  onOpen: (id: string) => void;
  users: { id: string; name: string; initials: string; avatarColor: string }[];
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-[11.5px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-medium">Title</th>
            {!compact && <th className="px-3 py-2 font-medium">Category</th>}
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Evidence</th>
            <th className="px-3 py-2 font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const owner = users.find((u) => u.id === item.ownerId);
            const overdue = isOverdue(item.dueDate) && item.status !== "accepted" && item.status !== "not_applicable";
            return (
              <tr
                key={item.id}
                onClick={() => onOpen(item.id)}
                className="cursor-pointer border-b border-border bg-surface last:border-0 hover:bg-surface-muted"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 font-medium text-navy-950">
                    {item.status === "blocked" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />}
                    {item.title}
                  </div>
                  <div className="text-[11.5px] text-slate-500">{item.requirementSource}</div>
                </td>
                {!compact && <td className="px-3 py-2.5 text-slate-600">{CHECKLIST_CATEGORIES.find((c) => c.key === item.category)?.label}</td>}
                <td className="px-3 py-2.5">
                  <Avatar user={owner} size="sm" />
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={PRIORITY_META[item.priority].tone}>{PRIORITY_META[item.priority].label}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={CHECKLIST_STATUS_META[item.status].tone}>{CHECKLIST_STATUS_META[item.status].label}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={item.evidenceStatus === "accepted" ? "green" : item.evidenceStatus === "rejected" ? "red" : item.evidenceStatus === "pending" ? "amber" : "neutral"}>
                    {item.evidenceStatus}
                  </Badge>
                </td>
                <td className={cn("px-3 py-2.5", overdue ? "font-medium text-red-700" : "text-slate-600")}>{formatDate(item.dueDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
