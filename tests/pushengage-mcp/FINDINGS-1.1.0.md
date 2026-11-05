# PR #287 / @pushengage/mcp 1.1.0: offline QA findings

**Build:** `pushengage-mcp-1.1.0.tgz` (from the developer, 2026-11-05)
**How it was tested:** the real 1.1.0 server was run against a local stand-in for the PushEngage API.
Its tools were called directly, and every request it would have sent was recorded. This shows exactly
what reaches the API, and whether anything is sent at all. Spec: `tests/pushengage-mcp/10-real-build-offline.spec.js`.

**Result: 15 passed, 4 failed.** The 4 failures are the findings below.

**Not yet covered:** these offline tests don't touch the real API. Live checks on QA Staging (51041) are still needed
for A1 (the real geo-segments response), the saved Audience in the dashboard, and the findings marked *needs live*.

---

## Passed ✅

| Case | What was checked |
|---|---|
| **B9** | Misspelled segment → `[VALIDATION] Could not resolve the audience filter, so nothing was sent`. **No request was made.** |
| B9 variants | One good + one misspelled segment, `op: all`, `op: nin`, and the A/B send tool: all refused, nothing sent |
| B9 variants | Unknown numeric segment id, and a name matching two segments: refused |
| A4 | Segment name is resolved to its id; name matching ignores case and spacing |
| A6, A12 | Attribute rule and combined segment + country + device rules are sent exactly as given |
| B1 | Unknown attribute key → refused |
| B2 | Invalid device (`smartfridge`) → refused, with the valid list |
| B3 (partial) | Non-date text (`banana`) and bare numbers on `ts_*` → refused |
| Rules | Operator matrix (`country` + `eq`), `key` on a non-attribute field, empty rule group, `audience_groups` + `subscriber_filter` together, timezone abbreviation `IST` → all refused |
| Timezone | `Asia/Kolkata` 2026-01-01 00:00 → sent as `2025-12-31 18:30:00` UTC, and the conversion is reported |
| A1 (shape) | The geo-segments response becomes per-field value lists sorted by subscriber count. *The real API shape still needs a live check.* |
| B6 | Misspelled country is sent unchanged. This is the **known gap**, recorded, not a new bug |
| C1 | No filter → request has no criteria (All Subscribers) |

---

## Findings ❌

### 1. Paused segment is accepted and sent (B5). Severity: High, *needs live confirmation*
- **Steps:** `subscriber_filter: { value: [[{ field: "segments", op: "in", value: ["Old Promo"] }]] }`, where "Old Promo" is a **paused** segment
- **Expected:** refused. The MCP's own error text says *"a paused segment cannot be targeted"*.
- **Actual:** the name resolves to its id and the notification is sent.
- **Cause (from the code):** `subscriberFilter/resolve.js` indexes every segment returned by `GET /sites/:id/segments`
  without checking `status`. Only an unknown **id** gets the "paused" wording; a paused segment's **name** resolves fine.
- **Why it matters:** the changelog says the API silently drops unresolved segment references, and that a filter reduced to nothing
  is treated as **All Subscribers**. If the API also drops paused segments, this is the same send-to-everyone bug B9 guards against.
- **Live check:** on QA Staging, send to the paused segment, then open the notification and check its Audience.
  *(Offline, the mock treated `status: 0` as paused. Confirm that's what the real API returns for a paused segment.)*

### 2. Impossible dates are accepted (B3). Severity: Medium
- **Steps:** `ts_created gt "2026-13-45"`, `ts_last_click lt "2026-02-30"`, attribute `dt_gt "2026-13-45"`
- **Expected:** refused. The changelog says `dt_gt` / `dt_lt` require an ISO 8601 date and `ts_*` comparisons require a date.
- **Actual:** all three are sent to the API unchanged. Only the *format* is checked, not whether the date exists.
- **Risk:** the API may reject the request, roll the date over, or match an unexpected set of subscribers. Check what happens live.

### 3. Negative, fractional and text counts are accepted (B4). Severity: Medium
- **Steps:** `click_count gte -3`, `sent_count gt 1.5`, `view_count gt "abc"`
- **Expected:** refused. Counts are non-negative whole numbers.
- **Actual:** all are sent. `click_count >= -3` matches **every** subscriber, which amounts to an unintended send-to-all.
  `"abc"` contradicts the changelog's claim that values are validated against the API's typing.

### 4. Inactive attributes are not checked. Severity: Low, *code observation, not tested*
- `verifyAttributeKeys` accepts any key the attribute list returns and ignores its `status` (0/1), the same pattern as finding 1.
