// Domain types shared by the main process, renderer, and tests.

export const STATUSES = ['inbox', 'ready', 'in_progress', 'waiting', 'scheduled', 'done', 'closed'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  inbox: 'Inbox',
  ready: 'Ready',
  in_progress: 'In Progress',
  waiting: 'Waiting on Someone',
  scheduled: 'Scheduled',
  done: 'Done',
  closed: 'Closed / No Action',
};

export const OPEN_STATUSES: Status[] = ['inbox', 'ready', 'in_progress', 'waiting', 'scheduled'];
export const isOpen = (s: Status) => s !== 'done' && s !== 'closed';

/** Importance: how much the outcome matters. Independent of time pressure. */
export const IMPORTANCES = ['critical', 'high', 'medium', 'low'] as const;
export type Importance = (typeof IMPORTANCES)[number];
export const IMPORTANCE_LABEL: Record<Importance, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Urgency: time pressure that is not captured by a real due date. */
export const URGENCIES = ['urgent', 'soon', 'none'] as const;
export type Urgency = (typeof URGENCIES)[number];
export const URGENCY_LABEL: Record<Urgency, string> = { urgent: 'Urgent', soon: 'Soon', none: 'Not time-sensitive' };

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskNote {
  id: string;
  body: string;
  createdAt: string; // ISO timestamp
}

/** Date-only fields use YYYY-MM-DD in the user's configured timezone. Timestamps are ISO UTC. */
export interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  company: string;
  contact: string;
  engagement: string;
  projectId: string | null;
  owner: string; // "Me" (or one of the user's aliases), a person's name, or "" when unknown
  coordinationStep: string; // the user's own step when someone else owns the task
  status: Status;
  importance: Importance;
  urgency: Urgency;
  dueDate: string | null; // only a real deadline
  nextActionDate: string | null; // when to revisit / defer-until
  effortMinutes: number | null;
  nextAction: string;
  blockers: string;
  dependsOn: string[];
  waitingOn: string;
  waitingSince: string | null;
  lastFollowUpDate: string | null;
  followUpIntervalDays: number | null;
  isOutreach: boolean;
  requiresCall: boolean;
  tags: string[];
  sourceId: string | null;
  sourceLink: string;
  manualRank: number | null;
  skippedOn: string | null;
  skipReason: string;
  remindersEnabled: boolean;
  /** Fields whose values came from AI/heuristic inference rather than an explicit statement. */
  inferredFields: string[];
  /** Open review flags, e.g. "Owner not stated in source". */
  reviewFlags: string[];
  checklist: ChecklistItem[];
  notes: TaskNote[];
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Fields that may be set when creating/patching a task. */
export type TaskPatch = Partial<
  Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'notes' | 'isDemo'>
>;

export const PATCHABLE_FIELDS = [
  'title', 'description', 'categoryId', 'company', 'contact', 'engagement', 'projectId', 'owner',
  'coordinationStep', 'status', 'importance', 'urgency', 'dueDate', 'nextActionDate', 'effortMinutes',
  'nextAction', 'blockers', 'dependsOn', 'waitingOn', 'waitingSince', 'lastFollowUpDate',
  'followUpIntervalDays', 'isOutreach', 'requiresCall', 'tags', 'sourceId', 'sourceLink', 'manualRank',
  'skippedOn', 'skipReason', 'remindersEnabled', 'inferredFields', 'reviewFlags', 'checklist',
] as const satisfies readonly (keyof TaskPatch)[];

export interface Category {
  id: string;
  name: string;
  color: string;
  position: number;
  followUpDays: number | null;
}

export type ContactStatus = 'active' | 'closed';
export interface Contact {
  id: string;
  name: string;
  company: string;
  status: ContactStatus;
  notes: string;
  isDemo: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
}

export type ProjectStatus = 'active' | 'on_hold' | 'done';
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  milestones: Milestone[];
  isDemo: boolean;
  createdAt: string;
}

export type SourceKind = 'quick' | 'email' | 'meeting' | 'list' | 'note' | 'assistant';
export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  rawText: string;
  link: string;
  textHash: string;
  isDemo: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  taskId: string | null;
  kind: string; // created | updated | status | note | followup_sent | skipped | deferred | ai_applied | ...
  summary: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface DuplicateMatch {
  taskId: string;
  title: string;
  score: number;
  reason: string;
}

export type FieldBasis = 'explicit' | 'inferred';
export interface FieldProvenance {
  basis: FieldBasis;
  evidence?: string; // quote from the source that supports the value
}

export type ProposalKind = 'create' | 'update' | 'draft';
export type ProposalStatus = 'pending' | 'applied' | 'rejected';
export type ProposalOrigin = 'intake' | 'assistant';

/** An AI or heuristic suggestion awaiting the user's confirmation. Never applied automatically. */
export interface Proposal {
  id: string;
  batchId: string | null;
  origin: ProposalOrigin;
  engine: 'ai' | 'local';
  kind: ProposalKind;
  taskId: string | null; // target for update/draft
  baseUpdatedAt: string | null; // target task's updatedAt when the proposal was made
  fields: TaskPatch;
  provenance: Record<string, FieldProvenance>;
  duplicates: DuplicateMatch[];
  flags: string[];
  rationale: string;
  draftText: string;
  status: ProposalStatus;
  createdAt: string;
}

export interface IntakeBatch {
  id: string;
  sourceId: string;
  engine: 'ai' | 'local';
  status: 'pending' | 'reviewed';
  notice: string;
  createdAt: string;
}

export type NotificationKind = 'followup_due' | 'next_action_due' | 'due_today' | 'overdue';
export interface AppNotification {
  id: string;
  taskId: string | null;
  kind: NotificationKind;
  fingerprint: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  snoozedUntil: string | null; // ISO timestamp
  dismissed: boolean;
}

export interface Settings {
  myName: string;
  myAliases: string[];
  timezone: string; // IANA zone, '' = system
  theme: 'system' | 'light' | 'dark';
  defaultFollowUpDays: number;
  followUpBusinessDays: boolean;
  reminderHour: number; // local hour (0-23) after which desktop reminders may fire
  desktopNotifications: boolean;
  inAppNotifications: boolean;
  quickCaptureEnabled: boolean;
  quickCaptureShortcut: string;
  aiEnabled: boolean;
  aiModel: string;
  todayLimit: number;
  demoSeeded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  myName: 'Me',
  myAliases: ['me', 'myself', 'i', 'st'],
  timezone: '',
  theme: 'system',
  defaultFollowUpDays: 3,
  followUpBusinessDays: true,
  reminderHour: 9,
  desktopNotifications: true,
  inAppNotifications: true,
  quickCaptureEnabled: true,
  quickCaptureShortcut: 'CommandOrControl+Shift+Space',
  aiEnabled: true,
  aiModel: 'claude-opus-5-5',
  todayLimit: 7,
  demoSeeded: false,
};

/** Everything the renderer needs to draw the app. Never contains secrets. */
export interface AppSnapshot {
  tasks: Task[];
  categories: Category[];
  contacts: Contact[];
  projects: Project[];
  sources: Source[];
  proposals: Proposal[];
  batches: IntakeBatch[];
  notifications: AppNotification[];
  settings: Settings;
  meta: AppMeta;
}

export interface AppMeta {
  today: string;
  timezone: string;
  dataDir: string;
  dbPath: string;
  backupDir: string;
  schemaVersion: number;
  aiKeyConfigured: boolean;
  secureStorageAvailable: boolean;
  appVersion: string;
}

export interface ExportBundle {
  app: 'st-work-hub';
  formatVersion: 1;
  schemaVersion: number;
  exportedAt: string;
  data: {
    tasks: Task[];
    categories: Category[];
    contacts: Contact[];
    projects: Project[];
    sources: Source[];
    activity: Activity[];
    settings: Settings;
  };
}

export interface AssistantAnswer {
  text: string;
  taskIds: string[];
  engine: 'ai' | 'local';
  proposalIds: string[];
  notice?: string;
}

export interface IntakeRequest {
  kind: SourceKind;
  text: string;
  title?: string;
  link?: string;
  useAi: boolean;
}

export interface IntakeResult {
  batch: IntakeBatch;
  proposals: Proposal[];
  sourceDuplicateOf: Source | null;
}
