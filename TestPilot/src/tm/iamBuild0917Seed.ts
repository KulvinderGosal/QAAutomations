// PushEngage IAM Android — 2026-09 build QA (dismiss-on-tap + number-rendering
// build, pushengage-demo-debug-2026-08-20-…-3e3b073.apk) run on the Pixel_9_Pro_Fold
// emulator against staging site 51041 ("QA Staging", app_id 7aa1099e-…). Supplements
// the 2026-08-20 fix-matrix in iamDeviceSeed.ts with this session's live-campaign
// verification + two new SDK findings filed to awesomemotive/pushengage-android-sdk-internal
// (#50 number-rendering height parse, #51 banner touch-block). MANUAL device tests
// (adb + emulator, frameworkId null).
import type { TmCase, TmPriority, TmSuite } from "./types";

export const IAM_0917_SUITE_ID = "suite-iam-0917";
export const IAM_0917_SUITES: TmSuite[] = [
  { id: IAM_0917_SUITE_ID, name: "IAM · 2026-09 build verify (site 51041) + findings", parentId: null, productId: "pe-android-sdk", order: 103 },
];

const SEED_AT = "2026-09-17T00:00:00.000Z";
type Raw = { key: string; title: string; area: string; priority: TmPriority; issue: string; step: string; expected: string; description: string };
const RAW: Raw[] = [
  {
    key: "IAM-B0917-SYNC-01", title: "SDK syncs the site's active IAM campaigns on init", area: "SYNC", priority: "high", issue: "",
    step: "Set the demo app's App ID to the campaign site's key (7aa1099e-… = site 51041), env Staging, Save → Restart. Then In-App Messaging → LOG IAM DATABASE STATE.",
    expected: "logcat: 'Fetched N campaigns … Sync ACTIVE: N campaigns … Full-replace complete'. DB summary: Total IAM Messages = N, Valid = N (3 at time of test, later 5). GET /iam/campaigns/metadata + /iam/campaigns?version=0 against staging-dexter2 back this up.",
    description: "Ground-truth sync check. IAM is push-decoupled ('no subscriber hash yet — skipping subscriber-state fetch' is fine).",
  },
  {
    key: "IAM-B0917-CFG-01", title: "Campaigns not received = App ID / site mismatch, NOT DNS", area: "SYNC", priority: "high", issue: "",
    step: "If the device shows no campaigns: (1) confirm which site the dashboard /in-app-campaigns is on (localStorage.__PE__currentSite__); (2) confirm the app's App ID resolves to the SAME site; (3) dig the IAM host on public resolvers.",
    expected: "Root cause when 'not receiving': the app is on a different site than the authored campaigns. Device on app_id 3bd8264e (site 50524) returns 0 campaigns; the campaigns live on site 51041 (7aa1099e) which returns them. DNS is fine — staging-dexter2.pushengage.com resolves on 1.1.1.1/8.8.8.8 (Cloudflare) and serves HTTP/2 200. Fix = point the App ID at the campaign site.",
    description: "Diagnostic case. IAM syncs by site_key and fires on trigger (auto/custom) subject to audience+frequency — it is not 'sent' like a push.",
  },
  {
    key: "IAM-B0917-DISP-01", title: "Auto top banner renders on app open", area: "DISP", priority: "high", issue: "",
    step: "Cold-open the app on the campaign site. Observe the top of the screen.",
    expected: "The auto/one_time top banner (e.g. 'IAM LIVE CHECK — QA Staging clean render') renders at the top with its X close; logcat 'displayMessageInternal … position TOP … updateLayout: Setting layout for position TOP'.",
    description: "Auto-trigger + TOP position render.",
  },
  {
    key: "IAM-B0917-DISP-02", title: "Auto center modal renders after its delay; 'Allow notifications' fires the OS permission prompt", area: "ACT", priority: "high", issue: "",
    step: "After the top banner is dismissed, the center modal (auto, 3s delay, capped) shows. Tap its 'Allow notifications' button.",
    expected: "Center modal renders (badge/title/subtitle/buttons). Tapping 'Allow notifications' (action type request_notification_permission) posts click analytics AND launches the Android system permission dialog (GrantPermissionsActivity 'Allow PushEngage to send you notifications?'). 'Not now'/X dismiss the modal.",
    description: "request_notification_permission action → real OS prompt. Delay + capped(2/wk) frequency honoured.",
  },
  {
    key: "IAM-B0917-TRIG-01", title: "Custom-event trigger with an Android audience gate matches and displays", area: "TRIG", priority: "high", issue: "",
    step: "In-App Messaging → event name = the campaign's custom event (e.g. aud_plat) → TRIGGER EVENT.",
    expected: "logcat 'Processing IAM trigger: aud_plat … Found 1 eligible messages … Recording impression … displayed'. The banner shows because the audience rule (platform ∈ [Android]) matches the device.",
    description: "Custom-event trigger + audience targeting on-device.",
  },
  {
    key: "IAM-B0917-ACT-01", title: "X-dismiss records a click and advances the queue", area: "AN", priority: "normal", issue: "",
    step: "With a banner up that has an X close, tap the X.",
    expected: "handleAction(<id>) → dismiss; analytics POST {\"btn_id\":…,\"btn_type\":\"dismiss\",\"campaign_id\":…,\"click\":1,\"impression\":0}; 'dismissed or completed, processing next message' → the next queued campaign displays.",
    description: "Dismiss action + click analytics + one-at-a-time queue advance.",
  },
  {
    key: "IAM-B0917-DISP-03", title: "shouldDismissOnTap=false is respected (body tap is a no-op)", area: "DISP", priority: "normal", issue: "",
    step: "Display a banner whose campaign has shouldDismissOnTap=false. Tap the banner body (not a button).",
    expected: "Nothing happens — the banner stays up, no handleAction/dismiss logged. (Verifies the false side of the dismiss-on-tap behaviour; the true side needs a campaign with the flag ON — see iamDeviceSeed IAM-DISP-05..18.)",
    description: "Dismiss-on-tap=false half of the headline fix.",
  },
  {
    key: "IAM-B0917-AN-01", title: "Impressions and display records flush to the backend", area: "AN", priority: "normal", issue: "",
    step: "After displaying/dismissing campaigns, In-App Messaging → LOG IAM DATABASE STATE.",
    expected: "Unsynced Display Records: 0 and Unsynced Analytics Events: 0 — impressions/clicks POST live to staging (seen as okhttp POSTs during the run).",
    description: "Analytics + display-record flush.",
  },
  {
    key: "IAM-B0917-BUG-01", title: "NumberFormatException in IAMWebViewContainer.measureContentHeight (number-rendering)", area: "DISP", priority: "high", issue: "sdk#50",
    step: "Cold-open so the auto campaigns display; watch `adb logcat -s PushEngage` during display.",
    expected: "BUG: 'Error measuring height: For input string: \"null\"' + java.lang.NumberFormatException at IAMWebViewContainer.measureContentHeight (IAMWebViewContainer.kt:427). evaluateJavascript returns the string 'null' (read before layout) and Float.parseFloat is unguarded. Caught/non-fatal (banner still draws) but fires on ~2/3 displays. Guard with toFloatOrNull()+fallback/retry. Related to this build's 'number-rendering' scope — likely an incomplete fix for the null/early-eval case.",
    description: "Filed awesomemotive/pushengage-android-sdk-internal#50 (assigned himshikhar-am).",
  },
  {
    key: "IAM-B0917-BUG-02", title: "Top banner intercepts all host touches; a no-dismiss banner can trap the user", area: "DISP", priority: "high", issue: "sdk#51",
    step: "Display a top banner (~127px). Tap host controls FAR below it. Then force-stop + relaunch (banner gone) and tap the same coordinates.",
    expected: "BUG: with the banner up, taps far below it register nothing ('WebView container added with MATCH_PARENT dimensions' intercepts screen-wide); after restart the same taps work — so the overlay, not a mis-tap, blocked them. A banner with no close button + displayDuration null + shouldDismissOnTap false has NO dismiss affordance → the host is frozen until force-stop. Size the touch surface to the content bounds for TOP/BOTTOM; add a safety dismiss path. (Note: swallowing outside taps IS intended per iamDeviceSeed IAM-DISP-12 — the defect is the screen-wide block + the no-dismiss trap.)",
    description: "Filed awesomemotive/pushengage-android-sdk-internal#51 (assigned himshikhar-am).",
  },
];

export const IAM_0917_CASES: TmCase[] = RAW.map((r) => ({
  id: `seedcase-iam0917-${r.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  key: r.key,
  title: r.title,
  description: r.issue ? `${r.description}` : r.description,
  suiteId: IAM_0917_SUITE_ID,
  priority: r.priority,
  automation: "manual",
  steps: [{ step: r.step, expected: r.expected }],
  tags: r.issue ? ["iam", "android", "0917", r.area.toLowerCase(), r.issue.replace("#", "-")] : ["iam", "android", "0917", r.area.toLowerCase()],
  review: "approved",
  frameworkId: null,
  specFile: null,
  lastRunStatus: r.key.includes("BUG") ? "failed" : "passed",
  lastRunAt: SEED_AT,
  runs: 1,
  source: "seed",
  createdBy: "Kulvinder Singh",
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
  comments: [],
  history: [],
}));
