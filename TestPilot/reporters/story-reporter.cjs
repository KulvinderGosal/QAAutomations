// TestPilot "run story" reporter — captures a human-readable trace of what each
// test DID (step timeline + printed narrative + attachments), so the /runs/:id
// story view can replay "launched this site, filled creds, logged in, title
// appeared" after the run finishes.
//
// It's injected by the runner via `--reporter=list,json,<abs path to this file>`
// (TestPilot controls that flag for spec/smoke/full/adhoc runs) and writes ONE
// JSON file to TESTPILOT_STORY_OUTPUT. Zero dependencies (node:fs only) so it
// loads cleanly inside every framework's own Playwright. Never writes into the
// framework folders.
const fs = require("node:fs");

const strip = (s) => (s || "").replace(/\[[0-9;]*m/g, "");

// Flatten the step tree into a readable timeline. Hook/fixture wrappers (and
// their "Launch browser / Create context" plumbing) are dropped — we want the
// test's own actions: test.step titles, pw:api calls (navigate/click/fill), and
// expects.
function flatten(steps, depth, acc) {
  for (const s of steps || []) {
    if (s.category === "hook" || s.category === "fixture") continue;
    acc.push({
      title: strip(s.title).slice(0, 200),
      category: s.category || "step",
      duration: s.duration || 0,
      depth,
      error: s.error ? strip(s.error.message).split("\n")[0].slice(0, 240) : null,
    });
    if (s.steps && s.steps.length) flatten(s.steps, depth + 1, acc);
  }
  return acc;
}

class StoryReporter {
  constructor() {
    this.out = process.env.TESTPILOT_STORY_OUTPUT || "";
    this.tests = [];
  }
  onTestEnd(test, result) {
    try {
      this.tests.push({
        title: test.title,
        titlePath: typeof test.titlePath === "function" ? test.titlePath() : [],
        file: (test.location && test.location.file) || null,
        line: (test.location && test.location.line) || null,
        status: result.status,
        expected: test.expectedStatus || "passed",
        duration: result.duration || 0,
        retry: result.retry || 0,
        steps: flatten(result.steps, 0, []),
        stdout: (result.stdout || []).map((x) => strip(typeof x === "string" ? x : x.toString()).replace(/\n$/, "")),
        stderr: (result.stderr || []).map((x) => strip(typeof x === "string" ? x : x.toString()).replace(/\n$/, "")).slice(0, 40),
        error: result.error ? strip(result.error.message).slice(0, 1200) : null,
        attachments: (result.attachments || []).map((a) => ({ name: a.name, contentType: a.contentType, path: a.path || null })),
      });
    } catch {
      /* one bad test never breaks the reporter */
    }
  }
  onEnd(result) {
    if (!this.out) return;
    try {
      fs.writeFileSync(this.out, JSON.stringify({ status: result.status, tests: this.tests }));
    } catch {
      /* best-effort — the run's pass/fail never depends on this */
    }
  }
  // Never let the reporter influence the process exit code.
  printsToStdio() {
    return false;
  }
}

module.exports = StoryReporter;
