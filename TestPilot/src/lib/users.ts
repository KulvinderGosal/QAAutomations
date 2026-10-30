// App users + a simulated auth/session layer, persisted to localStorage.
// This is NOT real authentication — there is no backend, no password check.
// It gates the UI and models a team so roles/assignment/profile work.
import type { AppUser, Role } from "@/types";

const USERS_KEY = "testpilot.users";
const SESSION_KEY = "testpilot.session";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  qa: "QA Engineer",
  dev: "Developer",
};

export const ROLE_ORDER: Role[] = ["admin", "qa", "dev"];

// Seed team: Kulvinder (admin) + a QA teammate + the developers who assign work.
// The admin ships with a password (stored ONLY as a salted SHA-256 hash — the
// plaintext is never in source). Other seed accounts have none (demo sign-in).
const SEED_USERS: AppUser[] = [
  { id: "u-kulvinder", name: "Kulvinder Singh", email: "kgosal@awesomemotive.com", role: "admin", title: "QA Engineer, PushEngage", handles: { github: "KulvinderGosal" }, active: true, passwordHash: "005773495bd6e9c71d56df85:cba2a38128c7b7a3a9684e37522e8332b191b234368af6aa7f52739657d4577c" },
  { id: "u-priya", name: "Priya Sharma", email: "priya@awesomemotive.com", role: "qa", title: "QA Engineer", active: true },
  { id: "u-abhishek", name: "Abhishek Rijal", email: "abhishek@awesomemotive.com", role: "dev", title: "Frontend Engineer", handles: { slack: "@abhishek" }, active: true },
  { id: "u-akash", name: "Akash Kumar Dhan", email: "akash@awesomemotive.com", role: "dev", title: "Backend Engineer", handles: { slack: "@akash" }, active: true },
  { id: "u-anjanish", name: "Anjanish Kumar", email: "anjanish@awesomemotive.com", role: "dev", title: "Full-stack Engineer", handles: { slack: "@anjanish" }, active: true },
  { id: "u-himshikhar", name: "Himshikhar Gayan", email: "himshikhar@awesomemotive.com", role: "dev", title: "Frontend Engineer", handles: { slack: "@himshikhar" }, active: true },
  { id: "u-mrityunjay", name: "Mrityunjay Kumar", email: "mrityunjay@awesomemotive.com", role: "dev", title: "Platform Engineer", handles: { slack: "@mrityunjay" }, active: true },
];

export function readUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as AppUser[];
      if (Array.isArray(list) && list.length) return mergeSeedSecrets(list);
    }
  } catch {
    /* ignore */
  }
  return SEED_USERS;
}

// Existing installs predate the password: backfill the seeded password hash onto
// a matching stored account that has none, so the shipped credential applies on
// next load. Never overwrites a password the user has set themselves.
function mergeSeedSecrets(list: AppUser[]): AppUser[] {
  let changed = false;
  const next = list.map((u) => {
    const seed = SEED_USERS.find((s) => s.id === u.id);
    if (seed?.passwordHash && !u.passwordHash) {
      changed = true;
      return { ...u, passwordHash: seed.passwordHash };
    }
    return u;
  });
  if (changed) writeUsers(next);
  return next;
}

// ── Password hashing (client-side, "secure enough" for a local tool) ─────────
// Stored as "salt:sha256hex". This is NOT bank-grade — a browser-only app keeps
// everything in localStorage, which dev-tools can read. It only prevents casual
// access and never stores the plaintext.
const enc = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Produce a "salt:hash" string to store on a user. */
export async function makePasswordHash(password: string): Promise<string> {
  const salt = randomSalt();
  return `${salt}:${await sha256Hex(`${salt}:${password}`)}`;
}

/** Does this account have a real password set (i.e. can it sign in)? */
export function hasPassword(user: AppUser): boolean {
  const h = user.passwordHash;
  return !!(h && h.includes(":") && h.split(":")[1]);
}

/**
 * Verify a password against a user. An account with NO password hash CANNOT
 * sign in — it must first be provisioned (an admin sets one in Users & Team, or
 * the member sets one via "Forgot password?"). Previously a missing hash
 * accepted any password, which meant every seeded member was effectively
 * unauthenticated — the member-login hole this closes.
 */
export async function verifyPassword(user: AppUser, password: string): Promise<boolean> {
  if (!hasPassword(user)) return false;
  const [salt, hash] = user.passwordHash!.split(":");
  return (await sha256Hex(`${salt}:${password}`)) === hash;
}

export function writeUsers(list: AppUser[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeSession(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// Which roles may open which route. Developers get a read-only slice (their
// assigned work + issues); QA/Admin get the full cockpit; only Admin manages users.
export const ROUTE_ROLES: Record<string, Role[]> = {
  "/": ["admin", "qa", "dev"],
  "/tests": ["admin", "qa"],
  "/overview": ["admin", "qa", "dev"],
  "/queue": ["admin", "qa", "dev"],
  "/runner": ["admin", "qa"],
  "/pipelines": ["admin", "qa"],
  "/schedule": ["admin", "qa"],
  "/reports": ["admin", "qa"],
  "/skb-docs": ["admin", "qa"],
  "/manual": ["admin", "qa"],
  "/qa-log": ["admin", "qa"],
  "/fixtures": ["admin", "qa"],
  "/users": ["admin"],
  "/database": ["admin"],
  "/integrations": ["admin", "qa"],
};

export function canAccess(path: string, role: Role | undefined): boolean {
  if (!role) return false;
  const key = path.startsWith("/queue/") ? "/queue" : path.startsWith("/tests") ? "/tests" : path;
  return (ROUTE_ROLES[key] ?? ROLE_ORDER).includes(role);
}
