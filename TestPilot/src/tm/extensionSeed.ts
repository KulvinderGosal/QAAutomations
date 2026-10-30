// PushEngage Browser Extension (QA) v2.0.0 — Chrome MV3, WXT + React 19.
// Built extension at ~/pushengage-browser-extension; source in the monorepo
// (author anjanish-kumar). Token-bridge SSO from a logged-in staging-app-dashboard
// tab → Authorization: Bearer to staging-app.pushengage.com/d/v1. Cases from the
// deep developer-grade audit in this QA pass (issues #999–#1008 in
// awesomemotive/pushengage-app). MANUAL — the toolbar popup + chrome-extension://
// aren't page-drivable, so verify via the dashboard-tab API + running extract-page.js
// logic + inspecting created records (frameworkId null).
import type { TmCase, TmPriority, TmSuite } from "./types";

export const EXT_SUITE_ID = "suite-pe-extension";
export const EXT_SUITES: TmSuite[] = [
  { id: EXT_SUITE_ID, name: "PushEngage Browser Extension (QA v2.0.0)", parentId: null, productId: "pe-extension", order: 60 },
];

const SEED_AT = "2026-09-17T00:00:00.000Z";
type Raw = { key: string; title: string; area: string; priority: TmPriority; issue: string; step: string; expected: string; description: string };
const RAW: Raw[] = [
  {
    key: "EXT-AUTH-01", title: "Token-bridge SSO: dashboard bearer is captured and authorizes the d/v1 API", area: "auth", priority: "high", issue: "",
    step: "Log in to staging-app-dashboard.pushengage.com. Open the toolbar popup. Confirm the extension picks up the session (pe_session in chrome.storage.local) and that all read endpoints respond.",
    expected: "background.js reads localStorage.__PE__token__/__PE__user__/__PE__currentSite__ via chrome.scripting, stores pe_session, and calls staging-app.pushengage.com/d/v1 with Authorization: Bearer + x-pe-client: chrome-extension. All 9 read endpoints (/auth, /sites/{id}, /app-setting, /segments, /audience-groups, /notifications, /active_subscriber_count, /analytics/optin, /credit-usages/credits) return 200.",
    description: "SSO handoff baseline (site 51041 / kgosal). 30-min alarm purges after 6h idle; 401 → refresh once.",
  },
  {
    key: "EXT-EXTRACT-01", title: "Create-from-page prefills title/message/URL(UTM-stripped)/image correctly → draft", area: "extract", priority: "high", issue: "",
    step: "On a content page (e.g. awesomemotive.com) open the popup → create campaign from page → Save as draft. Inspect the created notification record server-side.",
    expected: "notification_title = og:title||document.title; message = og:description; notification_url = canonical with utm_* stripped; big_image = og:image. Draft is created on site 51041 with these values.",
    description: "extract-page.js IIFE returns url/title/description/image/pageType/etc. Verified live on awesomemotive.com draft.",
  },
  {
    key: "EXT-SEC-01", title: "Dashboard bearer token stored in plaintext + broadcast over runtime messaging", area: "security", priority: "normal", issue: "#999",
    step: "Inspect chrome.storage.local after the SSO bridge runs; review background.js token flow.",
    expected: "Token is a full-privilege dashboard bearer stored in cleartext in chrome.storage.local (pe_session) and broadcast via chrome.runtime.sendMessage({type:'dashboard-auth-success', token,...}). Contained (no externally_connectable; 6h idle purge) but the at-rest plaintext + the localStorage read are hardening items — sign off before any non-QA/public build.",
    description: "#999 (MEDIUM x2): plaintext at-rest token; token exfiltrated from dashboard localStorage via injected script. Reasonable for a staging QA build.",
  },
  {
    key: "EXT-PERM-01", title: "Manifest declares unused capabilities (optional contextMenus + <all_urls>)", area: "manifest", priority: "low", issue: "#1000",
    step: "Grep the built extension (background.js + chunks/*.js + extract-page.js) for contextMenus / permissions.request / <all_urls> usage.",
    expected: "Zero hits — neither optional_permissions:['contextMenus'] nor optional_host_permissions:['<all_urls>'] is ever exercised (activeTab covers extraction on gesture). Remove both for least-privilege.",
    description: "#1000 (LOW). Avoids reviewer questions about an unused <all_urls>.",
  },
  {
    key: "EXT-ATTR-01", title: "Extension-created campaigns are attributed source='Dashboard' (no extension attribution)", area: "compose", priority: "low", issue: "#1001",
    step: "Create a campaign via the extension; inspect the notification record's source field.",
    expected: "source = 'Dashboard' — identical to a dashboard-created campaign, so extension-created ones can't be distinguished in reporting. Should stamp a distinct source (e.g. 'Extension') — the x-pe-client header is already present for the backend to key off.",
    description: "#1001a (LOW). No way to measure extension adoption.",
  },
  {
    key: "EXT-TITLE-01", title: "Long extracted page titles are not trimmed for push", area: "extract", priority: "low", issue: "#1001",
    step: "Extract from a page with a long og:title/document.title; check notification_title length on the draft.",
    expected: "Title passes through untrimmed (74 chars on the awesomemotive.com draft) — longer than the ~40-65 char window Chrome/Android show before truncating. Trim (or warn) at create time.",
    description: "#1001b (LOW). Silent delivery-time truncation, no warning.",
  },
  {
    key: "EXT-VALID-01", title: "Action-button label length not enforced to match the app dashboard", area: "validation", priority: "high", issue: "#1003",
    step: "In the extension compose form, enter an action-button label >12 chars; compare against the dashboard's limit and what the backend accepts on send.",
    expected: "Extension caps the action label at Wm.actionLabel = 40, but the dashboard/backend allows only 12 → the extension is over-permissive and the send is rejected. Fix: enforce the SAME allowed length as the dashboard. Verified parity table: title 85=85 ✓, message 135=135 ✓, actionUrl 256=256 ✓, notification URL unguarded, action label 40 vs 12 ✗.",
    description: "#1003 (user-filed). 'Applicable for ALL fields across the fields used in the Chrome extension.'",
  },
  {
    key: "EXT-VALID-02", title: "utm_content input hard-capped at 80 though the extension's own validator allows 120", area: "validation", priority: "low", issue: "#1003",
    step: "In compose UTM fields and Settings UTM defaults, type >80 chars into the utm_content field.",
    expected: "Input maxLength is Wm.utmShort (80) for ALL five UTM fields incl. content, but the campaign validator qm checks utm_content against Wm.utmContent (120) — so the documented 120 is unreachable by typing and the input is stricter than the backend for that field. Bind the content input to utmContent (120), keep the other four at 80.",
    description: "#1003 follow-up (LOW) — opposite direction to the action-label mismatch (input over-restricted vs its own validator).",
  },
  {
    key: "EXT-SCHED-01", title: "Scheduled campaigns created via the extension fail to trigger", area: "schedule", priority: "high", issue: "#1002",
    step: "Create a scheduled ('later') campaign via the extension; inspect the POST payload + whether it ever fires at the scheduled time.",
    expected: "Scheduled campaigns never fire. Code-anchored leads: the submit ALWAYS uses action=sent (F_ → ym(...,'sent'); only 'sent'/'draft' verbs exist, no action=schedule) while status='scheduled'+valid_from; valid_from is a naive local wall-clock string with no timezone (site is Asia/Kolkata) and the existing site-tz converter V_ is unused; no future-time validation (a past time on today's date is POSTed).",
    description: "#1002 (user-filed BUG). Root-cause detail added as a comment on the issue.",
  },
  {
    key: "EXT-AI-01", title: "AI auto-suggest sends the active tab's URL + spends a credit on view open (no user action)", area: "ai-privacy", priority: "normal", issue: "#1007",
    step: "Open the compose AI-suggestions view on a page whose URL carries a non-utm query param (e.g. ?id=SECRET123). Watch the network.",
    expected: "autoSuggest defaults ON (Im={autoExtract:!0,autoSuggest:!0,…}); a one-shot mount effect auto-POSTs to /sites/{id}/generative-ai/extension/broadcast-campaign with {source:'url', url: pageData.url} — no Generate click — and spends an AI credit. pageData.url strips only utm_*, so the full path + non-utm params (session ids/PII) are transmitted. Require an explicit Generate, strip the query, or gate behind first-run consent.",
    description: "#1007 (MEDIUM — privacy/consent + billing). Code anchors independently re-verified.",
  },
  {
    key: "EXT-SESSION-01", title: "Session lifecycle: valid session purged on transient errors; mid-session 401 leaves popup stuck", area: "auth", priority: "normal", issue: "#1006",
    step: "1) Open the popup while briefly offline (or with GET /auth stubbed 503) with a valid pe_session. 2) Force a mid-session 401 (revoke/expire the bearer) then trigger a send/segment action with the popup open.",
    expected: "1) Boot cy() catch calls oy() (removes pe_session/lastActivity) on ANY error → the user is logged out despite a valid token; should purge only on 401 and show a retry/offline state. 2) fm() refresh (cm) no-ops in the normal expiry case, nothing clears the dead session or routes to sign-in → the popup stays on the dashboard and every action re-401s with only a toast; no in-app re-auth path.",
    description: "#1006 (MEDIUM x2). Distinct from #999's token-storage findings.",
  },
  {
    key: "EXT-EXTRACT-02", title: "Page-extraction edge-cases degrade auto-filled campaign content", area: "extract", priority: "normal", issue: "#1008",
    step: "Run extract-page.js against: a lazy-load/srcset page (no og:image), a Yoast @graph article, an array-@type product, a page with header share buttons, a URL with fbclid/gclid, a hash-route SPA, a page with padded/multi-line meta.",
    expected: "7 defects: (1) lazy/srcset images missed → placeholder/empty pushed (u()/d() read only .src); (2) JSON-LD o() ignores @graph/array roots → author/publishDate/videoDuration empty; (3) Product @type array not detected → price lost; (4) socialLinks grabs the first hostname match → captures share/intent widgets; (5) canonicalizer strips only utm_* → fbclid/gclid persist; (6) hash-route SPA misclassified as homepage; (7) title/description never whitespace-collapsed.",
    description: "#1008 (MEDIUM headline #1 + LOW cluster). All in extract-page.js.",
  },
  {
    key: "EXT-COPY-01", title: "Extension intro/onboarding copy updates", area: "copy", priority: "low", issue: "#1005",
    step: "Review the extension's intro/onboarding text against the requested copy changes.",
    expected: "Copy matches the approved text updates.",
    description: "#1005 (user-filed, documentation).",
  },
];

export const EXT_CASES: TmCase[] = RAW.map((r) => ({
  id: `seedcase-ext-${r.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  key: r.key,
  title: r.title,
  description: r.issue ? `${r.description}\n\nGitHub: awesomemotive/pushengage-app ${r.issue}` : r.description,
  suiteId: EXT_SUITE_ID,
  priority: r.priority,
  automation: "manual",
  steps: [{ step: r.step, expected: r.expected }],
  tags: r.issue ? ["extension", "chrome", "mv3", r.area, r.issue.replace("#", "gh-")] : ["extension", "chrome", "mv3", r.area],
  review: "approved",
  frameworkId: null,
  specFile: null,
  lastRunStatus: "unexecuted",
  lastRunAt: null,
  runs: 0,
  source: "seed",
  createdBy: "Kulvinder Singh",
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
  comments: [],
  history: [],
}));
