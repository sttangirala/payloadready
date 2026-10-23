// Outlook connector placeholder. NOT IMPLEMENTED: it reports itself as unavailable and refuses every
// operation. There is no simulated connection.
//
// Planned design (later phase):
//  - OAuth 2.0 authorization code flow with PKCE against Microsoft identity platform, using the
//    system browser and a loopback redirect; tokens stored with safeStorage like the API key.
//  - Least-privilege delegated scopes: Mail.Read (or Mail.ReadBasic + per-message fetch), offline_access.
//  - Import only messages the user selects (e.g. a category/flag or a dedicated "ST Work Hub" folder).
//  - Preserve `webLink` and `conversationId` so each task links back to the original thread.
//  - Every message goes through the normal intake review; nothing becomes a task automatically.

import type { ConnectorStatus, ImportedItem, IntakeConnector } from './types';

export class OutlookConnector implements IntakeConnector {
  status(): ConnectorStatus {
    return {
      id: 'outlook',
      name: 'Microsoft Outlook (Microsoft Graph)',
      state: 'unavailable',
      description: 'Not available yet. Paste emails into Capture for now. A future version will read only the emails you select, with read-only access.',
      plannedScopes: ['Mail.Read', 'offline_access'],
    };
  }

  async connect(): Promise<void> {
    throw new Error('The Outlook connector is not implemented yet.');
  }

  async disconnect(): Promise<void> {
    /* nothing to disconnect */
  }

  async listSelected(): Promise<ImportedItem[]> {
    throw new Error('The Outlook connector is not implemented yet.');
  }
}
