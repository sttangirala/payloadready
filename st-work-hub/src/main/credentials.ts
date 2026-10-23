// API key storage using Electron safeStorage, which on macOS encrypts with a key held in the user's
// Keychain. The encrypted blob lives in the app data folder with 0600 permissions. The plaintext key
// stays in the main process: it is never sent over IPC, written to logs, or stored in the renderer.

import fs from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';

export class CredentialStore {
  private sessionOnlyKey: string | null = null;
  private cached: string | null | undefined;

  constructor(private dir: string) {}

  private file() {
    return path.join(this.dir, 'anthropic-api-key.enc');
  }

  secureStorageAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  get(): string | null {
    if (this.sessionOnlyKey) return this.sessionOnlyKey;
    if (this.cached !== undefined) return this.cached;
    try {
      if (!fs.existsSync(this.file()) || !this.secureStorageAvailable()) return (this.cached = null);
      this.cached = safeStorage.decryptString(fs.readFileSync(this.file()));
    } catch {
      this.cached = null;
    }
    return this.cached;
  }

  /** Returns where the key was stored. */
  set(key: string): 'keychain' | 'session' {
    const k = key.trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k)) throw new Error('That does not look like an Anthropic API key (expected sk-ant-…).');
    if (this.secureStorageAvailable()) {
      fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(this.file(), safeStorage.encryptString(k), { mode: 0o600 });
      this.cached = k;
      this.sessionOnlyKey = null;
      return 'keychain';
    }
    // No OS-backed encryption (e.g. some Linux desktops): keep it in memory for this session only.
    this.sessionOnlyKey = k;
    return 'session';
  }

  clear() {
    this.sessionOnlyKey = null;
    this.cached = null;
    fs.rmSync(this.file(), { force: true });
  }
}
