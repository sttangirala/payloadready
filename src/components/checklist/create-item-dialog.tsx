"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useStore, useActiveMission } from "@/lib/store";
import { CHECKLIST_CATEGORIES, type ChecklistCategoryKey, type Priority } from "@/lib/types";
import { PRIORITY_META } from "@/components/shared/status-meta";
import { useToast } from "@/components/ui/toast";
import { formatISO, addDays } from "date-fns";

export function CreateChecklistItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mission = useActiveMission();
  const users = useStore((s) => s.users);
  const addChecklistItem = useStore((s) => s.addChecklistItem);
  const { push } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ChecklistCategoryKey>("mission_payload_definition");
  const [requirementSource, setRequirementSource] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState(formatISO(addDays(new Date(), 14), { representation: "date" }));

  function reset() {
    setTitle("");
    setDescription("");
    setRequirementSource("");
    setPriority("medium");
  }

  function submit() {
    if (!mission || !title.trim()) return;
    addChecklistItem({
      missionId: mission.id,
      category,
      title: title.trim(),
      description,
      requirementSource: requirementSource || "Internal",
      ownerId,
      dueDate,
      priority,
      status: "not_started",
      evidenceStatus: "none",
      dependencies: [],
      notes: "",
    });
    push({ kind: "success", title: "Checklist item created", description: title });
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New checklist item"
      description="Add a requirement to the readiness checklist."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Create item
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Battery Thermal Runaway Test" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Category</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as ChecklistCategoryKey)}
              options={CHECKLIST_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
            />
          </div>
          <div>
            <Label htmlFor="source">Requirement source</Label>
            <Input id="source" value={requirementSource} onChange={(e) => setRequirementSource(e.target.value)} placeholder="e.g. LP-M-04 §3.2" />
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
          <div>
            <Label>Priority</Label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              options={(["low", "medium", "high", "critical"] as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
            />
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
