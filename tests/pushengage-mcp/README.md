# PushEngage MCP QA: custom-audience targeting (PR #287)

Automates the Asana task "QA: Custom-audience targeting in the MCP" for
awesomemotive/pushengage-sdks#287. **Run it locally, against a PushEngage TEST site.**

## How it works

```
prompt ──► Claude (API) ──► MCP server under test (stdio) ──► PushEngage test site
                                      ▲
harness verifies here ────────────────┘  (list/get notification tools, not Claude's reply)
```

- Claude gets the MCP's real tools and a plain-English prompt, as in Claude Desktop.
  So the test covers both the tool schema and how well Claude can build `subscriber_filter`.
- The harness, not Claude, decides what may run. Read-only tools (`list_*`, `get_*`) always run.
  Send tools run only with `PE_MCP_ALLOW_SEND=1`. Everything else (create, update, delete, pause) is blocked.
- After each case the harness diffs the notification list (before and after), reads each new
  notification back through the MCP, and checks its saved audience.
- Tool names are discovered from the server. A send tool is any tool whose schema has
  `subscriber_filter`. Run the build check to see what was detected.

## Setup

1. Build and pack the PR branch of `pushengage-mcp` following its `docs/QA.md`.
   **Bump the prerelease version before packing**, because npx caches by version.
2. `npm install` in this repo. It adds `@modelcontextprotocol/sdk`.
3. Fill the `PushEngage MCP QA` block in `.env` (template in `.env.example`):
   - `PE_MCP_COMMAND` / `PE_MCP_ARGS`: how to start the build. For example:
     - `PE_MCP_COMMAND=node` and `PE_MCP_ARGS=/path/to/pushengage-mcp/dist/index.js`
     - `PE_MCP_COMMAND=npx` and `PE_MCP_ARGS=-y /path/to/pushengage-mcp-0.4.0-qa.3.tgz`
   - The MCP's own API-key variable, for the **QA Staging site (51041)** only. The whole `.env` is passed to the server.
   - `PE_MCP_SITE_ID=51041` and `PE_MCP_SITE_NAME=QA Staging`. Claude is told to use only this site, and any tool call naming another site id is blocked.
   - `ANTHROPIC_API_KEY`, or be logged in with `ant auth login`.
   - Fixtures: `PE_MCP_SEGMENT_1`, `PE_MCP_SEGMENT_2`, `PE_MCP_PAUSED_SEGMENT`, `PE_MCP_ATTRIBUTE_NAME`,
     `PE_MCP_ATTRIBUTE_VALUE`, `PE_MCP_COUNTRY_1`, `PE_MCP_COUNTRY_2`, and optionally `PE_MCP_AUDIENCE_GROUP`.
     A case whose fixtures are unset is skipped and the report says which ones are missing.

## Run, in this order

```bash
npm run test:mcp:selftest   # offline check of the harness itself (fake server, no keys)
npm run test:mcp:build      # confirms the PR build; writes test-results/pushengage-mcp/tools.json
npm run test:mcp:dry        # Claude runs every case, sends are BLOCKED; checks the filters it built
npm run test:mcp:b9         # the critical case, live
npm run test:mcp:live       # everything, live: REAL pushes to the test site
```

To run one case: `npx playwright test -c playwright-mcp.config.js --grep "A7 "`.

## Results

- `test-results/pushengage-mcp/mcp-287-<run>.md` is a pass/fail table you can paste into Asana.
- `mcp-287-<run>.jsonl` holds every prompt, every tool call with its arguments and result, the new
  notification ids, and the saved audience for each.
- `npx playwright show-report playwright-report/pushengage-mcp` opens the HTML report. Each case has its JSON attached.
- Each push is titled `[QA-287 <case>] <run>`, so you can find it in the dashboard.

## What each kind of case checks

| Kind | Cases | Passes when |
|---|---|---|
| read | A1–A3 | `pushengage_list_audience_filter_values` was called, returned data, and the data includes your fixture values |
| send | A4–A12, C2 | dry run: the send call's `subscriber_filter` names the expected values. Live: exactly one new notification, its saved audience holds those values, and it is **not** All Subscribers |
| refuse | B1–B4, B9 | the bad value actually reached the send tool **and** no notification was created. Live only |
| record | B5, B6 | never fails; records what happened. B6 is the known gap: a misspelled country sends and reaches nobody |
| all | C1 | an explicit All Subscribers send still works |

**B9** fails with `ESCALATE` if a misspelled segment produced a notification targeting All Subscribers.
If you see that, stop and escalate, as the brief says.

## Limits (read before trusting a green run)

- **Case list.** Only A1, B6 and B9 come from the brief. The rest were written from its scope
  (segment, attribute, location, device, browser, dates, counts). Remap them to the PR's own A/B/C list in `cases.js`.
- **Audience check.** The saved-audience check reads the notification back through the MCP's
  get-notification tool and matches values in its JSON. If the build has no such tool, or its reply
  has no audience fields, the case **fails** and tells you to check the dashboard. It never passes unverified.
- **Unknown response shapes.** The "All Subscribers" detector is a heuristic built without seeing a real
  API response. Run one targeted send and one C1 send live, and compare them with the dashboard before trusting it.
- **Claude's choices.** Claude may build a filter you didn't expect, for example a date instead of "30 days".
  The JSONL shows exactly what it sent, so you can tell an MCP bug apart from a prompt that needs tightening.
- **Refusal fallback.** Requests use the server-side refusal fallback. If your account or SDK rejects it,
  set `PE_MCP_FALLBACKS=off`.
- **Pushes are real.** Live sends can't be undone. Never point this at a production site.
