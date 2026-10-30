// I1 — Session canary + live probe.
//
// One place that answers "is the saved login for persona X usable, and is it the
// right account?" for every auth-gated framework. A persona is
// `<framework>:<env>[:<name>]` (packages/qa-core/probe/contract.md).
//
// probeSession(persona):
//   • if the framework's package.json declares an "auth:probe" script, spawn
//     `npm run --silent auth:probe -- --persona <id> [--live]` in the framework dir
//     (stdout drained, 60s timeout), and parse its ONE JSON line
//     (exit 0 ok · 10 refreshable · 20 human-needed · 30 harness-error);
//   • else fall back to the storageState mtime + a local JWT `exp` decode
//     (state "unknown-probe-missing"). The token itself is never returned, logged
//     or stored — only expiry times and identity labels.
//   Results are cached 10 min per persona; concurrent callers share one probe.
//
// Every probe result is compared with the persona's last known SEVERITY
// (ok / warn / block). A change is recorded (events + .testpilot-sessions.json)
// and broadcast to onSessionChange listeners — the scheduler's canary turns those
// into a macOS notification, and the UI shows the red banner + header badge.
//
// This module does NOT import runner.ts (no import cycle): runner.ts registers the
// persona list with setPersonaRegistry() at load time.
import { spawn } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { redact } from "../../packages/qa-core/api/base";
import { isoFromSeconds, jwtExpSeconds, loadStorageState } from "../../packages/qa-core/api/session";

// ── Types ────────────────────────────────────────────────────────────────────

/** One persona the canary probes and the run gate checks. */
export type PersonaDef = {
  /** `<framework>:<env>[:<name>]` */
  id: string;
  framework: string;
  frameworkLabel: string;
  env: string;
  name?: string;
  /** Absolute framework dir (the probe runs here). */
  dir: string;
  /** storageState file(s), relative to `dir` — fallback freshness + display only. */
  files: string[];
  /** Registry capture command (used when the probe gives no humanAction). */
  captureCmd: string;
  ttlDays: number;
  /**
   * Set when the framework re-establishes this session by itself on the next run
   * (e.g. ledgerport-wp-plugin's global-setup logs in again from WP_ADMIN_USER /
   * WP_ADMIN_PASS on local/staging). An expired / logged-out / missing session is
   * then a warning, not a blocker — the run is what heals it.
   */
  selfHeal?: string;
};

export type SessionState = "ok" | "refreshable" | "human-needed" | "harness-error" | "unknown-probe-missing";

/**
 * ok    = usable.
 * warn  = usable-but-check: refreshable, harness-error, probe missing, or a cookie
 *         session that only a --live probe can confirm (stale/unverified cookie).
 * block = a human must act (missing/expired/wrong-account/logged-out/WAF …).
 */
export type SessionSeverity = "ok" | "warn" | "block";

export type SessionIdentity = { email?: string; store?: string; account?: string; site?: string };

export type SessionProbe = {
  persona: string;
  framework: string;
  frameworkLabel: string;
  env: string;
  name?: string;
  state: SessionState;
  ok: boolean;
  severity: SessionSeverity;
  code?: string;
  identity: SessionIdentity;
  /** From the framework's .auth/<env>/[<name>.]meta.json ({} when absent). */
  expected: Record<string, string>;
  expiresAt?: string;
  refreshExpiresAt?: string;
  humanAction?: string;
  checkedAt: string;
  /** "probe" = the framework's auth:probe; "fallback" = mtime + JWT exp. */
  source: "probe" | "fallback";
  /** true when the probe ran with --live (one read-only GET). */
  live: boolean;
  exitCode: number | null;
  durationMs: number;
  /** Fallback only: the freshest storageState found (relative) + its age. */
  file?: string | null;
  fileMtime?: string | null;
  ageHours?: number | null;
  captureCmd: string;
  dir: string;
  /** Short, redacted probe failure note (harness errors). */
  error?: string;
};

export type SessionChange = {
  persona: string;
  from: SessionSeverity | null;
  to: SessionSeverity;
  state: SessionState;
  code?: string;
  humanAction?: string;
  at: string;
};

export type CanaryStatus = {
  enabled: boolean;
  everyHours: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastTrigger: string | null;
  lastSummary: { ok: number; warn: number; block: number } | null;
  running: boolean;
};

// ── Registry (set by runner.ts) ───────────────────────────────────────────────

let registry: () => PersonaDef[] = () => [];

export function setPersonaRegistry(fn: () => PersonaDef[]): void {
  registry = fn;
}

export function listPersonas(): PersonaDef[] {
  return registry();
}

export function personaById(id: string): PersonaDef | undefined {
  return registry().find((p) => p.id === id);
}

const PERSONA_RE = /^[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*){1,2}$/i;

// ── Probe ────────────────────────────────────────────────────────────────────

const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
export const PROBE_CACHE_TTL_MS = 10 * 60_000;
const PROBE_TIMEOUT_MS = 60_000;
const STDOUT_CAP = 64_000;
const STDERR_CAP = 8_000;

/** Codes a selfHeal persona fixes on its own next run. */
export const HEALABLE_CODES = new Set(["expired", "logged-out", "no-file", "no-tokens"]);

/** human-needed codes that a --live probe can confirm either way (cookie sessions). */
export const SOFT_CODES = new Set(["stale-session-cookie", "unverified-session-cookie"]);

const STATES: SessionState[] = ["ok", "refreshable", "human-needed", "harness-error", "unknown-probe-missing"];

export function severityOf(state: SessionState, code?: string): SessionSeverity {
  if (state === "ok") return code && SOFT_CODES.has(code) ? "warn" : "ok";
  if (state === "human-needed") return code && SOFT_CODES.has(code) ? "warn" : "block";
  if (state === "unknown-probe-missing") return code === "no-file" ? "block" : "warn";
  return "warn"; // refreshable, harness-error
}

function hasProbeScript(dir: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    return !!pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, "auth:probe");
  } catch {
    return false;
  }
}

const clean = (v: unknown, max = 400): string | undefined =>
  typeof v === "string" && v ? redact(v).replace(/\s+/g, " ").slice(0, max) : undefined;

function cleanRecord(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (/pass(word)?|secret|token|api_?key|cookie|jwt|bearer|otp|nonce/i.test(k)) continue;
    if (x == null || typeof x === "object") continue;
    const s = clean(String(x), 200);
    if (s) out[k] = s;
  }
  return out;
}

function baseFields(def: PersonaDef) {
  return {
    persona: def.id,
    framework: def.framework,
    frameworkLabel: def.frameworkLabel,
    env: def.env,
    name: def.name,
    captureCmd: def.captureCmd,
    dir: def.dir,
  };
}

function harness(def: PersonaDef, msg: string, exitCode: number | null, durationMs: number, live: boolean): SessionProbe {
  return {
    ...baseFields(def),
    state: "harness-error",
    ok: false,
    severity: "warn",
    code: "harness-error",
    identity: {},
    expected: {},
    humanAction: `The auth:probe script in ${def.framework} failed: ${clean(msg, 240) ?? "unknown error"}`,
    checkedAt: new Date().toISOString(),
    source: "probe",
    live,
    exitCode,
    durationMs,
    error: clean(msg, 240),
  };
}

/** Spawn the framework's auth:probe once and parse its single JSON line. */
function spawnProbe(def: PersonaDef, live: boolean): Promise<SessionProbe> {
  const started = Date.now();
  return new Promise((resolve) => {
    const args = ["run", "--silent", "auth:probe", "--", "--persona", def.id, ...(live ? ["--live"] : [])];
    let out = "";
    let err = "";
    let settled = false;
    const done = (p: SessionProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(p);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(NPM_BIN, args, {
        cwd: def.dir,
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        // Own process group, so a timeout kills npm AND its tsx/ts-node child.
        detached: process.platform !== "win32",
      });
    } catch (e) {
      resolve(harness(def, `could not spawn npm: ${(e as Error).message}`, null, 0, live));
      return;
    }
    const timer = setTimeout(() => {
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          /* gone */
        }
      }
      done(harness(def, `timed out after ${PROBE_TIMEOUT_MS / 1000}s`, null, Date.now() - started, live));
    }, PROBE_TIMEOUT_MS);
    timer.unref?.();
    // ALWAYS drain both pipes (a full pipe would wedge the child).
    child.stdout?.on("data", (d: Buffer) => {
      if (out.length < STDOUT_CAP) out += d.toString("utf8");
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (err.length < STDERR_CAP) err += d.toString("utf8");
    });
    child.on("error", (e) => done(harness(def, `spawn error: ${e.message}`, null, Date.now() - started, live)));
    child.on("close", (code) => {
      const durationMs = Date.now() - started;
      // The contract says exactly one line — be tolerant of an npm banner by taking
      // the LAST line that parses as a probe result.
      const lines = out.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{"));
      for (let i = lines.length - 1; i >= 0; i--) {
        let j: Record<string, unknown>;
        try {
          j = JSON.parse(lines[i]) as Record<string, unknown>;
        } catch {
          continue;
        }
        const state = j.state as SessionState;
        if (!STATES.includes(state) || typeof j.persona !== "string") continue;
        const codeStr = clean(j.code, 60);
        const heals = !!def.selfHeal && state === "human-needed" && !!codeStr && HEALABLE_CODES.has(codeStr);
        const action = clean(j.humanAction, 600);
        const probe: SessionProbe = {
          ...baseFields(def),
          state,
          ok: state === "ok",
          severity: heals ? "warn" : severityOf(state, codeStr),
          code: codeStr,
          identity: cleanRecord(j.identity) as SessionIdentity,
          expected: cleanRecord(j.expected),
          expiresAt: clean(j.expiresAt, 40),
          refreshExpiresAt: clean(j.refreshExpiresAt, 40),
          humanAction: heals ? `Self-heals on the next run (${def.selfHeal}). Otherwise: ${action ?? def.captureCmd}` : action,
          checkedAt: clean(j.checkedAt, 40) ?? new Date().toISOString(),
          source: "probe",
          live,
          exitCode: code,
          durationMs,
        };
        if (j.persona !== def.id) {
          probe.error = `probe answered for ${clean(j.persona, 80)} instead of ${def.id}`;
        }
        done(probe);
        return;
      }
      const tail = err.trim().split("\n").slice(-3).join(" ");
      done(harness(def, `no JSON result line (exit ${code})${tail ? `: ${tail}` : ""}`, code, durationMs, live));
    });
  });
}

/** No auth:probe script: storageState mtime + JWT exp, never the token itself. */
function fallbackProbe(def: PersonaDef): SessionProbe {
  const started = Date.now();
  let best: { rel: string; mtime: number } | null = null;
  for (const rel of def.files) {
    try {
      const m = statSync(path.join(def.dir, rel)).mtimeMs;
      if (!best || m > best.mtime) best = { rel, mtime: m };
    } catch {
      /* absent */
    }
  }
  const humanAction = `cd ${def.dir} && ${def.captureCmd}`;
  const common = {
    ...baseFields(def),
    identity: {},
    expected: {},
    checkedAt: new Date().toISOString(),
    source: "fallback" as const,
    live: false,
    exitCode: null,
  };
  if (!best) {
    return {
      ...common,
      state: "unknown-probe-missing",
      ok: false,
      severity: "block",
      code: "no-file",
      humanAction,
      durationMs: Date.now() - started,
      file: def.files[0] ?? null,
      fileMtime: null,
      ageHours: null,
    };
  }
  // Collect JWT exp values from localStorage (raw or JSON-embedded) — exp only.
  let maxExp = 0;
  const st = loadStorageState(path.join(def.dir, best.rel));
  const JWT = /eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]{4,}/g;
  for (const o of st?.origins ?? []) {
    for (const item of o.localStorage ?? []) {
      for (const m of String(item.value ?? "").match(JWT) ?? []) maxExp = Math.max(maxExp, jwtExpSeconds(m));
    }
  }
  const now = Date.now() / 1000;
  const ageHours = Math.round(((Date.now() - best.mtime) / 3_600_000) * 10) / 10;
  const code = maxExp ? (maxExp > now ? "jwt-valid" : "jwt-expired") : ageHours > def.ttlDays * 24 ? "file-stale" : "file-only";
  return {
    ...common,
    state: "unknown-probe-missing",
    ok: false,
    severity: "warn",
    code,
    expiresAt: maxExp ? isoFromSeconds(maxExp) : undefined,
    humanAction: code === "jwt-valid" || code === "file-only" ? `Add an auth:probe script to ${def.framework} (packages/qa-core/probe/contract.md).` : humanAction,
    durationMs: Date.now() - started,
    file: best.rel,
    fileMtime: new Date(best.mtime).toISOString(),
    ageHours,
  };
}

// ── Cache + in-flight dedupe ──────────────────────────────────────────────────

type CacheEntry = { probe: SessionProbe; at: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SessionProbe>>();

export function cachedProbe(id: string, maxAgeMs = PROBE_CACHE_TTL_MS): SessionProbe | null {
  const c = cache.get(id);
  return c && Date.now() - c.at < maxAgeMs ? c.probe : null;
}

export type ProbeOptions = {
  /** Bypass the 10-min cache. */
  force?: boolean;
  /** Pass --live (ONE read-only GET through the qa-core clients). Refused for production personas. */
  live?: boolean;
};

export class SessionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "SessionError";
  }
}

/** Probe one persona (cached 10 min). Never throws for a probe failure — returns harness-error. */
export async function probeSession(personaId: string, opts: ProbeOptions = {}): Promise<SessionProbe> {
  if (!PERSONA_RE.test(personaId)) throw new SessionError(400, `invalid persona "${personaId.slice(0, 80)}"`);
  const def = personaById(personaId);
  if (!def) throw new SessionError(404, `Unknown persona ${personaId}`);
  if (opts.live && def.env === "production") throw new SessionError(400, "--live probes are never run against production personas");
  const live = !!opts.live;
  if (!opts.force && !live) {
    const c = cachedProbe(personaId);
    if (c) return c;
  }
  const key = `${personaId}|${live ? "live" : "offline"}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    let probe: SessionProbe;
    if (hasProbeScript(def.dir)) {
      probe = await spawnProbe(def, live);
      // V1: a harness error is retried ONCE before a human sees it.
      if (probe.state === "harness-error") probe = await spawnProbe(def, live);
    } else {
      probe = fallbackProbe(def);
    }
    cache.set(personaId, { probe, at: Date.now() });
    noteResult(probe);
    return probe;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Probe many personas with small concurrency (offline unless asked). */
export async function probeAll(ids: string[] = listPersonas().map((p) => p.id), opts: ProbeOptions = {}, concurrency = 2): Promise<SessionProbe[]> {
  const out: SessionProbe[] = new Array(ids.length);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      try {
        out[i] = await probeSession(ids[i], opts);
      } catch (e) {
        const def = personaById(ids[i]);
        if (def) out[i] = harness(def, (e as Error).message, null, 0, !!opts.live);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return out.filter(Boolean);
}

// ── Run gate ─────────────────────────────────────────────────────────────────

export type GateDecision = { block: boolean; probe: SessionProbe; note: string };

/**
 * Should a run for this persona start? Blocks only on block-severity
 * (human-needed with a hard code, or a missing session file). A soft cookie code
 * (stale/unverified) on a NON-production persona is confirmed with one --live probe
 * first; production personas are never probed live, so a soft code there warns only.
 */
export async function sessionGate(personaId: string): Promise<GateDecision> {
  let probe = await probeSession(personaId);
  if (probe.state === "human-needed" && probe.code && SOFT_CODES.has(probe.code) && probe.env !== "production") {
    try {
      probe = await probeSession(personaId, { live: true, force: true });
    } catch {
      /* keep the offline answer */
    }
    if (probe.state === "human-needed" && probe.code && SOFT_CODES.has(probe.code)) {
      return { block: false, probe, note: "cookie session not confirmable offline — running anyway" };
    }
  }
  if (probe.severity === "block") return { block: true, probe, note: "" };
  const note =
    probe.state === "ok"
      ? probe.code && probe.code !== "ok"
        ? probe.code
        : ""
      : `${probe.state}${probe.code ? `/${probe.code}` : ""} — not blocking`;
  return { block: false, probe, note };
}

/** Human-readable identity, labels only (e.g. "email a@b.com, store x"). */
export function describeIdentity(id: Record<string, string | undefined>): string {
  return ["email", "store", "account", "site"]
    .filter((k) => id[k])
    .map((k) => `${k} ${id[k]}`)
    .join(", ");
}

// ── State tracking, events, persistence ─────────────────────────────────────

const STATE_FILE = path.join(process.cwd(), ".testpilot-sessions.json");
type Persisted = {
  last: Record<string, { severity: SessionSeverity; state: SessionState; code?: string; at: string }>;
  events: SessionChange[];
  canary: Pick<CanaryStatus, "lastRunAt" | "lastTrigger" | "lastSummary">;
};
let persisted: Persisted | null = null;

function loadPersisted(): Persisted {
  if (persisted) return persisted;
  try {
    const j = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<Persisted>;
    persisted = {
      last: j.last && typeof j.last === "object" ? j.last : {},
      events: Array.isArray(j.events) ? j.events.slice(0, 50) : [],
      canary: j.canary ?? { lastRunAt: null, lastTrigger: null, lastSummary: null },
    };
  } catch {
    persisted = { last: {}, events: [], canary: { lastRunAt: null, lastTrigger: null, lastSummary: null } };
  }
  return persisted;
}

function savePersisted(): void {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(loadPersisted(), null, 2));
  } catch {
    /* best-effort */
  }
}

type Listener = (change: SessionChange, probe: SessionProbe) => void;
const listeners = new Set<Listener>();

/** Subscribe to severity changes (any probe source). Returns an unsubscribe fn. */
export function onSessionChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function noteResult(probe: SessionProbe): void {
  const p = loadPersisted();
  const prev = p.last[probe.persona];
  p.last[probe.persona] = { severity: probe.severity, state: probe.state, code: probe.code, at: probe.checkedAt };
  // First observation of a persona: only a problem counts as a change (so a fresh
  // install doesn't announce every green session).
  const changed = prev ? prev.severity !== probe.severity : probe.severity === "block";
  if (!changed) {
    savePersisted();
    return;
  }
  const change: SessionChange = {
    persona: probe.persona,
    from: prev?.severity ?? null,
    to: probe.severity,
    state: probe.state,
    code: probe.code,
    humanAction: probe.humanAction,
    at: probe.checkedAt,
  };
  p.events = [change, ...p.events].slice(0, 50);
  savePersisted();
  for (const fn of listeners) {
    try {
      fn(change, probe);
    } catch {
      /* a listener must never break probing */
    }
  }
}

export function sessionEvents(): SessionChange[] {
  return loadPersisted().events;
}

// ── Canary status (owned by scheduler.ts, surfaced by GET /api/sessions) ──────

let canary: CanaryStatus = {
  enabled: false,
  everyHours: 6,
  lastRunAt: null,
  nextRunAt: null,
  lastTrigger: null,
  lastSummary: null,
  running: false,
};

export function setCanaryStatus(patch: Partial<CanaryStatus>): void {
  canary = { ...canary, ...patch };
  if (patch.lastRunAt !== undefined || patch.lastSummary !== undefined || patch.lastTrigger !== undefined) {
    const p = loadPersisted();
    p.canary = { lastRunAt: canary.lastRunAt, lastTrigger: canary.lastTrigger, lastSummary: canary.lastSummary };
    savePersisted();
  }
}

export function canaryStatus(): CanaryStatus {
  const p = loadPersisted();
  return {
    ...canary,
    lastRunAt: canary.lastRunAt ?? p.canary.lastRunAt ?? null,
    lastTrigger: canary.lastTrigger ?? p.canary.lastTrigger ?? null,
    lastSummary: canary.lastSummary ?? p.canary.lastSummary ?? null,
  };
}

// ── API view ─────────────────────────────────────────────────────────────────

export type SessionView = {
  persona: string;
  framework: string;
  frameworkLabel: string;
  env: string;
  name?: string;
  dir: string;
  files: string[];
  captureCmd: string;
  /** Latest probe (null = never probed in this process and `cached` was asked). */
  probe: SessionProbe | null;
  /** Age of that probe result in seconds. */
  probeAgeSec: number | null;
};

/** All personas with their (cached, or freshly probed when stale) result. */
export async function sessionsView(opts: { cachedOnly?: boolean } = {}): Promise<{
  sessions: SessionView[];
  blocking: number;
  warnings: number;
  events: SessionChange[];
  canary: CanaryStatus;
}> {
  const defs = listPersonas();
  if (!opts.cachedOnly) {
    const stale = defs.filter((d) => !cachedProbe(d.id)).map((d) => d.id);
    if (stale.length) await probeAll(stale);
  }
  const sessions = defs.map((d): SessionView => {
    const c = cache.get(d.id);
    return {
      persona: d.id,
      framework: d.framework,
      frameworkLabel: d.frameworkLabel,
      env: d.env,
      name: d.name,
      dir: d.dir,
      files: d.files,
      captureCmd: d.captureCmd,
      probe: c?.probe ?? null,
      probeAgeSec: c ? Math.round((Date.now() - c.at) / 1000) : null,
    };
  });
  // With cachedOnly, fall back to the persisted last-known severity so the header
  // badge is right straight after a restart (before anything was re-probed).
  const last = loadPersisted().last;
  const sevOf = (s: SessionView) => s.probe?.severity ?? (opts.cachedOnly ? last[s.persona]?.severity : undefined);
  return {
    sessions,
    blocking: sessions.filter((s) => sevOf(s) === "block").length,
    warnings: sessions.filter((s) => sevOf(s) === "warn").length,
    events: sessionEvents().slice(0, 20),
    canary: canaryStatus(),
  };
}
