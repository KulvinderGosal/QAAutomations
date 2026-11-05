// @ts-check
/**
 * Offline self-test of the harness against fake/fake-pushengage-mcp.js. No API keys, no network.
 * Proves tool discovery, the before/after notification diff, audience read-back and the
 * All-Subscribers detector work, including on a server that has the B9 bug.
 */
const path = require('path');
const { test, expect } = require('@playwright/test');
const { McpSession, FILTER_VALUES_TOOL } = require('./lib/mcp-session');
const { resultJson, extractNotificationIds, looksLikeAllSubscribers, missingTokens, hasAudienceData } = require('./lib/checks');
const { misspell } = require('./lib/fixtures');

const FAKE = path.join(__dirname, 'fake', 'fake-pushengage-mcp.js');
const base = { title: 'selftest', message: 'm', url: 'https://example.com' };

function fakeSession(extraEnv = {}) {
  return new McpSession({ command: process.execPath, args: [FAKE], env: { ...process.env, ...extraEnv } }).connect();
}

/** Send directly (no Claude) and return the ids that appeared, plus what was saved. */
async function sendAndDiff(session, args) {
  const before = await session.recentNotificationIds();
  const res = await session.call('pushengage_send_notification', args);
  const after = await session.recentNotificationIds();
  const ids = [...after].filter((id) => !before.has(id));
  const saved = await Promise.all(ids.map((id) => session.getNotification(id)));
  return { res, ids, saved: saved.map((s) => s && s.json) };
}

test.describe('PushEngage MCP harness self-test @selftest', () => {
  test('discovers send, list, get and filter-values tools; blocks mutating tools', async () => {
    const s = await fakeSession();
    try {
      expect(s.toolNames()).toContain(FILTER_VALUES_TOOL);
      expect(s.sendTools().map((t) => t.name)).toEqual(['pushengage_send_notification']);
      expect(s.listNotificationsTool()?.name).toBe('pushengage_list_notifications');
      expect(s.getNotificationTool()?.name).toBe('pushengage_get_notification');
      expect(s.isReadOnlyTool('pushengage_list_audience_filter_values')).toBe(true);
      expect(s.isReadOnlyTool('pushengage_delete_segment')).toBe(false);
      expect(s.isSendTool('pushengage_delete_segment')).toBe(false);
    } finally {
      await s.close();
    }
  });

  test('targeted send: one new id, saved audience holds the segment, not All Subscribers', async () => {
    const s = await fakeSession();
    try {
      const { ids, saved } = await sendAndDiff(s, { ...base, subscriber_filter: { segments: ['Sports Fans'] } });
      expect(ids).toHaveLength(1);
      expect(hasAudienceData(saved[0])).toBe(true);
      expect(looksLikeAllSubscribers(saved[0])).toBe(false);
      expect(missingTokens(saved[0], ['Sports Fans'])).toEqual([]);
    } finally {
      await s.close();
    }
  });

  test('B9 on a correct server: misspelled segment is refused and nothing is created', async () => {
    const s = await fakeSession();
    try {
      const bad = misspell('Sports Fans');
      expect(bad).not.toBe('Sports Fans');
      const { res, ids } = await sendAndDiff(s, { ...base, subscriber_filter: { segments: [bad] } });
      expect(res.isError).toBe(true);
      expect(ids).toEqual([]);
    } finally {
      await s.close();
    }
  });

  test('B9 on a buggy server: the harness sees a new notification that targets All Subscribers', async () => {
    const s = await fakeSession({ FAKE_BUG: 'b9' });
    try {
      const { res, ids, saved } = await sendAndDiff(s, { ...base, subscriber_filter: { segments: [misspell('Sports Fans')] } });
      expect(res.isError).toBeFalsy();
      expect(ids).toHaveLength(1);
      expect(looksLikeAllSubscribers(saved[0])).toBe(true);
    } finally {
      await s.close();
    }
  });

  test('no get tool (as in @pushengage/mcp 1.0.0): audience is read from the list output', async () => {
    const s = await fakeSession({ FAKE_NO_GET: '1' });
    try {
      expect(s.getNotificationTool()).toBeUndefined();
      const targeted = await sendAndDiff(s, { ...base, subscriber_filter: { segments: ['Tech News'] } });
      expect(targeted.ids).toHaveLength(1);
      expect(hasAudienceData(targeted.saved[0])).toBe(true);
      expect(missingTokens(targeted.saved[0], ['Tech News'])).toEqual([]);
      // All Subscribers in list output = no criteria at all
      const all = await sendAndDiff(s, { ...base });
      expect(hasAudienceData(all.saved[0])).toBe(false);
    } finally {
      await s.close();
    }
  });

  test('checks: id extraction and All-Subscribers detection on common shapes', () => {
    expect([...extractNotificationIds({ notification_id: 7 })]).toEqual(['7']);
    expect([...extractNotificationIds({ data: [{ id: 'a' }, { id: 'b' }] })]).toEqual(['a', 'b']);
    expect([...extractNotificationIds([{ notificationId: 3 }])]).toEqual(['3']);
    expect(looksLikeAllSubscribers({ audience: 'All Subscribers' })).toBe(true);
    expect(looksLikeAllSubscribers({ send_to_all: true })).toBe(true);
    expect(looksLikeAllSubscribers({ audience_type: 'all' })).toBe(true);
    expect(looksLikeAllSubscribers({ send_to_all: false, audience_type: 'custom' })).toBe(false);
    expect(resultJson({ content: [{ type: 'text', text: '{"a":1}' }] })).toEqual({ a: 1 });
  });
});
