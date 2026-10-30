// Unit tests for the V2a Asana intake parser + TM upsert (pure; crafted inputs only —
// no Asana calls). Run: npm run test:intake
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIntakePack, caseKeysFromSpec, extractCaseKey, parseNotes, planAsanaUpsert, type IntakeTask, type LooseTmState } from "./intake";

const task = (over: Partial<IntakeTask>): IntakeTask => ({
  gid: "100",
  name: "QA — PR #237: QuickBooks App Store Silver listing",
  notes: "",
  html_notes: "",
  completed: false,
  permalink_url: "https://app.asana.com/0/0/100",
  parent: null,
  memberships: [{ project: { gid: "9", name: "Go Live" }, section: null }],
  custom_fields: [],
  created_by: { gid: "7", name: "Dev Person" },
  ...over,
});

test("extractCaseKey: spec regex at the start of the title, needs a digit", () => {
  assert.equal(extractCaseKey("SL-T1-01 Disconnect QuickBooks"), "SL-T1-01");
  assert.equal(extractCaseKey("SL-T1-01: Disconnect"), "SL-T1-01");
  assert.equal(extractCaseKey("[LP-252-01] Woo BACS"), "LP-252-01");
  assert.equal(extractCaseKey("IAM-TRIG-24 — custom event"), "IAM-TRIG-24");
  assert.equal(extractCaseKey("QA-ONLY notes"), null);
  assert.equal(extractCaseKey("Fix the SL-T1-01 bug"), null);
  assert.equal(extractCaseKey("sl-t1-01 lower"), null);
});

test("caseKeysFromSpec reads @case:<KEY> from tags and title", () => {
  assert.deepEqual(caseKeysFromSpec("L1 trademark notice @case:SL-L1-01", ["@silver-listing"]), ["SL-L1-01"]);
  assert.deepEqual(caseKeysFromSpec("plain", ["@case:SL-D2-01", "@case:SL-D3-01"]), ["SL-D2-01", "SL-D3-01"]);
  assert.deepEqual(caseKeysFromSpec("plain", ["@smoke"]), []);
});

test("parseNotes: sections, bullets, inline numbered steps, devices", () => {
  const p = parseNotes(
    [
      "Context line here.",
      "Steps:",
      "1. Open the dashboard",
      "2. Click Disconnect",
      "   and confirm the dialog",
      "Expected: LedgerPort removed from My Apps",
      "Pass criteria:",
      "- No error toast",
      "Devices: iPhone 15, Pixel 8 / iPad",
      "Do not file:",
      "- The 1-minute delay is by design",
    ].join("\n"),
  );
  assert.deepEqual(p.steps, ["Open the dashboard", "Click Disconnect and confirm the dialog"]);
  assert.deepEqual(p.expected, ["LedgerPort removed from My Apps"]);
  assert.deepEqual(p.pass, ["No error toast"]);
  assert.deepEqual(p.devices, ["iPhone 15", "Pixel 8", "iPad"]);
  assert.deepEqual(p.doNotFile, ["The 1-minute delay is by design"]);
  assert.deepEqual(p.notes, ["Context line here."]);
  const q = parseNotes("Steps: 1) Do A. 2) Do B. 3) Do C.");
  assert.equal(q.steps.length, 3);
});

test("buildIntakePack: cases from subtasks, flags imperatives verbatim, scope gaps, redacts secrets", () => {
  const pack = buildIntakePack({
    task: task({
      notes: [
        "Please run this on prod after staging passes.",
        "Use this token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdEFGHijkl",
        "Details in https://awesomemotive.slack.com/archives/D01ABCDEF/p1234",
        "Tracker: https://claude.ai/code/artifact/5912d92a-be83-4418-9d4e-b7e255fa0901",
        "Video: https://d.pr/v/AbCd12",
        "Known behaviours:",
        "- Intuit may take ~1 min to drop the app",
      ].join("\n"),
    }),
    subtasks: [
      task({ gid: "201", name: "SL-T1-01 Disconnect revokes at Intuit (P0)", notes: "Steps:\n1. Disconnect\nExpected: gone from My Apps\nPost the result to #qa-automation", permalink_url: "u201" }),
      task({ gid: "202", name: "SL-S1-01 Cache-Control no-store", notes: "", completed: true, permalink_url: "u202" }),
      task({ gid: "203", name: "Write up findings", notes: "Approve the Shopify charge", permalink_url: "u203" }),
    ],
    stories: [{ gid: "s1", created_at: "2026-10-01T00:00:00Z", type: "comment", created_by: { gid: "7", name: "Dev Person" }, text: "Not a bug: the banner flickers once.\nSend the report to qa@example.com" }],
    attachments: [{ gid: "a1", name: "repro.mov", resource_subtype: "asana", host: "asana", created_at: "2026-10-01T00:01:00Z" }],
  });
  assert.equal(pack.cases.length, 3);
  assert.equal(pack.stats.keyed, 2);
  const c1 = pack.cases[0];
  assert.equal(c1.caseKey, "SL-T1-01");
  assert.equal(c1.title, "Disconnect revokes at Intuit (P0)");
  assert.equal(c1.priority, "critical");
  assert.deepEqual(c1.steps, ["Disconnect"]);
  assert.equal(pack.cases[1].completed, true);
  assert.equal(pack.productGuess.productId, "lp-api");

  const rules = pack.flaggedImperatives.map((f) => f.rule);
  for (const r of ["run-on-production", "use-this-secret", "secret-shaped-value", "post-to", "approve", "send-to"]) assert.ok(rules.includes(r), `missing flag ${r}`);
  // Verbatim (but redacted) text — never the raw JWT.
  const all = JSON.stringify(pack);
  assert.ok(!all.includes("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0"), "JWT leaked into the pack");
  assert.ok(pack.flaggedImperatives.some((f) => f.text === "Please run this on prod after staging passes."));

  const kinds = pack.scopeIncomplete.map((g) => g.kind);
  for (const k of ["slack", "claude-artifact", "video", "video-attachment", "no-steps"]) assert.ok(kinds.includes(k as never), `missing scope ${k}`);
  assert.ok(pack.scopeIncomplete.find((g) => g.kind === "slack")!.reason.includes("DM"));
  assert.ok(pack.questionForAuthor && pack.questionForAuthor.startsWith("Hi Dev"));
  assert.ok(pack.knownBehaviours.some((k) => k.includes("Intuit may take")));
  assert.ok(pack.knownBehaviours.some((k) => k.startsWith("[comment] Not a bug")));
});

test("single keyed subtask imports as one case in its parent's suite", () => {
  const pack = buildIntakePack({
    task: task({ gid: "201", name: "SL-T1-02 Shared company", parent: { gid: "100", name: "QA — PR #237" }, notes: "Steps:\n- a" }),
    subtasks: [],
    stories: [],
    attachments: [],
  });
  assert.equal(pack.cases.length, 1);
  assert.equal(pack.suiteGid, "100");
  assert.equal(pack.suiteName, "QA — PR #237");
});

test("planAsanaUpsert: binds seeded keys, creates the rest, idempotent on re-run", () => {
  const state: LooseTmState = {
    suites: [{ id: "suite-lp-api", name: "LedgerPort QuickBooks Connector", parentId: null, productId: "lp-api", order: 0 }],
    cases: [
      {
        id: "seedcase-lppr237-sl-t1-01", key: "SL-T1-01", title: "Curated title", description: "curated", suiteId: "suite-lp-pr237", priority: "critical",
        automation: "manual", steps: [{ step: "curated", expected: "curated" }], tags: ["pr237"], review: "approved", lastRunStatus: "passed", runs: 2,
        source: "seed", createdBy: "x", createdAt: "t", updatedAt: "t", comments: [], history: [],
      },
    ],
    seq: { case: 10 },
    activity: [],
  };
  const pack = buildIntakePack({
    task: task({}),
    subtasks: [
      task({ gid: "201", name: "SL-T1-01 Disconnect", notes: "Steps:\n- x", permalink_url: "u201" }),
      task({ gid: "202", name: "SL-S1-01 Cache", notes: "Steps:\n- y", permalink_url: "u202" }),
      task({ gid: "203", name: "Untitled check", notes: "Steps:\n- z", permalink_url: "u203" }),
    ],
    stories: [],
    attachments: [],
  });
  const r1 = planAsanaUpsert(state, pack, { productId: "lp-api", actor: "QA", now: "2026-10-12T00:00:00.000Z" });
  assert.deepEqual(r1.counts, { create: 2, update: 0, bind: 1 });
  const bound = r1.next.cases.find((c) => c.id === "seedcase-lppr237-sl-t1-01")!;
  assert.equal(bound.title, "Curated title", "bind must keep curated content");
  assert.equal(bound.externalRef?.gid, "201");
  assert.equal(bound.runs, 2);
  const created = r1.next.cases.find((c) => c.id === "asana-202")!;
  assert.equal(created.key, "SL-S1-01");
  assert.equal(created.suiteId, "asana-suite-100");
  assert.equal(r1.next.cases.find((c) => c.id === "asana-203")!.key, "TC-11");
  const suite = r1.next.suites.find((s) => s.id === "asana-suite-100")!;
  assert.equal(suite.parentId, "suite-lp-api");
  assert.equal(suite.name, pack.suiteName);
  assert.equal(state.cases.length, 1, "input state must not be mutated");

  const r2 = planAsanaUpsert(r1.next, pack, { productId: "lp-api", actor: "QA", now: "2026-10-12T01:00:00.000Z" });
  assert.deepEqual(r2.counts, { create: 0, update: 2, bind: 1 });
  assert.equal(r2.next.cases.length, r1.next.cases.length);
  assert.equal(r2.next.suites.length, r1.next.suites.length);
  assert.equal(r2.next.seq!.case, 11);
});

test("activity html escapes Asana titles", () => {
  const pack = buildIntakePack({ task: task({ name: "<img src=x onerror=alert(1)>" }), subtasks: [task({ gid: "201", name: "AB-1 x", notes: "Steps:\n- a" })], stories: [], attachments: [] });
  const r = planAsanaUpsert({ suites: [], cases: [], seq: {} }, pack, { productId: null, actor: "QA", now: "2026-10-12T00:00:00.000Z" });
  assert.ok(!r.next.activity![0].html.includes("<img"));
});

test("parseNotes: Asana rich-text plain rendering (label + 4-space-indented items)", () => {
  const notes = [
    "For the tester",
    "",
    "Priority: P1. Why: reviewers check this.",
    "",
    "Setup (ready, checked 2026-10-01)    One business on the company.",
    "Steps    Open the dashboard.",
    "    Click Disconnect. Confirm.",
    "    Refresh My Apps.",
    "Pass    Dashboard shows disconnected.",
    "    App gone from My Apps.",
    "Fail    Any error toast.",
    "Pass, developer half    Server log shows the revoke line.",
    "Postman alternative: DELETE {{baseUrl}}/x with {{token}} → 200.",
    "----------",
    "For AI assistants",
    "",
    "    Ref: T1. Service.method does the thing.",
  ].join("\n");
  const p = parseNotes(notes);
  assert.deepEqual(p.preconditions, ["One business on the company."]);
  assert.deepEqual(p.steps, ["Open the dashboard.", "Click Disconnect. Confirm.", "Refresh My Apps."]);
  assert.deepEqual(p.pass, ["Dashboard shows disconnected.", "App gone from My Apps.", "Server log shows the revoke line."]);
  assert.deepEqual(p.fail, ["Any error toast."]);
  assert.ok(p.notes.some((n) => n.startsWith("Postman alternative")));
  assert.ok(p.notes.some((n) => n.startsWith("Ref: T1")));
  assert.equal(p.agentSection, true);
});

test("scrub is prose-safe but removes real secret shapes", async () => {
  const { scrub } = await import("./intake");
  assert.equal(scrub("logs token revocation failed at Intuit"), "logs token revocation failed at Intuit");
  assert.equal(scrub("the URL has no tempToken= and no code="), "the URL has no tempToken= and no code=");
  assert.equal(scrub("GET {{baseUrl}}/cb?code={{code}}&state=bogus"), "GET {{baseUrl}}/cb?code={{code}}&state=bogus");
  assert.ok(!scrub("Authorization: Bearer abcdEFGH1234ijklMNOP5678").includes("abcdEFGH1234"));
  assert.ok(!scrub("token ghp_abcdefghijklmnopqrstuvwxyz0123456789").includes("ghp_abcdef"));
  assert.ok(!scrub("?access_token=AbC123dEf456GhI789").includes("AbC123dEf456"));
  assert.ok(!scrub("password: Hunter2Hunter2").includes("Hunter2Hunter2"));
});
