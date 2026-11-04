/**
 * Cases for "Custom-audience targeting in the MCP" (pushengage-sdks PR #287).
 *
 * The case ids follow the Asana brief. Only A1, B6 and B9 are named there; the rest are
 * numbered here and should be remapped to the PR's own A/B/C list once you have it.
 *
 * kind:
 *   read    - read-only; Claude must call the filter-values tool and get usable data back
 *   send    - a real push; the saved notification's audience must contain `audienceTokens`
 *             and must NOT be All Subscribers
 *   refuse  - must be refused: no notification created, and the bad value must actually
 *             have reached the send tool (otherwise the case did not test anything)
 *   record  - known gap or undefined behaviour: run it and record what happened, never fail
 *   all     - regression: an explicit All Subscribers send must still go to everyone
 */
const MESSAGE = 'QA automation test for PR 287 - please ignore';

const send = (f, title, target) =>
  `Send a push notification now with title "${title}", message "${MESSAGE}" and URL ${f.url}, ` +
  `using a custom audience: ${target}.`;

const exact = 'Use the values exactly as written; do not look them up, correct them, or substitute others.';

module.exports = [
  // ---------- A. Happy paths ----------
  {
    id: 'A1',
    name: 'list location (geo) filter values returns countries',
    kind: 'read',
    tags: ['@read', '@geo'],
    needs: ['country1'],
    prompt: () =>
      'Use pushengage_list_audience_filter_values to list the location / country values I can target. ' +
      'Show me the raw list.',
    readContains: (f) => [f.country1],
    note: 'First live check of the geo-segments response shape. Empty or malformed data on a site with subscribers points at the response adapter.',
  },
  {
    id: 'A2',
    name: 'list segment filter values includes active segments',
    kind: 'read',
    tags: ['@read'],
    needs: ['segment1', 'segment2'],
    prompt: () => 'Use pushengage_list_audience_filter_values to list the segments I can target.',
    readContains: (f) => [f.segment1, f.segment2],
  },
  {
    id: 'A3',
    name: 'list attribute filter values',
    kind: 'read',
    tags: ['@read'],
    needs: ['attributeName'],
    prompt: () => 'Use pushengage_list_audience_filter_values to list the subscriber attributes I can target.',
    readContains: (f) => [f.attributeName],
  },
  {
    id: 'A4',
    name: 'send to one segment',
    kind: 'send',
    tags: ['@send'],
    needs: ['segment1'],
    prompt: (f, t) => send(f, t, `subscribers in the segment "${f.segment1}"`),
    audienceTokens: (f) => [f.segment1],
  },
  {
    id: 'A5',
    name: 'send to two segments',
    kind: 'send',
    tags: ['@send'],
    needs: ['segment1', 'segment2'],
    prompt: (f, t) => send(f, t, `subscribers in either of the segments "${f.segment1}" or "${f.segment2}"`),
    audienceTokens: (f) => [f.segment1, f.segment2],
  },
  {
    id: 'A6',
    name: 'send by subscriber attribute',
    kind: 'send',
    tags: ['@send'],
    needs: ['attributeName', 'attributeValue'],
    prompt: (f, t) => send(f, t, `subscribers whose attribute "${f.attributeName}" equals "${f.attributeValue}"`),
    audienceTokens: (f) => [f.attributeName, f.attributeValue],
  },
  {
    id: 'A7',
    name: 'send by country',
    kind: 'send',
    tags: ['@send', '@geo'],
    needs: ['country1'],
    prompt: (f, t) => send(f, t, `subscribers located in ${f.country1}`),
    audienceTokens: (f) => [f.country1],
  },
  {
    id: 'A8',
    name: 'send by device type',
    kind: 'send',
    tags: ['@send'],
    needs: ['device'],
    prompt: (f, t) => send(f, t, `subscribers on ${f.device} devices only`),
    audienceTokens: (f) => [f.device],
  },
  {
    id: 'A9',
    name: 'send by browser',
    kind: 'send',
    tags: ['@send'],
    needs: ['browser'],
    prompt: (f, t) => send(f, t, `subscribers using the ${f.browser} browser only`),
    audienceTokens: (f) => [f.browser],
  },
  {
    id: 'A10',
    name: 'send by subscription date (last 30 days)',
    kind: 'send',
    tags: ['@send'],
    needs: [],
    prompt: (f, t) => send(f, t, 'subscribers who subscribed in the last 30 days'),
    // Claude may send "30 days" or a computed date, so match the criterion type, not the number.
    audiencePattern: /subscri[a-z_]*["']?\s*:|subscription|days|since|after|date/i,
  },
  {
    id: 'A11',
    name: 'send by click count (clicked at least 1)',
    kind: 'send',
    tags: ['@send'],
    needs: [],
    prompt: (f, t) => send(f, t, 'subscribers who have clicked at least 1 notification'),
    audiencePattern: /click/i,
  },
  {
    id: 'A12',
    name: 'send with combined segment + country + device',
    kind: 'send',
    tags: ['@send', '@geo'],
    needs: ['segment1', 'country1', 'device'],
    prompt: (f, t) => send(f, t, `subscribers in segment "${f.segment1}", located in ${f.country1}, on ${f.device} devices`),
    audienceTokens: (f) => [f.segment1, f.country1, f.device],
  },

  // ---------- B. Error validation ----------
  {
    id: 'B1',
    name: 'nonexistent attribute is refused',
    kind: 'refuse',
    tags: ['@refuse'],
    needs: [],
    badValue: () => 'qa_no_such_attribute_287',
    prompt: (f, t) => send(f, t, 'subscribers whose attribute "qa_no_such_attribute_287" equals "yes"') + ' ' + exact,
  },
  {
    id: 'B2',
    name: 'invalid device type is refused',
    kind: 'refuse',
    tags: ['@refuse'],
    needs: [],
    badValue: () => 'smartfridge',
    prompt: (f, t) => send(f, t, 'subscribers on "smartfridge" devices') + ' ' + exact,
  },
  {
    id: 'B3',
    name: 'invalid subscription date is refused',
    kind: 'refuse',
    tags: ['@refuse'],
    needs: [],
    badValue: () => '2026-13-45',
    prompt: (f, t) => send(f, t, 'subscribers who subscribed after the date "2026-13-45"') + ' ' + exact,
  },
  {
    id: 'B4',
    name: 'negative click count is refused',
    kind: 'refuse',
    tags: ['@refuse'],
    needs: [],
    badValue: () => '-3',
    prompt: (f, t) => send(f, t, 'subscribers who clicked at least -3 notifications') + ' ' + exact,
  },
  {
    id: 'B5',
    name: 'paused segment (record behaviour)',
    kind: 'record',
    tags: ['@record'],
    needs: ['pausedSegment'],
    prompt: (f, t) => send(f, t, `subscribers in the segment "${f.pausedSegment}"`) + ' ' + exact,
    note: 'Expected behaviour for a paused segment is not stated in the brief. Compare with the PR test plan.',
  },
  {
    id: 'B6',
    name: 'misspelled country (known gap: sends, reaches nobody)',
    kind: 'record',
    tags: ['@record', '@geo'],
    needs: ['country1'],
    prompt: (f, t) => send(f, t, `subscribers located in "${f.misspelledCountry}"`) + ' ' + exact,
    note: 'Known gap: location values are not verified. Record what happened; do not file as new.',
  },
  {
    id: 'B9',
    name: 'misspelled segment is refused with nothing sent',
    kind: 'refuse',
    critical: true,
    tags: ['@refuse', '@critical'],
    needs: ['segment1'],
    badValue: (f) => f.misspelledSegment,
    prompt: (f, t) =>
      send(f, t, `subscribers in the segment "${f.misspelledSegment}"`) +
      ' ' + exact + ' If the tool rejects it, stop and report the error.',
    note: 'If a notification was created and its audience is All Subscribers: STOP and escalate.',
  },

  // ---------- C. Regression ----------
  {
    id: 'C1',
    name: 'explicit All Subscribers send still works',
    kind: 'all',
    tags: ['@send', '@regression'],
    needs: [],
    prompt: (f, t) =>
      `Send a push notification now to ALL subscribers with title "${t}", message "${MESSAGE}" and URL ${f.url}.`,
  },
  {
    id: 'C2',
    name: 'audience-group send still works',
    kind: 'send',
    tags: ['@send', '@regression'],
    needs: ['audienceGroup'],
    prompt: (f, t) =>
      `Send a push notification now to the audience group "${f.audienceGroup}" with title "${t}", ` +
      `message "${MESSAGE}" and URL ${f.url}.`,
    audienceTokens: (f) => [f.audienceGroup],
  },
];
