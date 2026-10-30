// Server-side automation scheduler for the Test Runner.
//
// Persists schedules to a JSON file and, while the Vite dev server is running,
// a ticker fires each due schedule by starting a `command`-mode run (an npm
// script from the chosen framework) through the existing runner. Runs are
// one-at-a-time, so if a run is already active the tick is skipped and retried.
//
// NOTE: this is dev-server-hosted, not a always-on daemon — schedules only fire
// while `npm run dev` (the TestPilot dev server) is running. That's surfaced in
// the UI. Persisting to disk means schedules survive dev-server restarts.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FRAMEWORKS, RunnerError, getRun, startRun } from "./runner";
import { postMessage } from "./slack";
import { listPersonas, onSessionChange, probeAll, setCanaryStatus, type SessionChange, type SessionProbe } from "./sessions";

export type Cadence =
  | { type: "interval"; everyMinutes: number }
  | { type: "daily"; at: string } // "HH:MM" (24h, local time)
  | { type: "weekly"; day: number; at: string }; // day 0=Sun … 6=Sat

export type Schedule = {
  id: string;
  framework: string;
  script: string; // npm script name
  env?: string | null;
  cadence: Cadence;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastRunId: string | null;
  lastStatus: string | null; // "started" | "skipped (busy)" | "error: …"
  nextRunAt: string | null; // ISO
  /**
   * I1: set when the last run ended BLOCKED{SESSION} for this persona. The job
   * re-queues itself (fires on the next tick) as soon as that persona's probe
   * turns non-blocking.
   */
  blockedOn?: string | null;
};

const FILE = path.join(process.cwd(), ".testpilot-schedules.json");
let schedules: Schedule[] = [];
let seq = 1;

function load(): void {
  if (!existsSync(FILE)) {
    schedules = [];
    return;
  }
  try {
    schedules = JSON.parse(readFileSync(FILE, "utf8")) as Schedule[];
    for (const s of schedules) {
      const n = parseInt(s.id.replace(/\D/g, ""), 10);
      if (!Number.isNaN(n) && n >= seq) seq = n + 1;
    }
  } catch {
    schedules = [];
  }
}

function persist(): void {
  try {
    writeFileSync(FILE, JSON.stringify(schedules, null, 2));
  } catch {
    /* best-effort — in-memory still works this session */
  }
}

/** Next fire time (ms epoch) for a cadence, strictly after `from`. */
export function computeNextRun(cadence: Cadence, from: number = Date.now()): number {
  if (cadence.type === "interval") {
    const mins = Math.max(1, Math.floor(cadence.everyMinutes || 0));
    return from + mins * 60_000;
  }
  const [hh, mm] = (cadence.at || "00:00").split(":").map((x) => parseInt(x, 10));
  const base = new Date(from);
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh || 0, mm || 0, 0, 0);
  if (cadence.type === "daily") {
    while (next.getTime() <= from) next.setDate(next.getDate() + 1);
    return next.getTime();
  }
  // weekly
  const targetDay = ((cadence.day % 7) + 7) % 7;
  while (next.getDay() !== targetDay || next.getTime() <= from) next.setDate(next.getDate() + 1);
  return next.getTime();
}

export function describeCadence(c: Cadence): string {
  if (c.type === "interval") return `every ${c.everyMinutes} min`;
  if (c.type === "daily") return `daily at ${c.at}`;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `weekly on ${days[((c.day % 7) + 7) % 7]} at ${c.at}`;
}

export function listSchedules(): Schedule[] {
  return schedules;
}

// ── Failure alerts (Slack) ───────────────────────────────────────────────────
// Configured from vite.config (where the .env values live). When a scheduled
// run finishes FAILED/ERROR, we post a message to the QA channel so the team is
// alerted that critical functionality on a live site may be broken.
let alertConfig: { slackToken: string; slackChannel: string; appUrl: string } = {
  slackToken: "",
  slackChannel: "",
  appUrl: "http://localhost:5173",
};
export function configureAlerts(cfg: Partial<typeof alertConfig>): void {
  alertConfig = { ...alertConfig, ...cfg };
}

/** Whether Slack failure-alerts are wired (token + channel present). */
export function alertStatus(): { ready: boolean; channel: string } {
  return { ready: !!alertConfig.slackToken, channel: alertConfig.slackChannel };
}

/** Post a test message to the alert channel — verifies the Slack wiring. */
export async function sendTestAlert(): Promise<{ ok: boolean; channel?: string; error?: string }> {
  if (!alertConfig.slackToken) {
    return { ok: false, error: "No SLACK_BOT_TOKEN configured in .env — add a bot token with chat:write (and /invite it to the channel)." };
  }
  try {
    const r = await postMessage(
      alertConfig.slackToken,
      alertConfig.slackChannel,
      ":white_check_mark: *TestPilot QA alerts are wired.* You'll get a summary here every time a Sunday/Wednesday critical-functionality check runs on PushEngage (www.pushengage.com) or LedgerPort (ledgerport.com) — green when healthy, red with details when something breaks.",
    );
    return { ok: true, channel: r.channel };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Friendly "which live site" label for the alert message.
const SITE_LABEL: Record<string, string> = {
  "pushengage-site": "PushEngage — www.pushengage.com",
  "ledgerport-marketing-site": "LedgerPort — ledgerport.com",
};

const alertTimers = new Map<string, ReturnType<typeof setInterval>>();

/** Poll a just-started scheduled run; on terminal FAILED/ERROR, alert Slack. */
function watchRunForAlert(s: Schedule, runId: string): void {
  const key = `${s.id}:${runId}`;
  if (alertTimers.has(key)) return;
  let ticks = 0;
  const timer = setInterval(() => {
    ticks++;
    let status: string;
    try {
      status = getRun(runId, 0).run.status;
    } catch {
      clearInterval(timer);
      alertTimers.delete(key);
      return;
    }
    if (status === "running") {
      if (ticks > 720) {
        // ~60 min safety cap (720 × 5s) — stop watching a stuck run.
        clearInterval(timer);
        alertTimers.delete(key);
      }
      return;
    }
    clearInterval(timer);
    alertTimers.delete(key);
    // Record the terminal status on the schedule (overwrites "started").
    const sched = schedules.find((x) => x.id === s.id);
    let sessionPersona: string | null = null;
    try {
      const r = getRun(runId, 0).run;
      if (status === "blocked" && r.verdict?.cls === "SESSION" && r.persona) sessionPersona = r.persona;
    } catch {
      /* run vanished */
    }
    if (sched && sched.lastRunId === runId) {
      sched.lastStatus = sessionPersona ? `blocked: session ${sessionPersona} (re-queues when it turns green)` : status;
      sched.blockedOn = sessionPersona;
      persist();
    }
    // I1: ONE alert per blocked persona — later runs blocked on the same persona stay
    // quiet until its probe turns green again (the canary/banner keep showing it).
    if (sessionPersona) {
      if (sessionAlerted.has(sessionPersona)) {
        console.warn(`[scheduler] run ${runId} (${s.framework}) blocked on session ${sessionPersona} — already alerted`);
        return;
      }
      sessionAlerted.add(sessionPersona);
    }
    // Post a Slack COMPLETION summary on every scheduled run — pass or fail —
    // with coverage, so you get a "ran & finished" ping either way (not just on
    // failure). No-ops with a console warning if SLACK_BOT_TOKEN isn't set.
    void sendCompletionAlert(s, runId, status);
  }, 5000);
  timer.unref?.();
  alertTimers.set(key, timer);
}

/**
 * Post a Slack summary when a scheduled run finishes — PASS or FAIL — with
 * coverage (passed/failed/skipped + duration). Command mode uses the framework's
 * own list reporter (no JSON summary), so we parse the "N passed/failed/skipped"
 * tail lines. No-ops (with a console warning) when SLACK_BOT_TOKEN isn't set.
 */
async function sendCompletionAlert(s: Schedule, runId: string, status: string): Promise<void> {
  if (!alertConfig.slackToken) {
    console.warn(`[scheduler] run ${runId} (${s.framework}) ${status} — no SLACK_BOT_TOKEN set, Slack summary skipped`);
    return;
  }
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let duration = "";
  let verdictLine = "";
  try {
    const g = getRun(runId, 0);
    // V1: name the blocker instead of calling a run that executed nothing "FAILED"/"PASSED".
    const v = g.run.verdict;
    if (v && v.state === "BLOCKED") verdictLine = `• *Blocked by ${v.cls ?? "HARNESS"}:* ${v.reason} — ${v.humanAction ?? ""}`.trim();
    else if (v && v.state === "PASS_WITH_GAPS") verdictLine = `• *Gaps:* ${v.reason}`;
    if (g.run.summary) {
      passed = g.run.summary.expected ?? 0;
      failed = g.run.summary.unexpected ?? 0;
      skipped = g.run.summary.skipped ?? 0;
    }
    const out = g.output || "";
    const mp = out.match(/(\d+)\s+passed(?:\s+\(([^)]+)\))?/i);
    const mf = out.match(/(\d+)\s+failed/i);
    const ms = out.match(/(\d+)\s+skipped/i);
    if (mp) {
      passed = parseInt(mp[1], 10);
      if (mp[2]) duration = mp[2];
    }
    if (mf) failed = parseInt(mf[1], 10);
    if (ms) skipped = parseInt(ms[1], 10);
  } catch {
    /* fall back to defaults */
  }
  const ok = status === "passed" && failed === 0;
  const site = SITE_LABEL[s.framework] || s.framework;
  const link = `${alertConfig.appUrl.replace(/\/$/, "")}/runs/${runId}`;
  const coverage = `${passed} passed · ${failed} failed · ${skipped} skipped${duration ? ` · ${duration}` : ""}`;
  const text = [
    ok
      ? `:large_green_circle: *QA scheduled check PASSED — ${site}*`
      : status === "blocked"
        ? `:warning: *QA scheduled check BLOCKED (no verdict) — ${site}*`
        : `:rotating_light: *QA scheduled check ${status === "passed" ? "needs a look" : "FAILED"} — ${site}*`,
    `• *Schedule:* ${describeCadence(s.cadence)}  (\`${s.script}\`)`,
    `• *Coverage:* ${coverage}`,
    `• *When:* ${new Date().toLocaleString()}`,
    ...(verdictLine ? [verdictLine] : []),
    `• *Details:* ${link}`,
    ok
      ? `All checks green on the live site. :white_check_mark:`
      : status === "blocked"
        ? `The run could not produce a verdict — fix the blocker above and re-run (this is NOT a pass).`
        : `Critical functionality may be broken on the live site — please check.`,
  ].join("\n");
  try {
    await postMessage(alertConfig.slackToken, alertConfig.slackChannel, text);
    console.log(`[scheduler] Slack completion summary posted for run ${runId} (${s.framework}) — ${ok ? "PASS" : "FAIL"}`);
  } catch (e) {
    console.error(`[scheduler] Slack post FAILED: ${(e as Error).message}`);
  }
}

/** Personas whose BLOCKED{SESSION} completion alert was already sent (cleared when they turn green). */
const sessionAlerted = new Set<string>();

export type CreateScheduleInput = {
  framework: string;
  script: string;
  env?: string | null;
  cadence: Cadence;
  enabled?: boolean;
};

function validateCadence(c: Cadence): void {
  if (!c || typeof c !== "object") throw new RunnerError(400, "cadence required");
  if (c.type === "interval") {
    if (!(c.everyMinutes >= 1)) throw new RunnerError(400, "interval everyMinutes must be >= 1");
  } else if (c.type === "daily" || c.type === "weekly") {
    if (!/^\d{1,2}:\d{2}$/.test(c.at || "")) throw new RunnerError(400, "cadence 'at' must be HH:MM");
    if (c.type === "weekly" && !(c.day >= 0 && c.day <= 6)) throw new RunnerError(400, "weekly day must be 0..6");
  } else {
    throw new RunnerError(400, "unknown cadence type");
  }
}

export function createSchedule(input: CreateScheduleInput): Schedule {
  if (!FRAMEWORKS.some((f) => f.id === input.framework)) throw new RunnerError(400, `Unknown framework: ${input.framework}`);
  if (!input.script?.trim()) throw new RunnerError(400, "script required");
  validateCadence(input.cadence);
  const now = Date.now();
  const s: Schedule = {
    id: `sched-${now}-${seq++}`,
    framework: input.framework,
    script: input.script.trim(),
    env: input.env ?? null,
    cadence: input.cadence,
    enabled: input.enabled !== false,
    createdAt: new Date(now).toISOString(),
    lastRunAt: null,
    lastRunId: null,
    lastStatus: null,
    nextRunAt: new Date(computeNextRun(input.cadence, now)).toISOString(),
  };
  schedules = [s, ...schedules];
  persist();
  return s;
}

export function deleteSchedule(id: string): void {
  schedules = schedules.filter((s) => s.id !== id);
  persist();
}

export function toggleSchedule(id: string, enabled: boolean): Schedule {
  const s = schedules.find((x) => x.id === id);
  if (!s) throw new RunnerError(404, "Schedule not found");
  s.enabled = enabled;
  // Re-arm from now when re-enabling so a long-disabled schedule doesn't fire immediately.
  if (enabled) s.nextRunAt = new Date(computeNextRun(s.cadence)).toISOString();
  persist();
  return s;
}

/** Fire a schedule now (respects one-at-a-time; returns the started run id or throws). */
export function runScheduleNow(id: string): { runId: string } {
  const s = schedules.find((x) => x.id === id);
  if (!s) throw new RunnerError(404, "Schedule not found");
  const run = startRun({ framework: s.framework, mode: "command", script: s.script, env: s.env ?? undefined });
  s.lastRunAt = new Date().toISOString();
  s.lastRunId = run.id;
  s.lastStatus = "started (manual)";
  persist();
  watchRunForAlert(s, run.id); // post a Slack completion summary (pass or fail) when this run finishes
  return { runId: run.id };
}

// ── I1 session canary ────────────────────────────────────────────────────────
// A built-in job (not a user schedule): every 6h, and once ~2 min after start-up,
// probe EVERY persona offline (`npm run auth:probe` per framework, via
// sessions.probeAll). Only a SEVERITY change (ok ↔ warn ↔ block) is announced:
// a macOS notification (osascript) + the red banner/header badge in the UI (which
// read GET /api/sessions). No Slack. Changes found by the run gate or a manual
// "Re-probe" are announced the same way, because the listener is global.
// When a persona stops blocking, schedules waiting on it (blockedOn) re-queue.
export const CANARY_EVERY_MS = 6 * 60 * 60_000;
export const CANARY_FIRST_DELAY_MS = 2 * 60_000;
let canaryOpts = { enabled: true, notify: true };

export function configureCanary(opts: Partial<typeof canaryOpts>): void {
  canaryOpts = { ...canaryOpts, ...opts };
}

/** Probe all personas now (fresh, offline). Safe to call concurrently (probes are de-duped). */
export async function runSessionCanary(trigger: "startup" | "interval" | "manual"): Promise<SessionProbe[]> {
  setCanaryStatus({ running: true });
  try {
    const results = await probeAll(listPersonas().map((p) => p.id), { force: true });
    const summary = { ok: 0, warn: 0, block: 0 };
    for (const r of results) summary[r.severity]++;
    setCanaryStatus({ lastRunAt: new Date().toISOString(), lastTrigger: trigger, lastSummary: summary });
    console.log(`[canary] ${trigger}: ${summary.ok} ok · ${summary.warn} warn · ${summary.block} need a human`);
    return results;
  } finally {
    setCanaryStatus({ running: false });
  }
}

/** macOS Notification Center via osascript — text passed as argv (never interpolated into the script). */
function macNotify(title: string, message: string): void {
  if (!canaryOpts.notify || process.platform !== "darwin") return;
  try {
    const child = spawn(
      "osascript",
      [
        "-e",
        "on run argv",
        "-e",
        "display notification (item 2 of argv) with title (item 1 of argv)",
        "-e",
        "end run",
        title.slice(0, 120),
        message.slice(0, 400),
      ],
      { stdio: "ignore" },
    );
    child.on("error", () => {});
    child.unref();
  } catch {
    /* notification is best-effort */
  }
}

// Batch changes that land together (one canary sweep) into ONE notification.
let pendingChanges: SessionChange[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushNotifications(): void {
  flushTimer = null;
  const changes = pendingChanges;
  pendingChanges = [];
  const bad = changes.filter((c) => c.to === "block");
  const good = changes.filter((c) => c.from === "block" && c.to !== "block");
  if (bad.length) {
    const first = bad[0];
    macNotify(
      bad.length === 1 ? "TestPilot — a test session needs a human" : `TestPilot — ${bad.length} test sessions need a human`,
      bad.length === 1
        ? `${first.persona} (${first.code ?? first.state}). ${first.humanAction ?? ""}`
        : `${bad.map((c) => `${c.persona} (${c.code ?? c.state})`).join(", ")}. Open TestPilot → Test Runner → Test sessions.`,
    );
  }
  if (good.length) {
    macNotify("TestPilot — session OK again", `${good.map((c) => c.persona).join(", ")} no longer blocked.`);
  }
}

function handleSessionChange(change: SessionChange): void {
  console.log(`[canary] ${change.persona}: ${change.from ?? "new"} → ${change.to} (${change.state}${change.code ? `/${change.code}` : ""})`);
  if (change.to === "block" || change.from === "block") {
    pendingChanges.push(change);
    if (!flushTimer) {
      flushTimer = setTimeout(flushNotifications, 1500);
      flushTimer.unref?.();
    }
  }
  if (change.to !== "block") {
    // Green again: allow one alert next time, and re-queue jobs that were waiting.
    sessionAlerted.delete(change.persona);
    let changed = false;
    for (const s of schedules) {
      if (s.blockedOn === change.persona) {
        s.blockedOn = null;
        if (s.enabled) {
          s.nextRunAt = new Date().toISOString();
          s.lastStatus = `re-queued (session ${change.persona} ${change.to})`;
        }
        changed = true;
      }
    }
    if (changed) persist();
  }
}

type GlobalWithCanary = typeof globalThis & {
  __testpilotCanaryTimers?: ReturnType<typeof setTimeout>[];
  __testpilotCanaryUnsub?: () => void;
};
const gc = globalThis as GlobalWithCanary;

/** (Re)arm the canary: one listener + timers per Node process, newest module wins. */
export function startSessionCanary(): void {
  for (const t of gc.__testpilotCanaryTimers ?? []) clearTimeout(t);
  gc.__testpilotCanaryTimers = [];
  gc.__testpilotCanaryUnsub?.();
  gc.__testpilotCanaryUnsub = onSessionChange((c) => handleSessionChange(c));
  if (!canaryOpts.enabled) {
    setCanaryStatus({ enabled: false, nextRunAt: null });
    return;
  }
  const armedAt = Date.now();
  const first = setTimeout(() => {
    setCanaryStatus({ nextRunAt: new Date(armedAt + CANARY_EVERY_MS).toISOString() });
    void runSessionCanary("startup").catch(() => {});
  }, CANARY_FIRST_DELAY_MS);
  const every = setInterval(() => {
    setCanaryStatus({ nextRunAt: new Date(Date.now() + CANARY_EVERY_MS).toISOString() });
    void runSessionCanary("interval").catch(() => {});
  }, CANARY_EVERY_MS);
  first.unref?.();
  every.unref?.();
  gc.__testpilotCanaryTimers = [first, every as unknown as ReturnType<typeof setTimeout>];
  setCanaryStatus({ enabled: true, everyHours: CANARY_EVERY_MS / 3_600_000, nextRunAt: new Date(Date.now() + CANARY_FIRST_DELAY_MS).toISOString() });
}

// ── Ticker ─────────────────────────────────────────────────────────────────

function fireDue(): void {
  const now = Date.now();
  let changed = false;
  for (const s of schedules) {
    if (!s.enabled || !s.nextRunAt) continue;
    if (new Date(s.nextRunAt).getTime() > now) continue;
    try {
      const run = startRun({ framework: s.framework, mode: "command", script: s.script, env: s.env ?? undefined });
      s.lastRunAt = new Date(now).toISOString();
      s.lastRunId = run.id;
      s.lastStatus = "started";
      s.nextRunAt = new Date(computeNextRun(s.cadence, now)).toISOString();
      changed = true;
      watchRunForAlert(s, run.id); // post a Slack completion summary (pass or fail) when this run finishes
    } catch (e) {
      const err = e as RunnerError;
      if (err.status === 409) {
        // A run is in progress — leave nextRunAt in the past so we retry next tick.
        if (s.lastStatus !== "skipped (busy)") {
          s.lastStatus = "skipped (busy)";
          changed = true;
        }
      } else {
        s.lastStatus = `error: ${(e as Error).message}`.slice(0, 120);
        // Don't hammer on a hard error — re-arm to the next slot.
        s.nextRunAt = new Date(computeNextRun(s.cadence, now)).toISOString();
        changed = true;
      }
    }
    // Start at most one run per tick (runner is one-at-a-time anyway).
    if (s.lastStatus === "started") break;
  }
  if (changed) persist();
}

// One ticker per Node process, always pointing at the newest module instance
// (Vite re-imports on restart — avoid piling up intervals).
type GlobalWithSched = typeof globalThis & { __testpilotSchedulerTimer?: ReturnType<typeof setInterval> };
const g = globalThis as GlobalWithSched;

export function startScheduler(): void {
  load();
  if (g.__testpilotSchedulerTimer) clearInterval(g.__testpilotSchedulerTimer);
  g.__testpilotSchedulerTimer = setInterval(fireDue, 30_000);
  g.__testpilotSchedulerTimer.unref?.();
  startSessionCanary(); // I1 built-in session canary (6h + once at start-up)
}
