// Recent QA work — 2026 Aug–Sep, captured as documented test cases across the
// LedgerPort + PushEngage fleet. These are the durable record of what was actually
// tested this period (full regressions, RC verifies, new-feature QA, and
// author-issue verification), drawn from the live runs. All MANUAL cases
// (frameworkId null) — runnable Playwright specs live in each product's own
// framework; this suite documents scope, steps, expected results, and verdicts.
//
// Suites nest under the existing per-product suites (suite-<productId>). Wired into
// src/tm/store.ts via backfillRecentQa (guarded by seq.recentQaSeed), idempotent.
import type { TmCase, TmPriority, TmSuite } from "./types";

const AT = "2026-09-20T00:00:00.000Z";

const S_LP_REG = "suite-recent-lp-qastaging-regr";
const S_LP_DUPSKU = "suite-recent-lp-dupsku";
const S_LP_249 = "suite-recent-lp-omnysync249";
const S_LP_288 = "suite-recent-lp-wp-104";
const S_PE_TZ = "suite-recent-pe-subscriber-tz";
const S_PE_OPTIN = "suite-recent-pe-ask-optin";
const S_PE_429 = "suite-recent-pe-wp-429";
const S_PE_TRIAGE = "suite-recent-pe-app-triage";
const S_PE_QAPROD = "suite-recent-pe-wp-qaprod-410";

export const RECENT_QA_SUITES: TmSuite[] = [
  { id: S_LP_REG, name: "LedgerPort WP · qastaging→QB full regression (2026-09-17)", parentId: "suite-lp-wp-plugin", productId: "lp-wp-plugin", order: 200 },
  { id: S_LP_249, name: "LedgerPort · omnysync #249 platform-mismatch audit", parentId: "suite-lp-wp-plugin", productId: "lp-wp-plugin", order: 201 },
  { id: S_LP_288, name: "LedgerPort WP · 1.0.4 RC (PR #288) changed-area QA", parentId: "suite-lp-wp-plugin", productId: "lp-wp-plugin", order: 202 },
  { id: S_LP_DUPSKU, name: "LedgerPort Shopify · duplicate-SKU finding (2026-09-09)", parentId: "suite-lp-shopify", productId: "lp-shopify", order: 203 },
  { id: S_PE_TZ, name: "PushEngage Dashboard · subscriber-timezone broadcasts (#1009)", parentId: "suite-pe-app-dashboard", productId: "pe-app-dashboard", order: 204 },
  { id: S_PE_OPTIN, name: "PushEngage · ask-before-auto-subscribe (opt-in gate)", parentId: "suite-pe-app-dashboard", productId: "pe-app-dashboard", order: 205 },
  { id: S_PE_TRIAGE, name: "PushEngage App · author-issue verification (triage)", parentId: "suite-pe-app-dashboard", productId: "pe-app-dashboard", order: 206 },
  { id: S_PE_429, name: "PushEngage WP · 4.2.9 build QA (PR #584)", parentId: "suite-pe-wp-plugin", productId: "pe-wp-plugin", order: 207 },
  { id: S_PE_QAPROD, name: "PushEngage WP · qaprod 4.2.10 issue cleanup", parentId: "suite-pe-wp-plugin", productId: "pe-wp-plugin", order: 208 },
];

const SUITE_TAG: Record<string, string> = {
  [S_LP_REG]: "ledgerport-wp",
  [S_LP_249]: "ledgerport",
  [S_LP_288]: "ledgerport-wp",
  [S_LP_DUPSKU]: "ledgerport-shopify",
  [S_PE_TZ]: "pushengage-dashboard",
  [S_PE_OPTIN]: "pushengage",
  [S_PE_TRIAGE]: "pushengage-app",
  [S_PE_429]: "pushengage-wp",
  [S_PE_QAPROD]: "pushengage-wp",
};

type Raw = {
  key: string;
  title: string;
  suiteId: string;
  area: string;
  priority: TmPriority;
  step: string;
  expected: string;
  status: "passed" | "failed";
  issue?: string;
};

const RAW: Raw[] = [
  // ── LedgerPort WP · qastaging→QB full regression (2026-09-17) ──────────────
  {
    key: "LP-REG-PROD-01", title: "Product sync → QuickBooks item (name/SKU/price)", suiteId: S_LP_REG, area: "PRODUCT", priority: "high", status: "passed",
    step: "On qastaging (WooCommerce) with the connection to the QB sandbox live, create/edit a simple product and run product sync.",
    expected: "A QuickBooks item is created/updated with the correct name, SKU and price; sync status shows success; no duplicate item created on re-sync (idempotent by SKU).",
  },
  {
    key: "LP-REG-CUST-01", title: "Customer sync → QuickBooks customer", suiteId: S_LP_REG, area: "CUSTOMER", priority: "high", status: "passed",
    step: "Place an order with a new billing customer, run customer/order sync.",
    expected: "A QuickBooks customer is created with matching name/email/billing address; an existing customer is matched (not duplicated).",
  },
  {
    key: "LP-REG-ORD-01", title: "Order → QuickBooks sales receipt / invoice with correct totals", suiteId: S_LP_REG, area: "ORDER", priority: "high", status: "passed",
    step: "Create a paid WooCommerce order (line items + qty) and sync.",
    expected: "The QB sales receipt/invoice carries the right line items, quantities, unit prices and order total; links back to the Woo order id.",
  },
  {
    key: "LP-REG-TAX-01", title: "Order tax maps to the QB tax code / tax line", suiteId: S_LP_REG, area: "TAX", priority: "high", status: "passed",
    step: "Order with a taxable product under a configured tax rate; sync.",
    expected: "Tax is recorded on the QB transaction matching the Woo tax amount (per the Sync Config tax mapping); totals reconcile.",
  },
  {
    key: "LP-REG-SHIP-01", title: "Shipping charge maps to the configured shipping line/account", suiteId: S_LP_REG, area: "SHIPPING", priority: "normal", status: "passed",
    step: "Order with a shipping method/charge; sync.",
    expected: "Shipping is posted to the configured shipping product/account in QB; the amount matches; totals reconcile.",
  },
  {
    key: "LP-REG-INV-01", title: "Inventory quantity adjustment reflects in QB", suiteId: S_LP_REG, area: "INVENTORY", priority: "normal", status: "passed",
    step: "For an inventory-tracked item, change stock in Woo and sync (or place an order that decrements stock).",
    expected: "The QB item quantity-on-hand adjusts consistently with the Woo stock change; no negative/duplicate adjustments.",
  },
  {
    key: "LP-REG-CFG-01", title: "Config snapshot: per-gateway clearing accounts + mappings set before asserting", suiteId: S_LP_REG, area: "CONFIG", priority: "high", status: "passed",
    step: "Before regression, capture the Sync Config: default income/clearing accounts, per-gateway clearing accounts, tax mapping, auto-create toggles.",
    expected: "Config is complete and matches the intended baseline — a green sync on an UNconfigured mapping is a false pass, so this snapshot gates the run (see LedgerPort config-prereqs).",
  },
  {
    key: "LP-REG-OBS-01", title: "Observation: gateway with no clearing account = expected skip, not a bug", suiteId: S_LP_REG, area: "CONFIG", priority: "normal", status: "passed",
    step: "Sync an order paid via a gateway that has no clearing account configured.",
    expected: "The payment isn't posted — this is expected config behaviour, NOT a defect. Confirm the gateway mapping before filing any 'payment not recorded' bug.",
  },
  {
    key: "LP-REG-OBS-02", title: "Observation: refund/invoice-mode paths deferred (not in this pass)", suiteId: S_LP_REG, area: "SCOPE", priority: "normal", status: "passed",
    step: "Record what this regression did NOT cover.",
    expected: "Invoice-mode, discounts and refunds were out of scope for the 2026-09-17 pass and remain to be regressed — tracked as remaining items.",
  },

  // ── LedgerPort · omnysync #249 platform-mismatch audit ─────────────────────
  {
    key: "LP-249-01", title: "#249 fix: ProductSyncOrchestrator no longer says 'Shopify' on a Woo sync", suiteId: S_LP_249, area: "COPY", priority: "normal", status: "passed", issue: "omnysync#249",
    step: "Audit the Woo product-sync log/messages for platform wording (ProductSyncOrchestrator around line 208).",
    expected: "After #249, Woo syncs use Woo/WooCommerce wording (not 'Shopify'); the ProductSyncOrchestrator:208 string is correctly platform-gated.",
  },
  {
    key: "LP-249-02", title: "Residual: AnalyticsService still emits 'Shopify' wording on Woo (not fixed by #249)", suiteId: S_LP_249, area: "COPY", priority: "normal", status: "failed", issue: "omnysync#249",
    step: "Audit AnalyticsService (~line 970) message strings on a Woo connection.",
    expected: "BUG: AnalyticsService:970 still uses 'Shopify' wording on a WooCommerce sync — NOT covered by #249's fix. All other Shopify strings are correctly gated; this one remains.",
  },

  // ── LedgerPort WP · 1.0.4 RC (PR #288) changed-area QA ─────────────────────
  {
    key: "LP-104-01", title: "Tax-code removal: legacy per-item tax-code field is gone", suiteId: S_LP_288, area: "TAX", priority: "high", status: "passed",
    step: "Install 1.0.4 RC on staging; open product/tax mapping.",
    expected: "The removed tax-code field no longer appears; tax mapping works via the new path without errors.",
  },
  {
    key: "LP-104-02", title: "Account gating: account pickers gated by connection/type", suiteId: S_LP_288, area: "CONFIG", priority: "normal", status: "passed",
    step: "Open Sync Config account selectors with and without a live connection.",
    expected: "Account dropdowns are correctly gated/enabled by connection state and account type; no invalid selections offered.",
  },
  {
    key: "LP-104-03", title: "Auto-create validation blocks incomplete config", suiteId: S_LP_288, area: "VALIDATION", priority: "normal", status: "passed",
    step: "Enable auto-create with a required mapping missing; try to save/sync.",
    expected: "Validation blocks the action with a clear message; no partial/garbage QB entities created.",
  },
  {
    key: "LP-104-04", title: "Audit Logs record sync actions", suiteId: S_LP_288, area: "AUDIT", priority: "normal", status: "passed",
    step: "Run a sync, open Audit Logs.",
    expected: "Entries appear with action/outcome/timestamp; failures are distinguishable from successes.",
  },
  {
    key: "LP-104-05", title: "Connection badges reflect live/disconnected state", suiteId: S_LP_288, area: "UI", priority: "normal", status: "passed",
    step: "Toggle/observe the QB connection; check badges + About Us page.",
    expected: "Connection badges show the correct state; About Us renders with correct version/build info.",
  },
  {
    key: "LP-104-06", title: "Woo build shows Shopify-specific copy on a setting (omnysync#248)", suiteId: S_LP_288, area: "COPY", priority: "normal", status: "failed", issue: "omnysync#248",
    step: "Review 1.0.4 settings copy on the WooCommerce build.",
    expected: "BUG: a setting shows Shopify-specific wording on the Woo plugin — filed omnysync#248.",
  },

  // ── LedgerPort Shopify · duplicate-SKU finding (2026-09-09) ─────────────────
  {
    key: "LP-DUPSKU-01", title: "Two Shopify variants sharing one SKU collapse to ONE QB item (silent rename)", suiteId: S_LP_DUPSKU, area: "PRODUCT", priority: "high", status: "failed",
    step: "Create two Shopify variants with the SAME SKU; run product sync to the QB sandbox 'Ledgerport testing'.",
    expected: "BUG: both variants report 2/2 'success' but only ONE QB item is created — the second silently overwrites/renames the first. No warning surfaced. (Woo blocks the duplicate-SKU state; Shopify allows it.)",
  },
  {
    key: "LP-DUPSKU-02", title: "Multi-variant product visibility on the Product tab", suiteId: S_LP_DUPSKU, area: "UI", priority: "normal", status: "failed",
    step: "Open the Product tab for a multi-variant product.",
    expected: "BUG/observation: the Product tab hides multi-variant products, so the duplicate-SKU collapse isn't visible to the user from that view.",
  },

  // ── PushEngage Dashboard · subscriber-timezone broadcasts (#1009) ───────────
  {
    key: "PE-TZ-01", title: "'Send in subscriber's timezone' scheduling notice renders", suiteId: S_PE_TZ, area: "SCHEDULE", priority: "high", status: "passed", issue: "pushengage-app#1009",
    step: "On staging dashboard2 (site 51041) create a broadcast, choose Schedule, enable send-in-subscriber-timezone.",
    expected: "The timezone scheduling notice/explainer renders correctly; the option is selectable on the eligible plan.",
  },
  {
    key: "PE-TZ-02", title: "Past-time warning + modal when scheduled time is already passed", suiteId: S_PE_TZ, area: "SCHEDULE", priority: "high", status: "passed", issue: "pushengage-app#1009",
    step: "Set a schedule time earlier than the current time (subscriber-timezone mode).",
    expected: "The warning shows and the confirmation modal appears; the core browser→site clock fix means the check uses the site clock, not the raw browser clock.",
  },
  {
    key: "PE-TZ-03", title: "Browser→site clock fix: warning keyed off the site's time", suiteId: S_PE_TZ, area: "SCHEDULE", priority: "high", status: "passed", issue: "adonis#419",
    step: "With the browser clock skewed from the site's, schedule near 'now'.",
    expected: "The past-time detection uses the site's clock (adonis#419), so the warning fires correctly regardless of local browser skew.",
  },
  {
    key: "PE-TZ-04", title: "Fan-out sections cron-blocked on staging (environment note)", suiteId: S_PE_TZ, area: "ENV", priority: "normal", status: "passed",
    step: "Attempt to observe the per-timezone fan-out send sections on staging.",
    expected: "Fan-out is cron-blocked on staging so the actual per-timezone dispatch can't be observed there — noted as an environment limitation, not a bug.",
  },

  // ── PushEngage · ask-before-auto-subscribe (opt-in gate) ───────────────────
  {
    key: "PE-OPTIN-01", title: "Opt-in gate asks before the SDK silently takes over subscription", suiteId: S_PE_OPTIN, area: "SDK", priority: "high", status: "passed",
    step: "On the publisher test site (site 51041), clear PushEngageSDK localStorage, load with the opt-in-before-takeover feature live.",
    expected: "The SDK asks/gates before auto-subscribing rather than silently taking over; verified 2026-09-03 on staging-app-dashboard2.",
  },
  {
    key: "PE-OPTIN-02", title: "SDK gate state persists per the documented endpoints", suiteId: S_PE_OPTIN, area: "SDK", priority: "normal", status: "passed",
    step: "Exercise the gate (accept/dismiss) and re-load; inspect the SDK localStorage + the gate endpoints.",
    expected: "The gate decision persists across reloads via the SDK state; the endpoints reflect the opt-in choice (clearing PushEngageSDK localStorage resets the gate for re-test).",
  },
  {
    key: "PE-OPTIN-03", title: "3-repo feature wired consistently (SDK + dashboard + backend)", suiteId: S_PE_OPTIN, area: "REGRESSION", priority: "normal", status: "passed",
    step: "Confirm the opt-in behaviour end-to-end across the SDK, dashboard toggle, and backend.",
    expected: "The opt-in-before-silent-takeover behaviour is consistent across the three repos; default is ask-first.",
  },

  // ── PushEngage App · author-issue verification (triage) ─────────────────────
  {
    key: "PE-TRIAGE-01", title: "#607 still reproduces after triage", suiteId: S_PE_TRIAGE, area: "VERIFY", priority: "normal", status: "failed", issue: "pushengage-app#607",
    step: "Reproduce awesomemotive/pushengage-app #607 on staging with cf_clearance obtained via the user's own Chrome tab.",
    expected: "Issue still reproduces — left open, marked still-broken (editor/save flows hang in Claude-in-Chrome, so verified in the user's Chrome).",
  },
  {
    key: "PE-TRIAGE-02", title: "#676 still reproduces after triage", suiteId: S_PE_TRIAGE, area: "VERIFY", priority: "normal", status: "failed", issue: "pushengage-app#676",
    step: "Reproduce #676 on staging.",
    expected: "Still reproduces — left open, marked still-broken.",
  },
  {
    key: "PE-TRIAGE-03", title: "#547 still reproduces after triage", suiteId: S_PE_TRIAGE, area: "VERIFY", priority: "normal", status: "failed", issue: "pushengage-app#547",
    step: "Reproduce #547 on staging.",
    expected: "Still reproduces — left open, marked still-broken (backlog of author-filed issues largely unaddressed).",
  },

  // ── PushEngage WP · 4.2.9 build QA (PR #584) ───────────────────────────────
  {
    key: "PE-429-01", title: "4.2.9 plugin zip installs/activates cleanly on staging", suiteId: S_PE_429, area: "INSTALL", priority: "high", status: "passed", issue: "pushengage-sdks#584",
    step: "Upload the 4.2.9 plugin zip on staging WP, replacing the prior build (no backup taken, per request); activate.",
    expected: "Installs and activates with no fatal/PHP error; PushEngage admin menu + version reflect 4.2.9.",
  },
  {
    key: "PE-429-02", title: "Core admin surfaces load post-upgrade (dashboard/broadcasts/settings)", suiteId: S_PE_429, area: "SMOKE", priority: "high", status: "passed",
    step: "Open Dashboard, Push Broadcasts, Drip, Settings tabs after the 4.2.9 upgrade.",
    expected: "All primary screens render (SPA hash routes ok); no console/PHP errors; connected-site badge intact.",
  },
  {
    key: "PE-429-03", title: "PR #584 changed area behaves as intended", suiteId: S_PE_429, area: "REGRESSION", priority: "normal", status: "passed", issue: "pushengage-sdks#584",
    step: "Exercise the specific change in PR #584 on the 4.2.9 build.",
    expected: "The targeted fix/behaviour works; no regression in the adjacent flows.",
  },

  // ── PushEngage WP · qaprod 4.2.10 issue cleanup ────────────────────────────
  {
    key: "PE-QAPROD-01", title: "#116 verified fixed on qaprod 4.2.10 → closed", suiteId: S_PE_QAPROD, area: "VERIFY", priority: "normal", status: "passed", issue: "pushengage-sdks#116",
    step: "On qaprod.pushengage.com (v4.2.10), behind the non-auto Cloudflare challenge (loaded in the user's Chrome for cf_clearance), reproduce #116.",
    expected: "No longer reproduces — verified & closed.",
  },
  {
    key: "PE-QAPROD-02", title: "#555 verified fixed → closed", suiteId: S_PE_QAPROD, area: "VERIFY", priority: "normal", status: "passed", issue: "pushengage-sdks#555",
    step: "Reproduce #555 on qaprod 4.2.10.",
    expected: "No longer reproduces — verified & closed.",
  },
  {
    key: "PE-QAPROD-03", title: "#399 verified fixed → closed", suiteId: S_PE_QAPROD, area: "VERIFY", priority: "normal", status: "passed", issue: "pushengage-sdks#399",
    step: "Reproduce #399 on qaprod 4.2.10.",
    expected: "No longer reproduces — verified & closed.",
  },
  {
    key: "PE-QAPROD-04", title: "#501 still reproduces → left open", suiteId: S_PE_QAPROD, area: "VERIFY", priority: "normal", status: "failed", issue: "pushengage-sdks#501",
    step: "Reproduce #501 on qaprod 4.2.10.",
    expected: "Still reproduces — left open, marked still-broken.",
  },
];

export const RECENT_QA_CASES: TmCase[] = RAW.map((r) => ({
  id: `seedcase-recentqa-${r.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  key: r.key,
  title: r.title,
  description: r.issue ? `Filed/related: ${r.issue}.` : "",
  suiteId: r.suiteId,
  priority: r.priority,
  automation: "manual",
  steps: [{ step: r.step, expected: r.expected }],
  tags: r.issue
    ? ["recent-qa", SUITE_TAG[r.suiteId], r.area.toLowerCase(), r.issue.replace(/[#/]/g, "-")]
    : ["recent-qa", SUITE_TAG[r.suiteId], r.area.toLowerCase()],
  review: "approved",
  frameworkId: null,
  specFile: null,
  lastRunStatus: r.status,
  lastRunAt: AT,
  runs: 1,
  source: "seed",
  createdBy: "Kulvinder Singh",
  createdAt: AT,
  updatedAt: AT,
  comments: [],
  history: [],
}));
