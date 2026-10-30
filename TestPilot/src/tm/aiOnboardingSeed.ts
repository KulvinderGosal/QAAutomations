// PushEngage App Dashboard — AI-powered Onboarding wizard QA (Asana task
// "QA of App Dashboard - Onboarding Flow", PRs pushengage-app#1014 +
// pushengage-adonis-node-api#407). Live pass on 2026-09-22 against
// staging-app-dashboard2.pushengage.com/onboarding (account "Onboardng Test",
// site qastaging.pushengage.com), driven via Claude-in-Chrome. All three tracks
// (Web Push / App Push / Chat Widget) + the AI endpoints (site-analysis,
// popup-copy, recommendations, adjust-workflow, app-analysis) were exercised and
// confirmed returning REAL (non-fallback) output. MANUAL UI cases (frameworkId null).
import type { TmCase, TmPriority, TmRunStatus, TmSuite } from "./types";

export const AI_ONBOARDING_SUITE_ID = "suite-ai-onboarding";
export const AI_ONBOARDING_SUITES: TmSuite[] = [
  { id: AI_ONBOARDING_SUITE_ID, name: "App Dashboard · AI Onboarding (PR #1014 / #407)", parentId: null, productId: "pe-app-dashboard", order: 40 },
];

const SEED_AT = "2026-09-22T00:00:00.000Z";
type Raw = { key: string; title: string; area: string; priority: TmPriority; status: TmRunStatus; issue: string; step: string; expected: string; description: string };
const RAW: Raw[] = [
  {
    key: "AIONB-CHAN-01", title: "Channel step: AI pick is site-specific", area: "channel", priority: "high", status: "passed", issue: "",
    step: "Open /onboarding. Read the ASSISTANT banner + the three channel cards (Web Push / App Push / Chat Widget).",
    expected: "Assistant recommends a channel BASED ON the registered site — e.g. 'Based on qastaging.pushengage.com, I'd start with Web Push'; Web Push carries the 'AI PICK' badge. Site-specific = the recommendations endpoint ran (not the generic fallback).",
    description: "Verifies the AI recommendation is grounded in the actual site, not boilerplate.",
  },
  {
    key: "AIONB-INST-01", title: "Install: AI platform detection", area: "install", priority: "high", status: "passed", issue: "",
    step: "Web Push → Install step. Read the Assistant + the detected-platform row.",
    expected: "site-analysis detects the platform from the live site ('I detected WordPress … from wp-content paths', 'AI DETECTED' badge) and shows the matching install instructions. Manual | AI Agent modes both present.",
    description: "site-analysis platform detection (PR #407).",
  },
  {
    key: "AIONB-PIPE-01", title: "AI agent pipeline completes with site-aware output", area: "pipeline", priority: "high", status: "passed", issue: "",
    step: "Advance past Install. Observe the 'AI agents are on it' orchestration.",
    expected: "Site Scanner (crawl/detect/brand colors → 'WordPress detected · 8 pages mapped'), Copy Writer (generated real headline/CTA copy), Design Engine (style + timing) all reach Done.",
    description: "The chained AI generation pipeline for the popup/audiences/automations.",
  },
  {
    key: "AIONB-POP-01", title: "Popup: AI copy + brand colors + live preview", area: "popup", priority: "critical", status: "passed", issue: "",
    step: "Popup step. Inspect the generated message, the colors (auto-matched), and the live Desktop/Mobile preview.",
    expected: "Popup renders with AI copy ('Stay updated with our latest news and exclusive tips…'), colors auto-matched to the site, a working style picker (Bell Bar / Large Safari / Floating Bar / Sleek OptIn) and a live preview on a mock of the site.",
    description: "popup-copy + brand-palette (PR #407) rendered in the wizard (PR #1014).",
  },
  {
    key: "AIONB-POP-02", title: "Popup copy regeneration with direction", area: "popup", priority: "critical", status: "passed", issue: "",
    step: "Customize copy & timing → Regenerate → pick a direction chip ('More urgent').",
    expected: "Direction chips present (More casual/urgent/Professional/Playful/Shorter/Benefit-focused + free text). 'More urgent' returns genuinely urgent copy ('Urgent updates are happening now…') AND adapts the buttons (Allow→'Allow Now', No thanks→'Dismiss'); the preview updates and an Undo appears.",
    description: "popup-copy regeneration with direction — the headline AI feature. Real Gemini output, not fallback.",
  },
  {
    key: "AIONB-AUD-01", title: "Audiences: AI site-aware segments", area: "audiences", priority: "high", status: "passed", issue: "",
    step: "Audiences step. Inspect the suggested Segments / Audience Groups.",
    expected: "AI proposes segments grounded in the store's real content (e.g. 'Coffee Mug Shoppers' → URL contains /product/…, excluding /my-account) with a How-it-works explainer.",
    description: "recommendations → segment suggestions tailored to the site.",
  },
  {
    key: "AIONB-AUD-02", title: "Audiences: plan-limit gating on Free plan", area: "gating", priority: "high", status: "passed", issue: "",
    step: "On the Audiences step (limited plan), observe the segment cards.",
    expected: "Segments show a 'Plan limit' badge + 'Upgrade' link and a 'PLAN LIMIT' marker; the footer offers 'Continue without audiences'. Plan gating is enforced and visible.",
    description: "Free-plan segment constraint from the test-case doc.",
  },
  {
    key: "AIONB-AUD-03", title: "AI segment slug looks mis-spelled (coffee → coffe)", area: "audiences", priority: "low", status: "failed", issue: "verify",
    step: "Read the 'Coffee Mug Shoppers' segment rule — it targets 'Contains /product/coffe-mug'.",
    expected: "The slug should match the real product URL. '/product/coffe-mug' reads like a typo (coffe vs coffee). VERIFY against the actual store URL — if the real slug is 'coffee-mug', the AI mangled it; if the store's slug is genuinely 'coffe-mug', this is fine.",
    description: "LOW — needs a quick check against the qastaging store's product URL before filing.",
  },
  {
    key: "AIONB-AUTO-01", title: "Automations: AI draft workflows + plan tiers", area: "automations", priority: "high", status: "passed", issue: "",
    step: "Automations step. Inspect the recommended workflows + the plan split.",
    expected: "AI suggests draft workflows tailored to the site (Welcome New Subscribers, Price Drop & Back-in-Stock) marked 'Ready on your Free plan'; higher-plan ones (Welcome Series · Business) are locked with Upgrade. Assistant states 'saves as a draft — nothing runs until you activate'.",
    description: "recommendations → workflow suggestions, drafts-only, plan-tiered.",
  },
  {
    key: "AIONB-AUTO-02", title: "AI adjust-workflow enforces plan gating (A/B test)", area: "gating", priority: "critical", status: "passed", issue: "",
    step: "Adjust this workflow with AI → request 'Add an A/B split test' → Adjust.",
    expected: "Rejected with a clear plan-gate message: 'The requested A/B split test requires a split_path node, which is not included in your current plan. Please upgrade … the workflow remains unchanged.' A Revert control appears; the workflow is left unchanged.",
    description: "adjust-workflow (PR #407) + plan gating — matches the test-case doc's A/B gating expectation.",
  },
  {
    key: "AIONB-RESUME-01", title: "Resume returns to the last in-progress step", area: "resume", priority: "normal", status: "passed", issue: "",
    step: "Mid-flow, navigate to /onboarding again.",
    expected: "The wizard resumes the in-progress track at the last step (e.g. Web → Automations), not a fresh start.",
    description: "Resume-checklist behaviour.",
  },
  {
    key: "AIONB-APP-01", title: "App Push: app-analysis → App ID + SDK setup", area: "app-push", priority: "high", status: "passed", issue: "",
    step: "Channel → App Push → enter App name + a store URL + platform → Analyze & Continue.",
    expected: "app-analysis completes and advances to a platform-specific SDK Setup (Android) for the app, generating a real PushEngage App ID (e.g. 1131ca53-…) and a 5-step checklist (Firebase → Gradle → init → permission → device test).",
    description: "app-analysis (PR #407, 24h cache / 20-per-hour cap). Store URL: a public Play listing.",
  },
  {
    key: "AIONB-APP-02", title: "App SDK: Manual + AI-Agent prompt", area: "app-push", priority: "normal", status: "passed", issue: "",
    step: "On the Android SDK Setup step, toggle Manual | AI Agent; read the AI-agent prompt.",
    expected: "AI Agent mode shows an app-specific copy-paste prompt (names the app, the real App ID, Firebase console steps, google-services.json, Sender ID + service-account key) suitable for Claude Code / Cursor. Manual mode shows the equivalent instructions.",
    description: "The mobile install analog of the web AI-agent install mode.",
  },
  {
    key: "AIONB-CHAT-01", title: "Chat Widget: AI-picked channels + live preview", area: "chat", priority: "high", status: "passed", issue: "",
    step: "Channel → Chat Widget → Channels step.",
    expected: "AI picks a set of channels for the site ('Picked 4 channels for qastaging.pushengage.com' — Messenger, SMS, Email, Phone) and the live widget launcher preview renders them on a mock of the site (Desktop/Mobile).",
    description: "Chat Widget track channel selection.",
  },
  {
    key: "AIONB-CHAT-02", title: "Chat channels are active but empty → Continue fails validation", area: "chat", priority: "normal", status: "failed", issue: "1017",
    step: "On the Chat Channels step with the 4 AI-picked channels, click 'Continue with 4 channels' WITHOUT editing them.",
    expected: "BUG (P2 UX): the AI marks all 4 channels active but leaves their required fields EMPTY (Email shows only a placeholder 'support@qastaging…', not a value), so Continue throws 'Messenger page link is required / SMS number is required / Email address is required / Phone number is required'. The recommended path (accept AI picks → Continue) can't proceed without manually filling or removing each. Expected: pre-fill from the site (e.g. support@<domain>) or don't mark empty channels required until edited.",
    description: "Filed as sub-issue #1017 under pushengage-app#1015. The assistant claims it 'picked' channels but they're unusable as-is.",
  },
  {
    key: "AIONB-APP-03", title: "App SDK: 5-step Android checklist + JSON upload gating", area: "app-push", priority: "high", status: "passed", issue: "",
    step: "On the Android SDK Setup step, walk all 5 checklist steps; inspect the 'YOUR PART' Firebase panel (Service Account JSON + Sender ID + Save).",
    expected: "All 5 steps render correct content — (1) Firebase connect, (2) Gradle with real SDK coords (com.github.awesomemotive:pushengage-android-sdk:0.1.0, google-services:4.4.2, firebase-bom, JitPack) + Copy, (3) init in Application class with the real App ID + Kotlin/Java toggle + Copy, (4) Android-13 permission (Kotlin/Java) + Copy, (5) device-test link + the pushengage-android skill/plugin install block; the final step's button reads 'Mark Done & Continue to Audiences'. The Service Account JSON field is readOnly (file-upload only — text can't be pasted/injected) and 'Save Firebase settings' stays DISABLED until a JSON file is uploaded (a valid Sender ID alone doesn't enable it).",
    description: "Checklist content + JSON upload gating on the App-Push SDK step. Verified via DOM (readOnly + disabled-state matrix) — no live save performed (writes real Firebase config to the account).",
  },
  {
    key: "AIONB-CHAT-03", title: "Chat Widget step: trigger/style/position/page-rules + live preview", area: "chat", priority: "normal", status: "passed", issue: "",
    step: "Advance Chat → Widget step ('Widget Design & Behavior'). Exercise Trigger Event dropdown, Widget Style, Position, Show-widget-on page rules, and watch the Live Widget Preview.",
    expected: "Trigger Event offers 4 options (Always display / Display after seconds / Display after scroll % / Display on exit intent); Widget Style (Chat Panel [Business] / Simple Icons) and Position (Bottom Right / Left / Custom [Business]) toggle; page rules map to real store URLs; the live preview caption updates ('Simple Icons · Bottom right · shows after 5s · 4 pages'). Business-only options are marked and gated.",
    description: "Widget-step UI/behaviour + live-preview reactivity on the Chat track.",
  },
  {
    key: "AIONB-CHAT-04", title: "Chat Agent step: Business gating opens locked-feature modal", area: "gating", priority: "normal", status: "passed", issue: "",
    step: "On the Chat → Agent step (Free plan), click 'Add Agent — Business'.",
    expected: "Agent management is a Business feature; the roster shows '0 of 50' and 'Add Agent — Business'. Clicking it opens a well-formed 'AGENTS · locked feature' upgrade modal (value prop + sample roster + Business pricing $3.48/mo annual / 45% off / due-today $41.80, saved card, 'Get Business' CTA, 'Not now / See what you unlock / View all plans'). No Free-plan input surface to bypass; gating is correct.",
    description: "Business-plan gating on the Agent step — verified the CTA opens the upgrade modal (not an inert click, not a real add-form).",
  },
  {
    key: "AIONB-VAL-07", title: "App SDK: Firebase Sender ID has no input-level numeric validation (observation)", area: "validation", priority: "low", status: "blocked", issue: "",
    step: "On the App SDK Firebase panel, type non-numeric ('abcXYZ!!') and a 60-char string into FIREBASE SENDER ID.",
    expected: "OBSERVATION (not filed): the Sender ID field is type=text with no inputMode/pattern/maxLength despite the numeric placeholder '123456789012' — it accepts letters and arbitrary length. Since 'Save Firebase settings' is hard-gated on the JSON file upload, the save-side (server) validation could NOT be confirmed without writing real Firebase config to the account. Low severity; re-check on a throwaway site whether Save rejects a malformed Sender ID.",
    description: "BLOCKED — client-side gap noted; server-side check unverifiable without a live credential save. Not filed pending confirmation.",
  },
  {
    key: "AIONB-VAL-08", title: "Chat Widget: 'Display after seconds' accepts non-numeric/negative (input↔effect mismatch)", area: "validation", priority: "normal", status: "failed", issue: "1018",
    step: "On Chat → Widget (Trigger = 'Display after seconds'), type -5, then 'abc', then 3.5 into the seconds field; watch the helper line + Live Widget Preview.",
    expected: "BUG (P3, filed #1018): the field is type=text with no min/max/inputMode/pattern (step=1 is inert). -5 → box shows '-5' while helper/preview clamp to 0s (input≠effect); 'abc' → box keeps 'abc', effect 0s; 3.5 → 3.5s (fractional). No error surfaced, Continue not blocked. Same pattern likely affects the 'Display after scroll %' variant. Expected: numeric input, sensible bounds, displayed value == applied value.",
    description: "Filed as sub-issue #1018 under pushengage-app#1015. Confirmed via DOM + screenshot (box '-5' vs helper '0 seconds').",
  },
  {
    key: "AIONB-FALL-01", title: "AI fallback path (200 + fallback:true, no error)", area: "fallback", priority: "high", status: "blocked", issue: "",
    step: "Force a model failure / site-lock / hourly cap on an onboarding-ai endpoint and observe the wizard.",
    expected: "Backend returns HTTP 200 with fallback:true; the wizard shows sensible DEFAULT content and NEVER surfaces an error. (Per PR #407 contract.)",
    description: "NOT force-tested — needs a model outage or cap exhaustion (20+ rapid calls). The happy path was confirmed to return real, non-fallback content at every step, so the fallback flag is not silently masking failures in normal use.",
  },
  {
    key: "AIONB-CAP-01", title: "Rate caps degrade gracefully", area: "fallback", priority: "normal", status: "blocked", issue: "",
    step: "Exceed the per-endpoint hourly cap (site 10/h, others 20/h) or the daily cap (Free 50/24h, paid 150/24h).",
    expected: "Over-cap calls return the fallback (200 + fallback:true) rather than erroring; the wizard stays usable.",
    description: "NOT force-tested (would require dozens of rapid calls). Documented for a dedicated cap-exhaustion run.",
  },
  {
    key: "AIONB-ROLE-01", title: "Non-admin sub-user is blocked (403)", area: "auth", priority: "high", status: "blocked", issue: "",
    step: "Sign in as a non-admin sub-user and hit the onboarding-ai endpoints / open the wizard.",
    expected: "onboarding-ai endpoints require a verified admin-level dashboard user; a sub-user receives 403 'You don't have permission'.",
    description: "BLOCKED — needs a non-admin sub-user account on this site (not available in this pass). Same class of blocker as WP #336.",
  },
  {
    key: "AIONB-VAL-01", title: "Popup message enforces the 150-char limit", area: "validation", priority: "high", status: "passed", issue: "",
    step: "Popup → Customize copy. Select-all the Message and type ~220 characters.",
    expected: "Input hard-caps at exactly 150 (counter 150/150; overflow truncated). Enforced in JS (no HTML maxlength) — correctly, unlike the attribute-name field which allowed negative overflow (#676).",
    description: "Char-limit boundary — verified via DOM (textarea value length = 150).",
  },
  {
    key: "AIONB-VAL-02", title: "Popup button labels cap at 20 with correct counters", area: "validation", priority: "normal", status: "passed", issue: "",
    step: "Type 30 chars into Allow Button Label; inspect the counter for both labels.",
    expected: "maxlength=20 caps the value at 20 (Allow 20/20); Close label counter reflects its own length (e.g. 7/20 for 'Dismiss'). Counters are per-field and accurate (verified via DOM — a suspected off-by-one was a mis-read, not a bug).",
    description: "Char-limit + counter correctness on the CTA/close labels.",
  },
  {
    key: "AIONB-VAL-03", title: "Popup display delay clamps to 0–300 and rejects non-numeric", area: "validation", priority: "high", status: "passed", issue: "",
    step: "In Display Delay enter 500, then -5, then 'abc12x'; observe the value + preview each time.",
    expected: "500 → clamped to 300 ('Appears after 300s'); -5 → clamped to 0 ('Appears after 0s'); non-numeric rejected (stays 0). Numeric bounds enforced.",
    description: "Numeric boundary + non-numeric rejection on the timing field.",
  },
  {
    key: "AIONB-VAL-04", title: "Empty popup message falls back to a default (graceful)", area: "validation", priority: "normal", status: "passed", issue: "",
    step: "Clear the Message field and click Apply & Continue, then go Back to the popup.",
    expected: "The wizard does not error/block; the popup falls back to a sensible DEFAULT ('Subscribe to receive news, offers and updates delivered straight to your browser.') rather than shipping empty. Other edited fields (button labels, delay) persist.",
    description: "Empty-field graceful default — NOT a bug (verified via the resolved preview).",
  },
  {
    key: "AIONB-VAL-05", title: "Chat channel fields validate FORMAT (email/phone/URL)", area: "validation", priority: "high", status: "passed", issue: "",
    step: "On Chat → Channels, enter invalid values (Email 'notanemail', SMS 'hello', Messenger 'notaurl', Phone 'abcxyz') and Continue.",
    expected: "Field-specific format errors block continue: Email → 'Enter a valid email address'; SMS/Phone → 'Use international format with country code, e.g. +19876543210'; Messenger → 'Enter a full URL starting with https://'. Not just presence — actual format checks with helpful copy.",
    description: "Format validation on the chat channel inputs.",
  },
  {
    key: "AIONB-VAL-06", title: "App Push: App Name is required", area: "validation", priority: "normal", status: "passed", issue: "",
    step: "On the App Push details step, leave App Name empty.",
    expected: "'Analyze & Continue' is disabled until a non-empty App Name is entered.",
    description: "Required-field enforcement on the app-details step.",
  },
  {
    key: "AIONB-SUM-01", title: "Summary + activation writes the setup", area: "summary", priority: "high", status: "unexecuted", issue: "",
    step: "Complete the wizard to the Summary step and activate (Create workflows / Finish).",
    expected: "The chosen popup, segments and workflow drafts are created/activated on the account; telemetry (category ai_onboarding) fires; Settings › Installation reuses the same install bodies.",
    description: "NOT executed on purpose — activating writes live config/campaigns to the real qastaging account. Run deliberately when a throwaway site is available.",
  },
];

export const AI_ONBOARDING_CASES: TmCase[] = RAW.map((r) => ({
  id: `seedcase-aionb-${r.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  key: r.key,
  title: r.title,
  description: r.issue && r.issue !== "verify" ? `${r.description}\n\nGitHub: awesomemotive/pushengage-app #${r.issue}` : r.description,
  suiteId: AI_ONBOARDING_SUITE_ID,
  priority: r.priority,
  automation: "manual",
  steps: [{ step: r.step, expected: r.expected }],
  tags: ["ai-onboarding", "app-dashboard", r.area, "pr-1014", "pr-407"],
  review: "approved",
  frameworkId: null,
  specFile: null,
  lastRunStatus: r.status,
  lastRunAt: r.status === "unexecuted" ? null : SEED_AT,
  runs: r.status === "unexecuted" ? 0 : 1,
  source: "seed",
  createdBy: "Kulvinder Singh",
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
  comments: [],
  history: [],
}));
