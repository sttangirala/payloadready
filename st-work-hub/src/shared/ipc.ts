// The complete, typed surface the renderer may call. The preload script exposes exactly these
// methods (each maps to one `st:<name>` IPC handler) and nothing else.

import type {
  Activity, AppSnapshot, AssistantAnswer, Category, Contact, IntakeRequest, IntakeResult, Project, Settings, Source,
  Task, TaskNote, TaskPatch,
} from './types';
import type { ConnectorStatus } from '../main/connectors/types';

export interface DailyReview {
  today: string;
  completed: string[];
  unfinished: string[];
  newlyBlocked: string[];
  tomorrow: { taskId: string; reasons: string[] }[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface Api {
  snapshot(): Promise<AppSnapshot>;
  createTask(patch: TaskPatch): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  addNote(taskId: string, body: string): Promise<TaskNote>;
  logFollowUpSent(taskId: string, note?: string): Promise<Task>;
  skipTask(taskId: string, reason: string): Promise<Task>;
  setManualOrder(orderedIds: string[]): Promise<void>;
  activity(taskId?: string): Promise<Activity[]>;
  getSource(id: string): Promise<Source | null>;

  saveCategory(c: Partial<Category> & { name: string }): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  saveContact(c: Partial<Contact> & { name: string }): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  saveProject(p: Partial<Project> & { name: string }): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  quickCapture(title: string, notes?: string): Promise<Task>;
  intake(req: IntakeRequest): Promise<IntakeResult>;
  applyProposal(id: string, overrides?: TaskPatch, opts?: { mergeIntoTaskId?: string; confirmCurrent?: boolean }): Promise<Task | null>;
  rejectProposal(id: string): Promise<void>;
  ask(question: string, history: ChatTurn[], useAi: boolean): Promise<AssistantAnswer>;
  dailyReview(): Promise<DailyReview>;

  snoozeNotification(id: string, minutes: number): Promise<void>;
  readNotification(id: string): Promise<void>;
  dismissNotification(id: string): Promise<void>;
  disableTaskReminders(taskId: string): Promise<void>;

  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  setApiKey(key: string): Promise<{ storedIn: 'keychain' | 'session' }>;
  clearApiKey(): Promise<void>;
  aiStatus(): Promise<{ available: boolean; reason: string }>;
  connectors(): Promise<ConnectorStatus[]>;

  exportJson(): Promise<{ path: string } | null>;
  exportCsv(): Promise<{ path: string } | null>;
  restoreJson(): Promise<{ tasks: number; backupPath: string } | null>;
  backupNow(): Promise<{ path: string }>;
  openDataFolder(): Promise<void>;
  loadDemo(): Promise<void>;
  removeDemo(): Promise<{ removed: number }>;
  openExternal(url: string): Promise<boolean>;
}

export const API_METHODS = [
  'snapshot', 'createTask', 'updateTask', 'deleteTask', 'addNote', 'logFollowUpSent', 'skipTask', 'setManualOrder',
  'activity', 'getSource', 'saveCategory', 'deleteCategory', 'saveContact', 'deleteContact', 'saveProject',
  'deleteProject', 'quickCapture', 'intake', 'applyProposal', 'rejectProposal', 'ask', 'dailyReview',
  'snoozeNotification', 'readNotification', 'dismissNotification', 'disableTaskReminders', 'updateSettings',
  'setApiKey', 'clearApiKey', 'aiStatus', 'connectors', 'exportJson', 'exportCsv', 'restoreJson', 'backupNow',
  'openDataFolder', 'loadDemo', 'removeDemo', 'openExternal',
] as const satisfies readonly (keyof Api)[];

export type ApiEvent = 'changed' | 'quick-capture' | 'open-task';

export interface Bridge {
  api: Api;
  on(event: ApiEvent, cb: (payload?: unknown) => void): () => void;
  platform: string;
}
