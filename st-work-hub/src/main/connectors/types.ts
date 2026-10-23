// Connector interface for future intake sources (e.g. Outlook via Microsoft Graph).
//
// A connector only *reads* selected items and hands them to the same intake pipeline used for
// pasted text, so every imported item still goes through review before it becomes a task. Connectors
// never send mail or create calendar events.

import type { SourceKind } from '../../shared/types';

export type ConnectorState = 'unavailable' | 'disconnected' | 'connected' | 'error';

export interface ConnectorStatus {
  id: string;
  name: string;
  state: ConnectorState;
  description: string;
  /** Scopes the connector will request when implemented (least privilege). */
  plannedScopes: string[];
}

export interface ImportedItem {
  externalId: string;
  kind: SourceKind;
  title: string;
  text: string;
  /** Deep link back to the original (e.g. Outlook web link to the thread). */
  link: string;
  receivedAt: string;
}

export interface IntakeConnector {
  status(): ConnectorStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** List items the user explicitly selected (e.g. flagged or in a chosen folder). */
  listSelected(limit: number): Promise<ImportedItem[]>;
}
