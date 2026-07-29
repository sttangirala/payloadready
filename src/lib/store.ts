"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "./nanoid";
import {
  DEMO_ACTIVITY,
  DEMO_CHECKLIST_ITEMS,
  DEMO_DECISIONS,
  DEMO_EVIDENCE,
  DEMO_ISSUES,
  DEMO_MILESTONES,
  DEMO_MISSION,
  DEMO_NOTIFICATIONS,
  DEMO_ORG,
  DEMO_READINESS_REVIEWS,
  DEMO_USERS,
  CURRENT_USER_ID,
} from "./seed";
import { CHECKLIST_CATEGORIES } from "./types";
import type {
  ActivityEvent,
  ChecklistItem,
  ChecklistStatus,
  Decision,
  DecisionStatus,
  EvidenceRecord,
  EvidenceReviewStatus,
  Issue,
  IssueState,
  Mission,
  Milestone,
  Notification,
  Organization,
  ReadinessReviewRecord,
  User,
} from "./types";

interface DataState {
  // "session"
  currentUserId: string;
  demoActivated: boolean;
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;

  // entities
  users: User[];
  organizations: Organization[];
  missions: Mission[];
  milestones: Milestone[];
  checklistItems: ChecklistItem[];
  evidence: EvidenceRecord[];
  issues: Issue[];
  decisions: Decision[];
  readinessReviews: ReadinessReviewRecord[];
  activity: ActivityEvent[];
  notifications: Notification[];

  activeMissionId: string;

  // actions
  activateDemo: () => void;
  setCurrentUser: (userId: string) => void;
  setActiveMission: (missionId: string) => void;

  logActivity: (entry: Omit<ActivityEvent, "id" | "timestamp" | "actorId"> & { actorId?: string }) => void;

  updateChecklistItem: (id: string, patch: Partial<ChecklistItem>, activityNote?: string) => void;
  addChecklistItem: (item: Omit<ChecklistItem, "id" | "createdAt" | "updatedAt">) => string;
  setChecklistStatus: (id: string, status: ChecklistStatus) => void;

  addEvidence: (record: Omit<EvidenceRecord, "id" | "createdAt" | "updatedAt">) => string;
  reviewEvidence: (id: string, status: EvidenceReviewStatus, comments?: string) => void;
  supersedeEvidence: (id: string, newRecord: Omit<EvidenceRecord, "id" | "createdAt" | "updatedAt" | "supersedesId" | "superseded">) => string;

  addIssue: (issue: Omit<Issue, "id" | "createdAt" | "updatedAt">) => string;
  updateIssue: (id: string, patch: Partial<Issue>) => void;

  addDecision: (decision: Omit<Decision, "id" | "createdAt">) => string;
  updateDecision: (id: string, patch: Partial<Decision>) => void;

  recordReadinessReview: (review: Omit<ReadinessReviewRecord, "id" | "recordedAt">) => void;

  updateMission: (id: string, patch: Partial<Mission>) => void;

  createOrgAndMission: (input: {
    orgName: string;
    missionName: string;
    payloadName: string;
    missionType: string;
    formFactor?: string;
    launchProvider: string;
    integrator: string;
    targetLaunchDate: string;
    payloadDeliveryDate: string;
    integrationDate: string;
    phase: string;
    templateKey: "cubesat_standard" | "hosted_payload" | "blank";
  }) => string;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  resetDemo: () => void;
}

const initialEntities = {
  users: DEMO_USERS,
  organizations: [DEMO_ORG],
  missions: [DEMO_MISSION],
  milestones: DEMO_MILESTONES,
  checklistItems: DEMO_CHECKLIST_ITEMS,
  evidence: DEMO_EVIDENCE,
  issues: DEMO_ISSUES,
  decisions: DEMO_DECISIONS,
  readinessReviews: DEMO_READINESS_REVIEWS,
  activity: DEMO_ACTIVITY,
  notifications: DEMO_NOTIFICATIONS,
};

export const useStore = create<DataState>()(
  persist(
    (set, get) => ({
      currentUserId: CURRENT_USER_ID,
      demoActivated: true,
      signedIn: false,
      activeMissionId: DEMO_MISSION.id,
      ...initialEntities,

      signIn: () => set({ signedIn: true }),
      signOut: () => set({ signedIn: false }),

      activateDemo: () => set({ demoActivated: true, signedIn: true, ...initialEntities, activeMissionId: DEMO_MISSION.id }),

      setCurrentUser: (userId) => set({ currentUserId: userId }),
      setActiveMission: (missionId) => set({ activeMissionId: missionId }),

      logActivity: (entry) =>
        set((s) => ({
          activity: [
            {
              id: `act-${nanoid()}`,
              timestamp: new Date().toISOString(),
              actorId: entry.actorId ?? s.currentUserId,
              missionId: entry.missionId,
              action: entry.action,
              entityType: entry.entityType,
              entityId: entry.entityId,
              entityLabel: entry.entityLabel,
            },
            ...s.activity,
          ],
        })),

      updateChecklistItem: (id, patch, activityNote) => {
        const s = get();
        const item = s.checklistItems.find((i) => i.id === id);
        if (!item) return;
        set({
          checklistItems: s.checklistItems.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i
          ),
        });
        get().logActivity({
          missionId: item.missionId,
          action: activityNote ?? "updated",
          entityType: "checklist_item",
          entityId: id,
          entityLabel: patch.title ?? item.title,
        });
      },

      addChecklistItem: (item) => {
        const id = `chk-${nanoid()}`;
        const now = new Date().toISOString();
        set((s) => ({
          checklistItems: [...s.checklistItems, { ...item, id, createdAt: now, updatedAt: now }],
        }));
        get().logActivity({
          missionId: item.missionId,
          action: "created checklist item",
          entityType: "checklist_item",
          entityId: id,
          entityLabel: item.title,
        });
        return id;
      },

      setChecklistStatus: (id, status) => {
        get().updateChecklistItem(id, { status }, `changed status to "${status.replace(/_/g, " ")}" on`);
      },

      addEvidence: (record) => {
        const id = `ev-${nanoid()}`;
        const now = new Date().toISOString();
        set((s) => ({ evidence: [...s.evidence, { ...record, id, createdAt: now, updatedAt: now }] }));
        get().logActivity({
          missionId: record.missionId,
          action: "submitted evidence",
          entityType: "evidence",
          entityId: id,
          entityLabel: record.documentName,
        });
        // reflect on linked checklist items
        const s = get();
        for (const chkId of record.relatedChecklistItemIds) {
          const item = s.checklistItems.find((i) => i.id === chkId);
          if (item) {
            get().updateChecklistItem(
              chkId,
              { evidenceStatus: record.reviewStatus === "accepted" ? "accepted" : "pending" },
              "linked new evidence to"
            );
          }
        }
        return id;
      },

      reviewEvidence: (id, status, comments) => {
        const s = get();
        const record = s.evidence.find((e) => e.id === id);
        if (!record) return;
        set({
          evidence: s.evidence.map((e) =>
            e.id === id ? { ...e, reviewStatus: status, reviewComments: comments, updatedAt: new Date().toISOString() } : e
          ),
        });
        get().logActivity({
          missionId: record.missionId,
          action: status === "accepted" ? "accepted evidence for" : status === "rejected" ? "rejected evidence for" : "updated evidence review for",
          entityType: "evidence",
          entityId: id,
          entityLabel: record.documentName,
        });
        for (const chkId of record.relatedChecklistItemIds) {
          const item = get().checklistItems.find((i) => i.id === chkId);
          if (!item) continue;
          if (status === "accepted") {
            get().updateChecklistItem(chkId, { evidenceStatus: "accepted", status: "accepted" }, "accepted evidence and closed");
          } else if (status === "rejected") {
            get().updateChecklistItem(chkId, { evidenceStatus: "rejected" }, "recorded rejected evidence on");
          }
        }
      },

      supersedeEvidence: (oldId, newRecord) => {
        const id = `ev-${nanoid()}`;
        const now = new Date().toISOString();
        set((s) => ({
          evidence: [
            ...s.evidence.map((e) => (e.id === oldId ? { ...e, superseded: true, updatedAt: now } : e)),
            { ...newRecord, id, supersedesId: oldId, superseded: false, createdAt: now, updatedAt: now },
          ],
        }));
        get().logActivity({
          missionId: newRecord.missionId,
          action: "submitted revised evidence for",
          entityType: "evidence",
          entityId: id,
          entityLabel: newRecord.documentName,
        });
        for (const chkId of newRecord.relatedChecklistItemIds) {
          get().updateChecklistItem(chkId, { evidenceStatus: "pending", status: "under_review" }, "resubmitted evidence for");
        }
        return id;
      },

      addIssue: (issue) => {
        const id = `iss-${nanoid()}`;
        const now = new Date().toISOString();
        set((s) => ({ issues: [...s.issues, { ...issue, id, createdAt: now, updatedAt: now }] }));
        get().logActivity({ missionId: issue.missionId, action: "opened issue", entityType: "issue", entityId: id, entityLabel: issue.title });
        return id;
      },

      updateIssue: (id, patch) => {
        const s = get();
        const issue = s.issues.find((i) => i.id === id);
        if (!issue) return;
        set({
          issues: s.issues.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i)),
        });
        const stateChanged = patch.state && patch.state !== issue.state;
        get().logActivity({
          missionId: issue.missionId,
          action: stateChanged ? `moved issue to "${(patch.state as IssueState).replace(/_/g, " ")}"` : "updated issue",
          entityType: "issue",
          entityId: id,
          entityLabel: issue.title,
        });
      },

      addDecision: (decision) => {
        const id = `dec-${nanoid()}`;
        const now = new Date().toISOString();
        set((s) => ({ decisions: [...s.decisions, { ...decision, id, createdAt: now }] }));
        get().logActivity({ missionId: decision.missionId, action: "proposed decision", entityType: "decision", entityId: id, entityLabel: decision.statement });
        return id;
      },

      updateDecision: (id, patch) => {
        const s = get();
        const decision = s.decisions.find((dec) => dec.id === id);
        if (!decision) return;
        set({ decisions: s.decisions.map((dec) => (dec.id === id ? { ...dec, ...patch } : dec)) });
        const statusChanged = patch.status && patch.status !== decision.status;
        get().logActivity({
          missionId: decision.missionId,
          action: statusChanged ? `recorded decision status "${(patch.status as DecisionStatus).replace(/_/g, " ")}" for` : "updated decision",
          entityType: "decision",
          entityId: id,
          entityLabel: decision.statement,
        });
      },

      recordReadinessReview: (review) => {
        const id = `rr-${nanoid()}`;
        set((s) => ({
          readinessReviews: [{ ...review, id, recordedAt: new Date().toISOString() }, ...s.readinessReviews],
        }));
        get().logActivity({
          missionId: review.missionId,
          action: "recorded readiness decision",
          entityType: "readiness_review",
          entityId: id,
          entityLabel: review.decision.replace(/_/g, " "),
        });
      },

      updateMission: (id, patch) => {
        set((s) => ({ missions: s.missions.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
      },

      createOrgAndMission: (input) => {
        const s = get();
        const orgId = `org-${nanoid()}`;
        const missionId = `mission-${nanoid()}`;
        const now = new Date().toISOString();
        const org: Organization = { id: orgId, name: input.orgName, createdAt: now };
        const mission: Mission = {
          id: missionId,
          organizationId: orgId,
          name: input.missionName,
          payloadName: input.payloadName,
          missionType: input.missionType,
          formFactor: input.formFactor,
          launchProvider: input.launchProvider,
          integrator: input.integrator,
          targetLaunchDate: input.targetLaunchDate,
          payloadDeliveryDate: input.payloadDeliveryDate,
          integrationDate: input.integrationDate,
          phase: input.phase,
          missionLeadId: s.currentUserId,
          createdAt: now,
        };

        const milestoneDefs: { key: Milestone["key"]; label: string; date: string }[] = [
          { key: "design_freeze", label: "Design Freeze", date: input.integrationDate },
          { key: "environmental_testing", label: "Environmental Testing", date: input.payloadDeliveryDate },
          { key: "documentation_submission", label: "Documentation Submission", date: input.payloadDeliveryDate },
          { key: "payload_delivery", label: "Payload Delivery", date: input.payloadDeliveryDate },
          { key: "integration", label: "Integration", date: input.integrationDate },
          { key: "launch", label: "Launch", date: input.targetLaunchDate },
        ];
        const milestones: Milestone[] = milestoneDefs.map((m) => ({
          id: `m-${nanoid()}`,
          missionId,
          key: m.key,
          label: m.label,
          date: m.date,
          status: "on_track",
        }));

        let templateItems: ChecklistItem[] = [];
        if (input.templateKey !== "blank") {
          templateItems = CHECKLIST_CATEGORIES.flatMap(({ key, label }) => [
            {
              id: `chk-${nanoid()}`,
              missionId,
              category: key,
              title: `Define ${label} requirements`,
              description: `Baseline requirement set for ${label.toLowerCase()} — populated from the ${
                input.templateKey === "hosted_payload" ? "hosted-payload" : "standard CubeSat"
              } template.`,
              requirementSource: "Mission Template",
              ownerId: s.currentUserId,
              dueDate: input.integrationDate,
              priority: "medium" as const,
              status: "not_started" as const,
              evidenceStatus: "none" as const,
              dependencies: [],
              notes: "",
              updatedAt: now,
              createdAt: now,
            },
          ]);
        }

        set((cur) => ({
          organizations: [...cur.organizations, org],
          missions: [...cur.missions, mission],
          milestones: [...cur.milestones, ...milestones],
          checklistItems: [...cur.checklistItems, ...templateItems],
          activeMissionId: missionId,
          signedIn: true,
        }));

        get().logActivity({
          missionId,
          action: "created mission",
          entityType: "mission",
          entityId: missionId,
          entityLabel: mission.name,
        });

        return missionId;
      },

      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      resetDemo: () => set({ ...initialEntities, activeMissionId: DEMO_MISSION.id, currentUserId: CURRENT_USER_ID }),
    }),
    {
      name: "payloadready-demo-storage",
      version: 4,
    }
  )
);

export function useActiveMission(): Mission | undefined {
  return useStore((s) => s.missions.find((m) => m.id === s.activeMissionId));
}

export function useMissionChecklist(): ChecklistItem[] {
  return useStore((s) => s.checklistItems.filter((i) => i.missionId === s.activeMissionId));
}

export function useMissionEvidence(): EvidenceRecord[] {
  return useStore((s) => s.evidence.filter((e) => e.missionId === s.activeMissionId));
}

export function useMissionIssues(): Issue[] {
  return useStore((s) => s.issues.filter((i) => i.missionId === s.activeMissionId));
}

export function useMissionDecisions(): Decision[] {
  return useStore((s) => s.decisions.filter((dec) => dec.missionId === s.activeMissionId));
}

export function useMissionMilestones(): Milestone[] {
  return useStore((s) => s.milestones.filter((m) => m.missionId === s.activeMissionId));
}

export function useMissionActivity(): ActivityEvent[] {
  return useStore((s) => s.activity.filter((a) => a.missionId === s.activeMissionId));
}

export function useMissionReadinessReviews(): ReadinessReviewRecord[] {
  return useStore((s) => s.readinessReviews.filter((r) => r.missionId === s.activeMissionId));
}

export function useUserById(id?: string): User | undefined {
  return useStore((s) => s.users.find((u) => u.id === id));
}
