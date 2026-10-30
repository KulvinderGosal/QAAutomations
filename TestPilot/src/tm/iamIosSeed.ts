// PushEngage iOS SDK — In-App Messaging (IAM) manual test cases.
// Added 2026-08-12 from the iOS SDK branch `task/in-app` (PR
// awesomemotive/pushengage-ios-sdk-internal#51 — "In-app messaging"), which ports
// IAM to iOS: public API triggerInAppMessageEvent / setInAppCustomActionHandler /
// getIAMDatabaseState, Sources/PushEngage/InAppMessaging/* (CoreData + rules/
// condition/trigger-delay/queue engines), and a demo IAM screen
// (PushEngageExample → InAppMessagingTestViewController: event field + "Trigger
// Event" + "IAM Database State"). These are MANUAL scenarios run on the iOS
// Simulator (or a device) with the demo app — NOT the Playwright runner — so
// automation is "manual" / frameworkId null. Case IDs mirror the Android set
// (IAM-<AREA>-<n>) since the feature is a port; keyed IAMIOS-* to stay distinct.
import type { TmPriority, TmStep, TmSuite } from "./types";

export const IAM_IOS_PARENT = "suite-iam-ios";

const AREA_NAME: Record<string, string> = {
  SYNC: "Sync & metadata gating",
  TRIG: "Trigger matching",
  DATE: "Eligibility — date window",
  FREQ: "Eligibility — frequency caps",
  AUD: "Eligibility — audience targeting",
  ELIG: "Eligibility — combined gates",
  QUEUE: "Priority queue",
  POS: "Display & positions",
  DISP: "Display behaviour",
  ACT: "Actions (open URL / dismiss / custom)",
  AN: "Analytics (impressions / clicks / offline)",
  LIFE: "Lifecycle — background / navigation",
  PERSIST: "Persistence & campaign replace",
  SEC: "WebView behaviour & security",
  EDGE: "Robustness / edge cases",
};

const HIGH = new Set(["SYNC", "TRIG", "AUD", "ACT", "DISP", "POS", "DATE", "FREQ", "ELIG"]);

const RAW: string[] = [
  "IAMIOS-SYNC-01 — Campaigns sync on app launch (visible in IAM Database State)",
  "IAMIOS-SYNC-02 — Version unchanged → no refetch; version changed → refetch",
  "IAMIOS-SYNC-03 — iam_status inactive purges local campaigns",
  "IAMIOS-SYNC-04 — Works without a push subscription (IAM is push-decoupled)",
  "IAMIOS-TRIG-01 — Custom event fires the matching campaign",
  "IAMIOS-TRIG-02 — Non-matching event shows nothing",
  "IAMIOS-TRIG-03 — Auto (app-open) campaign displays on launch/resume",
  "IAMIOS-TRIG-04 — App-open fires once per session",
  "IAMIOS-TRIG-05 — Trigger parameters match → shows; mismatch → does not show",
  "IAMIOS-DATE-01 — Within date window shows; before start / after end does not",
  "IAMIOS-DATE-02 — Null dates = always eligible (date-wise)",
  "IAMIOS-FREQ-01 — Show-once campaign shows only once",
  "IAMIOS-FREQ-02 — Capped campaign stops after N shows",
  "IAMIOS-FREQ-03 — Frequency cap survives a sync",
  "IAMIOS-AUD-01 — platform eq [iOS] matches on the iOS device",
  "IAMIOS-AUD-02 — Audience value is case-sensitive (exact match)",
  "IAMIOS-AUD-03 — Numeric compare on os_version",
  "IAMIOS-AUD-04 — Custom subscriber-attribute targeting",
  "IAMIOS-AUD-05 — Multiple conditions must all pass; no audience = everyone",
  "IAMIOS-ELIG-01 — Date + frequency + audience all pass → shows",
  "IAMIOS-ELIG-02 — Any single gate failing suppresses the campaign",
  "IAMIOS-POS-01 — Top banner renders at top",
  "IAMIOS-POS-02 — Bottom banner renders at bottom",
  "IAMIOS-POS-03 — Center modal renders centered",
  "IAMIOS-POS-04 — Full-screen takeover renders",
  "IAMIOS-DISP-01 — Auto-dismiss after display duration",
  "IAMIOS-DISP-02 — Dismiss button closes the message",
  "IAMIOS-DISP-03 — Banner not dismissed by an outside tap",
  "IAMIOS-DISP-04 — shouldDismissOnTap behaviour",
  "IAMIOS-ACT-01 — Open-URL button opens the link (Safari / in-app)",
  "IAMIOS-ACT-02 — Custom button calls the app's InAppCustomActionHandler",
  "IAMIOS-ACT-03 — Handled action auto-dismisses the message",
  "IAMIOS-ACT-04 — Multiple buttons route to their own actions",
  "IAMIOS-AN-01 — Impression recorded on display",
  "IAMIOS-AN-02 — Click reported with button details",
  "IAMIOS-AN-03 — Offline impression/click queued and flushed on reconnect",
  "IAMIOS-LIFE-01 — Message survives backgrounding / foregrounding",
  "IAMIOS-LIFE-02 — Screen navigation does not dismiss the message",
  "IAMIOS-PERSIST-01 — Full-replace sync drops removed campaigns",
  "IAMIOS-PERSIST-02 — Empty campaign set purges all",
  "IAMIOS-SEC-01 — Inline anchors / JS redirect handled safely in the WebView",
  "IAMIOS-EDGE-01 — Empty / non-HTML content does not crash",
  "IAMIOS-EDGE-02 — Rapid triggers handled gracefully",
  "IAMIOS-EDGE-03 — No network on launch (cached campaigns still display)",
];

export type IamIosSeedCase = {
  id: string; key: string; title: string; area: string; suiteId: string; priority: TmPriority; steps: TmStep[];
};

const parse = (raw: string): IamIosSeedCase => {
  const m = raw.match(/^(IAMIOS-([A-Z]{2,6})-(\d+))\s*—\s*(.+)$/);
  const key = m ? m[1] : raw;
  const area = m ? m[2] : "MISC";
  const num = m ? m[3] : "0";
  const desc = m ? m[4].trim() : raw;
  return {
    id: `seedcase-iamios-${area.toLowerCase()}-${num}`,
    key,
    title: raw,
    area,
    suiteId: `suite-iamios-${area.toLowerCase()}`,
    priority: HIGH.has(area) ? "high" : "normal",
    steps: [
      {
        step: "Run on the iOS Simulator (or a device) with the PushEngageExample demo app built from the `task/in-app` branch, pointed at the staging site: use the In-App Messaging test screen (event field + 'Trigger Event') and the 'IAM Database State' panel; verify display + logs.",
        expected: desc,
      },
    ],
  };
};

export const IAM_IOS_CASES: IamIosSeedCase[] = RAW.map(parse);

// Custom event to fire per case ("" = app-open/auto launch). EVERY iOS case is
// launchable on the Simulator via TestPilot's "Run on device"; this map only
// overrides the fire event for cases that need a specific custom event.
export const IAM_IOS_RUNNABLE: Record<string, string> = {
  "IAMIOS-TRIG-01": "iam_live_verify",
  "IAMIOS-TRIG-02": "zzz_no_match",
  "IAMIOS-EDGE-02": "iam_live_verify",
};

// Which cases a device run can AUTO-VERIFY from the SDK's own state dump
// (getIAMDatabaseState) / crash check — a real behavioral assertion, not just
// "app launched". Everything else launches + screenshots and is left for MANUAL
// record (status "skipped" — you confirm from the screenshot via Record result),
// because its outcome (rendered banner content, tap actions, audience/date/freq
// gating, offline flush) can't be reliably read from state alone.
//   synced     → IAM synced on launch (Total Campaigns > 0)
//   impression → an impression was recorded (Unsynced Analytics Events > 0)
//   alive      → app did not crash (robustness/edge cases)
//   display    → an in-app message actually rendered on the device this run
//                (run-case.sh v2 dense-captures + emits `IAM_DISPLAY: shown`);
//                proves the message displayed/renders at its position — confirm
//                the exact position/content from the attached screenshot.
export type IosAssert = "synced" | "impression" | "alive" | "display";
export const IAM_IOS_ASSERT: Record<string, IosAssert> = {
  "IAMIOS-SYNC-01": "synced",
  "IAMIOS-SYNC-02": "synced",
  "IAMIOS-SYNC-04": "synced",
  "IAMIOS-AN-01": "impression",
  "IAMIOS-EDGE-01": "alive",
  "IAMIOS-EDGE-02": "alive",
  // display/render cases — pass when a banner actually appeared on device
  "IAMIOS-POS-01": "display",
  "IAMIOS-POS-02": "display",
  "IAMIOS-POS-03": "display",
  "IAMIOS-POS-04": "display",
  "IAMIOS-TRIG-01": "display",
  "IAMIOS-TRIG-03": "display",
  "IAMIOS-DISP-01": "display",
};

export const IAM_IOS_SUITES: TmSuite[] = [
  { id: IAM_IOS_PARENT, name: "IAM iOS — In-App Messaging (PR #51, task/in-app)", parentId: null, productId: "pe-ios-sdk", order: 103 },
  ...[...new Set(IAM_IOS_CASES.map((c) => c.area))].map((area, i) => ({
    id: `suite-iamios-${area.toLowerCase()}`,
    name: AREA_NAME[area] ?? area,
    parentId: IAM_IOS_PARENT,
    order: 120 + i,
  })),
];
