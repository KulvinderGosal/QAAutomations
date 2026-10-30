// PushEngage Android SDK — In-App Messaging (IAM) manual test cases.
// Imported 2026-08-11 from the Asana umbrella task "IAM Android — In-App Messaging
// QA (all scenarios)" (github PR awesomemotive/pushengage-android-sdk-internal#34).
// These are MANUAL, on-device scenarios (run by hand on a real Android device with
// the demo app + its "IAM Database State" panel — NOT the Playwright runner), so
// automation is "manual" / frameworkId null. Case IDs (IAM-<AREA>-<n>) mirror Asana.
// 166 of the 171 subtasks were captured (a few skipped IDs, e.g. AUD-05/12, FREQ-04/05,
// SYNC-06/07/08, EDGE-01, are gaps in Asana's numbering).
import type { TmPriority, TmStep, TmSuite } from "./types";

export const IAM_ANDROID_PARENT = "suite-iam-android";

// Area prefix → readable sub-suite name (the 13 areas from the Asana umbrella,
// split by the case-ID prefix actually used).
const AREA_NAME: Record<string, string> = {
  SYNC: "Sync & metadata gating",
  TRIG: "Trigger matching",
  DATE: "Eligibility — date window",
  FREQ: "Eligibility — frequency caps",
  AUD: "Eligibility — audience targeting",
  ELIG: "Eligibility — combined gates",
  DELAY: "Trigger delay",
  QUEUE: "Priority queue",
  POS: "Display & positions",
  DISP: "Display behaviour",
  ORI: "Lifecycle — rotation / orientation",
  LIFE: "Lifecycle — nav / backgrounding",
  ENV: "Environment / device",
  ACT: "Actions (open URL / dismiss / custom / permission)",
  PERM: "Notification permission",
  AN: "Analytics (impressions / clicks / offline)",
  SEC: "WebView behaviour & security",
  PUSH: "Push interaction",
  DB: "Database migration",
  EDGE: "Robustness / edge cases",
  CONTENT: "Content rendering (images)",
  PERSIST: "Persistence & campaign replace",
};

// Areas kept at "high"; everything else defaults to "normal".
const HIGH = new Set(["SYNC", "TRIG", "AUD", "ACT", "DISP", "QUEUE", "PERM", "DB", "ELIG", "POS", "DATE", "FREQ", "PERSIST"]);

// The 166 scenarios, verbatim from Asana ("IAM-<AREA>-<n> — <title>").
const RAW: string[] = [
  "IAM-ACT-01 — Open URL button opens https link",
  "IAM-ACT-02 — Open URL without scheme defaults to https",
  "IAM-ACT-03 — Non-web URL scheme is rejected",
  "IAM-ACT-04 — Dismiss button closes the message",
  "IAM-ACT-05 — Custom button calls the app handler",
  "IAM-ACT-06 — Custom button with no listener is safe",
  "IAM-ACT-07 — Handled action auto-dismisses the message",
  "IAM-ACT-08 — Multiple buttons route to their own actions",
  "IAM-ACT-09 — A button that cannot do its job still closes the message",
  "IAM-AN-01 — Impression recorded on display",
  "IAM-AN-02 — One impression per display (rotation)",
  "IAM-AN-03 — Tapping a button reports a click with the button details",
  "IAM-AN-04 — Offline impression is queued",
  "IAM-AN-05 — Offline click is queued",
  "IAM-AN-06 — Queued analytics flush on reconnect",
  "IAM-AN-07 — Analytics keep sending after the network drops and comes back",
  "IAM-AUD-01 — Audience match on a built-in field shows",
  "IAM-AUD-02 — Audience value is case-sensitive",
  "IAM-AUD-03 — Not-equal audience rule matches a differing value",
  "IAM-AUD-04 — os_version is the marketing version, not the API level",
  "IAM-AUD-06 — Membership (in / not-in) audience rule",
  "IAM-AUD-07 — Contains audience rule",
  "IAM-AUD-08 — Custom attribute targeting (attr. prefix, loads on app open)",
  "IAM-AUD-09 — Trigger parameters are NOT visible to audience rules",
  "IAM-AUD-10 — Missing attribute with a positive rule does not show",
  "IAM-AUD-11 — Missing attribute with a negative rule shows",
  "IAM-AUD-13 — Multiple audience conditions must all pass",
  "IAM-AUD-14 — No audience means everyone",
  "IAM-AUD-15 — device_model is NOT a filterable field",
  "IAM-AUD-16 — language field resolves",
  "IAM-AUD-17 — Single scalar value form is accepted",
  "IAM-AUD-18 — OR between audience groups (match any)",
  "IAM-AUD-19 — AND between audience groups (match all)",
  "IAM-AUD-20 — AND inside a group",
  "IAM-AUD-21 — OR inside a group",
  "IAM-AUD-22 — 'at least' (gte) includes the boundary value",
  "IAM-AUD-23 — 'at most' (lte) includes the boundary value",
  "IAM-AUD-24 — Versions compare as versions, not as text",
  "IAM-AUD-25 — Missing version components count as zero",
  "IAM-AUD-26 — app_version resolves",
  "IAM-AUD-27 — timezone resolves",
  "IAM-AUD-28 — notification_enabled reflects the actual permission",
  "IAM-AUD-29 — device_region is the device locale region",
  "IAM-AUD-30 — geo_country comes from the network location",
  "IAM-AUD-31 — city and state resolve",
  "IAM-AUD-32 — segments 'includes' matches",
  "IAM-AUD-33 — segments 'includes' with no overlap",
  "IAM-AUD-34 — segments 'excludes' is the inverse of 'includes'",
  "IAM-AUD-35 — Segment removal takes effect",
  "IAM-AUD-36 — An attribute cannot override a built-in field",
  "IAM-AUD-37 — Numeric attribute compares as a number",
  "IAM-AUD-38 — Text operators are refused on version fields",
  "IAM-AUD-39 — Fresh install may defer subscriber-data rules on the first open",
  "IAM-AUD-40 — Device-only rules still work on the first open",
  "IAM-AUD-41 — Subscriber-data rules need push set up",
  "IAM-DATE-01 — Campaign within its date window shows",
  "IAM-DATE-02 — Campaign before its start date does not show",
  "IAM-DATE-03 — Campaign after its end date does not show",
  "IAM-DATE-04 — No dates set means always eligible",
  "IAM-DB-01 — Upgrade from a pre-IAM build",
  "IAM-DB-02 — Fresh install works",
  "IAM-DELAY-01 — App-open delay holds the message back",
  "IAM-DELAY-02 — The delay counts from app open, not from when loading finishes",
  "IAM-DELAY-03 — A short delay is already spent by the time loading ends",
  "IAM-DELAY-04 — Backgrounding pauses the countdown",
  "IAM-DELAY-05 — No delay configured behaves as before",
  "IAM-DELAY-06 — Delay applies to app-open campaigns only",
  "IAM-DISP-01 — Auto-dismiss after display duration",
  "IAM-DISP-02 — Back button while a message is shown",
  "IAM-DISP-03 — Banners not dismissed by outside tap or fling",
  "IAM-DISP-04 — shouldDismissOnTap behavior",
  "IAM-EDGE-02 — Empty / non-HTML content does not crash",
  "IAM-EDGE-03 — No network on launch",
  "IAM-EDGE-04 — Rapid triggers handled gracefully",
  "IAM-EDGE-05 — Trigger displays promptly during a slow sync",
  "IAM-EDGE-06 — Trigger with no foreground screen",
  "IAM-ELIG-01 — Date + frequency + audience all pass",
  "IAM-ELIG-02 — Any single gate failing suppresses the campaign",
  "IAM-ELIG-03 — Trigger and audience must both match",
  "IAM-ENV-01 — Phone vs tablet width",
  "IAM-ENV-02 — Edge-to-edge / gesture navigation",
  "IAM-ENV-03 — Display cutout / notch",
  "IAM-ENV-04 — 3-button vs gesture navigation",
  "IAM-ENV-05 — Dark mode",
  "IAM-ENV-06 — Large font and display size",
  "IAM-ENV-07 — Split-screen / multi-window",
  "IAM-FREQ-01 — Show-once campaign shows only once",
  "IAM-FREQ-02 — capped stops after N shows (count only)",
  "IAM-FREQ-03 — Recurring campaign respects its interval",
  "IAM-FREQ-06 — Frequency cap survives a campaign sync",
  "IAM-FREQ-07 — 'capped' also enforces its minimum gap",
  "IAM-FREQ-08 — 'capped' with no minimum gap",
  "IAM-FREQ-09 — 'recurring' has no total limit",
  "IAM-LIFE-01 — Message survives rotation",
  "IAM-LIFE-02 — Screen navigation does not dismiss the message",
  "IAM-LIFE-03 — Backgrounding dismisses the message",
  "IAM-LIFE-04 — Backgrounding from a second screen dismisses",
  "IAM-LIFE-05 — App open does not re-fire on return from background",
  "IAM-LIFE-06 — No display into a destroyed screen",
  "IAM-LIFE-07 — Notification shade does not dismiss the message",
  "IAM-LIFE-08 — Recent-apps overview then return",
  "IAM-LIFE-09 — App-open message is not lost if you leave the app while it is starting",
  "IAM-ORI-01 — All positions render in portrait",
  "IAM-ORI-02 — All positions render in landscape",
  "IAM-ORI-03 — Rotate portrait→landscape with a top banner showing",
  "IAM-ORI-04 — Rotate portrait→landscape with a bottom banner showing",
  "IAM-ORI-05 — Rotate portrait→landscape with a centre modal showing",
  "IAM-ORI-06 — Rotate portrait→landscape with a full-screen takeover showing",
  "IAM-ORI-07 — Rotate landscape→portrait (the reverse direction)",
  "IAM-ORI-08 — Rotate while the message is animating in or out",
  "IAM-ORI-09 — Rotate while the message content is still loading",
  "IAM-ORI-10 — Rotate several times quickly",
  "IAM-ORI-11 — Tall content in landscape becomes scrollable",
  "IAM-ORI-12 — Auto-dismiss timer is not disturbed by rotation",
  "IAM-ORI-13 — App launched already in landscape",
  "IAM-ORI-14 — Host screen locked to one orientation",
  "IAM-ORI-15 — Demo app screens are usable in landscape",
  "IAM-PERM-01 — Permission button shows system dialog (Android 13+)",
  "IAM-PERM-02 — Granting permission auto-subscribes",
  "IAM-PERM-03 — Denying permission is handled cleanly",
  "IAM-PERM-04 — Already-granted permission does not re-prompt",
  "IAM-PERM-05 — Permission button is a no-op below Android 13",
  "IAM-PERM-06 — Permission flow works from both host types",
  "IAM-POS-01 — Top banner renders correctly",
  "IAM-POS-02 — Bottom banner renders correctly",
  "IAM-POS-03 — Center modal renders and dismisses",
  "IAM-POS-04 — Full-screen takeover renders correctly",
  "IAM-POS-05 — Message sized to its content",
  "IAM-POS-06 — Tall content scrolls",
  "IAM-POS-07 — Entry and exit animations",
  "IAM-POS-08 — Centre modal never grows past its height limit",
  "IAM-PUSH-01 — Push arrives while a message is shown",
  "IAM-PUSH-02 — Open app via notification tap with a pending message",
  "IAM-QUEUE-01 — Higher priority shows first",
  "IAM-QUEUE-02 — Only one message at a time",
  "IAM-QUEUE-03 — Same campaign is not duplicated in the queue",
  "IAM-QUEUE-04 — Dismiss advances to the next message",
  "IAM-QUEUE-05 — Higher-priority trigger does not preempt",
  "IAM-SEC-01 — In-message links do not navigate the web view",
  "IAM-SEC-02 — http(s) link opens in external browser",
  "IAM-SEC-03 — Non-web / relative links are dropped",
  "IAM-SEC-04 — Renders without crashing on very old Android",
  "IAM-SYNC-01 — Immediate sync on app open",
  "IAM-SYNC-02 — Periodic background sync is scheduled",
  "IAM-SYNC-03 — Inactive status purges campaigns",
  "IAM-SYNC-04 — Nothing changed on the dashboard means no re-download",
  "IAM-SYNC-05 — Version changed triggers refetch",
  "IAM-SYNC-09 — No App ID means no sync",
  "IAM-SYNC-10 — IAM works without push subscription",
  "IAM-TRIG-01 — Custom event shows matching campaign",
  "IAM-TRIG-02 — Non-matching event shows nothing",
  "IAM-TRIG-03 — Auto campaign shows on app open",
  "IAM-TRIG-04 — Auto campaign fires once per app session",
  "IAM-TRIG-05 — Event with matching parameters shows campaign",
  "IAM-TRIG-06 — Event with mismatched parameter does not show",
  "IAM-TRIG-07 — Params passed while the campaign has no conditions",
  "IAM-TRIG-08 — All parameters must match (one differs)",
  "IAM-TRIG-09 — Parameter value is case-sensitive",
  "IAM-TRIG-10 — Empty params behaves like no params",
  "IAM-TRIG-11 — Numeric trigger rule compares as a number",
  "IAM-TRIG-12 — Decimal parameter matches a whole-number rule",
  "IAM-TRIG-13 — Extra event parameters are ignored",
  "IAM-TRIG-14 — Missing parameter with a positive rule",
  "IAM-TRIG-15 — Missing parameter with a negative rule",
  "IAM-TRIG-16 — Trigger conditions match ANY",
  "IAM-TRIG-17 — Trigger conditions match ALL",
  // Added 2026-08-11 (2nd Asana refresh — CONTENT + PERSIST areas, now 171 subtasks).
  "IAM-CONTENT-01 — Remote image renders",
  "IAM-CONTENT-02 — Broken or slow image degrades gracefully",
  "IAM-PERSIST-01 — Full replace drops removed campaigns",
  "IAM-PERSIST-02 — Survivor keeps display history",
  "IAM-PERSIST-03 — Empty campaign set purges all",
];

export type IamSeedCase = {
  id: string;
  key: string;
  title: string;
  area: string;
  suiteId: string;
  priority: TmPriority;
  steps: TmStep[];
};

const parse = (raw: string): IamSeedCase => {
  const m = raw.match(/^(IAM-([A-Z]{2,8})-(\d+))\s*—\s*(.+)$/);
  const key = m ? m[1] : raw;
  const area = m ? m[2] : "MISC";
  const num = m ? m[3] : "0";
  const desc = m ? m[4].trim() : raw;
  return {
    id: `seedcase-iam-${area.toLowerCase()}-${num}`,
    key,
    title: raw,
    area,
    suiteId: `suite-iam-${area.toLowerCase()}`,
    priority: HIGH.has(area) ? "high" : "normal",
    steps: [
      {
        step: "Run on a real Android device with the demo app (IAM screen + 'IAM Database State' panel) and the staging IAM campaigns; follow the matching scenario in the Asana IAM umbrella task.",
        expected: desc,
      },
    ],
  };
};

export const IAM_ANDROID_CASES: IamSeedCase[] = RAW.map(parse);

// Cases that now have a Maestro E2E flow in ~/QA-Automations/iam-android/automation/
// (authored 2026-08-11 for the UI-automatable subset — display/positions, actions,
// lifecycle, rotation). Maps the case key → its flow path. Cases NOT listed here
// remain manual-only on-device. Used to tag "maestro" + set specFile on those cases
// so the board shows Maestro-covered vs pure-manual. They stay automation:"manual"
// (Maestro-assisted device runs, not the Playwright/spec runner).
export const IAM_MAESTRO_COVERAGE: Record<string, string> = {
  "IAM-SYNC-01": "iam-android/automation/flows/iam-sync-01-db-state.yaml",
  "IAM-TRIG-01": "iam-android/automation/flows/iam-trig-01-custom-event.yaml",
  "IAM-TRIG-03": "iam-android/automation/flows/iam-auto-display-smoke.yaml",
  "IAM-POS-01": "iam-android/automation/flows/iam-auto-display-smoke.yaml",
  "IAM-POS-02": "iam-android/automation/flows/iam-pos-positions.yaml",
  "IAM-POS-03": "iam-android/automation/flows/iam-pos-positions.yaml",
  "IAM-POS-04": "iam-android/automation/flows/iam-pos-positions.yaml",
  "IAM-QUEUE-01": "iam-android/automation/flows/iam-auto-display-smoke.yaml",
  "IAM-QUEUE-02": "iam-android/automation/flows/iam-pos-positions.yaml",
  "IAM-QUEUE-04": "iam-android/automation/flows/iam-pos-positions.yaml",
  "IAM-ACT-04": "iam-android/automation/flows/iam-act-04-dismiss.yaml",
  "IAM-DISP-02": "iam-android/automation/flows/iam-act-04-dismiss.yaml",
  "IAM-LIFE-03": "iam-android/automation/flows/iam-life-03-background-dismiss.yaml",
  "IAM-LIFE-05": "iam-android/automation/flows/iam-life-03-background-dismiss.yaml",
  "IAM-ORI-01": "iam-android/automation/flows-adb/iam-ori-01-portrait.yaml",
  "IAM-LIFE-01": "iam-android/automation/flows-adb/iam-ori-01-portrait.yaml",
};

// Parent suite + one sub-suite per area that actually has cases (linked to the
// Android SDK product so it groups with the other mobile suites).
export const IAM_ANDROID_SUITES: TmSuite[] = [
  { id: IAM_ANDROID_PARENT, name: "IAM Android — In-App Messaging (PR #34)", parentId: null, productId: "pe-android-sdk", order: 102 },
  ...[...new Set(IAM_ANDROID_CASES.map((c) => c.area))].map((area, i) => ({
    id: `suite-iam-${area.toLowerCase()}`,
    name: AREA_NAME[area] ?? area,
    parentId: IAM_ANDROID_PARENT,
    order: 110 + i,
  })),
];
