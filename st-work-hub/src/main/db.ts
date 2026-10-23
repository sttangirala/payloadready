// SQLite storage via sql.js (SQLite compiled to WebAssembly). The whole database lives in memory and
// is written to disk atomically (temp file + rename) after every committed transaction, so a crash
// can never leave a half-written database file.

import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database, SqlValue } from 'sql.js';

export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        owner TEXT NOT NULL DEFAULT '',
        category_id TEXT,
        project_id TEXT,
        due_date TEXT,
        next_action_date TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_next_action ON tasks(next_action_date);
      CREATE TABLE task_notes (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_notes_task ON task_notes(task_id);
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        position INTEGER NOT NULL,
        follow_up_days INTEGER
      );
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT NOT NULL DEFAULT '',
        is_demo INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        link TEXT NOT NULL DEFAULT '',
        text_hash TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_sources_hash ON sources(text_hash);
      CREATE TABLE activity (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_activity_task ON activity(task_id);
      CREATE INDEX idx_activity_time ON activity(created_at);
      CREATE TABLE intake_batches (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        engine TEXT NOT NULL,
        status TEXT NOT NULL,
        notice TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE proposals (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        kind TEXT NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        read_at TEXT,
        snoozed_until TEXT,
        dismissed INTEGER NOT NULL DEFAULT 0,
        desktop_shown_at TEXT
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export type Params = SqlValue[] | Record<string, SqlValue>;

export class Store {
  private constructor(
    private db: Database,
    readonly filePath: string | null,
  ) {}

  /** Open (or create) the database at filePath. Pass null for an in-memory database (tests). */
  static async open(filePath: string | null, wasmBinary?: Uint8Array): Promise<Store> {
    const SQL = await initSqlJs(wasmBinary ? { wasmBinary: wasmBinary as unknown as ArrayBuffer } : {});
    let db: Database;
    if (filePath && fs.existsSync(filePath)) {
      db = new SQL.Database(fs.readFileSync(filePath));
    } else {
      db = new SQL.Database();
    }
    const store = new Store(db, filePath);
    store.migrate();
    return store;
  }

  private migrate() {
    this.db.run('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
    const current = (this.get<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations')?.v ?? 0) as number;
    const pending = MIGRATIONS.filter((m) => m.version > current);
    if (!pending.length) return;
    this.transaction(() => {
      for (const m of pending) {
        this.db.exec(m.sql);
        this.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [m.version, m.name, new Date().toISOString()]);
      }
    });
  }

  schemaVersion(): number {
    return (this.get<{ v: number }>('SELECT MAX(version) AS v FROM schema_migrations')?.v ?? 0) as number;
  }

  run(sql: string, params: Params = []) {
    this.db.run(sql, params);
  }

  all<T = Record<string, SqlValue>>(sql: string, params: Params = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  get<T = Record<string, SqlValue>>(sql: string, params: Params = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }

  private depth = 0;
  /** Run fn atomically; persist to disk once the outermost transaction commits. */
  transaction<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.depth++;
    this.db.run('BEGIN');
    try {
      const out = fn();
      this.db.run('COMMIT');
      this.persist();
      return out;
    } catch (e) {
      try {
        this.db.run('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw e;
    } finally {
      this.depth--;
    }
  }

  persist() {
    if (!this.filePath) return;
    const data = this.db.export();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.filePath);
  }

  /** Raw bytes of the current database (for backups). */
  exportBytes(): Uint8Array {
    return this.db.export();
  }

  close() {
    this.persist();
    this.db.close();
  }
}
