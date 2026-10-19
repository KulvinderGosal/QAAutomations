# Onboarding Wizard — Manual QA Execution Checklist

> Auto-generated from `cases.json` by `scripts/gen-onboarding-checklist.js`. Do not hand-edit —
> record results in the **Result** line under each case, or in the artifact's shared results DB.
> Source: Onboarding Wizard QA Plan artifact (8efe9d52) v1789988893-5fc6

**Environment:** `https://staging-app-dashboard2.pushengage.com/`  
**PRs:** FE [pushengage-app#1014](https://github.com/awesomemotive/pushengage-app/pull/1014) · BE [pushengage-adonis-node-api#407](https://github.com/awesomemotive/pushengage-adonis-node-api/pull/407)  
**Deploy order:** backend → run free-plan migration → frontend

**Totals:** 148 cases — 48 P0 · 88 P1 · 12 P2 (115 FE · 33 BE)

## ⛔ Two hard prerequisites (skip = whole flow breaks)

1. **Free-plan migration** — run `node ace migrate:free_plan_segments` on the backend before testing free accounts. Without it, free users get `403 Your account does not have access to this feature` the moment the wizard creates a segment (see case **N1 / N10**).
2. **`GOOGLE_GENERATIVE_AI_API_KEY`** set on the backend. Without it every AI response returns `fallback: true` with generic content — not a bug, but "AI-curated" cases are untestable. Confirm with one `site-analysis` call returning `fallback:false`.

> **`fallback: true` is never an error.** Model failure, a busy per-site lock, and the hourly/daily cap all return HTTP 200 with usable default content. The wizard must never show an error for it.

## Priority legend

| | Meaning |
|---|---|
| **P0** | Release blocker — core path of a track, a data-writing action, or a regression on an existing paid feature. |
| **P1** | Must pass before release; a fix can land as a follow-up commit. |
| **P2** | Polish, copy, or edge. Log and move on. |

## Before you start — accounts, sites & fixtures

- [ ] **Backend deployed with the OnboardingAi module, Redis reachable, GOOGLE_GENERATIVE_AI_API_KEY set** — Confirm with one curl to site-analysis returning fallback:false at least once.
- [ ] **Free-plan migration applied: node ace migrate:free_plan_segments** — Command output must list 0 shared permission groups skipped. Keep the output for case N1.
- [ ] **Owner account A on the Free plan (admin user level, email verified)** — Used for quota, plan-gate and upgrade-popup cases.
- [ ] **Owner account B on Business or higher (admin)** — Used to prove paid plans are unaffected by the new caps and that gated workflows unlock.
- [ ] **A non-admin sub-user on account B** — For the 403 cases on the five new routes and the sub-user smoke test.
- [ ] **A Shopify-connected account, plus one normal site on it** — For the per-site Shopify gate and the Shopify default audience-group seeding case.
- [ ] **Site 1: live, https, PushEngage installed correctly (WordPress if possible)** — Happy-path install check and platform detection.
- [ ] **Site 2: live, https, no PushEngage code** — Fail-panel cases. Ideally a Shopify or Wix storefront for detection.
- [ ] **Site 3: live, running PushEngage under a different site key** — The foreign-install case (D7, O6). A second account's snippet on a test page is enough.
- [ ] **Site 4: created before 2026-08-05 with an http:// site_url · Site 5: created after with http://** — The preview subdomain cutoff (pushengage.com vs trypushengage.com) in L2 and D11.
- [ ] **Android fixture: Firebase service-account JSON + Sender ID · iOS fixture: .p12 push certificate + password (one valid, one expired)** — Credential forms in the App Push track and on Settings › Installation › Mobile.
- [ ] **A real Play package name (e.g. com.whatsapp) and an App Store URL with /id…** — app-analysis matched-store cases.
- [ ] **Browser devtools open with Network + Application (localStorage) tabs, and a GTM preview or dataLayer watcher** — Many cases assert on requests, localStorage keys or events.
- [ ] **Safari available for one pass** — The subdomain cutoff parses a MySQL timestamp; Safari is the browser where that historically returns NaN.

## Progress tracker (fill as you go)

| Group | Cases | Passed | Failed | Blocked | Notes |
|---|---|---|---|---|---|
| B · Entry points and routing | 11 | | | | |
| C · Channel picker and reconfigure | 5 | | | | |
| D · Web track — Install step | 13 | | | | |
| E · Web track — Analyzing and Popup Design | 10 | | | | |
| F · Audiences and Automations | 13 | | | | |
| G · Summary and completion | 4 | | | | |
| H · Chat Widget track | 9 | | | | |
| I · App Push track | 10 | | | | |
| J · Resume checklist, banner and persistence | 9 | | | | |
| K · Settings › Installation (reused bodies) | 12 | | | | |
| L · Side effects on existing frontend screens | 11 | | | | |
| M · Backend API contracts (direct calls) | 13 | | | | |
| N · Plan quotas and the free-plan migration | 10 | | | | |
| O · Backend shared-module regressions | 10 | | | | |
| P · Telemetry | 4 | | | | |
| R · Responsive, visual and accessibility | 4 | | | | |
| **TOTAL** | **148** | | | | |

---

## Test cases

### B · Entry points and routing

_How a user reaches the wizard and how the app frame behaves around it._

#### B1 — Add new site lands directly in the wizard  `P0` `FE`

_Steps:_
1. Settings › Sites › Add new site with a valid https URL
2. Submit

_Expected:_ No "Site created successfully" modal. URL is `/onboarding` showing "What do you want to set up?". Header SiteSelector shows the new site. `localStorage.currentSite` is the new id and `pe_ai_onboarding_pending_<id>` = `1`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B2 — Shopify-session account adding a normal site reaches the wizard  `P0` `FE`

_Steps:_
1. Log in on the Shopify-connected account
2. Add a normal (non-Shopify) site

_Expected:_ Lands on `/onboarding` channel picker for the new site. Must NOT redirect to `/shopify-onboarding`. A brief blank frame while the per-site lookup resolves is acceptable.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B3 — Shopify site still goes to Shopify onboarding  `P0` `FE`

_Steps:_
1. Select the Shopify site in the header
2. Open `/onboarding`

_Expected:_ Redirected to `/shopify-onboarding`; the wizard never mounts.

> Note: If `getSiteDetails` fails, the code treats the site as not Shopify and shows the wizard rather than a dead end.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B4 — Browser Back right after creating a site  `P1` `FE`

_Steps:_
1. Create a site (B1)
2. Immediately press browser Back

_Expected:_ You are on Settings › Sites with the new site still selected. Dashboard then shows the card "{Site name} isn't set up yet" with a Start Setup button.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B5 — Failed site create does not navigate  `P1` `FE`

_Steps:_
1. On an account at its site limit (or force a 4xx), Add new site

_Expected:_ Error shown in the create modal; you stay on Settings › Sites; no navigation to `/onboarding`; no session site appended.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B6 — New-user login lands on the new picker  `P0` `FE`

_Steps:_
1. Sign up / log in with a brand-new account

_Expected:_ Post-login redirect goes to `/onboarding` and shows the three channel cards. None of the classic Step 1 UI appears.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B7 — Deep links: cold step URL and summary guard  `P1` `FE`

_Steps:_
1. In a fresh tab open `/onboarding/web/install`
2. Then open `/onboarding/web/summary` with no active run

_Expected:_ First renders the Install step for the current site. Second is replaced to `/onboarding` (picker) — the summary never resurrects without an active run.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B8 — Four-segment onboarding URL is a 404  `P1` `FE`

_Steps:_
1. Open `/onboarding/web/install/extra`

_Expected:_ The app's Not Found page renders, not a broken wizard.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B9 — Sider hides in the wizard and returns after every exit  `P0` `FE`

_Steps:_
1. Enter the wizard; confirm the left sider is hidden on every step
2. Exit via each of: "Skip setup and go to the Dashboard", Summary "Go to Dashboard", browser Back, header logo, header site switch

_Expected:_ Sider hidden on all onboarding paths; visible again immediately after each exit, with no reload needed.

> Note: Mechanism is a class on `#pe-page-sider` added on mount and removed on unmount; a leak here hides the sider app-wide.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B10 — Alert stack suppressed inside the wizard  `P1` `FE`

_Steps:_
1. Use an account with an active alert (payment/subscription, iOS certificate expiry, or dummy-data)
2. Enter the wizard, then leave to /campaigns

_Expected:_ No alert banners render on any `/onboarding` path. They render again on the next non-onboarding page.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### B11 — Header site switch mid-run  `P1` `FE`

_Steps:_
1. Reach the popup step on Site 1
2. Switch to Site 2 in the header

_Expected:_ URL replaced to `/onboarding` (picker) for Site 2 with a clean run. Switch back to Site 1 → its run resumes at the popup step with its data. No request for Site 1's URL fires under Site 2.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### C · Channel picker and reconfigure

#### C1 — Picker content and copy  `P0` `FE`

_Steps:_
1. Open `/onboarding` with no run

_Expected:_ Heading "What do you want to set up?", subtitle "Choose one — each takes a few minutes". Three cards: Web Push (AI PICK badge, 12× ROI, ~3 min), App Push (90% delivery, ~5 min), Chat Widget (45% more leads, ~4 min). Assistant strip names the site domain. No footer buttons.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### C2 — Each card enters its track  `P0` `FE`

_Steps:_
1. Click Set up Web Push, then repeat for App Push and Chat Widget from a fresh picker

_Expected:_ URLs `/onboarding/web/install`, `/onboarding/app/details`, `/onboarding/chat/channels`. The rail shows Channel as done and the first stage active. dataLayer has `ai_onboarding_channel_selected` with the right `channel`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### C3 — Completed channel shows Done and Reconfigure  `P1` `FE`

_Steps:_
1. Finish a web run (G1)
2. Open `/onboarding`

_Expected:_ Web Push card has a Done badge and a Reconfigure action; subtitle "1 of 3 channels configured". Clicking opens "Reconfigure Web Push?" with body "This will walk you through the setup again. Your current settings will be replaced." Cancel = no change. Reconfigure → `/onboarding/web/install` with empty step data; no `channel_selected` event.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### C4 — "Choose a different channel" only on the first step  `P1` `FE`

_Steps:_
1. On `/onboarding/web/install` look below the card
2. Advance to analyzing/popup and look again

_Expected:_ Link present only on the track's first step; clicking returns to the picker and keeps entered data. Absent on later steps. "Skip setup and go to the Dashboard" is present on all steps.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### C5 — Skip setup from a mid-flow step  `P1` `FE`

_Steps:_
1. On the popup step click "Skip setup and go to the Dashboard"

_Expected:_ Dashboard renders with the resume card at the popup step; `ai_onboarding_abandoned` fires once.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### D · Web track — Install step

#### D1 — Platform auto-detection  `P0` `FE`

_Steps:_
1. Enter the web track on Site 1 (WordPress)
2. Repeat on a plain custom site

_Expected:_ Two skeletons and a disabled "Detecting your platform…" primary while detecting. WordPress site shows the WordPress card with the AI DETECTED badge and the WordPress guide steps. Unknown site shows Custom Site with no badge.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D2 — Change platform  `P1` `FE`

_Steps:_
1. Click Change on the platform card
2. Pick Shopify

_Expected:_ Grid opens with "Pick your platform — the install steps and checks adapt to it:". After picking, the guide steps and tags change, the AI DETECTED badge disappears, and any previous check result is cleared.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D3 — Manual setup / AI Agent tabs and copy  `P1` `FE`

_Steps:_
1. Switch to AI Agent
2. Click Copy prompt
3. Paste into a text editor

_Expected:_ Panel header "PROMPT FOR YOUR AI AGENT"; button reads Copied for ~1.6 s; pasted prompt names the detected platform and the site URL. dataLayer has `ai_onboarding_install_mode` label `ai`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D4 — Site URL pencil: validation, save, rollback  `P1` `FE`

_Steps:_
1. Edit the URL to `asdf` and save
2. Edit to a valid https URL and save
3. Force a 4xx on PATCH (devtools request blocking) and save a valid URL

_Expected:_ `asdf` → inline error "A Valid URL should be of the format …"; nothing sent. Valid → PATCH `site_url`, platform re-detects, Settings › Site Details shows the new URL. Blocked → URL reverts, editor reopens, inline "Couldn't save this URL — check it and try again." plus a bottom-left notification "Couldn't update your site URL".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D5 — Install check fails on an uninstalled site  `P0` `FE`

_Steps:_
1. On Site 2 click "Confirm and Check Status"

_Expected:_ Headline "PushEngage isn't live on {domain} yet". Reason sentence names what is missing ("We couldn't find the service worker or the PushEngage SDK on {domain}…"). Pill "1 of 3 checks passed" (HTTPS only) expands to three rows. "Recommended fix" card with the platform's step 1, "Other options (N)", "Show steps", "Skip for now". Primary becomes "Check again". `verify_installation` fires with eventValue 0.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D6 — Install check passes and advances  `P0` `FE`

_Steps:_
1. On Site 1 click "Confirm and Check Status"
2. Click "Continue to Popup Design"

_Expected:_ Panel "PushEngage is live on {domain}" with "Your site is configured correctly. Next I'll design your opt-in popup." Primary label changes to "Continue to Popup Design"; clicking advances to `/onboarding/web/analyzing`. `verify_installation` eventValue 1.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D7 — Foreign install is called out  `P0` `FE`

_Steps:_
1. On Site 3 (another site's key) run the check

_Expected:_ Reason: "{domain} is running PushEngage, but under a different site's key — so its subscribers go to that site, not this one…". SDK row reads "PushEngage SDK: found, but set up for a different site". The Recommended fix card is NOT shown.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D8 — Unreachable site vs request failure  `P1` `FE`

_Steps:_
1. Set the site URL to a live domain that does not resolve; run the check
2. Then block the site-analysis request in devtools and run again

_Expected:_ Unreachable: "We couldn't load {domain}, so none of the checks ran…", pill "Checks didn't run", rows say "not checked". Request blocked: "We couldn't complete the check for {domain} — the request didn't get through…" and NO `verify_installation` event.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D9 — Back is locked during the check  `P1` `FE`

_Steps:_
1. Start a check and immediately try Go Back and the primary

_Expected:_ Primary shows "Checking status…" disabled; a full-card spinner "Checking your installation…"; Go Back disabled until the result lands.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D10 — Service-worker custom path option  `P1` `FE`

_Steps:_
1. On a platform whose step has hosting options, click "I can't upload to my site root"
2. Choose "Upload it, but to a different path"
3. Try `http://…`, a path on another domain, a `.php` path, then `/sw/service-worker.js`, then Save path

_Expected:_ Errors: "The service worker must be served over HTTPS.", "The path must be on {domain}…", "The path must point to a .js file…". Subfolder gives the warning "This worker sits in a subfolder, so it can only collect subscribers on pages under that folder." but Save is allowed. Save → PUT advanced settings; button reads Saved; "Saved. We'll point the SDK at {url}." Later check SW row reads "Using custom worker path — {path}".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D11 — PushEngage subdomain option and cutoff domain  `P1` `FE`

_Steps:_
1. Choose "I can't upload files to my site" on Site 4 (created before 2026-08-05), then on Site 5 (after)
2. Click "Use PushEngage subdomain"

_Expected:_ Warning card "Not the recommended setup". Site 4 shows `{slug}.pushengage.com`; Site 5 shows `{slug}.trypushengage.com`. Button becomes "Subdomain enabled". A later check trusts the subdomain (SW row "Service worker hosted on {slug}.…") and the popup saved in E7 has `optin_sw_support: 0`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D12 — Email my developer  `P1` `FE`

_Steps:_
1. Click "Email my developer"
2. Submit empty, then a bad email, then a valid one

_Expected:_ Modal "Email instructions to your developer". Errors "Enter your developer's email address" / "That doesn't look like an email address". Success notification "Instructions sent to {email}"; on failure "Couldn't send those instructions".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### D13 — Skip for now after a failed check  `P2` `FE`

_Steps:_
1. After D5 click "Skip for now"

_Expected:_ Advances to analyzing with `installed: false`; the Summary install row is later marked not done (heading "Your Setup Is Saved").

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### E · Web track — Analyzing and Popup Design

#### E1 — Analyzing board completes and hands off  `P0` `FE`

_Steps:_
1. Continue from a passing check

_Expected:_ Header "AI agents are on it", five agents (Site Scanner, Copy Writer, Design Engine, Audience Architect, Automation Builder), no Back button, no footer. Each agent shows Done with a real note; hands off to `/onboarding/web/popup` within 20 s even if the backend is slow.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E2 — Analysis failure still completes  `P1` `FE`

_Steps:_
1. Block `site-analysis` in devtools, then enter analyzing

_Expected:_ Board still finishes; notes read "Proven default copy" / "Default styling". Popup step opens seeded with the default copy "Subscribe to receive news, offers and updates…" and the default colour.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E3 — Popup step seeded from the analysis  `P0` `FE`

_Steps:_
1. Arrive on the popup step from a real analysis

_Expected:_ Left panel "Your Opt-in Popup". Large Safari style selected. Message equals the analysis `popup_copy.message`; colour picker "DETECTED FROM SITE" lists the palette. Preview renders inside a browser frame with "Powered by PushEngage" for a non-white-label site. Caption "Appears after Ns · Large Safari".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E4 — Styles, positions and per-device editing  `P1` `FE`

_Steps:_
1. Switch through Bell Bar, Floating Bar, Sleek OptIn, Large Safari
2. Toggle the device above the preview and change a colour

_Expected:_ Position control hidden for Large Safari and shows valid placements for others; switching style resets placements. The note names the device being edited; a colour changed on mobile does not change desktop. Bell Bar has no close-button field; Sleek shows a heading field (max 60).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E5 — Customize copy and timing  `P1` `FE`

_Steps:_
1. Open Customize copy & timing
2. Clear the message; type 151 chars; set delay 999

_Expected:_ Counters n/150, n/20; empty shows hint "Left empty — "{default}" will be used." (not an error); 151st char rejected; delay clamps to 300; note "0–300 seconds · 0 shows the popup immediately…". Primary reads "Apply & Continue" while the panel is open.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E6 — Regenerate copy with chips and undo  `P1` `FE`

_Steps:_
1. Click the regenerate icon, pick "More urgent" + free text, Go
2. Click Undo
3. Click regenerate again immediately

_Expected:_ New copy arrives (POST popup-copy with `directions: [urgent]`); Undo restores. Button disabled for ~3 s after a call. If the backend returns `fallback:true` the copy is unchanged and no error is shown.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E7 — Continue writes the real popup settings  `P0` `FE`

_Steps:_
1. Note the site's current optin_settings JSON (GET)
2. Click "Looks Good, Continue"
3. Open Design › Popup Modals and compare

_Expected:_ Spinner "Saving your popup…"; PUT `optin_settings`. Design lists the chosen style as ACTIVE (toggle ON), with matching desktop and mobile copy/colours/delay. Every other key in the previous JSON is unchanged. Advances to `/onboarding/web/segments`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E8 — Site that already has a popup  `P0` `FE`

_Steps:_
1. On a site with an editable popup configured, reach the popup step

_Expected:_ Info alert "Showing the popup this site already has" with "Use AI suggestion". Form is seeded from the live settings; Continue without edits leaves the saved JSON byte-identical. "Use AI suggestion" swaps to the analysis seed.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E9 — optin_settings load failure blocks Continue  `P1` `FE`

_Steps:_
1. Block the GET for optin_settings and open the popup step

_Expected:_ Warning "We couldn't load this site's current popup settings" with Retry; Continue disabled until Retry succeeds.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### E10 — Save failure keeps the design  `P1` `FE`

_Steps:_
1. Block the PUT and click Continue

_Expected:_ Stays on the step; notification "Couldn't save your popup" / "Your design is still here — try Continue again."; form unchanged.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### F · Audiences and Automations

_Shared by web and app tracks. Run once on a Free account and once on Business._

#### F1 — Audiences renders the curation  `P0` `FE`

_Steps:_
1. Arrive from analyzing on the web track

_Expected:_ Heading "Segments & Groups", subtitle names the domain. Tabs Segments / Audience Groups with counts. Top pick preselected and its detail panel open (DEFINED BY, HOW IT WORKS, GREAT FOR). Assistant line "I tailored these…" when `fallback:false`, "Here are proven starter…" otherwise.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F2 — Free-plan quota in the UI  `P0` `FE`

_Steps:_
1. On account A open Audiences

_Expected:_ At most 5 segments and 5 groups selectable; overflow rows carry a "Plan limit" badge and are not selectable; default selection never exceeds 5. Clicking a locked row opens the upgrade popup (segmentation content). "+N more … on higher plans" teaser appears only on a tab with a locked row.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F3 — Create segments and groups  `P0` `FE`

_Steps:_
1. Select 3 segments and 2 groups; click "Create 3 segments & 2 groups"
2. Open Audiences › Segments and › Audience Groups

_Expected:_ Spinner "Creating your audiences…"; requests are sequential (one at a time in Network). All five exist with the shown names and rules. Advances to `/onboarding/web/workflows`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F4 — Create failure holds the step  `P1` `FE`

_Steps:_
1. Pre-create a segment with the same name as a top pick
2. Select it plus others and Continue

_Expected:_ The failed row shows the server message inline (e.g. duplicate name); notification "Couldn't create N audiences" / "Check the highlighted items below…". Step does not advance. Deselecting the row clears its error; Continue again creates only the remaining items, never re-posting the ones already created.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F5 — Continue without audiences  `P1` `FE`

_Steps:_
1. Deselect all and Continue

_Expected:_ Label "Continue without audiences"; no requests; Summary later says "No audiences created yet — add them anytime".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F6 — Automations sections on Free  `P0` `FE`

_Steps:_
1. Open Automations on account A

_Expected:_ "READY ON YOUR FREE PLAN" lists only workflows with ≤5 real nodes and no wait/decision/exit/split/gated actions. "UNLOCK WITH A HIGHER PLAN" lists the rest with a lock reason ("…it uses wait timers…", "…A/B split paths…") and "View plans →". Assistant reminds "Each saves as a draft".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F7 — Automations on Business  `P0` `FE`

_Steps:_
1. Open Automations on account B

_Expected:_ Header "READY ON YOUR BUSINESS PLAN"; welcome series and most catalog workflows are unlocked; only Premium+ items (A/B) and Growth items (HTTP request) remain locked.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F8 — AI adjust: free chip and free text  `P1` `FE`

_Steps:_
1. Select a workflow, click "Make it shorter"
2. Type "add a reminder after 2 days" and Adjust

_Expected:_ POST adjust-workflow; node tree re-renders from the adjusted payload; the model's note appears with a check and a "Revert changes" link; Revert restores. Adjust button disabled ~3 s after each call.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F9 — Gated chip opens the upgrade popup without an API call  `P1` `FE`

_Steps:_
1. On account A click "Add an A/B test" (crown icon)

_Expected:_ Upgrade popup opens with workflow content targeting Premium; Network shows no adjust-workflow request. "Add a discount escalation" targets Business.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F10 — Backend fallback on adjust  `P1` `FE`

_Steps:_
1. Block adjust-workflow (or exceed the cap) and Adjust

_Expected:_ Inline note "The AI couldn't adjust this one right now — it's saved as-is, and you can fine-tune it anytime in Workflows." Workflow unchanged; no toast.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F11 — Create workflows and open them in the builder  `P0` `FE`

_Steps:_
1. Select 2 workflows; "Create 2 workflows"
2. Open Campaign › Workflows

_Expected:_ Both listed as drafts (inactive). Opening each in the builder shows no validation errors; nodes match the tree shown in the wizard; push URLs use the site's origin, never `example.com`. Advances to summary.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F12 — Workflow depending on a segment that was not created  `P1` `FE`

_Steps:_
1. Deselect the segment a workflow depends on in F3, create, then select that workflow

_Expected:_ Row error "This automation needs the {Segment Name} segment. Go back and create it, or deselect this automation." Step holds until fixed.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### F13 — Refresh on the audiences step  `P2` `FE`

_Steps:_
1. Press F5 on `/onboarding/web/segments`

_Expected:_ Recommendations refetch (GET recommendations) and render the same list from the backend's 30-min cache; selection resets to defaults.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### G · Summary and completion

#### G1 — Full web run completes  `P0` `FE`

_Steps:_
1. Complete D6 → E7 → F3 → F11
2. On Summary click "Go to Dashboard"

_Expected:_ Heading "You're All Set!", sub-line "Web push is configured for {domain}". Rows: install "{domain} · {Platform}", popup ""{message}" · appears after Ns", "N segments & M groups", "N workflow drafts". Dashboard shows no resume card or banner; `/onboarding` shows Web Push as Done. `ai_onboarding_completed` fires once.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### G2 — Partial run summary is honest  `P1` `FE`

_Steps:_
1. Skip the install check (D13) and skip audiences (F5); reach Summary

_Expected:_ Heading "Your Setup Is Saved"; install row not done; audiences row "No audiences created yet — add them anytime". Level Up list on the right: PushEngage MCP (NEW), Chrome extension (SOON), AI Skills, Send a test push, Track revenue goals, Invite your team.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### G3 — Set up another channel from Summary  `P1` `FE`

_Steps:_
1. Click the Chat Widget card under "SET UP ANOTHER CHANNEL"

_Expected:_ Enters `/onboarding/chat/channels`; `channel_selected` fires with `chat`. After finishing, the picker shows both channels Done and "2 of 3 channels configured".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### G4 — Level-up rows  `P2` `FE`

_Steps:_
1. Hover the ? icon; click PushEngage MCP; click Chrome extension

_Expected:_ ? shows a tooltip only. MCP opens a detail modal whose primary opens docs in a new tab. Chrome extension shows `message.info` "Chrome extension isn't available yet — check back soon." and no modal.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### H · Chat Widget track

#### H1 — Channels step curated for the site  `P0` `FE`

_Steps:_
1. Enter the chat track

_Expected:_ Skeletons with "Reading {domain} to pick the channels…" then ACTIVE list (≤4) plus ADD A CHANNEL tiles. Assistant says "Picked N channels for {domain}" when curated, or "Starting you off with the N channels businesses use most" on fallback. Primary "Continue with N channels" disabled at zero.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H2 — Channel value validation  `P1` `FE`

_Steps:_
1. Enter an invalid WhatsApp number and an invalid email; Continue

_Expected:_ Inline errors on the invalid rows; step holds. Valid values advance to `/onboarding/chat/design`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H3 — Section skip and Go Back  `P1` `FE`

_Steps:_
1. On Channels click "Skip chat widget setup"
2. On Summary click Go Back
3. Then reach Summary via skip again and click Go to Dashboard

_Expected:_ Summary shows "Setup skipped — add it anytime from Chat Widgets" (not done). Go Back returns to Channels, not Agents. Go to Dashboard does NOT mark Chat Widget as Done on the picker and no widget exists.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H4 — Design step and free-plan gates  `P1` `FE`

_Steps:_
1. On account A change trigger to duration then scroll
2. Try SHOW WIDGET ON specific pages, Chat Panel style, Custom position, then Left/Right

_Expected:_ Duration shows DISPLAY AFTER (SECONDS) 0–600; scroll shows percent 0–100. Page rules, Chat Panel style and Custom position open the upgrade gate (BUSINESS badge); Left/Right apply directly. On account B all apply. Chat Panel style requires heading and subheading ("Give the chat panel a heading").

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H5 — Finish Setup creates the widget  `P0` `FE`

_Steps:_
1. Add one agent on account B (name, contact); click "Finish Setup"
2. Open Chat Widgets

_Expected:_ Spinner "Creating your chat widget…"; a widget named "Chat Widget N Chat|Simple" exists with the chosen channels, agents, greeting and trigger. Summary row "N channels · M agents — live on {domain}". Wizard preview matched the widget on the Chat Widgets edit page.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H6 — Free plan widget limit  `P1` `FE`

_Steps:_
1. On account A with one widget already, reach Agents

_Expected:_ Notice "Free plan widget limit reached" with Upgrade / Manage chat widgets. Finish opens the upgrade gate; no create request. Agents are shown as Business-only ("Add Agent — Business").

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H7 — Missing channel details routes back  `P1` `FE`

_Steps:_
1. Clear a channel's contact value on Channels, advance, Finish

_Expected:_ Notification "Add your channel details first" and the wizard returns to `/onboarding/chat/channels`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H8 — Re-Finish updates, not duplicates  `P1` `FE`

_Steps:_
1. After H5 press Go Back to Agents, change the agent name, Finish again

_Expected:_ PUT on the same widget id; Chat Widgets still lists one widget with the new name.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### H9 — Live preview panel  `P2` `FE`

_Steps:_
1. On Design/Agents toggle Desktop / Mobile; click the launcher in the preview

_Expected:_ "LIVE WIDGET PREVIEW" re-renders in the right frame; the launcher is inert (panel stays open); per-channel "N agents available" updates as agents are added.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### I · App Push track

#### I1 — App Details and store lookup  `P0` `FE`

_Steps:_
1. Enter the app track; leave name empty
2. Enter name "WhatsApp", package `com.whatsapp`, Android; "Analyze & Continue"
3. Repeat with a made-up name and no URL

_Expected:_ Primary disabled without a name. Matched: primary reads "Analyzing your app…", Back locked, then the SDK step shows. Later the analyzing board header names the store title and category. Unmatched still advances (no error).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I2 — Android SDK stepper and Firebase credentials  `P0` `FE`

_Steps:_
1. Walk the rail: switch Kotlin/Java; copy a code block
2. On the Firebase step upload the service-account JSON and Sender ID; Save

_Expected:_ Header "Android Setup · for {app}", progress "N of M done", AI Agent mode on by default. Code blocks wrap and copy. Bad JSON → "That file isn't valid JSON…"; missing keys → "This doesn't look like a service account key…". Valid → PUT android settings; the step shows "Firebase is connected to {app} — Project: {id}". Site now reads `is_android` true elsewhere (e.g. Mobile App Push pages).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I3 — iOS stepper and APNs certificate  `P0` `FE`

_Steps:_
1. Pick iOS; switch CocoaPods / Swift Package Manager
2. Upload the .p12, password, App Push Id; Save
3. Repeat with the expired certificate

_Expected:_ Snippets change with the package manager. Valid save = upload then PUT `ios_options`; filename displayed. Missing pieces → "Upload the .p12 certificate and enter its password first". Expired cert shows an expiry warning.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I4 — React Native two-pass walk  `P0` `FE`

_Steps:_
1. Pick React Native; walk pass 1

_Expected:_ Assistant "React Native ships to both stores — we'll set up Android and iOS one at a time…". Pass 1 = JS + Android steps; last step primary "Set up iOS"; skip link "Skip Android — set up iOS". Pass 2 = iOS-native steps only; final primary "Mark Done & Continue to Audiences"; skip "Skip and go to Audiences". Change button returns to App Details without ticking SDK Setup on the rail.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I5 — Flutter two-pass walk  `P1` `FE`

_Steps:_
1. Repeat I4 with Flutter

_Expected:_ Same structure with Flutter Android / Flutter iOS step lists.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I6 — Credential drafts survive navigation  `P1` `FE`

_Steps:_
1. Type a password on the APNs step, click another rail step, toggle Manual, return

_Expected:_ The typed values are still there (form stays mounted).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I7 — Refresh keeps platform and ticks  `P1` `FE`

_Steps:_
1. Tick two steps on iOS; press F5 on `/onboarding/app/sdk`
2. Change platform to Android

_Expected:_ After refresh: still iOS, same two ticks, same sub-step. Changing platform resets ticks and credentials state for the new platform.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I8 — App analyzing board  `P1` `FE`

_Steps:_
1. Continue to Audiences from the SDK step

_Expected:_ Board "Building audiences and automations for {store title | app name}"; stage 1 settles from the store data, stage 2 waits on recommendations; hands off to segments. Audiences subtitle names the app, not the domain.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I9 — Summary reflects per-OS outcome  `P1` `FE`

_Steps:_
1. Finish with Android credentials saved and iOS skipped

_Expected:_ Summary SDK row "Android configured · iOS skipped". With nothing saved: "Setup not finished — resume anytime from App Integration" and heading "Your Setup Is Saved".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### I10 — Skills panel on the last step  `P2` `FE`

_Steps:_
1. Open the last SDK step

_Expected:_ Collapsible "Set up faster with the … skill" (NEW tag) with install-path tabs, a prompt, and links "MCP and Skills docs →" / "View the Skills repo →" opening in new tabs.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### J · Resume checklist, banner and persistence

#### J1 — Resume card restores the exact step  `P0` `FE`

_Steps:_
1. Reach the popup step, edit the message, leave to the dashboard
2. Click "Continue Setup" on the card

_Expected:_ Card: ring "N of M done", "Finish setting up Web Push", rows Done / In progress / Pending, "About N min left". Continue deep-links to `/onboarding/web/popup` with the edited message intact. `ai_onboarding_resumed` fires.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J2 — Cross-page banner and dismiss cap  `P0` `FE`

_Steps:_
1. With an active run open /campaigns, /analytics
2. Dismiss ✕ three times across visits

_Expected:_ Banner "Finish setting up Web Push · Next up: {step} · N of M done · Continue Setup" on non-dashboard pages; hidden on the dashboard (card lives there) and inside the wizard. After the third dismiss it never returns for that site; a second site still shows it.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J3 — Skipped steps in the checklist  `P1` `FE`

_Steps:_
1. Skip audiences, leave

_Expected:_ Row shows "Skipped" with a dash; the ring counts it as not done; "About N min left" excludes it. Completing it later drops the skipped flag.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J4 — Refresh at every step keeps data  `P1` `FE`

_Steps:_
1. Press F5 on install (after a pass), popup (after edits), segments (after selection), chat design, app sdk

_Expected:_ Each re-renders the same step with prior data (check result, popup form, platform). Selection on segments resets to default (data is remote), which is acceptable.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J5 — Finished run never resurrects  `P0` `FE`

_Steps:_
1. After G1, open `/onboarding` and `/onboarding/web/summary`

_Expected:_ Both show the picker with Web Push Done; card and banner absent; localStorage snapshot has `track: null`, `screen: channel_select`, `completed: ["web"]`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J6 — Logout sweeps onboarding storage  `P1` `FE`

_Steps:_
1. Have runs on two sites; log out; inspect localStorage

_Expected:_ All `pe_ai_onboarding_data_*`, `pe_ai_onboarding_checklist_dismissed_*`, `pe_ai_onboarding_pending_*` keys gone for every site; `pe_lifecycle_signals_*` and other keys remain; login works. Repeat in Safari private mode.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J7 — Corrupt snapshot does not crash  `P1` `FE`

_Steps:_
1. Set `pe_ai_onboarding_data_<siteId>` to `"x"`, then to `{"screen":"nope"}`, then to `{"version":2,"completed":"x"}`; open `/onboarding`

_Expected:_ Picker renders each time; no blank page or console crash; the bad value is overwritten on the next change.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J8 — Two sites, two runs  `P1` `FE`

_Steps:_
1. Run Site 1 to segments; switch to Site 2 and start a chat run; switch back

_Expected:_ Site 2 started clean; Site 1 resumes at segments; the dashboard card follows the selected site.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### J9 — Not-started nudge dismissal  `P2` `FE`

_Steps:_
1. After B1 leave to the dashboard; dismiss the "isn't set up yet" card

_Expected:_ Card gone; `pe_ai_onboarding_pending_<id>` removed; the dismiss counter key is NOT incremented (still 3 dismissals available for a later resume banner).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### K · Settings › Installation (reused bodies)

#### K1 — Website tab layout and controls  `P0` `FE`

_Steps:_
1. Open Settings › Installation

_Expected:_ Website | Mobile switcher; heading "Install PushEngage on Your Site"; platform grid open (no Change link); numbered guide; footer primary "Confirm and Check Status". No Back, no "Skip for now", no step rail, no "Choose a different channel". Sider visible. Card up to 1120 px wide.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K2 — Pass shows the Verified modal  `P0` `FE`

_Steps:_
1. On Site 1 click Confirm and Check Status; click OK

_Expected:_ Modal "Verified" / "Setup Verified Successfully. Click OK to continue." OK → dashboard. Behind it the pass panel reads "Your site is configured correctly." and the primary "Go to Dashboard".

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K3 — Fail shows the inline diagnostic  `P0` `FE`

_Steps:_
1. On Site 2 click Confirm and Check Status

_Expected:_ No error modal. Inline panel with headline, reason, checks pill, Recommended fix, Other options, Get install help, Show steps. Primary "Check again". Same copy as D5.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K4 — Settings page never touches the saved run  `P0` `FE`

_Steps:_
1. Start a wizard run to the popup step and leave
2. On Settings › Installation run a check (pass), switch Manual/AI, save Firebase creds on Mobile
3. Return to `/onboarding` and the dashboard

_Expected:_ Wizard resumes at the popup step with identical data; the resume card is unchanged; `pe_ai_onboarding_data_<id>` byte-identical before/after; dataLayer shows `verify_installation` but zero `ai_onboarding_*` events from the settings visit.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K5 — `?type=` deep-link matrix  `P1` `FE`

_Steps:_
1. Open `/settings/installation?type=wordpress`, `?type=shopify`, `?type=react_native`, `?type=flutter`, `?type=garbage`, and no param
2. Repeat on `/mobile-app-push/installation`
3. From each, switch Website → Mobile → Website and refresh at each stop

_Expected:_ wordpress/shopify pin the Website platform and suppress auto-detect; react_native/flutter open Mobile with that platform; garbage/none behave like no param (Website auto-detects; Mobile route opens Mobile with Android). Switching to Mobile writes `?type=android`; switching to Website clears `?type` (auto-detect alive). Other query params (e.g. `dummy-data`) survive.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K6 — iOS certificate-expiry alert deep link  `P1` `FE`

_Steps:_
1. Trigger the iOS certificate expiry alert (expired .p12) and click its link

_Expected:_ Lands on `/settings/installation?type=ios` → Mobile tab, iOS platform, APNs form. Uploading a fresh .p12 saves and the alert clears on the next load.

> Note: Product note: on master this landed in the classic Step 2 iOS section; confirm support expects the Mobile tab.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K7 — Mobile tab: fields, tiles, stepper and verify  `P0` `FE`

_Steps:_
1. Switch to Mobile
2. Fill app name/package, pick Android, walk steps
3. Click "Confirm and Check Status" with 0 subscribers, then with ≥1 Android subscriber

_Expected:_ APP NAME prefilled from the site name; four tiles (Android, iOS, React Native, Flutter); stepper below. 0 subscribers → Modal.error "Verification Failed" with the legacy Android copy. ≥1 → "Verified" modal → OK → dashboard. `verify_installation` fires with label android. No skip link on the final pass.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K8 — Two-pass walk on the settings page  `P1` `FE`

_Steps:_
1. Pick React Native on Mobile; walk both passes

_Expected:_ Pass 1 ends with "Set up iOS"; pass 2 shows no skip link at all; the final check calls subscribers with `include_browsers: ios`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K9 — Site URL pencil PATCHes from the settings page  `P1` `FE`

_Steps:_
1. Edit and save the URL on the Website tab; then force a 4xx

_Expected:_ Same behaviour as D4, including the revert. The change shows on Settings › Site Details.

> Note: Open product decision in the PR: this is the only persisting action on an otherwise session-only page.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K10 — Site switch mid-check  `P1` `FE`

_Steps:_
1. Start a check on Site 1; switch to Site 2 in the header before it returns

_Expected:_ No modal for Site 1 appears under Site 2; `?type=` cleared; platform and check state reset for Site 2; no stuck spinner.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K11 — Styling of the reused bodies  `P1` `FE`

_Steps:_
1. Website tab: site URL editor, iOS APNs form (password + text inputs), SDK code blocks, Kotlin/Java and Swift/Objective-C tabs
2. Viewport heights 800 / 1080 / 1440; widths 1440 / 768 / 375

_Expected:_ All inputs 32 px tall (none at 40 px); long SDK lines wrap; code blocks capped ~280 px with a Copy button that does not overlap text; language tabs on one line with the underline flush to the code's left edge; stepper pane scrolls inside its bounded height with no clipped footer; card padding intact at 768 and 375.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### K12 — Mobile route entry points  `P1` `FE`

_Steps:_
1. Sidebar Mobile App Push › Installation; the MobileAppPushSetupAlert link; App Push page CTA

_Expected:_ All open `/mobile-app-push/installation` on the Mobile tab.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### L · Side effects on existing frontend screens

#### L1 — Dashboard without the Challenge panel  `P0` `FE`

_Steps:_
1. Open the dashboard on an account with stats and on one with none

_Expected:_ No Challenge checklist and no floating checklist bubble anywhere. Network shows no `installation-step-details` request. Empty-stats layout (QuickCampaignOption) looks right with the resume card above it. Sidebar submenus no longer auto-open.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L2 — Notification preview subdomain line  `P0` `FE`

_Steps:_
1. On Site 4 (http-only, pre-cutoff) open Push Broadcast create, a Drip, a Triggered campaign, and the Templates gallery
2. Repeat on Site 5 (post-cutoff)
3. Repeat once in Safari

_Expected:_ Site 4 previews show `{slug}.pushengage.com`; Site 5 shows `{slug}.trypushengage.com`. An https site_url shows its own hostname regardless. Safari matches Chrome.

> Note: Known gap: the apex is decided by the session's pinned site, so a multi-site account after a header switch may show the wrong apex — report as a finding, not a blocker.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L3 — Chat Widgets edit preview matrix  `P0` `FE`

_Steps:_
1. Open an existing widget; toggle each attention effect (pulse, blink, bounce, waggle, floating, spin, fade, shockwave, sheen); left/right; custom image launcher; opened_by_default / click / hover; Chat vs Simple panel; horizontal vs vertical; light/dark/system; desktop/mobile
2. Add 6+ channels in Simple vertical on a short window

_Expected:_ Everything renders as on master. The only new behaviour: a tall simple stack wraps/caps instead of overflowing the launcher area.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L4 — Floating bar opt-in alignment  `P1` `FE`

_Steps:_
1. Design › Subscription Dialog Box › Floating Bar: desktop and mobile, 1-line and 2-line message, with/without segment checkboxes, with/without custom icon

_Expected:_ Icon, text and buttons vertically centred; no clipped checkbox row; matches the Design page's own preview.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L5 — Create-error toasts still show outside the wizard  `P1` `FE`

_Steps:_
1. Force a 4xx on create for: Audiences › Segments, Audiences › Groups, Push Broadcast (new group), Chat Widgets, Workflow Templates

_Expected:_ Each still shows the global red error notification (the new `disableGlobalErrorHandler` option must not leak).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L6 — Legacy code blocks unchanged  `P1` `FE`

_Steps:_
1. Analytics › Goal Tracking settings; Workflow custom-event drawer; Triggered › dynamic code

_Expected:_ Code blocks look as on master: no wrapping, no 280 px cap, same font size and Copy button position.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L7 — Settings › Site Details unchanged  `P1` `FE`

_Steps:_
1. Open Site Details; edit and save the URL; view the API key block

_Expected:_ Works as before; the API-key block styling is unchanged; a URL saved from the install page is reflected here.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L8 — Shopify onboarding stepper renders  `P1` `FE`

_Steps:_
1. On the Shopify account open `/shopify-onboarding`

_Expected:_ Step indicator and steps render as on master (its styles are separate from the deleted `_steps.scss`).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L9 — Header SiteSelector after adding a site  `P1` `FE`

_Steps:_
1. After B1 open the SiteSelector; also reload

_Expected:_ New site listed once with the right name before and after reload; any "N of M sites" counter is correct.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L10 — Menu entries and legacy redirect  `P2` `FE`

_Steps:_
1. Sidebar Settings › Installation; Mobile App Push › Installation; open an unknown URL

_Expected:_ Both entries open the rebuilt page; the Not Found page still applies its legacy redirects.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### L11 — Production build login/logout smoke  `P1` `FE`

_Steps:_
1. On the built bundle log in, navigate, log out

_Expected:_ No console errors from the new helper imports; logout returns to login.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### M · Backend API contracts (direct calls)

_Use curl or Postman with an admin dashboard token. Compare with the API reference table below._

#### M1 — site-analysis happy path and refresh  `P0` `BE`

_Steps:_
1. POST site-analysis `{url: <site url>}` twice, then with `refresh:true`

_Expected:_ 200 with `checks`, `platform.name/confidence`, `palette` (≤5 hex), `signals`, `popup_copy`, `suggested_colors`, `fallback`. Second call is a fast cache hit (same body); `refresh:true` re-inspects. Response for Site 1: `sdk_status: installed`; Site 3: `foreign`; Site 2: `missing`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M2 — site-analysis domain binding  `P0` `BE`

_Steps:_
1. POST with `url` on another public domain; `http://localhost`; `http://127.0.0.1`; `http://intranet`; `http://169.254.169.254`; `http://<site host>.`(trailing dot)

_Expected:_ Every off-domain or internal URL → 400 `URL must belong to your registered site domain`. A `www.` variant of the registered host is accepted.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M3 — Validation shapes  `P1` `BE`

_Steps:_
1. POST site-analysis with no `url`; with `Content-Type: text/plain`; with `:siteId` = `abc`

_Expected:_ 400 `Invalid request data.` with details; 400 "Request body should be parsable by JSON.parse…"; 404 route-param type error.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M4 — popup-copy contract  `P1` `BE`

_Steps:_
1. POST with `directions:["urgent","concise"]` and `current_copy`; with 7 directions; with `"loud"`; with a 151-char message; without `current_copy`; with legacy `headline`+`body`

_Expected:_ First → 200 `popup_copy` + `fallback`. Next four → 400. Legacy → 200 with `headline`/`body` folded into one `message` ≤150.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M5 — recommendations contract per track  `P1` `BE`

_Steps:_
1. GET `?track=web`, `?track=app`, `?track=chat`, `?track=x`

_Expected:_ web/app: arrays with `key`, `name`, `payload`, `allowed_plan_types`, `source` (ai|catalog), plus `locked_counts` and `fallback`. chat: `greeting`, `subheading`, `channel_prefills`, ≤6 `suggested_pages`, ≤8 `suggested_channels` with ≤4 `enabled`. `x` → 400.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M6 — adjust-workflow contract and plan gate  `P1` `BE`

_Steps:_
1. POST a catalog workflow payload with `prompt:"make it shorter"` on account B
2. Without `prompt`
3. On account A with `prompt:"add an A/B test"`

_Expected:_ 200 `{workflow, note, allowed_plan_types, fallback}`; missing prompt → 400; Free + A/B → 200, original workflow, `fallback:true`, note "This tweak adds A/B split testing, which isn't included in your plan — upgrade to apply it."

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M7 — app-analysis contract  `P1` `BE`

_Steps:_
1. POST `{}`; `{platform:"windows"}`; `store_url` of 301 chars; `{app_name:"WhatsApp", store_url:"com.whatsapp"}`; an App Store URL with `/id…`

_Expected:_ `{}` → 200 `fallback:true`, `store.found:false`. Invalid platform / oversized URL → 400. Package → 200 `found:true`, `source: play`, title/category/installs. Apple id → `source: itunes`. The customer URL itself is never requested (check outbound logs).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M8 — Admin-only and verified-only  `P0` `BE`

_Steps:_
1. Call all five routes as the non-admin sub-user
2. Call as an unverified admin

_Expected:_ Sub-user → 403 "You don't have permission to perform this action, Please contact your account administrator." Unverified → 403 "Email is not verified…". Admin → 200.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M9 — Hourly and daily caps return 200 + fallback  `P1` `BE`

_Steps:_
1. Call popup-copy 21 times within an hour on one site
2. Call site-analysis `refresh:true` 11 times
3. Check Redis `onboarding_ai_attempt_site` and `onboarding_ai_attempt_owner`

_Expected:_ Calls 1–20 may be `fallback:false`; call 21 is 200 with `fallback:true` and the current copy echoed. Refresh 11 serves the cached analysis. Log line "OnboardingAi: attempt cap reached, serving the fallback". Owner counter increments across sites; Free cap 50/24 h, others 150. With Redis stopped, calls still succeed (fail-open).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M10 — Cache keys  `P1` `BE`

_Steps:_
1. POST site-analysis for `https://site/?utm_source=x` after a plain call
2. GET recommendations web on account A then B for the same URL

_Expected:_ The utm variant is a cache hit (keyed on origin). Web recommendations differ per plan type (separate cache entries).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M11 — Lock contention across tracks  `P1` `BE`

_Steps:_
1. Fire GET recommendations `web` and `app` for one site at the same instant

_Expected:_ Both 200. One may wait up to ~12 s and then return the static catalog with `fallback:true`; neither errors.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M12 — Redirect and size guards  `P2` `BE`

_Steps:_
1. Point a test site at a URL that 302s to another domain; POST site-analysis
2. Serve a >3 MB homepage

_Expected:_ Reported as unreachable / fallback rather than followed; no 500.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### M13 — adjust-workflow note is rendered as text  `P1` `BE`

_Steps:_
1. Stub or observe a `note` containing `<b>bold</b>`

_Expected:_ The Automations step shows the literal tags, never bold text (no HTML injection).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### N · Plan quotas and the free-plan migration

#### N1 — Run the migration on staging  `P0` `BE`

_Steps:_
1. Snapshot `permission_groups` and `subscription_plans`
2. Run `node ace migrate:free_plan_segments`; save the output
3. Run it again

_Expected:_ Output "Free plan segments enabled: N permission group(s) capped, M plan row(s) given segment_limit 5, K shared group(s) skipped." with K = 0 (otherwise split the shared group and re-run). Free-only groups gain `segments:1` and `audience_groups.limit:5`; free plan rows have `segment_limit = 5`; paid rows untouched. Second run changes nothing.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N2 — Free account stops at exactly 5 + 5  `P0` `BE`

_Steps:_
1. On account A create segments via Audiences until refused; same for audience groups (dashboard UI and wizard)

_Expected:_ 5 succeed; 6th segment → 400 "Your account segment limit exceeded"; 6th group → 400 "Your account audience group limit exceeded". Counts are owner-wide across all active sites.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N3 — Paid account is uncapped and fast  `P0` `BE`

_Steps:_
1. On account B create the 6th, 20th audience group; watch response time

_Expected:_ All succeed with no extra owner-lock latency (no `audience_groups` key on the paid permission group → unlimited, no count query).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N4 — Plans with no permission_groups row  `P1` `BE`

_Steps:_
1. Run before release: `SELECT p.plan_id, p.plan_type FROM subscription_plans p LEFT JOIN permission_groups g ON g.permission_id = p.permission_id WHERE p.type='plan' AND g.permission_id IS NULL`

_Expected:_ Returns no rows. Any row listed would now be capped at 5 audience groups by the code fallback — escalate.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N5 — Admin plan-permission editor round-trip  `P1` `BE`

_Steps:_
1. Open a free plan's permission group in the admin panel; Save without edits
2. Set `audience_groups.limit` to 0, then 10001

_Expected:_ The `audience_groups` key survives an unedited save. 0 = unlimited; 10001 → 400 (max 10000).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N6 — Owner override can cap a paid account  `P1` `BE`

_Steps:_
1. POST admin account plan-permissions for account B with `audience_groups.limit: 2`
2. Create a 3rd group on B

_Expected:_ 400 audience group limit exceeded. Remove the override → unlimited again. Confirm the admin UI never sends this key by accident.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N7 — Shopify default groups bypass the quota  `P1` `BE`

_Steps:_
1. Connect a Shopify store on a free/fallback account so default groups are seeded
2. Create one manual group

_Expected:_ Seeding succeeds regardless of count; the manual create then 400s if the seeded groups already reach 5. Document the count.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N8 — Failed group insert releases the per-site lock  `P1` `BE`

_Steps:_
1. Create a group with a duplicate name (fails); immediately retry with a new name

_Expected:_ Retry succeeds immediately (master held the lock ~18 min after a failure).

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N9 — Concurrent creates across sites of one owner  `P1` `BE`

_Steps:_
1. Account A at 4 groups; fire two creates on two different sites simultaneously

_Expected:_ Exactly one succeeds; the other returns the limit error or "Failed to create the audience group right now. Please try again"; a serial retry after ~10 s behaves normally.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### N10 — Pre-migration free account (documented failure mode)  `P1` `BE`

_Steps:_
1. On an environment WITHOUT the migration, run the wizard Audiences step on a free account

_Expected:_ Creates fail with 403 "Your account does not have access to this feature…" and the step holds with the message inline. This confirms the deploy-order requirement; not a code bug.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### O · Backend shared-module regressions

#### O1 — Workflow HTTP Request node endpoint blocklist  `P0` `BE`

_Steps:_
1. Before release query production workflow nodes for HTTP Request endpoints with dotless hosts or hosts ending .local / .internal / .home.arpa
2. Open an existing workflow with an HTTP Request node to a public https host; Save
3. Set the endpoint to `http://internal-hook/notify`, `http://api.local/x`, `http://2130706433/`; Save

_Expected:_ Public hosts save as before. The three unusual hosts → 400 "HTTP request endpoint host is not allowed." Any production rows matching the query are customers who can no longer re-save their workflow — escalate before shipping.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O2 — Workflow builder "Test" HTTP request  `P1` `BE`

_Steps:_
1. Use the Test button with a public URL and with `http://intranet/x`

_Expected:_ Public works as before; blocked host returns `{success:false, status:404, data:"Endpoint URL is not valid"}`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O3 — Duplicate node ids on create  `P0` `BE`

_Steps:_
1. Clone an existing workflow in the dashboard; create a workflow from a template
2. POST create with two nodes sharing an id, plus a cycle

_Expected:_ Clone and template creates succeed (ids re-minted). The bad payload → 400 with `details[0].type = duplicate_node_ids` reported first (not the cycle error). Update behaves identically.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O4 — AI credits untouched  `P0` `BE`

_Steps:_
1. Generate notification text with AI; generate a broadcast from a URL; note `remaining_credit` and `credit_usage_histories`
2. Exhaust credits and retry
3. Hit onboarding endpoints 10 times

_Expected:_ Each metered call debits exactly once with the right `ai_model` and `usages_type`; zero credit → 400 "No AI credit remaining. Please purchase AI credits." Onboarding calls write no usage rows and do not change `remaining_credit`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O5 — URL-to-notification fetch semantics  `P1` `BE`

_Steps:_
1. Generate a broadcast from a public https product URL with both A and AAAA records
2. From `http://localhost:3000/` and from an unresolvable host

_Expected:_ Public URL fetches and generates; blocked → the existing "blocked" user message; unresolvable → the existing "host not found" message. Credit handling on failure unchanged.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O6 — GET installation-details detection  `P1` `BE`

_Steps:_
1. Call for Site 1 (installed), Site 2 (none), a GTM/consent-plugin site with the snippet split or base64-encoded, and a test page with an unrelated `/assets/core/<siteId>.js` script

_Expected:_ installed true / false / true / (false-positive: true — file as a finding with the page). Detection no longer depends on `CLIENT_BASE_URL`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O7 — GET detect-site-type new values  `P1` `BE`

_Steps:_
1. Call for a WordPress, Shopify, Wix, Squarespace, Webflow, Magento, PrestaShop, HubSpot-hosted site, a WordPress site carrying a HubSpot tracking embed, and an unreachable URL

_Expected:_ Each returns its platform; WP + HubSpot embed → `wordpress`; unreachable → `https`/`http`. Frontend consumers of `site_type` handle the seven new values without falling into a broken branch.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O8 — Sub-user smoke across normal routes  `P1` `BE`

_Steps:_
1. As the sub-user list notifications, segments, audience groups, workflows; create a segment

_Expected:_ All 200 — the new `dashboardIsAdmin` middleware is applied nowhere else.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O9 — Weekly analytics email  `P2` `BE`

_Steps:_
1. Trigger the account-analytics email job on staging

_Expected:_ Email renders with the AI report section as before.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### O10 — Boot and route table  `P2` `BE`

_Steps:_
1. Start the API; dump routes

_Expected:_ Boots without a middleware namespace error; five `onboarding-ai` routes present under `sites/:siteId/`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### P · Telemetry

#### P1 — Full web run event sequence  `P1` `FE`

_Steps:_
1. With a dataLayer watcher run G1 from a fresh tab

_Expected:_ `ai_onboarding_opened` once; `channel_selected` (web); `step_viewed` once per step (no duplicates on advance); `step_completed` per step incl. analyzing; `completed` once. Every event carries `category: ai_onboarding`, `channel`, and `plan_type`.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### P2 — Abandon fires once and only mid-flow  `P1` `FE`

_Steps:_
1. Close the tab on the install step; reopen and leave from the picker; leave from analyzing; leave from summary

_Expected:_ Exactly one `ai_onboarding_abandoned` (install). None from the picker, analyzing steps or summary.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### P3 — Checklist events  `P1` `FE`

_Steps:_
1. Load the dashboard with a run (card), a campaigns page (banner), click Continue, dismiss

_Expected:_ `checklist_shown` label card / banner once per mount; `checklist_cta_clicked` with the step; `checklist_dismissed`; `resumed` when the wizard re-enters.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### P4 — verify_installation parity  `P2` `FE`

_Steps:_
1. Run checks from the wizard and from Settings › Installation (web and mobile)

_Expected:_ `verify_installation` with eventValue 1/0 and a platform/os label in all cases where a verdict was reached; absent when the request itself failed.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

### R · Responsive, visual and accessibility

#### R1 — Wizard at four widths  `P1` `FE`

_Steps:_
1. Walk all three tracks at 1440, 1024, 768 and 375 px

_Expected:_ Rail collapses to the mobile stepper; split panels (popup, audiences, automations, chat) stack; footer buttons never overflow; preview frames scale; no horizontal scroll.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### R2 — Keyboard operation  `P1` `FE`

_Steps:_
1. Tab through the install step: platform tiles, Manual/AI tabs, SW host radios, copy buttons; the popup chips; the status rail in App SDK

_Expected:_ Every control reachable and operable with Enter/Space; visible focus ring; the SW host option change does not swallow keyboard events for the rest of the page.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### R3 — Type scale  `P2` `FE`

_Steps:_
1. Inspect body text across steps

_Expected:_ 14 px base; no text under 12 px except uppercase section labels; assistant strips and hints readable at AA contrast.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

#### R4 — Step transitions and scroll  `P1` `FE`

_Steps:_
1. Advance through several steps with content scrolled down

_Expected:_ Each step opens scrolled to the top; no visible fade-flash or double render on advance; the SDK stepper pane scrolls to top on pass change.

- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_

---

## Impacted existing screens (regression watch)

| Screen / surface | Repo | What changed | Regression to look for | Cases |
|---|---|---|---|---|
| Dashboard | FE | Challenge panel and floating checklist bubble unmounted; new resume card / not-started nudge. | Missing panel gap, empty-stats layout, no `installation-step-details` request, sidebar submenus no longer auto-open. | L1 J1 |
| Every dashboard page (PageAlert stack) | FE | Resume banner mounted above all alerts; the whole alert stack is hidden on onboarding paths. | Banner shows on /campaigns etc. but not on / or in the wizard; account-lock and payment alerts return after leaving the wizard. | J2 B10 |
| Settings › Sites › Add new site | FE | Success modal removed; navigates into the wizard and appends the site to the session list. | Header SiteSelector duplicate or wrong name; navigation on a failed create; Shopify-session account bounced to /shopify-onboarding. | B1 B2 B5 L9 |
| Settings › Installation · Mobile App Push › Installation | FE | Rebuilt on the wizard bodies; page width 840 → 1120 px; fail path is an inline panel, not a modal. | Verify modal, `?type=` deep links, credential saves, and isolation from the saved onboarding run. | K1–K12 |
| Settings › Site Details | FE | Untouched (reads its own slice), but the install step's URL pencil PATCHes `site_url`. | URL edited on the install page must show here; API-key block styling unchanged. | D4 K9 L7 |
| Design › Popup Modals / Subscription Dialog Box | FE | Wizard writes `optin_settings`; floating-bar preview SCSS switched to centred alignment. | New popup listed ACTIVE with the right style; floating bar icon/text vertical alignment on desktop and mobile. | E7 E8 L4 |
| Audiences › Segments · Audience Groups | FE+BE | Wizard creates items; free plan capped 5 + 5 owner-wide; `disableGlobalErrorHandler` option added to create APIs. | Paid plans unlimited; failed creates still show the global error toast; 6th item on Free → 400. | F3 N2 N3 L5 |
| Campaign › Workflows (builder, templates, clone) | FE+BE | Wizard creates drafts; duplicate-node-id check now on create; HTTP Request endpoint blocklist widened. | Clone/template-to-create still works; drafts open without validation errors; unusual endpoint hosts rejected. | F11 O1 O2 O3 |
| Chat Widgets › create / edit | FE | Preview renderer extracted to `ChatWidgetStage`; new panel max-height and wrap rules. | All attention effects, positions, panel modes, themes, 6+ channels in simple vertical layout. | L3 H5 |
| Push Broadcast · Drip · Triggered · Templates previews | FE | Preview domain line uses `trypushengage.com` for sites created on/after 2026-08-05 (http-only sites). | Old sites still show `pushengage.com`; Safari date parsing; multi-site accounts after a site switch. | L2 |
| Analytics › Goal Tracking · Workflow custom-event drawer · Triggered dynamic code | FE | `IntegrationCode` gained a class that is styled only inside onboarding cards. | Code blocks unchanged (no wrap, no 280 px cap, same font size). | L6 |
| Shopify onboarding | FE | Legacy `_steps.scss` removed; Shopify has its own stepper styles. | Stepper renders as before. | L8 |
| Login / logout | FE | New-user login lands on the new picker; logout sweeps `pe_ai_onboarding*` keys for all sites. | Logout completes in private mode; other localStorage keys survive. | B6 J6 L11 |
| Dashboard install state (`GET installation-details`) | BE | Detection is host-agnostic and split-install aware. | False positive on a page with an unrelated `core/<siteId>.js` script; previously stuck sites now detected. | O6 |
| `GET detect-site-type` | BE | Returns 8 CMS names, not just wordpress. | Frontend handles new values; WordPress + HubSpot embed stays wordpress; `/cdn/shop/` substring on a WP site → shopify. | O7 |
| AI text generation · Broadcast from URL · weekly analytics email | BE | GenerativeAi module gained `generateStructured`; transport code moved to `pinnedTransport`. | Credit debited exactly once; zero-credit 400 intact; blocked-host error text unchanged. | O4 O5 O9 |
| Admin › Plan permissions · Account overrides | BE | Schemas accept `audience_groups.limit`. | Saving a free plan's group keeps the key; owner override can cap a paid account (new power). | N5 N6 |
| Any sub-user (non-admin) route | BE | New `dashboardIsAdmin` named middleware. | Must be applied only to the five onboarding-ai routes. | M8 O8 |

## Known issues & decisions — DO NOT file as bugs

_Confirm they behave as described; file only if the behaviour differs._

- **Failed-check reason sentence is partly hardcoded.** In the "missing" branch the sentence lists what is missing correctly, but the checks pill starts collapsed. A site failing only on HTTPS can be misread until the pill is expanded. Queued follow-up.
- **"I detected {platform} from your site" copy on the CopilotStrip.** Shown even when the platform came from `?type=` or a manual pick. Queued follow-up.
- **Site URL pencil on Settings › Installation persists via PATCH.** Everything else on that page is session-only. Whether to suppress the pencil there is an open product decision (one host flag). Test it as it is (K9).
- **`fallback: true` is not an error.** Model failure, busy lock and hourly/daily cap all return 200 with usable default content. On an environment without a model key every response is a fallback.
- **Free plan gates in the wizard mirror the dashboard.** Locked rows, gated chips and the chat widget limit open the same FeatureGateUpgrade / ChatWidgetUpgradeGate popups. A completed in-flow upgrade lifts the gates immediately.
- **Notification previews use the session's pinned site date.** After a header site switch on a multi-site account the preview apex (pushengage.com vs trypushengage.com) may follow the wrong site. Pre-existing staleness that this PR makes visible; log as a finding.
- **Web and app recommendation tracks share one Redis lock.** A simultaneous cross-track burst can cost a ~12 s wait then the static catalog. Cosmetic in real use.
- **`installation-details` detection dropped its host anchor.** A page with an unrelated script at a path containing `core/<siteId>.js` can read as installed. Rare; report with the page if you hit it.
- **Two comment drifts in the backend.** `Catalog/web.js` says "Workflows (7)" but there are 6; the validator comment mentions 422 where the API returns 400. Not behaviour.
- **`src/App.test.tsx` does not run.** Stock Create React App scaffold test, failing on master too. Unrelated.
- **Functional backend tests 401 locally with a stale `.env.testing`.** Set `SETUP_TEST_ACCOUNT=true` with `TEST_ACCOUNT_EMAIL` / `TEST_ACCOUNT_PASSWORD` to mint a fresh account per run (see test/README.md).
