/**
 * Pure helpers for reading MCP tool results. No network, no MCP client.
 * Kept separate so the harness self-test can exercise them offline.
 */

/** Join the text parts of an MCP CallToolResult. */
function resultText(result) {
  if (!result || !Array.isArray(result.content)) return '';
  return result.content
    .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n');
}

/** Parse a tool result as JSON. Tries structuredContent, then the whole text, then each text part. */
function resultJson(result) {
  if (result && result.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent;
  }
  const whole = tryParse(resultText(result));
  if (whole !== undefined) return whole;
  for (const c of (result && result.content) || []) {
    if (c && c.type === 'text') {
      const parsed = tryParse(c.text);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
}

function tryParse(text) {
  if (typeof text !== 'string' || !text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Depth-first walk over every [key, value, parent] pair in a JSON value. */
function* walk(value, parentKey = null) {
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item, parentKey);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      yield [k, v, value];
      yield* walk(v, k);
    }
  }
}

const NOTIFICATION_ID_KEY = /^(notification_?id|notificationId)$/i;

/**
 * Collect notification ids from a tool result.
 * Picks keys named notification_id / notificationId anywhere, plus a bare `id`
 * on objects that sit in a list (the usual shape of a "list notifications" reply)
 * or at the top level of a single-object reply.
 */
function extractNotificationIds(json) {
  const ids = new Set();
  if (json === undefined || json === null) return ids;
  for (const [k, v] of walk(json)) {
    if (NOTIFICATION_ID_KEY.test(k) && (typeof v === 'string' || typeof v === 'number')) {
      ids.add(String(v));
    }
  }
  if (ids.size === 0) {
    const objects = Array.isArray(json)
      ? json
      : firstArrayOfObjects(json) || (typeof json === 'object' ? [json] : []);
    for (const o of objects) {
      if (o && typeof o === 'object' && (typeof o.id === 'string' || typeof o.id === 'number')) {
        ids.add(String(o.id));
      }
    }
  }
  return ids;
}

function firstArrayOfObjects(json) {
  if (!json || typeof json !== 'object') return null;
  for (const [, v] of walk(json)) {
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object')) return v;
  }
  return null;
}

const AUDIENCE_KEY = /audience|send_?to|target|segment|filter|criteria|subscriber/i;

/** True when the notification JSON carries some audience/targeting data at all. */
function hasAudienceData(json) {
  for (const [k, v] of walk(json)) {
    if (AUDIENCE_KEY.test(k) && v !== null && v !== undefined && v !== '') return true;
  }
  return false;
}

/**
 * Heuristic: does this notification target All Subscribers?
 * - an audience-like key whose string value starts with "all" (e.g. send_to: "all_subscribers")
 * - a boolean-ish key like send_to_all / all_subscribers set truthy
 * - any string value that is exactly "All Subscribers"
 */
function looksLikeAllSubscribers(json) {
  for (const [k, v] of walk(json)) {
    if (/send_?to_?all|^all_?subscribers$/i.test(k) && v === true) return true;
    if (typeof v === 'string') {
      if (/^all[\s_-]?subscribers$/i.test(v.trim())) return true;
      if (/^(audience|audience_?type|send_?to|target|target_?type)$/i.test(k) && /^all\b/i.test(v.trim())) {
        return true;
      }
    }
  }
  return false;
}

/** Case-insensitive check that every token appears somewhere in the JSON. Returns the missing ones. */
function missingTokens(json, tokens) {
  const haystack = JSON.stringify(json ?? '').toLowerCase();
  return tokens.filter((t) => t !== undefined && t !== null && t !== '' && !haystack.includes(String(t).toLowerCase()));
}

/** True when a JSON value contains the string anywhere (case-insensitive). */
function containsValue(json, value) {
  return JSON.stringify(json ?? '').toLowerCase().includes(String(value).toLowerCase());
}

module.exports = {
  resultText,
  resultJson,
  extractNotificationIds,
  hasAudienceData,
  looksLikeAllSubscribers,
  missingTokens,
  containsValue,
};
