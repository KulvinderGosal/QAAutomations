// V1 "Honest verdict floor" — derive ONE five-state verdict for a finished
// runner run from the evidence it left behind (Playwright JSON report, else the
// Playwright stdout summary lines, else just the exit code).
//
// The floor, in one sentence: a run that executed nothing is never a pass.
//   • executed == 0                      → BLOCKED (SESSION / ENV / … / HARNESS)
//   • any skip of a test tagged @case:KEY → BLOCKED (that case was not verified)
//   • >20% of tests skipped (fixme excluded) → BLOCKED (skip budget)
//   • a qa-core BlockedError message ("[BLOCKED:<CLS>…] … -- human action: …")
//     in a failure / global-setup output → BLOCKED{<CLS>}, never a product FAIL
//   • a real failing test                → FAIL
//   • passed, but some skips / flakes    → PASS_WITH_GAPS
//   • cancelled                          → NOT_RUN
//
// Pure module: no Node / Playwright imports, so it is unit-testable with
// `node --import tsx --test` and could be shared with the UI.
import { parseBlockedMessage, type BlockedClass } from "../../../packages/qa-core/errors";

export type VerdictState = "PASS" | "PASS_WITH_GAPS" | "FAIL" | "BLOCKED" | "NOT_RUN";

export type VerdictCounts = {
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  /** expected + unexpected + flaky — tests that actually ran to an outcome. */
  executed: number;
};

/** Where the counts came from — "exit-code" means no per-test evidence existed. */
export type VerdictSource = "json" | "stdout" | "exit-code" | "none";

export type Verdict = {
  state: VerdictState;
  cls?: BlockedClass;
  code?: string;
  reason: string;
  humanAction?: string;
  counts: VerdictCounts;
  source: VerdictSource;
  /** @case:<KEY> tests that skipped (each one forces BLOCKED). */
  caseSkips?: string[];
  /** Failures whose message was a qa-core BlockedError (not product defects). */
  blockedFailures?: number;
  /** Failures excluded as infrastructure (browser launch/crash; navigation while the host slept). */
  infraFailures?: number;
  /** Wall-clock time the host spent asleep during the run (only set above the threshold). */
  hostSleptMs?: number;
  /** 2 when the runner auto-retried a BLOCKED{HARNESS} attempt. */
  attempts?: number;
  /** The first attempt's verdict, when this one is the auto-retry. */
  firstAttempt?: { state: VerdictState; cls?: BlockedClass; reason: string };
  derivedAt?: string;
};

/** Skips above this fraction of the run (fixme excluded) block the verdict. */
export const SKIP_BUDGET = 0.2;

/** Host sleep above this (wall-clock vs monotonic drift) marks the run's timing as unreliable. */
export const HOST_SLEEP_THRESHOLD_MS = 60_000;
// Infrastructure failures — never product defects: the browser never started or died.
const INFRA_BROWSER =
  /browserType\.launch|Executable doesn't exist|Failed to launch|Target page, context or browser has been closed|[Bb]rowser (?:has been )?(?:closed|disconnected)|Target closed/;
// Navigation / network errors count as infrastructure ONLY when the host provably slept
// during the run; otherwise a page that won't load is a real outage and stays a failure.
// Includes WebKit/Firefox wordings and plain test/fixture timeouts, which a sleeping host
// produces en masse (2026-10-12: 282 × WebKit "Internet connection appears to be offline").
const INFRA_NAV =
  /page\.goto: (?:Timeout|net::ERR_|NS_ERROR_)|net::ERR_[A-Z_]+|NS_ERROR_[A-Z_]+|NS_BINDING_ABORTED|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|getaddrinfo|Internet connection appears to be offline|Could not connect to the server|network connection was lost|hostname could not be found|Test timeout of \d+ms exceeded/;

export type BlockedHit = { cls: BlockedClass; code?: string; reason: string; humanAction: string };

/** Everything the verdict needs, extracted from one report / output. */
export type ReportFacts = {
  counts: VerdictCounts;
  source: "json" | "stdout";
  /** Skip that counts toward the budget (test.skip / did-not-run; NOT test.fixme). */
  budgetSkips: number;
  /** Skip annotation descriptions (deduped, ANSI-stripped). */
  skipReasons: string[];
  /** Skipped tests tagged @case:<KEY>. */
  caseSkips: { key: string; reason: string }[];
  /** Failures carrying a qa-core BlockedError marker. */
  blockedFailures: BlockedHit[];
  /** First line of each real (non-blocked) failure. */
  realFailures: string[];
  /** Errors outside any test (global setup, config load, worker crash). */
  topLevelErrors: string[];
  noTestsFound: boolean;
};

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
export const stripAnsi = (s: string) => s.replace(ANSI, "");

const CASE_TAG = /@?case:([\w.-]+)/i;
/** A Playwright code-frame line prefix: "  6 | " or "> 5 | ". */
const CODE_FRAME_LINE = /^\s*>?\s*\d+\s*\|/;

const zeroCounts = (): VerdictCounts => ({ expected: 0, unexpected: 0, flaky: 0, skipped: 0, executed: 0 });

/** Every qa-core BlockedError marker in a blob of text (deduped). */
export function findBlockedMarkers(text: string | null | undefined): BlockedHit[] {
  if (!text) return [];
  const clean = stripAnsi(text);
  const hits: BlockedHit[] = [];
  const seen = new Set<string>();
  let i = clean.indexOf("[BLOCKED:");
  while (i !== -1 && hits.length < 20) {
    // Skip markers that are only SOURCE CODE quoted in an error's code frame
    // ("  6 | throw new Error('[BLOCKED:…')") — Playwright prints the lines
    // around a failure, so a real failure next to a blocked test would otherwise
    // read as blocked.
    const lineStart = clean.lastIndexOf("\n", i) + 1;
    const inCodeFrame = CODE_FRAME_LINE.test(clean.slice(lineStart, i));
    const hit = inCodeFrame ? null : parseBlockedMessage(clean.slice(i, i + 2000));
    if (hit) {
      const key = `${hit.cls}|${hit.code ?? ""}|${hit.reason}|${hit.humanAction}`;
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({ cls: hit.cls, code: hit.code, reason: hit.reason, humanAction: hit.humanAction });
      }
    }
    i = clean.indexOf("[BLOCKED:", i + 9);
  }
  return hits;
}

// Keyword classes, checked in this order (spec: SESSION, then ENV, else HARNESS;
// FIXTURE/DEPLOY added for the obvious "not provisioned / not deployed" skips).
const CLASS_RULES: { cls: BlockedClass; code: string; re: RegExp }[] = [
  {
    cls: "SESSION",
    code: "session",
    re: /\b(?:log(?:ged)?[ -]?(?:in|out)|sign[ -]?in|session|storage[ -]?state|auth(?:enticat\w*|:capture)?|unauthori[sz]ed|401|token (?:expired|missing|invalid)|credentials?)\b|\.auth\//i,
  },
  {
    cls: "ENV",
    code: "network",
    re: /(ENOTFOUND|EAI_AGAIN|getaddrinfo|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_|\bDNS\b|cloudflare|cf[-_]chl|just a moment|turnstile|captcha|\b50[234]\b|bad gateway|service unavailable|network (?:error|unreachable)|unreachable|socket hang up)/i,
  },
  { cls: "DEPLOY", code: "not-deployed", re: /\bnot (?:yet )?deployed\b|deploy-only/i },
  { cls: "FIXTURE", code: "fixture", re: /not[- ]provisioned|\bfixture\b|no (?:test )?(?:store|site|account|data) (?:configured|found|available)/i },
];

/** Classify free text (skip reasons, global-setup errors) into a BLOCKED class. */
export function classifyText(text: string | null | undefined): { cls: BlockedClass; code: string } | null {
  if (!text) return null;
  for (const r of CLASS_RULES) if (r.re.test(text)) return { cls: r.cls, code: r.code };
  return null;
}

// Drop the list reporter's per-test lines ("  ✓  3 file › title") before
// classifying raw output, so a test TITLE like "login page" can't read as SESSION.
const LIST_TEST_LINE = /^\s+[✓✘×\-·°~]\s+\d+\s/;
function outputForClassification(output: string): string {
  return stripAnsi(output)
    .split("\n")
    .filter((l) => !LIST_TEST_LINE.test(l))
    .join("\n")
    .slice(-20_000);
}

// ── Facts from a Playwright JSON report ────────────────────────────────────

type JAnn = { type?: string; description?: string };
type JResult = { status?: string; error?: { message?: string }; errors?: { message?: string }[]; annotations?: JAnn[] };
type JTest = { status?: string; expectedStatus?: string; annotations?: JAnn[]; results?: JResult[] };
type JSpec = { title?: string; file?: string; tags?: string[]; tests?: JTest[] };
type JSuite = { suites?: JSuite[]; specs?: JSpec[] };
type JReport = {
  stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number };
  suites?: JSuite[];
  errors?: { message?: string; stack?: string }[];
};

export function factsFromJsonReport(json: unknown): ReportFacts {
  const data = (json ?? {}) as JReport;
  const counts: VerdictCounts = {
    expected: data.stats?.expected ?? 0,
    unexpected: data.stats?.unexpected ?? 0,
    flaky: data.stats?.flaky ?? 0,
    skipped: data.stats?.skipped ?? 0,
    executed: 0,
  };
  counts.executed = counts.expected + counts.unexpected + counts.flaky;

  const skipReasons = new Set<string>();
  const caseSkips: ReportFacts["caseSkips"] = [];
  const blockedFailures: BlockedHit[] = [];
  const realFailures: string[] = [];
  let budgetSkips = 0;

  const walk = (s: JSuite) => {
    for (const spec of s.specs ?? []) {
      const title = spec.title ?? "";
      const tags = [...(spec.tags ?? []), ...(title.match(/@[\w:.-]+/g) ?? [])];
      const caseKey = tags.map((t) => CASE_TAG.exec(t)?.[1]).find(Boolean) ?? null;
      for (const t of spec.tests ?? []) {
        const anns = [...(t.annotations ?? []), ...(t.results ?? []).flatMap((r) => r.annotations ?? [])];
        if (t.status === "skipped") {
          const reason = stripAnsi(
            anns.find((a) => (a.type === "skip" || a.type === "fixme") && a.description)?.description ?? "",
          ).trim();
          if (reason) skipReasons.add(reason);
          const fixmeOnly = anns.some((a) => a.type === "fixme") && !anns.some((a) => a.type === "skip");
          if (!fixmeOnly) budgetSkips++;
          if (caseKey) caseSkips.push({ key: caseKey, reason });
        } else if (t.status === "unexpected") {
          const msgs = (t.results ?? []).flatMap((r) => [r.error?.message, ...(r.errors ?? []).map((e) => e.message)]);
          const first = stripAnsi(msgs.find((m) => !!m) ?? "failed");
          const marker = msgs.map((m) => findBlockedMarkers(m)[0]).find(Boolean);
          if (marker) blockedFailures.push(marker);
          else realFailures.push(`${title}: ${first.split("\n")[0].slice(0, 200)}`);
        }
      }
    }
    for (const x of s.suites ?? []) walk(x);
  };
  for (const s of data.suites ?? []) walk(s);

  const topLevelErrors = (data.errors ?? [])
    .map((e) => stripAnsi(e.message ?? e.stack ?? "").trim())
    .filter(Boolean);
  const noTestsFound = topLevelErrors.some((m) => /No tests found/i.test(m));

  return {
    counts,
    source: "json",
    budgetSkips,
    skipReasons: [...skipReasons],
    caseSkips,
    blockedFailures,
    realFailures,
    topLevelErrors,
    noTestsFound,
  };
}

// ── Facts from Playwright's stdout (command mode with the framework's own reporters) ──

const SUMMARY_LINE = /^\s*(\d+)\s+(passed|failed|flaky|skipped|did not run|interrupted)\b/;
const TOPLEVEL_LINE = /^\s*(\d+)\s+errors?\s+(?:was|were)\s+not\s+a\s+part\s+of\s+any\s+test/i;

/**
 * Parse Playwright's end-of-run summary ("N passed", "N skipped", "N failed",
 * "N flaky", "No tests found") out of raw output. Sums every summary block, so
 * an npm script that chains several `playwright test` calls is counted whole.
 * Returns null when the output has no Playwright summary at all.
 */
export function factsFromStdout(output: string | null | undefined): ReportFacts | null {
  if (!output) return null;
  const lines = stripAnsi(output).split("\n");
  const counts = zeroCounts();
  let found = false;
  let noTestsFound = false;
  let interrupted = 0;
  const topLevelErrors: string[] = [];
  const caseSkips: ReportFacts["caseSkips"] = [];
  for (const line of lines) {
    if (/^\s*(?:Error:\s*)?No tests found\b/i.test(line)) {
      noTestsFound = true;
      found = true;
      continue;
    }
    const top = TOPLEVEL_LINE.exec(line);
    if (top) {
      topLevelErrors.push(line.trim());
      found = true;
      continue;
    }
    const m = SUMMARY_LINE.exec(line);
    if (m) {
      const n = parseInt(m[1], 10);
      found = true;
      if (m[2] === "passed") counts.expected += n;
      else if (m[2] === "failed") counts.unexpected += n;
      else if (m[2] === "flaky") counts.flaky += n;
      else if (m[2] === "interrupted") interrupted += n;
      else counts.skipped += n; // skipped | did not run
      continue;
    }
    // List reporter prints a skipped test as "  -  3 file:line › title @case:KEY".
    if (/^\s+-\s+\d+\s/.test(line)) {
      const key = CASE_TAG.exec(line)?.[1];
      if (key) caseSkips.push({ key, reason: "" });
    }
  }
  if (!found) return null;
  counts.executed = counts.expected + counts.unexpected + counts.flaky;
  if (interrupted) topLevelErrors.push(`${interrupted} test(s) interrupted`);
  const blocked = findBlockedMarkers(output);
  return {
    counts,
    source: "stdout",
    budgetSkips: counts.skipped,
    skipReasons: [],
    caseSkips,
    // stdout can't tie a marker to a test, so markers only matter when no real
    // failure is reported — see deriveVerdict.
    blockedFailures: counts.unexpected > 0 ? blocked.slice(0, counts.unexpected) : [],
    realFailures: [],
    topLevelErrors,
    noTestsFound,
  };
}

// ── The verdict ──────────────────────────────────────────────────────────────

export type VerdictHints = {
  /** Exact command a human runs to refresh this framework's saved login. */
  sessionAction?: string;
  /**
   * false = the framework has NO saved login (e.g. a public marketing site), so a
   * keyword match on "login"/"auth" in its output can't mean an expired session —
   * it falls back to HARNESS. Explicit qa-core BlockedError markers still win.
   */
  hasSavedLogin?: boolean;
  /** Framework label, for reasons. */
  label?: string;
};

export type DeriveVerdictInput = {
  facts: ReportFacts | null;
  exitCode: number | null;
  /** Raw combined stdout+stderr of the attempt (global-setup errors live here). */
  output?: string;
  cancelled?: boolean;
  /** Set when the runner itself killed the run (TestPilot shut down / restarted). */
  interrupted?: string | null;
  /** Wall-clock minus monotonic elapsed time: how long the host slept during the run. */
  hostSleptMs?: number | null;
  spawnError?: string | null;
  /**
   * "playwright" (default): the floor applies. "exit-code": a non-Playwright
   * harness (Maestro flow / iOS run-case.sh) with no per-test counts.
   */
  harness?: "playwright" | "exit-code";
  /** For "exit-code" harnesses: one flow/case per run (true) vs an npm script (false). */
  singleCase?: boolean;
  /** For "exit-code" single cases: exit 0 is a real assertion pass (Maestro) vs launch-only (iOS). */
  exitZeroAsserts?: boolean;
  hints?: VerdictHints;
  now?: string;
};

function defaultAction(cls: BlockedClass, hints?: VerdictHints): string {
  switch (cls) {
    case "SESSION":
      return hints?.sessionAction ?? "Re-capture the framework's saved login (npm run auth:capture — run by the user), then re-run";
    case "ENV":
      return "Check the target environment is reachable (DNS / Cloudflare challenge / staging up), then re-run";
    case "DEPLOY":
      return "Confirm the change under test is deployed to the target environment, then re-run";
    case "FIXTURE":
      return "Provision the test data / store / account the skipped tests need, then re-run";
    default:
      return "Open the run output: check browsers are installed, the spec path / grep matches tests, and global setup succeeds; then re-run";
  }
}

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

export function deriveVerdict(input: DeriveVerdictInput): Verdict {
  const { facts, exitCode, hints } = input;
  const derivedAt = input.now ?? new Date().toISOString();
  const counts = facts?.counts ?? zeroCounts();
  const source: VerdictSource = facts?.source ?? (input.harness === "exit-code" ? "exit-code" : "none");
  const base = { counts, source, derivedAt };

  // Keyword classification, minus SESSION for frameworks that have no saved login
  // (a "login"/"auth" word in a public site's output is not an expired session).
  const keywordClass = (text: string | null | undefined) => {
    const c = classifyText(text);
    return c && c.cls === "SESSION" && hints?.hasSavedLogin === false ? null : c;
  };

  const blocked = (
    cls: BlockedClass,
    reason: string,
    extra?: Partial<Verdict> & { humanAction?: string; code?: string },
  ): Verdict => ({
    state: "BLOCKED",
    cls,
    reason,
    ...base,
    ...extra,
    humanAction: extra?.humanAction ?? defaultAction(cls, hints),
  });

  // 1. Never started / cancelled.
  if (input.spawnError)
    return blocked("HARNESS", `Runner could not start the process: ${input.spawnError}`, { code: "spawn" });
  if (input.interrupted) return { state: "NOT_RUN", reason: input.interrupted, humanAction: "Re-run it", ...base };
  if (input.cancelled) return { state: "NOT_RUN", reason: "Run was cancelled before it finished", ...base };

  // 2. Non-Playwright harnesses (Maestro / iOS Simulator): exit code is all we have.
  if (input.harness === "exit-code" && !facts) {
    const one = !!input.singleCase;
    const c: VerdictCounts = one
      ? { expected: exitCode === 0 ? 1 : 0, unexpected: exitCode === 0 ? 0 : 1, flaky: 0, skipped: 0, executed: 1 }
      : zeroCounts();
    const marker = findBlockedMarkers(input.output)[0];
    if (marker) return blocked(marker.cls, marker.reason, { humanAction: marker.humanAction, code: marker.code, counts: c, source: "exit-code" });
    if (exitCode !== 0)
      return { state: "FAIL", reason: `Harness exited ${exitCode ?? "without a code"}`, counts: c, source: "exit-code", derivedAt };
    if (one && input.exitZeroAsserts) return { state: "PASS", reason: "Flow passed (exit 0)", counts: c, source: "exit-code", derivedAt };
    return {
      state: "PASS_WITH_GAPS",
      reason: one
        ? "Exit 0 only — this harness reports no assertions (the case verdict comes from its own state check)"
        : "Exit 0 only — this script reports no per-test counts",
      counts: c,
      source: "exit-code",
      derivedAt,
    };
  }

  const out = input.output ?? "";
  const outputMarkers = findBlockedMarkers(out);
  // Split out infrastructure failures (browser launch/crash always; navigation errors
  // only when the host slept during the run) — they are not product defects.
  const slept = (input.hostSleptMs ?? 0) > HOST_SLEEP_THRESHOLD_MS;
  const sleepNote = slept ? `the host slept ~${Math.round((input.hostSleptMs ?? 0) / 60_000)} min during the run` : "";
  const realList: string[] = [];
  let infraBrowser = 0;
  let infraNav = 0;
  for (const f of facts?.realFailures ?? []) {
    if (INFRA_BROWSER.test(f)) infraBrowser++;
    else if (slept && INFRA_NAV.test(f)) infraNav++;
    else realList.push(f);
  }
  const infra = infraBrowser + infraNav;
  const realFailures = facts
    ? facts.source === "json"
      ? // stats.unexpected is authoritative: a failure the walk could not tie to a
        // spec (unusual report shape) is still a failure, never a "harness" block.
        Math.max(realList.length, counts.unexpected - facts.blockedFailures.length - infra)
      : Math.max(0, counts.unexpected - facts.blockedFailures.length - infra)
    : 0;
  const blockedFailures = facts?.blockedFailures ?? [];
  const infraExtras = { infraFailures: infra || undefined, hostSleptMs: slept ? (input.hostSleptMs ?? undefined) : undefined };
  const awakeAction = "Keep the Mac awake for the whole run (plugged in, lid open, or start it under `caffeinate -dimsu`), then re-run";

  // 3. Real product failures win over everything below (a defect is a defect).
  if (realFailures > 0) {
    const first = realList[0];
    const notes = [
      blockedFailures.length ? `+${blockedFailures.length} blocked` : "",
      infra ? `+${infra} infrastructure failures excluded` : "",
      sleepNote,
    ].filter(Boolean);
    return {
      state: "FAIL",
      reason: `${plural(realFailures, "test")} failed${first ? ` — ${first}` : ""}${notes.length ? ` (${notes.join("; ")})` : ""}`,
      ...base,
      // Failures after a sleep may be artefacts too — say so instead of overclaiming.
      humanAction: slept ? `Results after the sleep are unreliable. ${awakeAction}` : undefined,
      blockedFailures: blockedFailures.length || undefined,
      ...infraExtras,
    };
  }

  // 3b. Only infrastructure failures (no product failure) → BLOCKED, never FAIL.
  if (infra > 0) {
    const parts = [
      infraBrowser ? `${infraBrowser} browser launch/crash` : "",
      infraNav ? `${infraNav} navigation while the host slept` : "",
    ].filter(Boolean);
    return blocked(
      slept && infraNav >= infraBrowser ? "ENV" : "HARNESS",
      `0 product failures — ${plural(infra, "test")} failed on infrastructure (${parts.join(", ")})${sleepNote ? `; ${sleepNote}` : ""}`,
      {
        code: slept ? "host-sleep" : "browser-launch",
        humanAction: slept
          ? awakeAction
          : "The browser could not start — close memory-heavy apps or run `npx playwright install` in the framework, then re-run",
        blockedFailures: blockedFailures.length || undefined,
        ...infraExtras,
      },
    );
  }

  // 4. Failures that were qa-core BlockedErrors → BLOCKED{cls}, never FAIL.
  if (blockedFailures.length > 0) {
    const b = blockedFailures[0];
    return blocked(b.cls, `${plural(blockedFailures.length, "test")} blocked: ${b.reason}`, {
      humanAction: b.humanAction,
      code: b.code,
      blockedFailures: blockedFailures.length,
    });
  }

  // 5. Nothing executed → BLOCKED, never PASS.
  if (counts.executed === 0) {
    const marker =
      findBlockedMarkers((facts?.topLevelErrors ?? []).join("\n"))[0] ??
      findBlockedMarkers((facts?.skipReasons ?? []).join("\n"))[0] ??
      outputMarkers[0];
    if (marker)
      return blocked(marker.cls, `0 tests executed — ${marker.reason}`, { humanAction: marker.humanAction, code: marker.code });
    const what = !facts
      ? `no Playwright result (no JSON report or summary line; exit ${exitCode ?? "?"})`
      : facts.noTestsFound
        ? "No tests found (spec path / --grep matched nothing)"
        : counts.skipped > 0
          ? `all ${plural(counts.skipped, "test")} skipped`
          : `0 tests executed (exit ${exitCode ?? "?"})`;
    const cl =
      keywordClass((facts?.skipReasons ?? []).join("\n")) ??
      keywordClass((facts?.topLevelErrors ?? []).join("\n")) ??
      keywordClass(outputForClassification(out));
    const firstReason = facts?.skipReasons[0] ?? facts?.topLevelErrors[0]?.split("\n")[0];
    const reason = `${what}${firstReason ? ` — ${firstReason.slice(0, 200)}` : ""}`;
    if (facts?.noTestsFound) return blocked("HARNESS", reason, { code: "no-tests-found" });
    return blocked(cl?.cls ?? "HARNESS", reason, { code: cl?.code ?? "zero-executed" });
  }

  // 6. A skipped @case test means that case was NOT verified.
  if (facts && facts.caseSkips.length > 0) {
    const keys = [...new Set(facts.caseSkips.map((c) => c.key))];
    const why = facts.caseSkips.find((c) => c.reason)?.reason ?? "";
    const cl = keywordClass(why) ?? keywordClass(facts.skipReasons.join("\n"));
    return blocked(cl?.cls ?? "HARNESS", `@case test skipped: ${keys.slice(0, 5).join(", ")}${why ? ` — ${why.slice(0, 200)}` : ""}`, {
      code: "case-skipped",
      caseSkips: keys,
    });
  }

  // 7. Skip budget: >20% of the run skipped (fixme excluded) is not a pass.
  const total = counts.executed + counts.skipped;
  if (facts && total > 0 && facts.budgetSkips / total > SKIP_BUDGET) {
    const pct = Math.round((facts.budgetSkips / total) * 100);
    const cl = keywordClass(facts.skipReasons.join("\n"));
    return blocked(
      cl?.cls ?? "HARNESS",
      `Skip budget exceeded: ${facts.budgetSkips}/${total} tests skipped (${pct}% > ${SKIP_BUDGET * 100}%)${
        facts.skipReasons[0] ? ` — ${facts.skipReasons[0].slice(0, 200)}` : ""
      }`,
      { code: "skip-budget" },
    );
  }

  // 8. Non-zero exit with no failing test: an error outside any test (global
  //    setup/teardown, a spec file that failed to load, a chained script).
  if (exitCode !== 0) {
    const marker = findBlockedMarkers((facts?.topLevelErrors ?? []).join("\n"))[0] ?? outputMarkers[0];
    if (marker) return blocked(marker.cls, marker.reason, { humanAction: marker.humanAction, code: marker.code });
    const first = facts?.topLevelErrors[0]?.split("\n")[0];
    return blocked(
      "HARNESS",
      `Exited ${exitCode ?? "without a code"} with no failing test${first ? ` — ${first.slice(0, 200)}` : ""}`,
      { code: "nonzero-exit" },
    );
  }

  // 9. Passed — honest about any gaps.
  const gaps: string[] = [];
  if (counts.skipped) gaps.push(`${counts.skipped} skipped`);
  if (counts.flaky) gaps.push(`${counts.flaky} flaky`);
  if (gaps.length)
    return { state: "PASS_WITH_GAPS", reason: `${counts.executed} executed, ${gaps.join(", ")}`, ...base };
  return { state: "PASS", reason: `${plural(counts.executed, "test")} executed, all passed`, ...base };
}

/** "Blocked by SESSION: <human action>" — the one-line UI/notes string. */
export function verdictNote(v: Pick<Verdict, "state" | "cls" | "reason" | "humanAction"> | null | undefined): string {
  if (!v) return "";
  if (v.state === "BLOCKED") return `Blocked by ${v.cls ?? "HARNESS"}: ${v.humanAction ?? v.reason}`;
  if (v.state === "PASS_WITH_GAPS") return `Passed with gaps: ${v.reason}`;
  return v.reason;
}
