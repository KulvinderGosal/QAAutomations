// @ts-check
/**
 * Runs the REAL @pushengage/mcp build (PR #287, 1.1.0) against a local stand-in for the PushEngage API
 * (fake/mock-pushengage-api.js) and calls the tools directly, without Claude. It proves what the MCP
 * would send for each case, including whether anything was sent at all. No login and no network needed.
 *
 *   PE_MCP_DIST=/path/to/package/dist/index.js npx playwright test -c playwright-mcp.config.js 10-real
 *
 * Expectations encode the correct behaviour. Cases tagged @finding failed on 1.1.0 (see the README),
 * and @needs-live cases depend on how the real API behaves, so confirm them on QA Staging.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { McpSession } = require('./lib/mcp-session');
const { resultText } = require('./lib/checks');
const mock = require('./fake/mock-pushengage-api');

const DIST = process.env.PE_MCP_DIST;
const base = { title: 'QA-287 offline', message: 'QA test', url: 'https://example.com' };
const seg = (value, op = 'in') => ({ op: 'or', value: [[{ field: 'segments', op, value }]] });
const rule = (r) => ({ op: 'or', value: [[r]] });

test.describe('Real MCP build vs mock API @offline', () => {
  test.skip(!DIST, 'set PE_MCP_DIST to the PR build\'s dist/index.js');

  let api;
  let session;

  test.beforeAll(async () => {
    api = await mock.start();
    const tokenFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pe-mcp-')), 'token.json');
    fs.writeFileSync(tokenFile, JSON.stringify({ token: 'mock', expires_at: '2099-01-01T00:00:00Z', current_site_id: mock.SITE, api_url: api.url, dashboard_url: 'http://127.0.0.1:1' }));
    session = await new McpSession({
      command: process.execPath,
      args: [DIST],
      env: { ...process.env, PE_MCP_CONFIG_PATH: tokenFile, PUSHENGAGE_API_URL: api.url },
    }).connect();
  });

  test.afterAll(async () => {
    await session?.close();
    await api?.close();
  });

  /** Call a send tool; return { isError, text, posts } where posts are the notification POSTs it made. */
  async function send(args, tool = 'pushengage_send_notification') {
    const before = api.notificationPosts().length;
    const res = await session.call(tool, { ...base, ...args });
    return { isError: Boolean(res.isError), text: resultText(res), posts: api.notificationPosts().slice(before) };
  }
  const sentFilter = (r) => r.posts[0]?.body?.notification_criteria?.filter;

  async function expectRefusedNothingSent(args, tool) {
    const r = await send(args, tool);
    expect(r.posts, `a notification was POSTed: ${JSON.stringify(sentFilter(r))}`).toHaveLength(0);
    expect(r.isError, r.text).toBe(true);
    return r;
  }

  // ---- B9 and the segment resolver ----
  test('B9 misspelled segment: refused, nothing sent @critical', async () => {
    const r = await expectRefusedNothingSent({ subscriber_filter: seg(['Sprots Fans']) });
    expect(r.text).toContain('nothing was sent');
  });
  test('B9 one good + one misspelled segment: whole send refused', async () => {
    await expectRefusedNothingSent({ subscriber_filter: seg(['Sports Fans', 'Sprots Fans']) });
  });
  test('B9 misspelled segment with op=all and op=nin: refused', async () => {
    await expectRefusedNothingSent({ subscriber_filter: seg(['Sports Fans', 'Sprots Fans'], 'all') });
    await expectRefusedNothingSent({ subscriber_filter: seg(['Sprots Fans'], 'nin') });
  });
  test('B9 on the A/B send tool: refused', async () => {
    await expectRefusedNothingSent(
      { variant_a: { ...base }, variant_b: { ...base, title: 'b' }, subscriber_filter: seg(['Sprots Fans']) },
      'pushengage_send_ab_notification',
    );
  });
  test('unknown numeric segment id and ambiguous duplicate name: refused', async () => {
    await expectRefusedNothingSent({ subscriber_filter: seg([999]) });
    await expectRefusedNothingSent({ subscriber_filter: seg(['Dup Name']) });
  });
  test('A4 segment name (any case/spacing) is resolved to its id', async () => {
    const r = await send({ subscriber_filter: seg(['  sports FANS ']) });
    expect(r.isError, r.text).toBe(false);
    expect(sentFilter(r)).toEqual(seg([101]));
  });
  test('B5 paused segment is refused @finding @needs-live', async () => {
    // The resolver's own message says "a paused segment cannot be targeted", but it indexes every
    // segment the list endpoint returns without checking status. In the mock, status 0 = paused.
    await expectRefusedNothingSent({ subscriber_filter: seg(['Old Promo']) });
  });

  // ---- Value validation (B1-B4) ----
  test('B1 unknown attribute key: refused', async () => {
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'attributes', key: 'qa_no_such', op: 'eq', value: 'yes' }) });
  });
  test('B2 invalid device: refused', async () => {
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'device', op: 'in', value: ['smartfridge'] }) });
  });
  test('B3 impossible calendar date on ts_* is refused @finding', async () => {
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'ts_created', op: 'gt', value: '2026-13-45' }) });
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'ts_last_click', op: 'lt', value: '2026-02-30' }) });
  });
  test('B3 impossible calendar date on attribute dt_gt is refused @finding', async () => {
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'attributes', key: 'plan', op: 'dt_gt', value: '2026-13-45' }) });
  });
  test('B3 non-date text and bare numbers on ts_*: refused', async () => {
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'ts_created', op: 'gt', value: 'banana' }) });
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'ts_created', op: 'gt', value: 20260101 }) });
  });
  test('B4 negative / fractional / text counts are refused @finding', async () => {
    // click_count >= -3 matches every subscriber, i.e. an accidental send-to-all.
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'click_count', op: 'gte', value: -3 }) });
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'sent_count', op: 'gt', value: 1.5 }) });
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'view_count', op: 'gt', value: 'abc' }) });
  });
  test('operator matrix, key on non-attribute field, empty group, both targeting modes: refused', async () => {
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'country', op: 'eq', value: 'India' }) });
    await expectRefusedNothingSent({ subscriber_filter: rule({ field: 'country', key: 'plan', op: 'in', value: ['India'] }) });
    await expectRefusedNothingSent({ subscriber_filter: { op: 'or', value: [[]] } });
    await expectRefusedNothingSent({ audience_groups: [1], subscriber_filter: seg(['Sports Fans']) });
    await expectRefusedNothingSent({ subscriber_filter: { timezone: 'IST', value: [[{ field: 'ts_created', op: 'gt', value: '2026-01-01' }]] } });
  });

  // ---- Happy paths and known gap ----
  test('A1 filter values: geo-segments response becomes per-field value lists', async () => {
    const res = await session.call('pushengage_list_audience_filter_values', { fields: ['country', 'device'] });
    const out = JSON.parse(resultText(res));
    expect(out.fields.country.values.map((v) => v.value)).toEqual(['India', 'United States']);
    expect(out.fields.device.values[0]).toEqual({ value: 'mobile', subscribers: 150 });
  });
  test('A6 attribute and A12 combined rules are sent as given', async () => {
    const a6 = await send({ subscriber_filter: rule({ field: 'attributes', key: 'plan', op: 'eq', value: 'gold' }) });
    expect(sentFilter(a6)).toEqual(rule({ field: 'attributes', op: 'eq', value: 'gold', key: 'plan' }));
    const combo = { op: 'or', value: [[{ field: 'segments', op: 'in', value: ['Sports Fans'] }, { field: 'country', op: 'in', value: ['India'] }, { field: 'device', op: 'in', value: ['mobile'] }]] };
    const a12 = await send({ subscriber_filter: combo });
    expect(sentFilter(a12).value[0].map((x) => x.field)).toEqual(['segments', 'country', 'device']);
    expect(sentFilter(a12).value[0][0].value).toEqual([101]);
  });
  test('timezone converts naive filter dates to UTC', async () => {
    const r = await send({ subscriber_filter: { timezone: 'Asia/Kolkata', value: [[{ field: 'ts_created', op: 'gt', value: '2026-01-01T00:00:00' }]] } });
    expect(sentFilter(r).value[0][0].value).toBe('2025-12-31 18:30:00');
  });
  test('B6 misspelled country is sent unchanged (known gap, recorded)', async () => {
    const r = await send({ subscriber_filter: rule({ field: 'country', op: 'in', value: ['Indai'] }) });
    expect(sentFilter(r)).toEqual(rule({ field: 'country', op: 'in', value: ['Indai'] }));
  });
  test('C1 no filter = All Subscribers (no criteria in the request)', async () => {
    const r = await send({});
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0].body.notification_criteria).toBeUndefined();
  });
});
