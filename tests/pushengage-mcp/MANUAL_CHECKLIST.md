# Manual QA checklist: Custom-audience targeting in the MCP (PR #287)

Use this when testing by hand in Claude Desktop. It covers the same cases as the automated suite.
Only A1, B6 and B9 are named in the Asana brief. Rename the others to match the PR's list once you have it.

---

## Before you start

### 1. Install the MCP in Claude Desktop, pointed at staging

> The public `@pushengage/mcp` (1.0.0) does **not** contain PR #287. We checked: it has no
> `pushengage_list_audience_filter_values` and no `subscriber_filter`. You need the PR build from the developer.

Ask the developer for two values:
- [ ] **PR build:** the package version or `.tgz` file for PR #287
- [ ] **Staging API URL:** the value for `PUSHENGAGE_API_URL` (production uses `https://dashboard-public-api.pushengage.com`)

Then:
1. Install **Node.js 18+** from https://nodejs.org
2. Open Claude Desktop, go to **Settings → Developer → Edit Config**, and add this. Replace the three `<...>` values.
   ```json
   {
     "mcpServers": {
       "pushengage-staging": {
         "command": "npx",
         "args": ["-y", "--package=/full/path/to/pushengage-mcp-1.1.0.tgz", "pushengage-mcp"],
         "env": {
           "PUSHENGAGE_DASHBOARD_URL": "https://staging-app-dashboard2.pushengage.com",
           "PUSHENGAGE_API_URL": "<staging API URL from the developer>",
           "PE_MCP_CONFIG_PATH": "/Users/<you>/.pushengage/mcp-staging.json",
           "PE_MCP_CLIENT_NAME": "Claude Desktop (QA Staging)"
         }
       }
     }
   }
   ```
   `PE_MCP_CONFIG_PATH` keeps the staging login separate from any production login. It must be a full path, with no `~`.
3. Quit Claude Desktop completely and reopen it.
4. Clear any cached old build first: run `rm -rf ~/.npm/_npx` in Terminal.

### 2. Log in, pick the site, and confirm the build
In a new Claude Desktop chat:
1. **"Log me into PushEngage."** A browser tab opens. Log in to the **staging** dashboard and click **Authorize**.
2. **"Show my PushEngage sites."** Then **"Use site 51041."**
3. **"Show my PushEngage auth status."**
   - [ ] It says you're logged in and the current site is **QA Staging (51041)**
4. **"List your PushEngage tools."**
   - [ ] The list includes **`pushengage_list_audience_filter_values`**

If the tool is missing, you're on the old build. Recheck the `args` line, clear the cache (`rm -rf ~/.npm/_npx`), and restart Claude Desktop.
**Don't continue until both checks pass.** Every send is a real push to QA Staging.

### 3. Prepare QA Staging (51041), then write the names here

| What | Name or value on QA Staging |
|---|---|
| Active segment 1 | |
| Active segment 2 | |
| Paused segment | |
| Subscriber attribute, and one known value | |
| Country 1 (has subscribers) | |
| Country 2 (has subscribers) | |
| A device type that has subscribers (e.g. mobile) | |
| A browser that has subscribers (e.g. Chrome) | |
| Audience group (for C2) | |
| Landing URL for test pushes | https://example.com |

In the prompts below, replace anything in `<angle brackets>` with these values.

### 4. How to check a result
**Don't trust Claude's reply.** "Sent to Sports Fans" isn't proof. For every send:
1. Open the staging dashboard, switch to the **QA Staging (51041)** site, and go to **Push Broadcasts**
2. Find the notification by its title (`QA-287 <case>`)
3. Open it and look at the **Audience** section
4. Take a screenshot if anything looks wrong

---

## Part 1: Read-only (sends nothing)

### A1: Location values (most load-bearing)
> Use pushengage_list_audience_filter_values to list the location / country values I can target. Show me the raw list.

- [ ] **Pass if:** the list shows real countries, including `<COUNTRY 1>` and `<COUNTRY 2>`
- [ ] **Fail if:** it's empty, errors, or looks garbled on a site that clearly has subscribers. Note it in the bug report: the developers suspect how the response is read, not the endpoint.

Result: ____________________

### A2: Segment values
> Use pushengage_list_audience_filter_values to list the segments I can target.

- [ ] **Pass if:** `<SEGMENT 1>` and `<SEGMENT 2>` are in the list

Result: ____________________

### A3: Attribute values
> Use pushengage_list_audience_filter_values to list the subscriber attributes I can target.

- [ ] **Pass if:** `<ATTRIBUTE>` is in the list

Result: ____________________

---

## Part 2: The critical case. Do this before any other send.

### B9: Misspelled segment must be refused
Take `<SEGMENT 1>` and swap two letters (e.g. *Sports Fans* becomes *Sprots Fans*).

> Send a push notification now with title "QA-287 B9", message "QA test - please ignore" and URL `<URL>`, using a custom audience: subscribers in the segment "`<MISSPELLED SEGMENT>`". Use the name exactly as written; do not look it up, correct it, or substitute another segment. If the tool rejects it, stop and report the error.

- [ ] Claude reports an error such as "segment not found", **and**
- [ ] **No notification titled "QA-287 B9"** exists in Push Broadcasts

> **STOP AND ESCALATE** if a "QA-287 B9" notification exists and its Audience shows **All Subscribers**.
> That means a targeted send silently went to everyone, which is the bug this change exists to prevent.
> Screenshot it and tell the developer and reviewers right away.

- [ ] Also check: did Claude "helpfully" fix the spelling and send to the real segment? If so, the test didn't
  test anything. Run it again and stress "use the name exactly as written".

Result: ____________________

---

## Part 3: Targeted sends (real pushes)

Each prompt starts the same way:

> Send a push notification now with title "QA-287 `<CASE>`", message "QA test - please ignore" and URL `<URL>`, using a custom audience:

followed by the audience below. For every case: **Pass if** the notification's Audience in the dashboard
shows exactly that criteria and is **not** "All Subscribers".

| Case | Add to the prompt | Dashboard Audience should show | Result |
|---|---|---|---|
| A4 | subscribers in the segment "`<SEGMENT 1>`" | Segment 1 only | |
| A5 | subscribers in either of the segments "`<SEGMENT 1>`" or "`<SEGMENT 2>`" | Both segments | |
| A6 | subscribers whose attribute "`<ATTRIBUTE>`" equals "`<VALUE>`" | That attribute = value | |
| A7 | subscribers located in `<COUNTRY 1>` | Country 1 | |
| A8 | subscribers on `<DEVICE>` devices only | That device type | |
| A9 | subscribers using the `<BROWSER>` browser only | That browser | |
| A10 | subscribers who subscribed in the last 30 days | Subscription date in the last 30 days | |
| A11 | subscribers who have clicked at least 1 notification | Clicks ≥ 1 | |
| A12 | subscribers in segment "`<SEGMENT 1>`", located in `<COUNTRY 1>`, on `<DEVICE>` devices | All three criteria together | |

---

## Part 4: Error handling (each should be refused, nothing sent)

Same prompt start as Part 3, ending with *"Use the values exactly as written; do not look them up, correct them, or substitute others."*

**Pass if** Claude reports an error **and** no notification with that title exists in the dashboard.

| Case | Add to the prompt | Result |
|---|---|---|
| B1 | subscribers whose attribute "qa_no_such_attribute_287" equals "yes" | |
| B2 | subscribers on "smartfridge" devices | |
| B3 | subscribers who subscribed after the date "2026-13-45" | *Offline: 1.1.0 sends this (finding 2). Record what the API does.* |
| B4 | subscribers who clicked at least -3 notifications | *Offline: 1.1.0 sends this, and it matches everyone (finding 3).* |

### Record only (no pass/fail, write down what happened)

| Case | Add to the prompt | What happened |
|---|---|---|
| B5 | subscribers in the segment "`<PAUSED SEGMENT>`" | **Suspected bug (offline finding 1):** 1.1.0 accepts paused segments. If it sends, open the notification. Audience showing **All Subscribers** → escalate like B9. |
| B6 | subscribers located in "`<MISSPELLED COUNTRY>`" (e.g. "Indai") | **Known gap, don't file as a new bug.** Expected: it sends and reaches nobody. Note the actual behaviour. |

---

## Part 5: Regression (old features still work)

| Case | Prompt | Pass if | Result |
|---|---|---|---|
| C1 | Send a push notification now to ALL subscribers with title "QA-287 C1", message "QA test - please ignore" and URL `<URL>`. | Audience = All Subscribers | |
| C2 | Send a push notification now to the audience group "`<AUDIENCE GROUP>`" with title "QA-287 C2", message "QA test - please ignore" and URL `<URL>`. | Audience = that audience group | |

---

## Reporting back on Asana

For each case, give:
- the case ID, and Pass, Fail or Recorded
- for failures: the prompt you used, Claude's reply, and a screenshot of the notification's Audience section

**B9 result first.** Code review is with akash-kumar-dhan and anjanish-kumar.
