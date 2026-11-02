// CI verdict — the same V1 honest verdict floor TestPilot applies locally, for a
// GitHub Actions leg. A thin wrapper over the pure `deriveVerdict`.
//
//   node --import tsx scripts/ci-verdict.ts <results.json> --leg <id> [--out verdict.json]
//
// • A missing / empty / unparseable Playwright JSON is BLOCKED{HARNESS}, never PASS.
// • Writes verdict.json, appends a table to $GITHUB_STEP_SUMMARY (when set), prints
//   `::notice title=TP_VERDICT::{json}` (TestPilot's /api/ci/status reads it back)
//   plus `::warning::` on BLOCKED.
// • Exit 1 only on FAIL — BLOCKED / NOT_RUN exit 0 (the warning carries them).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { deriveVerdict, factsFromJsonReport, type Verdict } from "../server/qaLoop/verdict";

const NO_RESULTS = "Playwright JSON results missing or empty";

export function ciVerdict(jsonText: string | null): Verdict {
  let data: unknown = null;
  if (jsonText && jsonText.trim()) {
    try {
      data = JSON.parse(jsonText);
    } catch {
      data = null;
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      state: "BLOCKED",
      cls: "HARNESS",
      code: "no-results",
      reason: NO_RESULTS,
      humanAction: "Check the leg's test step: did `playwright test` run with --reporter=list,json and PLAYWRIGHT_JSON_OUTPUT_NAME set?",
      counts: { expected: 0, unexpected: 0, flaky: 0, skipped: 0, executed: 0 },
      source: "none",
      derivedAt: new Date().toISOString(),
    };
  }
  const facts = factsFromJsonReport(data);
  // No exit code reaches this step; an error outside any test (global setup) is
  // the only "non-zero exit with no failing test" case the JSON can show.
  const exitCode = facts.counts.unexpected > 0 || facts.topLevelErrors.length > 0 ? 1 : 0;
  // CI legs are public-only (no saved login): "login"/"auth" words are not SESSION.
  return deriveVerdict({ facts, exitCode, hints: { hasSavedLogin: false } });
}

const oneLine = (s: string | undefined) => (s ?? "").replace(/[\r\n]+/g, " ").trim();

// GitHub decodes %25 / %0D / %0A in workflow-command data, so a literal "%" (e.g. "50%")
// or "%0A" in a reason would be mangled or become a newline. Escape % first.
export function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export function annotation(v: Verdict): string {
  const body = { state: v.state, cls: v.cls ?? null, executed: v.counts.executed, reason: oneLine(v.reason).slice(0, 200) };
  return `::notice title=TP_VERDICT::${escapeData(JSON.stringify(body))}`;
}

export function warningLine(v: Verdict): string {
  return `::warning title=BLOCKED (${v.cls ?? "HARNESS"})::${escapeData(oneLine(v.humanAction ?? v.reason).slice(0, 300))}`;
}

const cell = (s: string | number | undefined | null) => oneLine(String(s ?? "")).replace(/\|/g, "\\|");

export function summaryMarkdown(leg: string, v: Verdict): string {
  const c = v.counts;
  return [
    `### TestPilot verdict — ${cell(leg)}`,
    "",
    "| Leg | Verdict | Class | Executed | Passed | Failed | Flaky | Skipped | Reason |",
    "|---|---|---|---|---|---|---|---|---|",
    `| ${cell(leg)} | ${v.state} | ${cell(v.cls ?? "—")} | ${c.executed} | ${c.expected} | ${c.unexpected} | ${c.flaky} | ${c.skipped} | ${cell(v.reason)} |`,
    v.humanAction && v.state === "BLOCKED" ? `\n**Human action:** ${oneLine(v.humanAction)}` : "",
    "",
  ].join("\n");
}

export function exitCodeFor(v: Verdict): 0 | 1 {
  return v.state === "FAIL" ? 1 : 0;
}

function main(argv: string[]): number {
  const args = [...argv];
  const opt = (name: string) => {
    const i = args.indexOf(name);
    if (i === -1) return undefined;
    const val = args[i + 1];
    args.splice(i, 2);
    return val;
  };
  const leg = opt("--leg") ?? "unknown";
  const out = opt("--out") ?? "verdict.json";
  const file = args[0];
  const text = file && existsSync(file) ? readFileSync(file, "utf8") : null;
  const v = ciVerdict(text);
  writeFileSync(out, `${JSON.stringify({ leg, ...v }, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(leg, v));
  console.log(annotation(v));
  if (v.state === "BLOCKED") console.log(warningLine(v));
  return exitCodeFor(v);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
