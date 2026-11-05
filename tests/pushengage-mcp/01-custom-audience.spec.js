// @ts-check
/**
 * Custom-audience targeting in the PushEngage MCP (pushengage-sdks PR #287).
 *
 * Each case sends a natural-language prompt to Claude, which drives the MCP server under test.
 * The result is then verified straight against the MCP (list/get notification tools),
 * never from Claude's chat reply.
 *
 * Dry run (default): send tools are blocked; send cases check the subscriber_filter Claude built.
 * Live (PE_MCP_ALLOW_SEND=1): real pushes go out on the test site and the saved audience is read back.
 *
 * Run:  npx playwright test -c playwright-mcp.config.js --grep B9
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { McpSession, FILTER_VALUES_TOOL } = require('./lib/mcp-session');
const { runAgent, allowSend, MODEL } = require('./lib/agent');
const { fixtures, titleFor, missingFixtures } = require('./lib/fixtures');
const {
  resultJson,
  extractNotificationIds,
  hasAudienceData,
  looksLikeAllSubscribers,
  missingTokens,
  containsValue,
} = require('./lib/checks');
const CASES = require('./cases');

const REPORT_DIR = path.join(__dirname, '..', '..', 'test-results', 'pushengage-mcp');
// Append-only: Playwright restarts the worker after a failure, so in-memory state would be lost.
const segmentIds = new Map();
const JSONL = path.join(REPORT_DIR, `mcp-287-${fixtures.runId}.jsonl`);

test.describe('PushEngage MCP: custom-audience targeting (PR #287)', () => {
  test.skip(!McpSession.isConfigured(), 'PE_MCP_COMMAND is not set; see tests/pushengage-mcp/README.md');

  /** @type {McpSession} */
  let session;

  test.beforeAll(async () => {
    session = await new McpSession().connect();
    // Same check as the brief's "confirm the build first": a cached build lacks these.
    expect(session.toolNames(), 'stale MCP build? (rm -rf ~/.npm/_npx and repack)').toContain(FILTER_VALUES_TOOL);
    expect(session.sendTools().length, 'no tool accepts subscriber_filter; stale build?').toBeGreaterThan(0);
    // Saved criteria store segment ids, not names: map names to ids for the read-back check.
    if (session.getTool('pushengage_list_segments')) {
      const res = await session.call('pushengage_list_segments', { limit: 100 });
      for (const [k, v, parent] of walkPairs(resultJson(res))) {
        if (k === 'segment_name' && parent && parent.segment_id !== undefined) segmentIds.set(String(v).toLowerCase(), String(parent.segment_id));
      }
    }
  });

  test.afterAll(async () => {
    await session?.close();
    writeReport();
  });

  for (const c of CASES) {
    test(`${c.id} ${c.name} ${c.tags.join(' ')}`, async ({}, testInfo) => {
      const missing = missingFixtures(c.needs);
      test.skip(missing.length > 0, `set fixtures in .env: ${missing.join(', ')}`);
      const live = allowSend();
      const sends = ['send', 'refuse', 'record', 'all'].includes(c.kind);
      test.skip(c.kind === 'refuse' && !live, 'refusal cases need the real server-side check: set PE_MCP_ALLOW_SEND=1');

      const title = titleFor(c.id);
      const prompt = c.prompt(fixtures, title);
      const before = sends && live ? await session.recentNotificationIds() : null;
      const run = await runAgent(session, prompt);
      const sendCalls = run.toolCalls.filter((t) => session.isSendTool(t.name));

      let newIds = [];
      if (sends && live) {
        const after = await session.recentNotificationIds();
        newIds = before && after
          ? [...after].filter((id) => !before.has(id))
          : sendCalls.filter((t) => !t.isError).flatMap((t) => [...extractNotificationIds(resultJson(t.raw))]);
      }
      const saved = [];
      for (const id of newIds) {
        const got = await session.getNotification(id);
        saved.push({ id, json: got ? got.json : null, readable: Boolean(got) });
      }

      const entry = {
        id: c.id,
        name: c.name,
        kind: c.kind,
        mode: live ? 'live' : 'dry-run',
        model: run.model,
        title,
        prompt,
        reply: run.finalText,
        stopReason: run.stopReason,
        toolCalls: run.toolCalls.map(({ raw, ...rest }) => ({ ...rest, text: rest.text.slice(0, 4000) })),
        newNotificationIds: newIds,
        savedNotifications: saved,
        note: c.note,
        verdict: 'pending',
      };
      await testInfo.attach(`${c.id}.json`, { body: JSON.stringify(entry, null, 2), contentType: 'application/json' });
      if (c.note) testInfo.annotations.push({ type: 'note', description: c.note });
      for (const id of newIds) testInfo.annotations.push({ type: 'notification', description: `${id} (${title})` });

      try {
        if (c.kind === 'read') checkRead(c, run);
        else if (c.kind === 'refuse') checkRefuse(c, sendCalls, newIds, saved, before !== null);
        else if (c.kind === 'record') entry.recorded = describeOutcome(sendCalls, newIds, saved);
        else if (!live) checkDryRunSend(c, sendCalls);
        else checkLiveSend(c, sendCalls, newIds, saved);
        entry.verdict = c.kind === 'record' ? 'recorded' : 'pass';
      } catch (err) {
        entry.verdict = 'fail';
        entry.failure = String(err.message || err).slice(0, 2000);
        throw err;
      } finally {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
        fs.appendFileSync(JSONL, JSON.stringify(entry) + '\n');
      }
    });
  }
});

/** Read cases: the filter-values tool ran, returned data, and that data includes the known fixture values. */
function checkRead(c, run) {
  const calls = run.toolCalls.filter((t) => t.name === FILTER_VALUES_TOOL);
  expect(calls.length, `${FILTER_VALUES_TOOL} was never called`).toBeGreaterThan(0);
  const ok = calls.filter((t) => !t.isError);
  expect(ok.length, `every ${FILTER_VALUES_TOOL} call errored: ${calls.map((t) => t.text).join(' | ')}`).toBeGreaterThan(0);
  const combined = ok.map((t) => t.text).join('\n');
  expect(combined.replace(/[\s[\]{}]/g, '').length, 'filter values came back empty').toBeGreaterThan(0);
  const missing = missingTokens(combined, c.readContains(fixtures));
  expect(missing, `known values missing from ${FILTER_VALUES_TOOL} output`).toEqual([]);
}

/** Refusal cases: the bad value reached a send tool, and no notification exists afterwards. */
function checkRefuse(c, sendCalls, newIds, saved, listDiffed) {
  const bad = c.badValue(fixtures);
  const exercised = sendCalls.filter((t) => containsValue(t.args, bad));
  expect(
    exercised.length,
    `inconclusive: "${bad}" never reached a send tool (calls: ${sendCalls.map((t) => t.name).join(', ') || 'none'})`,
  ).toBeGreaterThan(0);

  // In PushEngage's list output an All Subscribers send has no `criteria` at all.
  const toEveryone = saved.filter((s) => s.json && (looksLikeAllSubscribers(s.json) || !hasAudienceData(s.json)));
  if (toEveryone.length) {
    throw new Error(
      `ESCALATE ${c.id}: notification ${toEveryone.map((s) => s.id).join(', ')} was created and targets ALL SUBSCRIBERS. ` +
        'A targeted send silently became a send-to-everyone. Stop testing and report it.',
    );
  }
  expect(newIds, `a notification was created for an invalid audience: ${newIds.join(', ')}`).toEqual([]);
  if (!listDiffed) {
    // No list tool: fall back to the send tool's own response.
    for (const t of exercised) {
      const ids = [...extractNotificationIds(resultJson(t.raw))];
      expect(ids, `${t.name} returned a notification id for an invalid audience`).toEqual([]);
    }
  }
}

/** Dry run: Claude called a send tool and the subscriber_filter it built names the expected values. */
function checkDryRunSend(c, sendCalls) {
  expect(sendCalls.length, 'Claude never called a send tool').toBeGreaterThan(0);
  const last = sendCalls[sendCalls.length - 1];
  const filter = last.args?.subscriber_filter;
  if (c.kind === 'all') {
    expect(isEmptyFilter(filter), `All Subscribers send carried a subscriber_filter: ${JSON.stringify(filter)}`).toBe(true);
    return;
  }
  if (c.id === 'C2') return; // audience-group send uses its own argument, not subscriber_filter
  expect(filter, `${last.name} was called without subscriber_filter`).toBeTruthy();
  expectAudience(c, filter, 'subscriber_filter');
}

/** Live: exactly one notification created, readable, not All Subscribers, and holding the expected criteria. */
function checkLiveSend(c, sendCalls, newIds, saved) {
  expect(sendCalls.length, 'Claude never called a send tool').toBeGreaterThan(0);
  expect(newIds.length, `expected exactly one new notification; send results: ${sendCalls.map((t) => t.text).join(' | ')}`).toBe(1);
  const [n] = saved;
  if (!n.readable) {
    throw new Error(`could not read notification ${n.id} back through the MCP; open it in the dashboard and check its Audience.`);
  }
  if (c.kind === 'all') {
    expect(looksLikeAllSubscribers(n.json) || !hasAudienceData(n.json), 'regression send did not go to All Subscribers').toBe(true);
    return;
  }
  expect(hasAudienceData(n.json), `notification ${n.id} came back with no audience fields; check the dashboard`).toBe(true);
  expect(looksLikeAllSubscribers(n.json), `notification ${n.id} was saved as ALL SUBSCRIBERS`).toBe(false);
  expectAudience(c, n.json, `saved audience of ${n.id}`);
}

function expectAudience(c, json, label) {
  if (c.audienceTokens) {
    // A token counts as present if it, or the segment id it names, appears.
    const missing = missingTokens(json, c.audienceTokens(fixtures)).filter((t) => {
      const id = segmentIds.get(String(t).toLowerCase());
      return !(id && JSON.stringify(json).includes(id));
    });
    expect(missing, `values missing from ${label}`).toEqual([]);
  }
  if (c.audiencePattern) {
    expect(JSON.stringify(json), `${label} does not look like ${c.audiencePattern}`).toMatch(c.audiencePattern);
  }
}

function* walkPairs(value) {
  if (Array.isArray(value)) for (const v of value) yield* walkPairs(v);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      yield [k, v, value];
      yield* walkPairs(v);
    }
  }
}

function isEmptyFilter(filter) {
  if (filter === undefined || filter === null) return true;
  if (typeof filter !== 'object') return false;
  return Object.values(filter).every((v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0));
}

function describeOutcome(sendCalls, newIds, saved) {
  if (!sendCalls.length) return 'no send tool was called';
  const last = sendCalls[sendCalls.length - 1];
  if (last.blocked) return `dry run; Claude built: ${JSON.stringify(last.args?.subscriber_filter)}`;
  if (!newIds.length) return `refused / not sent: ${last.text.slice(0, 300)}`;
  return saved
    .map((s) => `created ${s.id}; all-subscribers=${s.json ? looksLikeAllSubscribers(s.json) : 'unknown'}`)
    .join('; ');
}

function writeReport() {
  if (!fs.existsSync(JSONL)) return;
  const report = fs.readFileSync(JSONL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const stamp = fixtures.runId;
  const rows = report.map((r) => {
    const detail = r.failure || r.recorded || (r.newNotificationIds.length ? `notification ${r.newNotificationIds.join(', ')}` : '');
    return `| ${r.id} | ${r.name} | ${r.mode} | **${r.verdict}** | ${String(detail).replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 300)} |`;
  });
  const md = [
    `# PushEngage MCP PR #287: custom-audience QA run ${stamp}`,
    '',
    `Model: ${MODEL}. Mode: ${allowSend() ? 'live (real pushes)' : 'dry run (sends blocked)'}.`,
    '',
    '| Case | What | Mode | Result | Detail |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'Live sends: spot-check each notification\'s Audience section in the dashboard (search the title `[QA-287 <case>]`).',
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, `mcp-287-${stamp}.md`), md);
}
