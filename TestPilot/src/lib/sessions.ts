// I1 — client for the session canary / persona probes (server/sessions.ts).
// GET /api/sessions lists every persona (`<framework>:<env>[:<name>]`) with its
// latest probe; POST /api/sessions/:persona/probe re-probes one (nonce-gated).
// Probe results carry identity labels + expiry times only — never a token.
import { fetchWithNonce } from "@/lib/session";

export type SessionState = "ok" | "refreshable" | "human-needed" | "harness-error" | "unknown-probe-missing";
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
  expected: Record<string, string>;
  expiresAt?: string;
  refreshExpiresAt?: string;
  humanAction?: string;
  checkedAt: string;
  source: "probe" | "fallback";
  live: boolean;
  exitCode: number | null;
  durationMs: number;
  file?: string | null;
  fileMtime?: string | null;
  ageHours?: number | null;
  captureCmd: string;
  dir: string;
  error?: string;
};

export type SessionView = {
  persona: string;
  framework: string;
  frameworkLabel: string;
  env: string;
  name?: string;
  dir: string;
  files: string[];
  captureCmd: string;
  probe: SessionProbe | null;
  probeAgeSec: number | null;
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

export type SessionsResponse = {
  sessions: SessionView[];
  blocking: number;
  warnings: number;
  events: SessionChange[];
  canary: CanaryStatus;
};

/** All personas. `cached` = never probe (cheap — for the header badge poll). */
export async function fetchSessions(cached = false): Promise<SessionsResponse> {
  const r = await fetch(`/api/sessions${cached ? "?cached=1" : ""}`, { cache: "no-store" });
  const b = (await r.json().catch(() => ({}))) as SessionsResponse & { error?: string };
  if (!r.ok) throw new Error(b.error || `sessions ${r.status}`);
  return b;
}

/** Fresh probe of one persona. `live` = ONE read-only GET (refused for production). */
export async function probeSessionNow(persona: string, live = false): Promise<SessionProbe> {
  const r = await fetchWithNonce(`/api/sessions/${encodeURIComponent(persona)}/probe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ live }),
  });
  const b = (await r.json().catch(() => ({}))) as { probe?: SessionProbe; error?: string };
  if (!r.ok || !b.probe) throw new Error(b.error || `probe ${r.status}`);
  return b.probe;
}

/** Window event the Sessions panel fires after a re-probe so the header badge refreshes at once. */
export const SESSIONS_CHANGED_EVENT = "testpilot:sessions-changed";
