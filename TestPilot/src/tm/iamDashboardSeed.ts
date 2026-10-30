// PushEngage App Dashboard — In-App Messaging (IAM) manual test cases.
// Added 2026-08-12. These are MANUAL, browser-driven QA scenarios for the IAM
// feature IN THE APP DASHBOARD (staging-app-dashboard.pushengage.com/in-app-campaigns):
// the template gallery, the message designer (blocks/positions/preview), trigger,
// audience, schedule, frequency, and campaign management. Run by hand (or via
// Claude-in-Chrome) against a staging site — NOT the Playwright runner — so
// automation is "manual" / frameworkId null. Case IDs: IAMD-<AREA>-<n>.
// Bugs found go to github.com/awesomemotive/pushengage-app/issues.
import type { TmPriority, TmStep, TmSuite } from "./types";

export const IAM_DASH_PARENT = "suite-iamdash";

const AREA_NAME: Record<string, string> = {
  TPL: "Template gallery & selection",
  DSN: "Message designer (blocks)",
  POS: "Message style / position",
  DSP: "Display behaviour",
  TRG: "Trigger",
  AUD: "Audience targeting",
  SCH: "Schedule",
  FRQ: "Frequency",
  MGT: "Campaign management (list / activate / edit / delete / analytics)",
  VAL: "Validation & edge cases",
};

const HIGH = new Set(["TPL", "DSN", "TRG", "AUD", "MGT"]);

const RAW: string[] = [
  // Template gallery & selection
  "IAMD-TPL-01 — Template Gallery loads and lists the available templates",
  "IAMD-TPL-02 — Style filter tabs (All / Top Banner / Bottom Banner / Center Modal / Full Screen) filter the gallery",
  "IAMD-TPL-03 — Template search filters the gallery by name",
  "IAMD-TPL-04 — Selecting a template opens the designer prefilled with that template",
  "IAMD-TPL-05 — My Templates tab lists the user's saved templates",
  "IAMD-TPL-06 — 'Design your own' → style picker → Start Designing opens a blank designer of that style",
  "IAMD-TPL-07 — Saving a design as a template makes it appear under My Templates",
  // Message designer (blocks)
  "IAMD-DSN-01 — Add each block type (Container, Text, Button, Image, Video, Divider, Spacer, Close) to the canvas",
  "IAMD-DSN-02 — Text block content is editable via the properties panel and reflects in the preview",
  "IAMD-DSN-03 — Button block: label, action (open URL / custom / dismiss) and target are configurable",
  "IAMD-DSN-04 — Image block accepts a remote image URL and renders it in the preview",
  "IAMD-DSN-05 — Blocks can be reordered and deleted",
  "IAMD-DSN-06 — Block limits enforced (e.g. Full Screen: up to 12 blocks + 2 Button blocks; Close always included)",
  "IAMD-DSN-07 — Background (color / gradient / image), corner radius, padding, alignment apply to the container",
  "IAMD-DSN-08 — Device preview switcher + Portrait/Landscape re-render the message",
  "IAMD-DSN-09 — Undo / redo work in the designer",
  // Style / position
  "IAMD-POS-01 — Top Banner style builds and previews correctly",
  "IAMD-POS-02 — Bottom Banner style builds and previews correctly",
  "IAMD-POS-03 — Center Modal style builds and previews correctly",
  "IAMD-POS-04 — Full Screen style builds and previews correctly",
  "IAMD-POS-05 — Switching style in the editor preserves the content blocks",
  // Display behaviour
  "IAMD-DSP-01 — 'Dismiss on tap' (close on tap outside) can be enabled",
  // Trigger
  "IAMD-TRG-01 — Trigger 'App open' saves and shows on app open",
  "IAMD-TRG-02 — Trigger 'App open' + 'Wait a few seconds before showing' delay saves",
  "IAMD-TRG-03 — Trigger 'On event' requires an event name and saves it",
  // Audience targeting
  "IAMD-AUD-01 — Add Condition: field + operator (is any of / is none of) + value builds a rule",
  "IAMD-AUD-02 — Platform is-any-of [Android]/[iOS] rule saves",
  "IAMD-AUD-03 — Multiple AND conditions in one group",
  "IAMD-AUD-04 — Add OR Group creates an alternative condition group",
  "IAMD-AUD-05 — Remove condition / remove group",
  "IAMD-AUD-06 — 'All users' (no conditions) is the default",
  "IAMD-AUD-07 — Attribute condition with Number type + 'is equal to' builds a numeric rule",
  "IAMD-AUD-08 — Attribute condition on the default Text type + 'is equal to'",
  // Schedule
  "IAMD-SCH-01 — Start Now vs Schedule Start (future date) save correctly",
  "IAMD-SCH-02 — Run Continuously vs End On a Specific Date save correctly",
  // Frequency
  "IAMD-FRQ-01 — Show-once ('Each user sees it one time') saves",
  "IAMD-FRQ-02 — Capped (show N times) saves",
  "IAMD-FRQ-03 — Recurring / interval saves",
  // Campaign management
  "IAMD-MGT-01 — Campaign list shows name, style, Impressions / Clicks / Closes",
  "IAMD-MGT-02 — Save and Activate publishes the campaign (appears Active)",
  "IAMD-MGT-03 — Save as Draft keeps it out of Active",
  "IAMD-MGT-04 — Edit an existing campaign and re-save",
  "IAMD-MGT-05 — Activate / Deactivate toggles a campaign's state",
  "IAMD-MGT-06 — Duplicate a campaign",
  "IAMD-MGT-07 — Delete a campaign (with confirm)",
  "IAMD-MGT-08 — Preview / eye action renders the campaign",
  "IAMD-MGT-09 — Export Data downloads the campaign report",
  "IAMD-MGT-10 — All / Active / Inactive / Draft tab counts are accurate",
  // Validation & edge cases
  "IAMD-VAL-01 — Activating an empty (no-content) campaign is blocked with a clear error",
  "IAMD-VAL-02 — On-event trigger with a blank event name is blocked",
  "IAMD-VAL-03 — Very long text / many blocks do not break the designer or preview",
  "IAMD-VAL-04 — Switching site while editing preserves or safely discards the draft",
];

export type IamDashSeedCase = {
  id: string;
  key: string;
  title: string;
  area: string;
  suiteId: string;
  priority: TmPriority;
  steps: TmStep[];
};

const parse = (raw: string): IamDashSeedCase => {
  const m = raw.match(/^(IAMD-([A-Z]{2,5})-(\d+))\s*—\s*(.+)$/);
  const key = m ? m[1] : raw;
  const area = m ? m[2] : "MISC";
  const num = m ? m[3] : "0";
  const desc = m ? m[4].trim() : raw;
  return {
    id: `seedcase-iamdash-${area.toLowerCase()}-${num}`,
    key,
    title: raw,
    area,
    suiteId: `suite-iamdash-${area.toLowerCase()}`,
    priority: HIGH.has(area) ? "high" : "normal",
    steps: [
      {
        step: "On the PushEngage app dashboard (staging-app-dashboard.pushengage.com/in-app-campaigns), on a staging site, exercise this In-App Messaging flow in the browser.",
        expected: desc,
      },
    ],
  };
};

export const IAM_DASH_CASES: IamDashSeedCase[] = RAW.map(parse);

export const IAM_DASH_SUITES: TmSuite[] = [
  { id: IAM_DASH_PARENT, name: "IAM — App Dashboard (In-App Messages)", parentId: null, productId: "pe-app-dashboard", order: 104 },
  ...[...new Set(IAM_DASH_CASES.map((c) => c.area))].map((area, i) => ({
    id: `suite-iamdash-${area.toLowerCase()}`,
    name: AREA_NAME[area] ?? area,
    parentId: IAM_DASH_PARENT,
    order: 140 + i,
  })),
];
