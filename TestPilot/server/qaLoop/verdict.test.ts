// Unit tests for the V1 verdict floor. Run: npm run test:verdict
// (node's built-in test runner via tsx — no extra dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveVerdict, factsFromJsonReport, factsFromStdout, findBlockedMarkers, verdictNote } from "./verdict";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => JSON.parse(readFileSync(path.join(here, "fixtures", `${name}.json`), "utf8")) as unknown;
const fromJson = (name: string, exitCode: number, output = "") =>
  deriveVerdict({ facts: factsFromJsonReport(fixture(name)), exitCode, output, hints: { sessionAction: "cd fw && npm run auth:capture" } });

test("0 tests (No tests found) → BLOCKED{HARNESS}, never PASS", () => {
  const v = fromJson("zero-tests", 1);
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "HARNESS");
  assert.equal(v.code, "no-tests-found");
  assert.equal(v.counts.executed, 0);
});

test("0 tests even with exit 0 → BLOCKED (the 83/85 green-with-nothing case)", () => {
  const v = deriveVerdict({ facts: factsFromJsonReport({ suites: [], errors: [], stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 } }), exitCode: 0 });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "HARNESS");
});

test("all skipped for a missing session → BLOCKED{SESSION} with the capture action", () => {
  const v = fromJson("all-skipped", 0);
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "SESSION");
  assert.equal(v.humanAction, "cd fw && npm run auth:capture");
  assert.deepEqual(v.counts, { expected: 0, unexpected: 0, flaky: 0, skipped: 2, executed: 0 });
  assert.match(verdictNote(v), /^Blocked by SESSION: cd fw && npm run auth:capture$/);
});

test("a skipped @case:<KEY> test → BLOCKED even though everything else passed (1/6 < budget)", () => {
  const v = fromJson("case-skipped", 0);
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.code, "case-skipped");
  assert.deepEqual(v.caseSkips, ["TC-42"]);
  assert.equal(v.cls, "FIXTURE"); // "store not provisioned"
  assert.equal(v.counts.executed, 5);
});

test("real pass → PASS with executed > 0", () => {
  const v = fromJson("real-pass", 0);
  assert.equal(v.state, "PASS");
  assert.equal(v.counts.executed, 3);
  assert.equal(v.source, "json");
});

test("real fail → FAIL (a real defect beats a blocked sibling)", () => {
  const v = fromJson("real-fail", 1);
  assert.equal(v.state, "FAIL");
  assert.equal(v.blockedFailures, 1);
  assert.match(v.reason, /^1 test failed — price matches API/);
  assert.ok(!v.reason.includes("\u001b")); // ANSI stripped
});

test("only BlockedError failures → BLOCKED{cls} with the error's human action, not FAIL", () => {
  const v = fromJson("blocked-failure", 1);
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "ENV");
  assert.equal(v.code, "waf");
  assert.equal(v.humanAction, "load staging once in a normal Chrome tab, then re-run");
});

test("skip budget: 2/5 skipped (40%) → BLOCKED{ENV} from the Cloudflare skip reason", () => {
  const v = fromJson("skip-budget", 0);
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.code, "skip-budget");
  assert.equal(v.cls, "ENV");
});

test("fixme skips don't burn the budget; skips/flakes → PASS_WITH_GAPS", () => {
  const v = fromJson("pass-with-gaps", 0);
  assert.equal(v.state, "PASS_WITH_GAPS");
  assert.match(v.reason, /2 skipped, 1 flaky/);
});

test("global-setup BlockedError in output with 0 tests → BLOCKED{cls} from the marker", () => {
  const out =
    "Error: [BLOCKED:SESSION/missing] .auth/state.json not found -- human action: SHOPIFY_ENV=staging npm run auth:capture in pushengage-shopify-revamped\n   at globalSetup (global-setup.ts:12)\n";
  const v = deriveVerdict({ facts: null, exitCode: 1, output: out });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "SESSION");
  assert.equal(v.code, "missing");
  assert.equal(v.humanAction, "SHOPIFY_ENV=staging npm run auth:capture in pushengage-shopify-revamped");
});

test("global-setup network error, no report → BLOCKED{ENV}", () => {
  const v = deriveVerdict({ facts: null, exitCode: 1, output: "Error: getaddrinfo ENOTFOUND staging.example.test\n" });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "ENV");
});

test("a test TITLE mentioning login doesn't make an unexplained 0-run SESSION", () => {
  const out = "Running 1 test using 1 worker\n  -  1 a.spec.ts:3:1 › login page renders\n\n  1 skipped\n";
  const v = deriveVerdict({ facts: factsFromStdout(out), exitCode: 0, output: out });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "HARNESS");
});

test("stdout summary (command mode): pass / skipped / failed / no tests found", () => {
  const pass = "Running 3 tests using 1 worker\n  ✓  1 a.spec.ts:2:1 › one (3ms)\n\n  3 passed (1.2s)\n";
  assert.equal(deriveVerdict({ facts: factsFromStdout(pass), exitCode: 0, output: pass }).state, "PASS");

  const mixed = "  2 failed\n    a.spec.ts:5:1 › fails ───\n  3 skipped\n  1 passed (703ms)\n";
  const f = factsFromStdout(mixed)!;
  assert.deepEqual(f.counts, { expected: 1, unexpected: 2, flaky: 0, skipped: 3, executed: 3 });
  assert.equal(deriveVerdict({ facts: f, exitCode: 1, output: mixed }).state, "FAIL");

  const none = "Error: No tests found\n";
  const n = deriveVerdict({ facts: factsFromStdout(none), exitCode: 1, output: none });
  assert.equal(n.state, "BLOCKED");
  assert.equal(n.code, "no-tests-found");

  const caseSkip = "  -  3 a.pw.cjs:4:1 › case skipped @case:TC-9 @smoke\n  ✓  4 x › y\n  ✓  5 x › z\n  ✓  6 x › w\n  ✓  7 x › v\n  1 skipped\n  4 passed (1s)\n";
  const cs = deriveVerdict({ facts: factsFromStdout(caseSkip), exitCode: 0, output: caseSkip });
  assert.equal(cs.state, "BLOCKED");
  assert.deepEqual(cs.caseSkips, ["TC-9"]);
});

test("stdout with no Playwright summary → null facts → BLOCKED{HARNESS} (never PASS on exit 0)", () => {
  assert.equal(factsFromStdout("> echo hi\nhi\n"), null);
  const v = deriveVerdict({ facts: null, exitCode: 0, output: "hi\n" });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "HARNESS");
});

test("non-zero exit with passing tests and an error outside any test → BLOCKED{HARNESS}", () => {
  const out = "  1 error was not a part of any test, see above for details\n  4 passed (2s)\n";
  const v = deriveVerdict({ facts: factsFromStdout(out), exitCode: 1, output: out });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.code, "nonzero-exit");
});

test("cancelled → NOT_RUN; spawn error → BLOCKED{HARNESS}", () => {
  assert.equal(deriveVerdict({ facts: null, exitCode: null, cancelled: true }).state, "NOT_RUN");
  const s = deriveVerdict({ facts: null, exitCode: null, spawnError: "ENOENT" });
  assert.equal(s.state, "BLOCKED");
  assert.equal(s.cls, "HARNESS");
});

test("exit-code harnesses (Maestro / iOS)", () => {
  const m = deriveVerdict({ facts: null, exitCode: 0, harness: "exit-code", singleCase: true, exitZeroAsserts: true });
  assert.equal(m.state, "PASS");
  assert.equal(m.counts.executed, 1);
  const i = deriveVerdict({ facts: null, exitCode: 0, harness: "exit-code", singleCase: true });
  assert.equal(i.state, "PASS_WITH_GAPS");
  const f = deriveVerdict({ facts: null, exitCode: 2, harness: "exit-code", singleCase: true });
  assert.equal(f.state, "FAIL");
  const script = deriveVerdict({ facts: null, exitCode: 0, harness: "exit-code" });
  assert.equal(script.state, "PASS_WITH_GAPS");
  assert.equal(script.counts.executed, 0);
});

test("a marker quoted in a neighbouring test's code frame is NOT a block (real PW 1.61 shape)", () => {
  const v = fromJson("codeframe-fail", 1);
  assert.equal(v.state, "FAIL");
  assert.equal(v.blockedFailures, 1);
  const out =
    "  1) a.spec.ts:5:1 › fails\n    Error: expect(received).toBe(expected)\n    > 5 | test('fails', () => {});\n      6 | throw new Error('[BLOCKED:SESSION/expired] x -- human action: y');\n\n  1 failed\n  1 passed (1s)\n";
  const s = deriveVerdict({ facts: factsFromStdout(out), exitCode: 1, output: out });
  assert.equal(s.state, "FAIL");
  assert.equal(findBlockedMarkers(out).length, 0);
});

test("findBlockedMarkers dedupes and strips ANSI", () => {
  const msg = "\u001b[31m[BLOCKED:DEVICE] no emulator -- human action: boot the emulator\u001b[39m\n";
  const hits = findBlockedMarkers(msg + msg);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].cls, "DEVICE");
  assert.equal(hits[0].humanAction, "boot the emulator");
});

test("JSON stats.unexpected the walk could not tie to a spec is still FAIL, not BLOCKED{HARNESS}", () => {
  const v = deriveVerdict({ facts: factsFromJsonReport({ stats: { expected: 2, unexpected: 1, flaky: 0, skipped: 0 }, suites: [] }), exitCode: 1 });
  assert.equal(v.state, "FAIL");
  assert.equal(v.counts.executed, 3);
});

// Regression (2026-10-12): a TestPilot restart killed a public-site run mid-flight and
// the leftover output ("login"/"auth" page names) was read as BLOCKED{SESSION} with an
// auth:capture action — for a framework that has no saved login at all.
test("a run killed by a TestPilot restart → NOT_RUN 'interrupted', never a guessed BLOCKED class", () => {
  const v = deriveVerdict({
    facts: null,
    exitCode: null,
    output: "Running 12 tests\n  ✓ 1 home › loads\n  pricing-and-auth › sign in link",
    cancelled: true,
    interrupted: "Interrupted — TestPilot restarted while this run was in progress",
    hints: { hasSavedLogin: false },
  });
  assert.equal(v.state, "NOT_RUN");
  assert.match(v.reason, /TestPilot restarted/);
  assert.equal(v.humanAction, "Re-run it");
});

test("no saved login (public site): 'login'/'auth' words in output fall back to HARNESS, not SESSION", () => {
  const out = "Error: page.goto: net::timeout waiting for sign in / auth page\n";
  const pub = deriveVerdict({ facts: null, exitCode: 1, output: out, hints: { hasSavedLogin: false } });
  assert.equal(pub.state, "BLOCKED");
  assert.equal(pub.cls, "HARNESS");
  assert.doesNotMatch(pub.humanAction ?? "", /auth:capture/);
  const authed = deriveVerdict({ facts: null, exitCode: 1, output: out, hints: { sessionAction: "cd fw && npm run auth:capture", hasSavedLogin: true } });
  assert.equal(authed.cls, "SESSION");
});

test("an explicit qa-core BlockedError marker still wins on a public site", () => {
  const out = "[BLOCKED:SESSION/waf] Cloudflare challenge on staging.ledgerport.com -- human action: open it once in your own Chrome\n";
  const v = deriveVerdict({ facts: null, exitCode: 1, output: out, hints: { hasSavedLogin: false } });
  assert.equal(v.cls, "SESSION");
  assert.match(v.humanAction ?? "", /own Chrome/);
});

// Regression (2026-10-12/13): a 5-browser smoke ran 18.4 h with the Mac asleep 16.8 h;
// ~650 browserType.launch / navigation timeouts were reported as "689 tests failed".
const rep = (fails: string[], passed = 0) => ({
  stats: { expected: passed, unexpected: fails.length, flaky: 0, skipped: 0 },
  suites: [{ specs: fails.map((m, i) => ({ title: `t${i}`, tests: [{ status: "unexpected", results: [{ error: { message: m } }] }] })) }],
});
const LAUNCH = "TimeoutError: browserType.launch: Timeout 180000ms exceeded.";
const NAV = "TimeoutError: page.goto: Timeout 30000ms exceeded.";

test("browser launch failures only → BLOCKED{HARNESS}, never FAIL", () => {
  const v = deriveVerdict({ facts: factsFromJsonReport(rep([LAUNCH, LAUNCH], 3)), exitCode: 1 });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "HARNESS");
  assert.equal(v.code, "browser-launch");
  assert.equal(v.infraFailures, 2);
});

test("real assertion failure + launch failures → FAIL counting only the real one", () => {
  const v = deriveVerdict({ facts: factsFromJsonReport(rep(["Error: expect(received).toBe(expected)", LAUNCH, LAUNCH])), exitCode: 1 });
  assert.equal(v.state, "FAIL");
  assert.match(v.reason, /^1 test failed/);
  assert.match(v.reason, /\+2 infrastructure failures excluded/);
});

test("navigation timeouts WITHOUT host sleep stay real failures (a down site is an outage)", () => {
  const v = deriveVerdict({ facts: factsFromJsonReport(rep([NAV, NAV])), exitCode: 1, hostSleptMs: 5_000 });
  assert.equal(v.state, "FAIL");
});

test("navigation timeouts while the host slept → BLOCKED{ENV host-sleep} with a keep-awake action", () => {
  const v = deriveVerdict({ facts: factsFromJsonReport(rep([NAV, NAV, LAUNCH])), exitCode: 1, hostSleptMs: 16.8 * 3_600_000 });
  assert.equal(v.state, "BLOCKED");
  assert.equal(v.cls, "ENV");
  assert.equal(v.code, "host-sleep");
  assert.match(v.humanAction ?? "", /caffeinate/);
  assert.equal(v.hostSleptMs, 16.8 * 3_600_000);
});

test("real failures + host sleep → FAIL that says results after the sleep are unreliable", () => {
  const v = deriveVerdict({ facts: factsFromJsonReport(rep(["Error: expect(locator).toBeVisible()", NAV])), exitCode: 1, hostSleptMs: 2 * 3_600_000 });
  assert.equal(v.state, "FAIL");
  assert.match(v.reason, /host slept ~120 min/);
  assert.match(v.humanAction ?? "", /unreliable/);
});

test("WebKit offline wording + test timeouts count as infrastructure only while the host slept", () => {
  const OFFLINE = "Error: page.goto: The Internet connection appears to be offline.";
  const TO = 'Test timeout of 30000ms exceeded while running "beforeEach" hook.';
  const asleep = deriveVerdict({ facts: factsFromJsonReport(rep([OFFLINE, TO])), exitCode: 1, hostSleptMs: 3_600_000 });
  assert.equal(asleep.state, "BLOCKED");
  assert.equal(asleep.code, "host-sleep");
  const awake = deriveVerdict({ facts: factsFromJsonReport(rep([OFFLINE, TO])), exitCode: 1, hostSleptMs: 0 });
  assert.equal(awake.state, "FAIL");
});
