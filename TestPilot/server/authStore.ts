// INC-2 of public hosting (see HOSTING.md) — SERVER-SIDE auth store + sessions.
//
// Mirrors the client model in src/lib/users.ts (roles admin|qa|dev, password hash
// `salt:sha256hex(salt:password)`) but is the REAL security boundary: users +
// opaque session tokens live in the shared SQLite DB (same file as tmStore), and
// password verification + session resolution happen on the server, not in the
// browser. The password hash and session tokens are never returned to clients.
//
// Needs Node ≥ 22.5 + --experimental-sqlite (already wired into the dev/start
// scripts' NODE_OPTIONS), same as tmStore.ts.
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

export type Role = "admin" | "qa" | "dev";
export type ServerUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: string;
  handles?: Record<string, string>;
  active: boolean;
  passwordHash?: string; // `salt:sha256hex(salt:password)` — NEVER sent to clients
};
/** The shape safe to return over the wire (no hash). */
export type PublicUser = Omit<ServerUser, "passwordHash">;

// Kept in sync with SEED_USERS in src/lib/users.ts. Only the admin ships a hash
// (computed offline — plaintext never in source); the rest must be provisioned
// (an admin sets a password in Users & Team) before they can sign in.
const SEED_USERS: ServerUser[] = [
  { id: "u-kulvinder", name: "Kulvinder Singh", email: "kgosal@awesomemotive.com", role: "admin", title: "QA Engineer, PushEngage", handles: { github: "KulvinderGosal" }, active: true, passwordHash: "005773495bd6e9c71d56df85:cba2a38128c7b7a3a9684e37522e8332b191b234368af6aa7f52739657d4577c" },
  { id: "u-priya", name: "Priya Sharma", email: "priya@awesomemotive.com", role: "qa", title: "QA Engineer", active: true },
  { id: "u-abhishek", name: "Abhishek Rijal", email: "abhishek@awesomemotive.com", role: "dev", title: "Frontend Engineer", handles: { slack: "@abhishek" }, active: true },
  { id: "u-akash", name: "Akash Kumar Dhan", email: "akash@awesomemotive.com", role: "dev", title: "Backend Engineer", handles: { slack: "@akash" }, active: true },
  { id: "u-anjanish", name: "Anjanish Kumar", email: "anjanish@awesomemotive.com", role: "dev", title: "Full-stack Engineer", handles: { slack: "@anjanish" }, active: true },
  { id: "u-himshikhar", name: "Himshikhar Gayan", email: "himshikhar@awesomemotive.com", role: "dev", title: "Frontend Engineer", handles: { slack: "@himshikhar" }, active: true },
  { id: "u-mrityunjay", name: "Mrityunjay Kumar", email: "mrityunjay@awesomemotive.com", role: "dev", title: "Platform Engineer", handles: { slack: "@mrityunjay" }, active: true },
];

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = "tp_sess";

type Row = Record<string, unknown>;
interface DB {
  exec(sql: string): void;
  prepare(sql: string): { get(...a: unknown[]): Row | undefined; all(...a: unknown[]): Row[]; run(...a: unknown[]): unknown };
}

const DB_PATH = process.env.TESTPILOT_TM_DB || join(homedir(), "QA-Automations", "testpilot-tm.db");
let _db: DB | null = null;

function db(): DB {
  if (_db) return _db;
  const { DatabaseSync } = nodeRequire("node:sqlite") as { DatabaseSync: new (p: string) => DB };
  const d = new DatabaseSync(DB_PATH);
  d.exec("PRAGMA journal_mode = WAL");
  d.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL, title TEXT, handles TEXT, active INTEGER NOT NULL DEFAULT 1,
      password_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_exp ON auth_sessions(expires_at);
  `);
  _db = d;
  seedIfEmpty();
  return d;
}

function seedIfEmpty(): void {
  const d = _db!;
  const n = (d.prepare("SELECT COUNT(*) AS c FROM auth_users").get() as { c: number }).c;
  if (n > 0) return;
  const ins = d.prepare("INSERT INTO auth_users (id, name, email, role, title, handles, active, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const u of SEED_USERS) {
    ins.run(u.id, u.name, u.email, u.role, u.title ?? null, u.handles ? JSON.stringify(u.handles) : null, u.active ? 1 : 0, u.passwordHash ?? null);
  }
}

function rowToUser(r: Row | undefined): ServerUser | null {
  if (!r) return null;
  return {
    id: String(r.id), name: String(r.name), email: String(r.email), role: r.role as Role,
    title: r.title ? String(r.title) : undefined,
    handles: r.handles ? (JSON.parse(String(r.handles)) as Record<string, string>) : undefined,
    active: !!r.active, passwordHash: r.password_hash ? String(r.password_hash) : undefined,
  };
}

export function publicUser(u: ServerUser): PublicUser {
  const { passwordHash: _omit, ...rest } = u;
  void _omit;
  return rest;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function getUser(id: string): ServerUser | null {
  return rowToUser(db().prepare("SELECT * FROM auth_users WHERE id = ?").get(id));
}
export function findByEmail(email: string): ServerUser | null {
  return rowToUser(db().prepare("SELECT * FROM auth_users WHERE lower(email) = lower(?)").get(email.trim()));
}
export function listUsers(): PublicUser[] {
  return db().prepare("SELECT * FROM auth_users ORDER BY name").all().map((r) => publicUser(rowToUser(r)!));
}

/** True only when the account has a real hash AND the password matches it. */
export function verifyPassword(user: ServerUser | null, password: string): boolean {
  const h = user?.passwordHash;
  if (!h || !h.includes(":") || !h.split(":")[1]) return false;
  const [salt, hash] = h.split(":");
  return sha256Hex(`${salt}:${password}`) === hash;
}

export type Session = { token: string; userId: string; expiresAt: number };

export function createSession(userId: string, now: number): Session {
  const token = randomBytes(24).toString("hex");
  const expiresAt = now + SESSION_TTL_MS;
  db().prepare("INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(token, userId, now, expiresAt);
  return { token, userId, expiresAt };
}

/** Resolve a session token → active user, or null (expired/unknown/inactive).
 *  Expired rows are pruned on access. */
export function resolveSession(token: string | undefined, now: number): ServerUser | null {
  if (!token) return null;
  const row = db().prepare("SELECT * FROM auth_sessions WHERE token = ?").get(token) as Row | undefined;
  if (!row) return null;
  if (Number(row.expires_at) <= now) {
    db().prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
    return null;
  }
  const user = getUser(String(row.user_id));
  return user && user.active ? user : null;
}

export function deleteSession(token: string | undefined): void {
  if (token) db().prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
}

/** Housekeeping — drop expired sessions. Safe to call periodically. */
export function pruneSessions(now: number): void {
  db().prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(now);
}
