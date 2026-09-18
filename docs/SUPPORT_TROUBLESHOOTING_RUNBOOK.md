# PushEngage Support Troubleshooting Runbook

> A triage-first debugging checklist for Hybrid Software Support Engineers.
> Goal: resolve or correctly escalate Integration, Opt-in, SDK, Delivery, and
> Analytics tickets **faster** by asking the right questions once and working a
> repeatable checklist.

**How to use this doc**

1. Start with **§1 First-Response Intake** on *every* ticket — collect the data
   before you start debugging. Half of resolution time is lost to back-and-forth.
2. Jump to the section that matches the symptom (§2–§7).
3. Work the checklist top to bottom — items are ordered by how often they're the
   root cause and how cheap they are to check.
4. If you exhaust the checklist, use **§9 Escalation Template** — don't sit on it.

**Legend:** ✅ = confirm this is true · 🔧 = fix action · 🔎 = where to look ·
⚠️ = common gotcha

---

## §1 First-Response Intake (collect on EVERY ticket)

Ask for / capture these up front. Paste them into the ticket so any engineer can
pick it up cold.

- [ ] **Site URL** (exact, including subdomain / path where the issue appears)
- [ ] **PushEngage Site Key / Account** (from dashboard → Settings → Site Details)
- [ ] **Plan** (Free / Business / Premium / Enterprise) — many features are plan-gated
- [ ] **Integration type**: WordPress plugin / Shopify / Website (custom JS) / API / Instant
- [ ] **Browser + version + OS** where it reproduces (e.g. Chrome 129 / Windows 11)
- [ ] **Is the site HTTPS?** (web push requires HTTPS; note if HTTP)
- [ ] **When did it start?** (always / after a change / after plugin or theme update)
- [ ] **Scope**: all visitors, or specific browsers/devices/geographies?
- [ ] **Screenshots / screen recording** of the symptom
- [ ] **Browser console output** (F12 → Console) and Network tab errors
- [ ] **What has the customer already tried?**

⚠️ If the customer is describing "my end" — always confirm whether they tested in
a **fresh/incognito profile**. A support engineer who has already subscribed or
blocked will *never* see the opt-in, and will chase a ghost bug.

---

## §2 Opt-in Not Showing (highest-volume category)

The subscription prompt / dialog box isn't appearing for the visitor. Work these
in order — the first ~5 catch the large majority of tickets.

### 2.1 Visitor-state checks (check these first — usually the cause)

- [ ] ✅ **HTTPS?** Web push requires a valid SSL cert. 🔎 Look for mixed-content
      or cert warnings. HTTP-only sites can only use the http-fallback (subdomain)
      flow — confirm which the account is on.
- [ ] ✅ **Not already subscribed.** If the visitor already allowed notifications,
      the opt-in won't show again. 🔎 `chrome://settings/content/notifications` →
      is the site under "Allowed"? 🔧 Remove it and retry in a fresh profile.
- [ ] ✅ **Not previously blocked/denied.** If permission = *denied*, the browser
      suppresses the prompt permanently until the user resets it. This is a
      **browser-level lock PushEngage cannot override.** 🔧 Reset site permissions
      → reload.
- [ ] ✅ **Fresh session / incognito test.** Rules out cookies, "show again after
      X days" frequency caps, and prior dismissal.
- [ ] ✅ **Supported browser.** Chrome, Edge, Firefox, Opera desktop + Android
      Chrome are fully supported. ⚠️ **iOS Safari** only supports web push when the
      site is installed to the Home Screen as a PWA (iOS 16.4+). Desktop Safari
      uses a different (VAPID/APNs) path — confirm it's configured.
- [ ] ⚠️ **Ad-blockers / privacy extensions** (uBlock, Brave Shields, Ghostery)
      frequently block the PushEngage SDK or the opt-in. 🔧 Test with extensions
      disabled / a clean profile.

### 2.2 Dashboard configuration checks

- [ ] ✅ **An opt-in is created AND set active.** 🔎 Dashboard → Design → Popup
      Modals / Subscription Dialogbox. A drafted-but-inactive opt-in shows nothing.
- [ ] ✅ **Opt-in type matches the setup.** Single-step, Single-step + browser
      prompt, Push Single Opt-in, Bell/Widget, etc. — confirm the expected type is
      the active one.
- [ ] ✅ **Display targeting rules.** URL targeting (show on / hide on specific
      pages), device targeting (desktop vs mobile), and audience/geo rules can all
      legitimately hide the opt-in. 🔎 Confirm the test URL/device/country actually
      matches the rules.
- [ ] ✅ **Display frequency / delay.** "Show after N seconds", "on scroll", "on
      exit-intent", and "don't show again for X days" all delay or suppress the
      prompt. Test accordingly (scroll/wait/exit as configured).
- [ ] ⚠️ **Multiple opt-ins competing** or an old opt-in still active — only one
      should win. Deactivate stale ones.

### 2.3 Technical / installation checks

- [ ] ✅ **SDK / installation code present** on the page. 🔎 View source / Network
      tab for the PushEngage SDK request. No SDK = no opt-in.
- [ ] ✅ **Site Key matches** the account. ⚠️ A copied-from-another-site key, or a
      staging key on production, produces silent failure.
- [ ] ✅ **Service worker registered & reachable.** 🔎 `chrome://serviceworker-internals`
      or DevTools → Application → Service Workers. The `service-worker.js` (and
      `push-sw.js` where applicable) must be served **from the site root** over
      HTTPS with the correct scope, `Content-Type: application/javascript`, and no
      redirect. A 404 or wrong MIME type breaks everything downstream.
- [ ] ⚠️ **Caching / CDN** serving a stale page without the SDK, or caching the SW
      file. 🔧 Purge cache; confirm SW isn't cached with a long TTL.
- [ ] 🔎 **Console errors** — capture any PushEngage / service-worker / CSP errors
      and match against §8.

---

## §3 Integration Issues

Symptom: the platform integration isn't connecting, syncing, or installing
correctly.

### 3.1 WordPress plugin

- [ ] ✅ **Plugin installed & activated**, on a **current version**. 🔧 Update if
      stale — many tickets are already-fixed bugs.
- [ ] ✅ **Account connected / API key entered.** 🔎 PushEngage → Settings →
      confirm connected status (green), correct site selected.
- [ ] ✅ **Correct Site selected** if the account has multiple sites — a mismatch
      installs the wrong site key.
- [ ] ✅ **Service worker file served at root.** WordPress can fail to write
      `service-worker.js` to root on some hosts (read-only FS, security plugins).
      🔎 Visit `https://site.com/service-worker.js` directly — expect JS, not 404.
- [ ] ⚠️ **Caching plugins** (WP Rocket, W3TC, LiteSpeed) or **security plugins**
      (Wordfence) blocking the SW or the SDK. 🔧 Exclude the SW file from caching/
      minification; whitelist PushEngage scripts.
- [ ] ⚠️ **Theme/other-plugin JS conflict** — check console for errors; test with a
      default theme / plugins disabled if reproducible only there.
- [ ] ⚠️ **PHP / WP version** below plugin minimum.

### 3.2 Shopify

- [ ] ✅ **App installed** from the Shopify App Store and connected to the correct
      PushEngage account.
- [ ] ✅ **Embed / theme app extension enabled** in the theme customizer.
- [ ] ⚠️ **Custom / headless themes** may need manual script placement.

### 3.3 Website / custom JS install

- [ ] ✅ **Installation code placed** in `<head>` on **every** page, before
      `</head>`, exactly as generated (no edits to the site key or paths).
- [ ] ✅ **Both files present**: the header snippet **and** the service worker file
      uploaded to the site root over HTTPS.
- [ ] ⚠️ **Async loader / `_peq` queue** used correctly (see §4).
- [ ] ⚠️ **Tag manager (GTM)** injecting the SDK can break service-worker scope
      (SW must be same-origin at root; GTM can't host it). Host the SW file yourself.

### 3.4 Cross-cutting integration checks

- [ ] ✅ **Site Key / API key correct and for the right site.**
- [ ] ✅ **Domain in the ticket matches the domain configured in the dashboard**
      (www vs non-www, http vs https, subdomain).
- [ ] ⚠️ **API integrations**: verify the API key/permissions, request payload, and
      that the endpoint/version being called is current. Capture the exact request +
      response body and status code.

---

## §4 SDK Issues

Symptom: the JS SDK errors, doesn't initialize, or behaves inconsistently.

- [ ] ✅ **SDK actually loads.** 🔎 Network tab — is the SDK request 200? Blocked
      (ad-block), 404 (bad path), or CORS-failed?
- [ ] ✅ **Initialization / async queue** is correct. The SDK uses an async command
      queue (e.g. `window._peq = window._peq || []; _peq.push([...])`). ⚠️ Calling
      SDK methods synchronously before load, or overwriting `_peq`, silently fails.
- [ ] ✅ **Service worker path & scope** match the SDK config. The SW must be at a
      path whose scope covers the pages using push (root scope is safest). A
      mismatched `scope`/`Service-Worker-Allowed` header breaks registration.
- [ ] ⚠️ **Content Security Policy (CSP)** blocking the SDK or SW. 🔎 Console shows
      `Refused to load ... because it violates the following CSP directive`. 🔧 Add
      PushEngage script/connect/worker sources to `script-src`, `connect-src`,
      `worker-src`/`default-src`.
- [ ] ⚠️ **CORS** errors on SDK/API requests — capture the exact blocked origin.
- [ ] ⚠️ **SDK version / stale cached SDK** — hard-reload, clear the SW, confirm the
      latest loader snippet is in use.
- [ ] ⚠️ **SPA / client-side routing** — opt-in logic tied to page load may not fire
      on route changes; confirm expected trigger behavior.
- [ ] 🔎 **Reproduce with a minimal page** (SDK snippet + SW only) to isolate SDK
      vs. site conflict before escalating.

---

## §5 Notifications Not Received / Delivery Issues

Symptom: subscriber exists but campaigns/notifications don't arrive.

- [ ] ✅ **Subscriber is actually subscribed** (permission = *granted*, appears in
      the dashboard subscriber count). A "subscriber" who later blocked won't get
      pushes.
- [ ] ✅ **Campaign actually sent / not still scheduled or draft**, and targeted an
      audience/segment the subscriber belongs to.
- [ ] ✅ **OS-level notifications enabled** for the browser. ⚠️ Windows **Focus
      Assist / Do Not Disturb**, macOS **Do Not Disturb / Focus**, and Android
      per-app notification settings silently swallow pushes. Web push only shows
      while the browser process is running in the background.
- [ ] ✅ **Service worker still active** (not unregistered by a cache-clear, another
      SW taking over the scope, or the user clearing site data).
- [ ] ⚠️ **Plan / quota limits** — subscriber cap or send limits reached on the plan.
- [ ] ⚠️ **Notification content** — required fields, image/icon URL reachable over
      HTTPS, valid CTA URLs.
- [ ] ⚠️ **Delivery vs. display delay** — push delivery can be delayed by the
      browser push service (FCM/Mozilla/Apple) when the device is offline; check
      after the device is online and the browser has run.
- [ ] 🔎 Confirm on a **known-good test subscriber** you control before assuming a
      platform-wide failure.

---

## §6 Analytics / Subscriber-Count Discrepancies

Symptom: numbers in the dashboard don't match customer expectations.

- [ ] ✅ **Define "the number"** — subscribers added vs. active vs. unsubscribed vs.
      views/clicks. Mismatched definitions cause most of these.
- [ ] ⚠️ **Attribution / reporting window & timezone** — customer may compare
      different date ranges or timezones.
- [ ] ⚠️ **Unsubscribes / churn** — count drops are often legitimate opt-outs,
      browser data clears, or expired subscriptions the push service purged.
- [ ] ⚠️ **Duplicate counting across devices/browsers** — one person = multiple
      subscriptions.
- [ ] ⚠️ **Reporting lag** — analytics may aggregate on a delay; compare
      like-for-like timestamps.
- [ ] 🔎 If a genuine discrepancy remains after the above, capture exact numbers +
      screenshots + date ranges and escalate (§9).

---

## §7 Cross-Browser / Permission Reference

**Permission states (`Notification.permission`)**

| State | Meaning | Can opt-in show? | Fix |
|---|---|---|---|
| `default` | Not yet asked | ✅ Yes | Normal — prompt can appear |
| `granted` | Already allowed | ❌ No | Already a subscriber — expected |
| `denied` | Blocked by user/browser | ❌ No | User must reset site permissions; PushEngage cannot override |

**Browser support (high level — always verify current specifics)**

| Browser | Web push | Notes |
|---|---|---|
| Chrome / Edge (desktop + Android) | ✅ | Fully supported over HTTPS |
| Firefox | ✅ | Supported over HTTPS |
| Opera | ✅ | Chromium-based |
| Safari (macOS) | ✅ | Uses VAPID/APNs path — must be configured |
| Safari (iOS/iPadOS) | ⚠️ | Only via Home-Screen PWA, iOS 16.4+ |
| In-app / embedded browsers (FB, IG, etc.) | ❌ | Push generally unsupported |

**Quick self-check the customer can run in Console:**
```js
console.log('permission:', Notification.permission);
navigator.serviceWorker.getRegistrations().then(r => console.log('SWs:', r));
console.log('secure context:', window.isSecureContext);
```

---

## §8 Common Console Errors → Likely Cause

| Console message (pattern) | Likely cause | First action |
|---|---|---|
| SW registration failed / 404 on `service-worker.js` | SW file not at root / not served | Verify file URL returns JS 200 (§2.3, §3.1) |
| Wrong MIME type for service worker | Host serving `.js` as `text/html` | Fix `Content-Type: application/javascript` |
| `Refused to load ... Content Security Policy` | CSP blocking SDK/SW | Allowlist PushEngage sources (§4) |
| `Registration failed - permission denied` | Notifications blocked | User resets site permission (§2.1) |
| CORS / blocked by policy | Cross-origin SDK/API request | Check origin config, host SW same-origin |
| SDK request blocked (net::ERR_BLOCKED) | Ad-blocker / privacy extension | Test clean profile (§2.1) |
| `_peq is not defined` / SDK method undefined | Snippet missing or reordered | Restore exact install snippet (§3.3, §4) |
| Mixed content warning | HTTP asset on HTTPS page | Serve all assets over HTTPS (§2.1) |

---

## §9 Escalation Template (use when the checklist is exhausted)

Only escalate after §1 intake is complete and the relevant checklist is worked.
Paste this into the escalation:

```
### Escalation — <symptom in one line>

**Site URL:**
**Site Key / Account:**
**Plan:**
**Integration:** WordPress / Shopify / Website / API / Instant
**Reproduces on:** <browser+version / OS / device>
**HTTPS:** yes / no
**Started:** always / after <change> on <date>
**Scope:** all visitors / specific <browser|device|geo>

**Symptom:** <what the customer sees vs. expects>

**Checklist worked (with results):**
- HTTPS: ...
- Permission state: ...
- Service worker (URL + status): ...
- Site key matches: ...
- Opt-in active + targeting: ...
- Console/Network errors: <pasted>
- Reproduced by support in clean profile? yes/no

**What I've ruled out:** ...
**Why I believe this is a platform/engineering issue:** ...
**Attachments:** screenshots / HAR / screen recording
```

**Escalate immediately (don't work the full checklist first) when:**
- Data loss / billing / security concern.
- Platform-wide outage signal (multiple customers, same symptom, same time).
- Dashboard 500s / API returning 5xx.

---

## Appendix — 60-Second Triage Flow

```
Ticket in
  │
  ├─ §1 Collect intake (URL, key, browser, HTTPS, integration, console)
  │
  ├─ Symptom = opt-in missing? ──────► §2 (visitor state → config → tech)
  ├─ Symptom = won't connect/install? ► §3 (platform-specific)
  ├─ Symptom = SDK/JS errors? ───────► §4 (load → init → SW scope → CSP)
  ├─ Symptom = pushes not arriving? ──► §5 (subscribed? OS DND? SW active?)
  ├─ Symptom = numbers look wrong? ───► §6 (define metric → window → churn)
  │
  └─ Checklist exhausted ────────────► §9 Escalate with template
```

_Maintained by the Hybrid Software Support team. Keep this doc updated as new
recurring root causes are found — add them to the relevant checklist so the next
engineer resolves it in one pass._
