// Server-side persistence for the Test-Management store (suites/cases/plans/…).
//
// Until now the whole TM state lived in one browser localStorage blob
// (`testpilot.tm`) — per-browser and fragile (it silently reset to seed once and
// dropped ~2000 imported cases). This module makes the state a SHARED, DURABLE,
// server-owned SQLite DB so every browser sees the same data and a bad write can
// never silently wipe it.
//
// Model (confirmed): "state + versioned backups" — we persist the whole state
// blob as a single row and SNAPSHOT the previous row into `tm_state_backup` before
// every overwrite (kept to the last 50). Plus a `tm_seq` table for server-atomic
// human-key counters (TC-/TP-/…) so concurrent users don't collide.
//
// Engine: Node's built-in `node:sqlite` (DatabaseSync) — synchronous (a perfect
// fit for the Vite dev middleware, which already calls sync persistence helpers)
// and requires no native module install. It needs Node's `--experimental-sqlite`
// flag, wired in via the `dev` script's NODE_OPTIONS. The DB lives in the durable
// home dir (like server/deviceReports.ts) so it's outside the repo and Vite's file
// watcher — no git noise, no reload-on-write.

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

// node:sqlite is experimental (Node 22.5+, needs --experimental-sqlite, wired via the
// `dev` script's NODE_OPTIONS). Require it LAZILY (only when the DB is first opened),
// so that if the flag is ever missing it can't crash Vite's config load / the whole
// dev server — only /api/tm calls would error, and the client falls back to its
// localStorage cache.
const nodeRequire = createRequire(join(process.cwd(), "vite.config.ts"));

const DIR = join(homedir(), "QA-Automations");
const DB_PATH = join(DIR, "testpilot-tm.db");
const MAX_BACKUPS = 50;

const now = () => new Date().toISOString();

type DB = {
  exec(sql: string): void;
  prepare(sql: string): { run(...a: unknown[]): unknown; get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[] };
};

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const { DatabaseSync } = nodeRequire("node:sqlite") as { DatabaseSync: new (path: string) => DB };
  const d = new DatabaseSync(DB_PATH) as unknown as DB;
  d.exec("PRAGMA journal_mode = WAL"); // concurrent reads while a write is in flight
  d.exec(`
    CREATE TABLE IF NOT EXISTS tm_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL,
      cases INTEGER NOT NULL DEFAULT 0,
      suites INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tm_state_backup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      json TEXT NOT NULL,
      cases INTEGER NOT NULL DEFAULT 0,
      suites INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      saved_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tm_seq (
      kind TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
  `);
  _db = d;
  return d;
}

// node:sqlite has no transaction() helper (unlike better-sqlite3) — wrap manually.
function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    try {
      d.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

// Count cases/suites out of a state blob for cheap listings + drop-guard logging.
function counts(json: string): { cases: number; suites: number } {
  try {
    const p = JSON.parse(json) as { cases?: unknown[]; suites?: unknown[] };
    return { cases: Array.isArray(p.cases) ? p.cases.length : 0, suites: Array.isArray(p.suites) ? p.suites.length : 0 };
  } catch {
    return { cases: 0, suites: 0 };
  }
}

export function hasState(): boolean {
  return !!db().prepare("SELECT 1 FROM tm_state WHERE id = 1").get();
}

export function loadState(): string | null {
  const row = db().prepare("SELECT json FROM tm_state WHERE id = 1").get() as { json: string } | undefined;
  return row?.json ?? null;
}

export function currentCounts(): { cases: number; suites: number } {
  const row = db().prepare("SELECT cases, suites FROM tm_state WHERE id = 1").get() as
    | { cases: number; suites: number }
    | undefined;
  return row ?? { cases: 0, suites: 0 };
}

// Persist the whole state. ALWAYS snapshots the prior row into tm_state_backup
// first, so any write — even an accidental empty one — is recoverable. Returns
// the new counts + a `warning` when a write drops >90% of cases (surfaced to the
// client so a suspicious wipe is visible, not silent).
export function saveState(json: string, reason = "save"): {
  ok: true;
  savedAt: string;
  cases: number;
  suites: number;
  backedUp: boolean;
  warning?: string;
} {
  const d = db();
  const at = now();
  const next = counts(json);
  const prev = d.prepare("SELECT json, cases, suites FROM tm_state WHERE id = 1").get() as
    | { json: string; cases: number; suites: number }
    | undefined;

  const backedUp = tx(() => {
    let did = false;
    if (prev) {
      d.prepare("INSERT INTO tm_state_backup (json, cases, suites, reason, saved_at) VALUES (?, ?, ?, ?, ?)").run(
        prev.json,
        prev.cases,
        prev.suites,
        `pre:${reason}`,
        at,
      );
      d.prepare(
        "DELETE FROM tm_state_backup WHERE id NOT IN (SELECT id FROM tm_state_backup ORDER BY id DESC LIMIT ?)",
      ).run(MAX_BACKUPS);
      did = true;
    }
    d.prepare(
      `INSERT INTO tm_state (id, json, cases, suites, updated_at) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET json = excluded.json, cases = excluded.cases, suites = excluded.suites, updated_at = excluded.updated_at`,
    ).run(json, next.cases, next.suites, at);
    return did;
  });

  let warning: string | undefined;
  if (prev && prev.cases > 20 && next.cases < prev.cases * 0.1) {
    warning = `write dropped cases ${prev.cases} → ${next.cases}; prior state snapshotted (restorable via /api/tm/backups)`;
    // eslint-disable-next-line no-console
    console.warn(`[tmStore] ${warning}`);
  }
  return { ok: true, savedAt: at, cases: next.cases, suites: next.suites, backedUp, warning };
}

// Server-atomic key allocation for TC-/TP-/REQ-/RISK-/BUG- etc.
export function nextSeq(kind: string): number {
  const d = db();
  return tx(() => {
    d.prepare("INSERT OR IGNORE INTO tm_seq (kind, value) VALUES (?, 0)").run(kind);
    d.prepare("UPDATE tm_seq SET value = value + 1 WHERE kind = ?").run(kind);
    return (d.prepare("SELECT value FROM tm_seq WHERE kind = ?").get(kind) as { value: number }).value;
  });
}

// Raise (never lower) the seq counters from a migrated `seq` map so keys keep
// incrementing correctly after the localStorage→DB migration.
export function seedSeq(seq: Record<string, number>): void {
  const d = db();
  tx(() => {
    for (const [k, v] of Object.entries(seq)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        d.prepare(
          "INSERT INTO tm_seq (kind, value) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET value = MAX(value, excluded.value)",
        ).run(k, v);
      }
    }
  });
}

export function listBackups(): { id: number; cases: number; suites: number; reason: string | null; savedAt: string }[] {
  return db()
    .prepare("SELECT id, cases, suites, reason, saved_at AS savedAt FROM tm_state_backup ORDER BY id DESC LIMIT ?")
    .all(MAX_BACKUPS) as { id: number; cases: number; suites: number; reason: string | null; savedAt: string }[];
}

// Restore a snapshot as the current state. saveState() first snapshots the
// (soon-to-be-replaced) current row, so a restore is itself undoable.
export function restoreBackup(id: number): { ok: boolean; cases: number; suites: number } {
  const b = db().prepare("SELECT json FROM tm_state_backup WHERE id = ?").get(id) as { json: string } | undefined;
  if (!b) throw new Error(`backup ${id} not found`);
  const r = saveState(b.json, `restore-${id}`);
  return { ok: true, cases: r.cases, suites: r.suites };
}
