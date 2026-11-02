/**
 * Rock pe-site-pricing-revert-465 — the legacy /pricing/ template restored on the PushEngage marketing site.
 * PR awesomemotive/pushengage-site#465 (abhishekrijal, merged to staging 2026-10-15) brings back the pre-v2
 * pricing template while v2 is being fixed. Checklist = the 2026-10-15 QA report (artifact
 * 3mw9eNGTugys4g8oy2HE5N: "What passed", findings, "Before production") + the open issues
 * awesomemotive/pushengage-app#1069–#1079 (all OPEN on 2026-10-20; do not refile them).
 *
 * WAVE 1 (high priority + the always-skipped / vacuous TM cases it replaces):
 *   PEPR-01 template fidelity · PEPR-03 Yearly cards = oracle · PEPR-04 Monthly/Yearly switch (TC-26, TC-27)
 *   PEPR-05 calculator readouts, 96 states x keyboard/click/drag (TC-125) · PEPR-06 calculator CTA Stripe ids
 *   PEPR-07 every card CTA / Request Demo / anchor link at 1440 and 1280 px · PEPR-14 production cut-over.
 * Later waves append tests to the describe at the bottom (and device describes built from `devices[...]`
 * minus defaultBrowserType). Every shared helper lives at the top of this file.
 *
 * ENV. TEST_ENV=staging → https://staging.pushengage.com; anything else (default 'production', same switch as
 * playwright.config.js) → https://www.pushengage.com. Paths are relative; the baseURL comes from the config.
 * No login, no storageState, no session.
 *
 * ORACLE. Never hard-coded prices: staging and production differ by DATA (staging test discount rows give
 * $11/$19/$36, production flat 45/50/60 % gives $8/$15/$24). Every test captures the page's OWN
 * GET {staging-app|dashboard-public-api}.pushengage.com/d/v1/misc/payment/plans?type=plan (passively, with
 * page.waitForResponse registered before goto; the production plans path is not in the qa-core production
 * allow-list, so it is never called directly) and runs it through theme src/js/pricing.js's formulas, ported
 * verbatim below (Math.round, parseInt(first_year_price, 10) / 12, first tier with the smallest
 * subscribers_limit, slider values `${limit / 1000}k` in API order). A plans response that is not 200 is a FAIL.
 *
 * CTA CHECKS. Card / calculator "Get Started" are <a>/<button> without href; a delegated jQuery handler sets
 * window.location.href = /signup?planName=..&plan=<stripe_plan_id>. interceptSignup() records that navigation
 * request and aborts it with net::ERR_ABORTED, so nothing loads, nothing is submitted and the pricing document
 * stays (ensureOnPricing() goes back and re-waits for prices if it ever does not). Request Demo is allowed to
 * navigate (GET /pricing/schedule → 301 → /schedule_demo/), nothing is typed there.
 *
 * SAFETY. Production = GET navigation + client-side clicks only. No form fill/submit, no signup, no checkout,
 * no account. The production wpconsent banner only ever gets its Reject/Decline control. Analytics / Sentry /
 * Cloudflare RUM beacons are route-aborted (courtesy, keeps QA traffic out of the data); Cloudflare challenge
 * scripts are never touched, no launch flags, no fingerprint tweaks. A 403/429/503 or a challenge page throws
 * BlockedError{SESSION/waf} — never a silent skip, never a bypass.
 *
 * LOAD. page.goto('/pricing/', { waitUntil: 'domcontentloaded' }) + explicit waits. Never 'load' or
 * 'networkidle': refersion.js can hold the load event for ~75 s.
 *
 * Run (Validate stage only, machine-wide serialized):
 *   TEST_ENV=staging caffeinate -i npx playwright test tests/rocks/pe-site-pricing-revert-465.spec.ts \
 *     --project=chromium --no-deps --reporter=list --retries=0 --workers=1 --trace=off
 *   …then the same with TEST_ENV=production.
 *
 * Known behaviours (not defects, never asserted): "save upto 50%" while staging's best API discount is 45 % is
 * intended (only the spelling is #1079); no Log In link below 1098 px; industry tabs hidden by custom CSS;
 * Request Demo → /pricing/schedule 301 → /schedule_demo/; /pricing-v2/ exists on staging only; staging footer
 * "© 2015-2025", dead "PushEngage Coupon" link, web SDK loaded twice and ~90 report-only CSP warnings; Audience
 * Groups 25/50/100 vs "Unlimited" is an open product question. A future v2 relaunch makes PEPR-01/03..14 fail BY
 * DESIGN (content-only switch, Pricing\Component::replaces_legacy_pricing()) — re-scope the rock, don't file.
 */
import { test, expect, type Locator, type Page, type Request, type Response, type Route } from '@playwright/test';
import { BlockedError } from '../../../packages/qa-core/errors';

// ───────────────────────── configuration ─────────────────────────

const ROCK = 'pe-site-pricing-revert-465';
const ENV = process.env.TEST_ENV || 'production';
/** Same switch as playwright.config.js: only 'staging' selects the staging baseURL. */
const IS_PROD = ENV !== 'staging';
const PRICING_PATH = '/pricing/';
const SCHEDULE_DEMO_PATH = '/schedule_demo/';
/** The host the page's own pricing.js fetches plans from (config().backendApiUrl). */
const EXPECTED_PLANS_HOST = IS_PROD ? 'dashboard-public-api.pushengage.com' : 'staging-app.pushengage.com';
const PLANS_RE = /\/d\/v1\/misc\/payment\/plans/;
const WAF_STATUSES = new Set([403, 429, 503]);

const PR_ANNOTATION = { type: 'pr', description: 'awesomemotive/pushengage-site#465' };
/** '@case:<KEY>' for each key + the rock tag, on every test. */
const tags = (...keys: string[]): string[] => [...keys.map((k) => `@case:${k}`), `@rock:${ROCK}`];

type PaidPlan = 'business' | 'premium' | 'growth';
type Period = 'year' | 'month';
type CtaKind = 'free' | PaidPlan;
const PAID_PLANS: readonly PaidPlan[] = ['business', 'premium', 'growth'];
const PERIODS: readonly Period[] = ['year', 'month'];
const PLAN_LABEL: Record<PaidPlan, string> = { business: 'Business', premium: 'Premium', growth: 'Growth' };
/** Subscriber tiers per plan and per period — the owner's sheet "PushEngage V5 Pricing - 35% - 50%" (Plan Limits). */
const EXPECTED_TIER_COUNTS: Record<PaidPlan, number> = { business: 8, premium: 13, growth: 27 };
/** Desktop widths of the 2026-10-15 CTA sweep (122/122 at both). */
const CTA_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
] as const;

/** Selectors from the 2026-10-20 HTML of both envs (staging + production serve the same legacy template). */
const SEL = {
  body: 'body',
  v2Markup: '[class*="pe-v2-"]',
  topArea: '.pricing-page-first-price-table-block-area',
  detailArea: '.pricing-page-second-detailed-price-table-block-area',
  /** Wraps the page's only H1, the detailed switch and the detailed block area; hidden until body.show-table. */
  detailWrap: '#second-pricing-table-container',
  table: '#pricing-table',
  calc: '#pricing-calculator',
  topSwitch: '#plan-period-table',
  detailSwitch: '#plan-period-detail-table',
  switchText: '.pricing-front-switch-label-text',
  compareAll: '.pricing-front__compare-price-link',
  cardCtas: '.pricing-front__action--trial:not(.trial-type-calculator)',
  calcCta: '#pricing-calculator .pricing-front__action--trial.trial-type-calculator',
  requestDemo: '.pricing-front__action--request-demo',
  enterpriseContent: '#pricing-enterprise-content',
  calcPlanName: '.pricing-front-calculator__action__plan-name',
  faqItem: '.wp-block-pushengage-theme-accordion-item',
  savingTag: '.pricing-front__saving-tag',
} as const;
const switchLabel = (checkboxId: string): string => `label.pricing-front-switch-label.sub-popup-label[for="${checkboxId}"]`;
const tabSel = (plan: PaidPlan | 'enterprise'): string => `${SEL.calc} #${plan}-tab`;
const panelSel = (plan: PaidPlan | 'enterprise'): string => `#pricing-calculator-${plan}-content`;
const sliderSel = (plan: PaidPlan): string => `#pricing-subscriber-${plan}-range-slider`;
const SLIDER_IDS = PAID_PLANS.map((p) => `pricing-subscriber-${p}-range-slider`);
/** Calculator readouts (plain strings: passed into page.evaluate). */
const CALC_READ = {
  result: '#pricing-calculator-result',
  startingAt: '#pricing-calculator-result-monthly',
  saving: '.pricing-front-calculator__saving-price',
  billed: '.pricing-front-calculator__saving-text-billed',
  planName: SEL.calcPlanName,
};

// ───────────────────────── small utils ─────────────────────────

const stripQuery = (u: string): string => u.replace(/[?#].*$/, '');
const firstLine = (s: string): string => (s.split('\n')[0] || '').slice(0, 300);
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scrubUrls = (s: string): string => s.replace(/(https?:\/\/[^\s'")?#]+)[?#][^\s'")]*/g, '$1?…');

// ───────────────────────── Cloudflare / WAF (copied from tests/smoke/pricing-and-auth.spec.js) ─────────────────────────

const BLOCK_RE = /just a moment|attention required|checking your browser|cloudflare|verify you are human|enable javascript and cookies|access denied|error 10\d\d/i;

/** True when the rendered page looks like a Cloudflare / bot challenge. */
async function looksBlocked(page: Page): Promise<boolean> {
  const title = (await page.title().catch(() => '')) || '';
  // Same as the smoke spec: an unreadable body is not a challenge signal.
  const body = (await page.locator('body').innerText({ timeout: 2500 }).catch(() => '')) || '';
  return BLOCK_RE.test(`${title}\n${body.slice(0, 500)}`);
}

/** 403/429/503 or a challenge page → BlockedError{SESSION/waf}. Never a skip, never a bypass. */
async function assertNotChallenged(page: Page, status: number, path: string): Promise<void> {
  const host = /^https?:\/\/([^/?#]+)/i.exec(page.url())?.[1] ?? (IS_PROD ? 'www.pushengage.com' : 'staging.pushengage.com');
  const blocked = WAF_STATUSES.has(status) || (await looksBlocked(page));
  if (!blocked) return;
  throw new BlockedError({
    cls: 'SESSION',
    code: 'waf',
    reason: `Cloudflare challenged automation on ${host}${path} (HTTP ${status || 'no response'}${WAF_STATUSES.has(status) ? '' : ', challenge page'})`,
    humanAction: `Cloudflare challenged automation on ${host}${path}; rerun later or from an allow-listed IP; never bypass`,
  });
}

// ───────────────────────── courtesy beacon blocking ─────────────────────────

/** Analytics / Sentry / Cloudflare RUM beacons only. Cloudflare challenge scripts (/cdn-cgi/challenge-platform on the site host) are never matched. */
function isBeaconHost(hostname: string, pathname: string): boolean {
  const h = hostname.toLowerCase();
  const under = (d: string) => h === d || h.endsWith(`.${d}`);
  if (under('google-analytics.com') || under('analytics.google.com')) return true;
  if (under('googletagmanager.com') && /collect/i.test(pathname)) return true;
  if (/(^|\.)ingest\.([a-z0-9-]+\.)?sentry\.io$/.test(h)) return true;
  if (under('cloudflareinsights.com')) return true;
  return false;
}
const isBeaconUrl = (u: URL): boolean => isBeaconHost(u.hostname, u.pathname);
/** Same test on a raw string (console message locations), without throwing on odd URLs. */
function isBeaconString(raw: string): boolean {
  const m = /^https?:\/\/([^/?#:]+)(?::\d+)?([^?#]*)/i.exec(raw || '');
  return !!m && isBeaconHost(m[1], m[2] || '/');
}

// ───────────────────────── console / page-error watcher (PEPR-01) ─────────────────────────

type ConsoleWatch = { errors: string[]; pageErrors: string[]; ignored: string[] };

/** Attach BEFORE goto. Ignores only our own aborted beacons and report-only CSP lines (known staging noise). */
function watchConsole(page: Page): ConsoleWatch {
  const w: ConsoleWatch = { errors: [], pageErrors: [], ignored: [] };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const at = m.location()?.url || '';
    const line = scrubUrls(`${text.slice(0, 300)}${at ? ` @ ${stripQuery(at)}` : ''}`);
    if (/\[Report Only\]/i.test(text) || isBeaconString(at)) {
      w.ignored.push(line);
      return;
    }
    w.errors.push(line);
  });
  page.on('pageerror', (e) => w.pageErrors.push(scrubUrls(firstLine(e?.message ?? String(e)))));
  return w;
}

// ───────────────────────── plans model + pricing.js oracle (ported verbatim) ─────────────────────────

type Tier = {
  stripe_plan_id: string;
  subscribers_limit: number;
  plan_mode: string;
  price: number | string;
  first_year_price?: number | string;
  first_year_discount?: number | string;
};
type PlanRow = { plan_type: string; tiers?: Tier[] };
type PlansBody = { data?: PlanRow[] };

type CardOracle = {
  year: { price: string; crossed: string; saving: string; stripeId: string };
  month: { price: string; stripeId: string };
};
type Oracle = {
  /** Tiers in API order — pricing.js iterates them in this order. */
  tiers: Record<PaidPlan, Tier[]>;
  /** ion.rangeSlider values: the month tiers' `${subscribers_limit / 1000}k`, API order (e.g. '2.5k'). */
  values: Record<PaidPlan, string[]>;
  cards: Record<PaidPlan, CardOracle>;
};

/** pricing.js createSliders(): first tier of that mode with the smallest subscribers_limit (strict <). */
function firstTier(tiers: Tier[], mode: Period): Tier | undefined {
  let first: Tier | undefined;
  for (const t of tiers) {
    if (t.plan_mode !== mode) continue;
    if (!first?.subscribers_limit) first = t;
    else if (t.subscribers_limit < first.subscribers_limit) first = t;
  }
  return first;
}

function buildOracle(body: PlansBody): Oracle {
  const rows: PlanRow[] = Array.isArray(body?.data) ? (body.data as PlanRow[]) : [];
  const tiers = {} as Record<PaidPlan, Tier[]>;
  const values = {} as Record<PaidPlan, string[]>;
  const cards = {} as Record<PaidPlan, CardOracle>;
  for (const plan of PAID_PLANS) {
    const row = rows.find((r) => r.plan_type === plan);
    expect(row, `plans API: no '${plan}' plan in the captured response`).toBeTruthy();
    const t = row?.tiers ?? [];
    tiers[plan] = t;
    values[plan] = t.filter((x) => x.plan_mode === 'month').map((x) => `${x.subscribers_limit / 1000}k`);
    const fy = firstTier(t, 'year');
    const fm = firstTier(t, 'month');
    expect(fy && fm, `plans API: '${plan}' has no year/month tier`).toBeTruthy();
    if (!fy || !fm) continue;
    expect(typeof fy.stripe_plan_id === 'string' && typeof fm.stripe_plan_id === 'string', `plans API: '${plan}' lowest tiers carry a stripe_plan_id`).toBe(true);
    // businessDefaultPlan / premiumDefaultPlan / growthDefaultPlan
    const yearlyPrice = Number(Number(fy.price) / 12);
    cards[plan] = {
      year: {
        price: String(Math.round((yearlyPrice * (100 - Number(fy.first_year_discount))) / 100)), // discountedYearlyPrice
        crossed: `$${Math.round(yearlyPrice)}`, // __reduce-price
        saving: `$${Math.round(Number(fy.price) - Number(fy.first_year_price))} savings*`, // __saving-price
        stripeId: fy.stripe_plan_id,
      },
      month: { price: String(Number(fm.price)), stripeId: fm.stripe_plan_id }, // monthlyPrice
    };
  }
  return { tiers, values, cards };
}

/** The tier the calculator shows for a slider value — getSubscriberSliderPrice()'s lookup. */
function tierFor(o: Oracle, plan: PaidPlan, period: Period, value: string): Tier | undefined {
  const subs = Number(value.slice(0, -1)) * 1000;
  return o.tiers[plan].find((t) => t.plan_mode === period && t.subscribers_limit === subs);
}

type CalcState = {
  value: string;
  planName: string;
  result: string;
  savingVisible: boolean;
  billedVisible: boolean;
  startingAt?: string;
  saving?: string;
};

/** changePriceOnCalculatorResult() for one slider value. */
function calcExpected(o: Oracle, plan: PaidPlan, period: Period, value: string): CalcState {
  const tier = tierFor(o, plan, period, value);
  expect(tier, `calculator ${PLAN_LABEL[plan]} shows slider value '${value}', which has no ${period} tier in the captured plans response`).toBeTruthy();
  const t = tier as Tier;
  if (period === 'month') {
    return { value, planName: PLAN_LABEL[plan], result: String(t.price), savingVisible: false, billedVisible: false };
  }
  return {
    value,
    planName: PLAN_LABEL[plan],
    result: String(Math.round(parseInt(String(t.first_year_price), 10) / 12)),
    startingAt: '$' + Math.round(parseInt(String(t.price), 10) / 12), // 'month_up'
    saving: '$' + Math.round(Number(t.price) - Number(t.first_year_price)).toFixed(0) + ' savings*',
    savingVisible: true,
    billedVisible: true,
  };
}

function describeCards(o: Oracle): string {
  return PAID_PLANS.map((p) => {
    const c = o.cards[p];
    return `${PLAN_LABEL[p]} $${c.year.price} (crossed ${c.year.crossed}, ${c.year.saving}) / monthly $${c.month.price}`;
  }).join('; ');
}

// ───────────────────────── page load ─────────────────────────

type PricingLoad = { status: number; plansUrl: string; oracle: Oracle };
const consentChecked = new WeakSet<Page>();

/**
 * GET /pricing/ (domcontentloaded), BlockedError on a WAF answer, capture the page's own plans response
 * (registered BEFORE goto), build the oracle, wait until pricing.js has initialised (3 sliders + top cards
 * equal the oracle), then decline the production cookie banner if it shows.
 */
async function openPricing(page: Page): Promise<PricingLoad> {
  const plansWait = page
    .waitForResponse((r) => PLANS_RE.test(r.url()) && r.request().method() === 'GET', { timeout: 60_000 })
    .then(
      (r) => r,
      (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
    );
  const res = await page.goto(PRICING_PATH, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const status = res?.status() ?? 0;
  await assertNotChallenged(page, status, PRICING_PATH);
  expect(status, `GET ${PRICING_PATH} should answer HTTP 200`).toBe(200);
  // Server-rendered: fail fast (and clearly) if v2 content is back — a v2 relaunch fails this rock BY DESIGN.
  await expect(page.locator(SEL.body), `${PRICING_PATH} serves the legacy template (body.pe-legacy-pricing); if v2 is relaunched, re-scope this rock`).toHaveClass(
    /(^|\s)pe-legacy-pricing(\s|$)/,
    { timeout: 15_000 },
  );

  const plansRes = await plansWait;
  if (plansRes instanceof Error) {
    throw new Error(`pricing.js never requested /d/v1/misc/payment/plans within 60 s of GET ${PRICING_PATH}: ${firstLine(plansRes.message)}`);
  }
  expect(plansRes.status(), `the page's own plans call ${stripQuery(plansRes.url())} must answer 200 (anything else is a real outage)`).toBe(200);
  const oracle = buildOracle((await plansRes.json()) as PlansBody);

  await waitForPricingReady(page, oracle, 30_000);
  await rejectConsentIfShown(page);
  return { status, plansUrl: plansRes.url(), oracle };
}

/**
 * pricing.js binds the switch / tab / CTA handlers synchronously right after it initialises the three
 * ion.rangeSliders, so 3 × .irs-line means "handlers bound"; then the top cards must equal the oracle for the
 * period the top switch shows (on production the static HTML happens to equal the oracle, so the slider count
 * is the real readiness signal there).
 */
async function waitForPricingReady(page: Page, oracle: Oracle, timeout: number): Promise<void> {
  await expect(page.locator(`${SEL.calc} .irs-line`), 'pricing.js initialised the 3 ion.rangeSlider calculators').toHaveCount(3, { timeout });
  const period: Period = (await page.locator(SEL.topSwitch).isChecked()) ? 'year' : 'month';
  await expectCards(page, oracle, period, 'top', { visible: false, timeout });
}

/** Production wpconsent banner: Reject/Decline only, never Accept. Waits for it once per page (production only). */
async function rejectConsentIfShown(page: Page): Promise<void> {
  // wpconsent renders <button id="wpconsent-cancel-all" class="wpconsent-cancel-cookies …">Reject</button> next to Accept.
  const reject = page
    .locator('#wpconsent-cancel-all, button.wpconsent-cancel-cookies, [id^="wpconsent"] button')
    .filter({ hasText: /\b(reject|decline)\b/i })
    .first();
  const wait = IS_PROD && !consentChecked.has(page) ? 5_000 : 300;
  consentChecked.add(page);
  const shown = await reject.waitFor({ state: 'visible', timeout: wait }).then(
    () => true,
    () => false, // absent banner is the normal case (staging never shows one)
  );
  if (!shown) return;
  // Belt and braces with the log-consent route stub (keepalive fetches can bypass routing).
  await page
    .evaluate(() => {
      const w = window as unknown as { wpconsent?: { records_of_consent?: string } };
      if (w.wpconsent) w.wpconsent.records_of_consent = '0';
    })
    .catch(() => undefined);
  await reject.click();
  test.info().annotations.push({ type: 'consent', description: 'wpconsent banner dismissed with its Reject/Decline control (never Accept)' });
  await expect(reject).toBeHidden();
}

/** Back on a ready /pricing/ document after a CTA click (the aborted /signup navigation must not replace it). */
async function ensureOnPricing(page: Page, oracle: Oracle, label: string): Promise<void> {
  const intact = await page
    .evaluate(() => /^\/pricing\/?$/.test(location.pathname) && document.body.classList.contains('pe-legacy-pricing'))
    .then(
      (v) => v,
      () => false, // execution context destroyed = the document was replaced
    );
  if (intact) return;
  test.info().annotations.push({
    type: 'harness',
    description: `${label}: the aborted /signup navigation did not leave the pricing document intact (now ${stripQuery(page.url())}); went back and re-waited for prices`,
  });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  if (!/^\/pricing\/?$/.test(new URL(page.url()).pathname)) {
    const res = await page.goto(PRICING_PATH, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await assertNotChallenged(page, res?.status() ?? 0, PRICING_PATH);
  }
  await waitForPricingReady(page, oracle, 30_000);
}

// ───────────────────────── cards + switches ─────────────────────────

/**
 * Plan-card values in one table. Yearly: price, crossed-out price and savings equal the oracle; Monthly: the
 * month price, and the crossed-out / savings spans are hidden (only asserted when `visible`, i.e. the table is
 * on screen — the detailed table is hidden until "Compare all plans").
 */
async function expectCards(
  page: Page,
  o: Oracle,
  period: Period,
  table: 'top' | 'detail',
  opts: { visible: boolean; timeout?: number },
): Promise<void> {
  const root = table === 'top' ? SEL.topArea : SEL.detailWrap;
  const timeout = opts.timeout ?? 10_000;
  for (const plan of PAID_PLANS) {
    const c = o.cards[plan];
    const name = `${table === 'top' ? 'top' : 'detailed'} ${PLAN_LABEL[plan]} card (${period === 'year' ? 'Yearly' : 'Monthly'})`;
    const price = page.locator(`${root} .pricing-front-${plan}-price`);
    const crossed = page.locator(`${root} .pricing-front-${plan}__reduce-price`);
    const saving = page.locator(`${root} .pricing-front-${plan}__saving-price`);
    await expect(price, `${name}: price`).toHaveText(period === 'year' ? c.year.price : c.month.price, { timeout });
    if (period === 'year') {
      await expect(crossed, `${name}: crossed-out price`).toHaveText(c.year.crossed, { timeout });
      await expect(saving, `${name}: savings`).toHaveText(c.year.saving, { timeout });
    }
    if (!opts.visible) continue;
    await expect(price, `${name}: price is visible`).toBeVisible();
    if (period === 'year') {
      await expect(crossed, `${name}: crossed-out price is visible`).toBeVisible();
      await expect(saving, `${name}: savings is visible`).toBeVisible();
    } else {
      await expect(crossed, `${name}: crossed-out price is hidden`).toBeHidden();
      await expect(saving, `${name}: savings is hidden`).toBeHidden();
    }
  }
}

/** Both Monthly/Yearly checkboxes (display:none) carry the period: checked = Yearly. */
async function expectSwitchState(page: Page, period: Period): Promise<void> {
  for (const id of [SEL.topSwitch, SEL.detailSwitch]) {
    await expect(page.locator(id), `${id} is ${period === 'year' ? 'checked (Yearly)' : 'unchecked (Monthly)'}`).toBeChecked({ checked: period === 'year' });
  }
}

/** Idempotent: clicks the chosen switch's label only when the period differs, then checks both switches. */
async function setPeriod(page: Page, period: Period, via: 'top' | 'detail' = 'top'): Promise<void> {
  const isYear = await page.locator(SEL.topSwitch).isChecked();
  if (isYear !== (period === 'year')) {
    const label = page.locator(switchLabel(via === 'top' ? 'plan-period-table' : 'plan-period-detail-table'));
    await label.click();
  }
  await expectSwitchState(page, period);
}

/** 'bolder' sits on every "Monthly" label text in Monthly and on every "Yearly" one in Yearly (both switches). */
async function expectBoldPeriodLabel(page: Page, period: Period): Promise<void> {
  const read = () =>
    page.locator(SEL.switchText).evaluateAll((els) => els.map((e) => ({ text: (e.textContent || '').trim(), bolder: e.classList.contains('bolder') })));
  const now = await read();
  expect(now.length, 'Monthly/Yearly label texts on both switches').toBe(4);
  const want = now.map((l) => ({ text: l.text, bolder: /^monthly$/i.test(l.text) === (period === 'month') }));
  await expect.poll(read, { message: `'bolder' marks ${period === 'year' ? 'Yearly' : 'Monthly'} on both switches` }).toEqual(want);
}

/** "Compare all plans" → body.show-table → the detailed table (page's only H1, switch, cards, #pricing-table) shows. */
async function revealDetailedTable(page: Page): Promise<void> {
  const link = page.locator(`${SEL.calc} ${SEL.compareAll}`);
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  // price-table-link.js matches event.target against a[href="#pricing-table"]: click the label text, not the arrow <svg>.
  await link.click({ position: { x: Math.min(8, Math.max(1, (box?.width ?? 16) / 4)), y: (box?.height ?? 16) / 2 } });
  await expect(page.locator(SEL.body), "'Compare all plans' adds body.show-table").toHaveClass(/(^|\s)show-table(\s|$)/);
  await expect(page.locator(SEL.detailWrap), 'the detailed pricing table is revealed').toBeVisible();
}

async function ensureDetailedRevealed(page: Page): Promise<void> {
  const shown = await page.locator(SEL.body).evaluate((b) => b.classList.contains('show-table'));
  if (!shown) await revealDetailedTable(page);
}

// ───────────────────────── calculator (ion.rangeSlider 2.3.1) ─────────────────────────

const sliderValue = (page: Page, plan: PaidPlan): Promise<string> =>
  page.locator(sliderSel(plan)).evaluate((el) => (el as HTMLInputElement).value);

/**
 * ion writes the input on its next redraw tick (rAF while dragging, else a 300 ms timer), and pricing.js's
 * onChange updates the readouts in that same task. Resolves with the value once it equals `target` (or, without
 * a target, once it differs from `prev`); on timeout returns whatever the input holds.
 */
async function waitSliderValue(page: Page, plan: PaidPlan, prev: string, target: string | undefined, timeout = 1_500): Promise<string> {
  const handle = await page
    .waitForFunction(
      ({ sel, prev, target }) => {
        const v = (document.querySelector(sel) as HTMLInputElement | null)?.value ?? '';
        return (target ? v === target : v !== prev) ? v : false;
      },
      { sel: sliderSel(plan), prev, target: target ?? '' },
      { polling: 'raf', timeout },
    )
    .then(
      (h) => h,
      () => null, // timeout = the move did not land there; the caller reads the actual value
    );
  return handle ? String(await handle.jsonValue()) : sliderValue(page, plan);
}

/**
 * Sync only (never asserted): after a tab switch, wait for ion's 300 ms redraw to measure the newly visible
 * slider (coords.w_rs_old === its width). Until then ion ignores clicks (w_rs 0) or re-bases them.
 */
async function waitIonLaidOut(page: Page, plan: PaidPlan): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          type Ion = { coords?: { w_rs_old?: number }; $cache?: { rs?: { outerWidth(b: boolean): number } } };
          const jq = (window as unknown as { jQuery?: (s: string) => { data(k: string): unknown } }).jQuery;
          const inst = jq?.(sel).data('ionRangeSlider') as Ion | undefined;
          const w = inst?.$cache?.rs?.outerWidth(false) ?? 0;
          return w > 0 && inst?.coords?.w_rs_old === w;
        }, sliderSel(plan)),
      { message: `ion.rangeSlider for ${plan} never laid out after its tab was opened`, timeout: 5_000 },
    )
    .toBe(true);
}

async function selectCalcTab(page: Page, plan: PaidPlan | 'enterprise'): Promise<void> {
  const tab = page.locator(tabSel(plan));
  await tab.click();
  await expect(page.locator(SEL.calcPlanName), `calculator plan name after the ${plan} tab`).toHaveText(plan === 'enterprise' ? 'Enterprise' : PLAN_LABEL[plan]);
  if (plan === 'enterprise') return;
  await expect(page.locator(panelSel(plan)), `${plan} calculator panel is shown`).toBeVisible();
  await waitIonLaidOut(page, plan);
}

async function ensureCalcTab(page: Page, plan: PaidPlan): Promise<void> {
  const name = ((await page.locator(SEL.calcPlanName).textContent()) || '').trim();
  const panelShown = await page.locator(panelSel(plan)).isVisible();
  if (name !== PLAN_LABEL[plan] || !panelShown) await selectCalcTab(page, plan);
}

async function readCalc(page: Page, plan: PaidPlan, period: Period): Promise<CalcState> {
  return (await page.evaluate(
    ({ slider, s, period }) => {
      const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
      const text = (sel: string) => (q(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const shown = (sel: string) => {
        const e = q(sel);
        return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
      };
      const base = {
        value: (document.querySelector(slider) as HTMLInputElement | null)?.value ?? '',
        planName: text(s.planName),
        result: text(s.result),
        savingVisible: shown(s.saving),
        billedVisible: shown(s.billed),
      };
      return period === 'year' ? { ...base, startingAt: text(s.startingAt), saving: text(s.saving) } : base;
    },
    { slider: sliderSel(plan), s: CALC_READ, period },
  )) as CalcState;
}

/** Readouts for the state the slider shows now must equal pricing.js's formulas on the captured tiers. */
async function expectCalcState(page: Page, o: Oracle, plan: PaidPlan, period: Period, value: string, how: string): Promise<void> {
  const want = calcExpected(o, plan, period, value);
  await expect
    .poll(() => readCalc(page, plan, period), { message: `calculator ${PLAN_LABEL[plan]} ${period === 'year' ? 'Yearly' : 'Monthly'} @ ${value} (${how})`, timeout: 3_000 })
    .toEqual(want);
}

type Geo = { rsLeft: number; rsWidth: number; lineY: number; handleW: number; handleCx: number; handleCy: number };

/** Viewport geometry of a plan's slider (scrolled to the middle of the viewport first, instantly). */
async function sliderGeometry(page: Page, plan: PaidPlan): Promise<Geo> {
  const g = await page.locator(panelSel(plan)).evaluate((p) => {
    const line = p.querySelector('.irs-line') as HTMLElement | null;
    const handle = p.querySelector('.irs-handle') as HTMLElement | null;
    const rs = line?.parentElement;
    if (!line || !handle || !rs) return null;
    let lr = line.getBoundingClientRect();
    if (lr.top < 120 || lr.bottom > window.innerHeight - 120) {
      line.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior });
      lr = line.getBoundingClientRect();
    }
    const r = rs.getBoundingClientRect();
    const h = handle.getBoundingClientRect();
    return { rsLeft: r.left, rsWidth: r.width, lineY: lr.top + lr.height / 2, handleW: h.width, handleCx: h.left + h.width / 2, handleCy: h.top + h.height / 2 };
  });
  expect(g, `${plan} slider renders ion's .irs-line and .irs-handle`).toBeTruthy();
  return g as Geo;
}

/**
 * Where the handle's centre sits for tier i of n. ion maps a pointer to the handle's left edge
 * (pointer − handle/2) over (width − handle), so the tier positions — and the grid ticks — run from
 * handle/2 to width − handle/2.
 */
const tierX = (g: Geo, i: number, n: number): number => g.rsLeft + g.handleW / 2 + (n > 1 ? i / (n - 1) : 0) * (g.rsWidth - g.handleW);

async function moveByClick(page: Page, plan: PaidPlan, i: number, values: string[]): Promise<string> {
  const prev = await sliderValue(page, plan);
  const g = await sliderGeometry(page, plan);
  await page.mouse.click(tierX(g, i, values.length), g.lineY);
  return waitSliderValue(page, plan, prev, values[i]);
}

async function moveByDrag(page: Page, plan: PaidPlan, i: number, values: string[]): Promise<string> {
  const prev = await sliderValue(page, plan);
  const g = await sliderGeometry(page, plan);
  await page.mouse.move(g.handleCx, g.handleCy);
  await page.mouse.down();
  await page.mouse.move(tierX(g, i, values.length), g.handleCy, { steps: 6 });
  await page.mouse.up();
  return waitSliderValue(page, plan, prev, values[i]);
}

/**
 * Keyboard: focus the (tabindex=0) .irs-line, ArrowLeft to the first tier, ArrowRight to the last, ArrowLeft back.
 * Every state the slider lands on is checked. ion moves by a percentage of the track, so a press can skip a tier
 * (the known rounding quirk, e.g. Growth 120k) — the union with click/drag covers those.
 */
async function keyboardPass(page: Page, plan: PaidPlan, values: string[], check: (v: string) => Promise<void>): Promise<Set<string>> {
  const reached = new Set<string>();
  const line = page.locator(`${panelSel(plan)} .irs-line`);
  await sliderGeometry(page, plan); // brings the slider on screen
  const before = await sliderValue(page, plan);
  await line.focus();
  let v = await waitSliderValue(page, plan, before, undefined, 700); // ion's focus handler re-clicks the handle position
  reached.add(v);
  await check(v);
  const idx = (x: string) => values.indexOf(x);
  const press = async (key: 'ArrowLeft' | 'ArrowRight') => {
    const prev = v;
    await page.keyboard.press(key);
    v = await waitSliderValue(page, plan, prev, undefined, 1_200);
    if (v !== prev) {
      reached.add(v);
      await check(v);
    }
  };
  const cap = 2 * values.length;
  for (let k = 0; idx(v) > 0 && k < cap; k++) await press('ArrowLeft');
  for (let k = 0; idx(v) < values.length - 1 && k < cap; k++) await press('ArrowRight');
  for (let k = 0; idx(v) > 0 && k < cap; k++) await press('ArrowLeft');
  return reached;
}

/** Select tier i by click, then drag, then keyboard nudges. Returns the value the slider shows. */
async function setTier(page: Page, plan: PaidPlan, i: number, values: string[]): Promise<string> {
  let v = await sliderValue(page, plan);
  if (v === values[i]) return v;
  v = await moveByClick(page, plan, i, values);
  if (v === values[i]) return v;
  v = await moveByDrag(page, plan, i, values);
  if (v === values[i]) return v;
  await page.locator(`${panelSel(plan)} .irs-line`).focus();
  for (let k = 0; v !== values[i] && k < 2 * values.length; k++) {
    const prev = v;
    await page.keyboard.press(values.indexOf(v) < i ? 'ArrowRight' : 'ArrowLeft');
    v = await waitSliderValue(page, plan, prev, undefined, 1_200);
  }
  return v;
}

// ───────────────────────── CTA interception ─────────────────────────

/**
 * Records every /signup navigation request and aborts it with net::ERR_ABORTED (Chrome keeps the current
 * document for an aborted navigation), so the pricing page stays and nothing loads or is submitted.
 */
async function interceptSignup(page: Page): Promise<string[]> {
  const captured: string[] = [];
  await page.route(
    (u: URL) => /\/signup\/?(\?|$)/.test(u.pathname + u.search),
    async (route: Route) => {
      if (route.request().isNavigationRequest()) {
        captured.push(route.request().url());
        await route.abort('aborted');
        return;
      }
      await route.continue();
    },
  );
  return captured;
}

/** Card CTAs are <div class="wp-block-button …"> around an <a> without href; the calculator CTA is the <button> itself. */
async function clickTargetOf(el: Locator): Promise<Locator> {
  const inner = el.locator('a, button');
  return (await inner.count()) > 0 ? inner.first() : el;
}

/** Click a CTA and return the one /signup URL it navigated to. */
async function clickCta(page: Page, cta: Locator, captured: string[], label: string): Promise<string> {
  const before = captured.length;
  const target = await clickTargetOf(cta);
  await target.click();
  await expect.poll(() => captured.length, { message: `${label}: the click should start exactly one /signup navigation`, timeout: 10_000 }).toBe(before + 1);
  return captured[before];
}

function expectSignupUrl(raw: string, origin: string, kind: CtaKind, stripeId: string | undefined, label: string): void {
  const u = new URL(raw);
  expect(`${u.origin}${u.pathname}`, `${label}: navigates to this site's /signup (${raw})`).toMatch(new RegExp(`^${escapeRe(origin)}/signup/?$`));
  expect(u.searchParams.get('planName'), `${label}: planName (${raw})`).toBe(kind);
  if (kind === 'free') {
    expect(u.searchParams.has('plan'), `${label}: Free carries no Stripe plan id (${raw})`).toBe(false);
    return;
  }
  expect(u.searchParams.get('plan'), `${label}: Stripe plan id is never 'undefined' (${raw})`).not.toBe('undefined');
  expect(u.searchParams.get('plan'), `${label}: Stripe plan id (${raw})`).toBe(stripeId ?? '<oracle has no id>');
}

/** Request Demo navigates for real (GET only, nothing typed): /pricing/schedule (301) → /schedule_demo/ (200). */
async function expectRequestDemoLands(page: Page, demo: Locator, label: string, viaJsHandler: boolean): Promise<void> {
  const target = await clickTargetOf(demo);
  const hops: { url: string; status: number }[] = [];
  const navRequests: string[] = [];
  const onRequest = (r: Request) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navRequests.push(r.url());
  };
  const onResponse = (r: Response) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) hops.push({ url: r.url(), status: r.status() });
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  try {
    await target.click();
    await page.waitForURL((u) => /^\/schedule_demo\/?$/.test(u.pathname), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
  }
  // WordPress speculation rules prefetch same-site <a href> on pointerdown ("conservative"); a navigation served
  // from that prefetch may emit no 'response' event, so the landed document's own Navigation Timing is the fallback.
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] as (PerformanceNavigationTiming & { responseStatus?: number; deliveryType?: string }) | undefined;
    return n ? { status: n.responseStatus ?? 0, delivery: n.deliveryType ?? '', redirects: n.redirectCount } : null;
  });
  const chain = hops.map((h) => `${new URL(h.url).pathname} ${h.status}`).join(' → ') || '(no response events)';
  const landedHop = hops.filter((h) => stripQuery(h.url) === stripQuery(page.url())).pop();
  const finalStatus = landedHop?.status ?? nav?.status ?? 0;
  test.info().annotations.push({
    type: 'request-demo',
    description: `${label}: ${chain}; navigation timing status ${nav?.status ?? '?'} delivery '${nav?.delivery ?? '?'}' redirects ${nav?.redirects ?? '?'}`,
  });
  await assertNotChallenged(page, finalStatus, SCHEDULE_DEMO_PATH);
  expect(new URL(page.url()).pathname, `${label}: lands on ${SCHEDULE_DEMO_PATH} (${chain})`).toBe(SCHEDULE_DEMO_PATH);
  expect(finalStatus, `${label}: ${SCHEDULE_DEMO_PATH} answers 200 (${chain})`).toBe(200);
  if (viaJsHandler) {
    // The calculator's <button> has no href: only pricing.js's peLocalizeUrl('./schedule') can move it.
    const firstUrl = navRequests[0];
    expect(firstUrl ? new URL(firstUrl).pathname : '<no navigation>', `${label}: first hop is /pricing/schedule (${chain})`).toBe('/pricing/schedule');
    const firstHop = hops.find((h) => h.url === firstUrl);
    expect(!!firstHop && firstHop.status >= 300 && firstHop.status < 400, `${label}: /pricing/schedule redirects (301 expected) (${chain})`).toBe(true);
  }
}

// ───────────────────────── misc page helpers ─────────────────────────

async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' as ScrollBehavior });
  });
}

const plansHost = (plansUrl: string): string => new URL(plansUrl).host;

// ───────────────────────── tests ─────────────────────────

test.describe('pe-site-pricing-revert-465 — legacy /pricing/ restore (site PR #465)', { tag: '@rock-pe-site-pricing-revert-465' }, () => {
  // Opt out of the config's fullyParallel: one page at a time against Cloudflare-fronted hosts.
  test.describe.configure({ mode: 'default', timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.route(isBeaconUrl, (route) => route.abort());
    // Production read-only: WPConsent POSTs every banner choice (our Reject included) to its log-consent REST
    // route as a records-of-consent row. Answer it locally so no consent record is written (same stub as
    // tests/low/02-cookie-consent.spec.js); rejectConsentIfShown() also switches records_of_consent off.
    await page.route('**/wp-json/wpconsent/v1/log-consent**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
  });

  test(
    'PEPR-01 — /pricing/ serves the restored legacy template (pe-legacy-pricing, no v2 markup, legacy widgets and assets present)',
    { tag: tags('PEPR-01'), annotation: [PR_ANNOTATION] },
    async ({ page }) => {
      const consoleWatch = watchConsole(page); // before goto: "during load"
      await openPricing(page); // HTTP 200, no challenge, plans 200, pricing.js initialised

      const body = page.locator(SEL.body);
      await expect(body, '<body> carries pe-legacy-pricing').toHaveClass(/(^|\s)pe-legacy-pricing(\s|$)/);
      await expect(body, '<body> carries pricing').toHaveClass(/(^|\s)pricing(\s|$)/);
      await expect(page.locator(SEL.v2Markup), "no v2 markup (class*='pe-v2-')").toHaveCount(0);

      await expect(page.locator(SEL.topSwitch), 'top Monthly/Yearly switch').toHaveCount(1);
      await expect(page.locator(SEL.detailSwitch), 'detailed-table Monthly/Yearly switch').toHaveCount(1);
      await expect(page.locator(SEL.topArea), 'first price-table block area').toHaveCount(1);
      await expect(page.locator(SEL.detailArea), 'second (detailed) price-table block area').toHaveCount(1);
      await expect(page.locator(SEL.calc), 'price calculator').toHaveCount(1);
      for (const tab of ['business', 'premium', 'growth', 'enterprise'] as const) {
        await expect(page.locator(tabSel(tab)), `calculator tab #${tab}-tab`).toHaveCount(1);
      }
      const sliders = await page.evaluate(
        (ids) =>
          ids.map((id) => {
            const el = document.getElementById(id);
            const prev = el?.previousElementSibling;
            return { id, present: !!el, irs: !!prev && prev.classList.contains('irs') && !!prev.querySelector('.irs-line') };
          }),
        SLIDER_IDS,
      );
      expect(sliders, 'each subscriber slider input is rendered as an ion .irs widget').toEqual(SLIDER_IDS.map((id) => ({ id, present: true, irs: true })));
      await expect(page.locator(SEL.table), 'feature comparison table #pricing-table').toHaveCount(1);
      await expect(page.locator(SEL.faqItem), 'FAQ accordion items').toHaveCount(15);

      const ionType = await page.evaluate(() => {
        const jq = (window as unknown as { jQuery?: { fn?: Record<string, unknown> } }).jQuery;
        return typeof jq?.fn?.ionRangeSlider;
      });
      expect(ionType, 'ion.rangeSlider is loaded (jQuery.fn.ionRangeSlider)').toBe('function');

      if (consoleWatch.ignored.length) {
        test.info().annotations.push({ type: 'console-ignored', description: `${consoleWatch.ignored.length} line(s): aborted QA beacons / report-only CSP` });
      }
      expect(consoleWatch.pageErrors, 'no uncaught page errors while /pricing/ loads').toEqual([]);
      expect(consoleWatch.errors, 'no console errors while /pricing/ loads').toEqual([]);
    },
  );

  test(
    'PEPR-03 — Plan cards default to Yearly with prices, crossed-out prices and savings tags that match the plans API (both tables)',
    { tag: tags('PEPR-03'), annotation: [PR_ANNOTATION] },
    async ({ page }) => {
      const { plansUrl, oracle } = await openPricing(page); // plans 200 asserted inside
      expect(plansHost(plansUrl), "the page's plans call goes to this env's API").toBe(EXPECTED_PLANS_HOST);
      for (const plan of PAID_PLANS) {
        const t = oracle.tiers[plan];
        expect(
          { plan, month: t.filter((x) => x.plan_mode === 'month').length, year: t.filter((x) => x.plan_mode === 'year').length },
          `plans API tier count for ${plan}`,
        ).toEqual({ plan, month: EXPECTED_TIER_COUNTS[plan], year: EXPECTED_TIER_COUNTS[plan] });
      }
      test.info().annotations.push({ type: 'oracle', description: `${ENV}: ${describeCards(oracle)}` });

      await expectSwitchState(page, 'year'); // Yearly is the default: both switches checked
      await expectCards(page, oracle, 'year', 'top', { visible: true });
      await revealDetailedTable(page);
      await expectCards(page, oracle, 'year', 'detail', { visible: true });
    },
  );

  test(
    'PEPR-04 — Monthly/Yearly switch flips every card price, hides the crossed-out price and savings, and keeps both switches in sync',
    { tag: tags('PEPR-04', 'TC-26', 'TC-27'), annotation: [PR_ANNOTATION] },
    async ({ page }) => {
      const { oracle } = await openPricing(page);
      const topLabel = page.locator(switchLabel('plan-period-table'));
      await expect(topLabel, 'the top Monthly/Yearly switch is visible').toBeVisible(); // TC-26
      await expectSwitchState(page, 'year');

      await test.step('top switch → Monthly', async () => {
        await topLabel.click();
        await expectSwitchState(page, 'month');
        await expectBoldPeriodLabel(page, 'month');
        await expectCards(page, oracle, 'month', 'top', { visible: true });
      });

      await test.step('detailed table is already Monthly (in sync)', async () => {
        await revealDetailedTable(page);
        await expect(page.locator(SEL.detailSwitch), 'detailed switch already shows Monthly').toBeChecked({ checked: false });
        await expectCards(page, oracle, 'month', 'detail', { visible: true });
        const savingTags = page.locator(`${SEL.detailWrap} ${SEL.savingTag}`);
        const n = await savingTags.count();
        expect(n, 'detailed cards have saving tags').toBeGreaterThan(0);
        await expect
          .poll(() => savingTags.evaluateAll((els) => els.map((e) => `${getComputedStyle(e).backgroundImage}|${getComputedStyle(e).backgroundColor}`)), {
            message: "saving-tag background is 'none' in Monthly",
          })
          .toEqual(Array.from({ length: n }, () => 'none|rgba(0, 0, 0, 0)'));
      });

      await test.step('detailed switch → back to Yearly in BOTH tables', async () => {
        await page.locator(switchLabel('plan-period-detail-table')).click();
        await expectSwitchState(page, 'year');
        await expectBoldPeriodLabel(page, 'year');
        await expectCards(page, oracle, 'year', 'detail', { visible: true });
        await expectCards(page, oracle, 'year', 'top', { visible: true }); // TC-27: the switch changes the display
      });
    },
  );

  test(
    'PEPR-05 — Calculator readouts are correct for every tier, Yearly and Monthly (Business 8, Premium 13, Growth 27 = 96 cases), by keyboard, click and drag',
    { tag: tags('PEPR-05', 'TC-125'), annotation: [PR_ANNOTATION] },
    async ({ page }) => {
      test.setTimeout(180_000);
      const { oracle } = await openPricing(page);

      for (const period of PERIODS) {
        await setPeriod(page, period);
        for (const plan of PAID_PLANS) {
          await test.step(`${PLAN_LABEL[plan]} · ${period === 'year' ? 'Yearly' : 'Monthly'}`, async () => {
            const values = oracle.values[plan];
            expect(values.length, `${plan}: slider tiers`).toBe(EXPECTED_TIER_COUNTS[plan]);
            await selectCalcTab(page, plan);
            const check = (how: string) => (v: string) => expectCalcState(page, oracle, plan, period, v, how);

            await check('tab opened')(await sliderValue(page, plan));

            const keyboard = await keyboardPass(page, plan, values, check('keyboard'));

            const click = new Set<string>();
            for (let i = 0; i < values.length; i++) {
              const v = await moveByClick(page, plan, i, values);
              click.add(v);
              await check(`click → ${values[i]}`)(v);
            }

            const drag = new Set<string>();
            for (let i = 0; i < values.length; i++) {
              const v = await moveByDrag(page, plan, i, values);
              drag.add(v);
              await check(`drag → ${values[i]}`)(v);
            }

            const missed = (s: Set<string>) => values.filter((v) => !s.has(v));
            test.info().annotations.push({
              type: 'coverage',
              description:
                `${plan}/${period}: keyboard ${values.length - missed(keyboard).length}/${values.length}` +
                (missed(keyboard).length ? ` (skipped ${missed(keyboard).join(',')})` : '') +
                `, click ${values.length - missed(click).length}/${values.length}` +
                (missed(click).length ? ` (missed ${missed(click).join(',')})` : '') +
                `, drag ${values.length - missed(drag).length}/${values.length}` +
                (missed(drag).length ? ` (missed ${missed(drag).join(',')})` : ''),
            });
            const union = new Set([...keyboard, ...click, ...drag]);
            expect(missed(union), `${PLAN_LABEL[plan]} ${period}: tiers that no input method could select`).toEqual([]);
            for (const [how, set] of [
              ['keyboard', keyboard],
              ['click', click],
              ['drag', drag],
            ] as const) {
              expect(set.size, `${how} never moved the ${PLAN_LABEL[plan]} slider (${period})`).toBeGreaterThan(1);
            }
          });
        }
      }

      await test.step('Enterprise tab', async () => {
        await selectCalcTab(page, 'enterprise');
        for (const plan of PAID_PLANS) await expect(page.locator(panelSel(plan)), `${plan} slider panel hidden on Enterprise`).toBeHidden();
        await expect(page.locator(SEL.enterpriseContent), 'Enterprise content (Request Demo) shows').toBeVisible();
        await expect(page.locator(`${SEL.enterpriseContent} ${SEL.requestDemo}`), 'Enterprise Request Demo button').toBeVisible();
        await expect(page.locator(SEL.calcPlanName)).toHaveText('Enterprise');
      });
    },
  );

  test(
    "PEPR-06 — Calculator 'Get Started' carries the Stripe plan id of exactly the selected tier and period (no plan=undefined)",
    { tag: tags('PEPR-06'), annotation: [PR_ANNOTATION] },
    async ({ page }) => {
      test.setTimeout(180_000);
      const captured = await interceptSignup(page);
      const { oracle } = await openPricing(page);
      const origin = new URL(page.url()).origin;
      let checked = 0;

      for (const period of PERIODS) {
        for (const plan of PAID_PLANS) {
          await test.step(`${PLAN_LABEL[plan]} · ${period === 'year' ? 'Yearly' : 'Monthly'}`, async () => {
            const values = oracle.values[plan];
            for (let i = 0; i < values.length; i++) {
              await setPeriod(page, period); // idempotent; restores state after any recovery
              await ensureCalcTab(page, plan);
              const landed = await setTier(page, plan, i, values);
              expect(landed, `${PLAN_LABEL[plan]} ${period}: no input method could select tier ${values[i]}`).toBe(values[i]);
              const tier = tierFor(oracle, plan, period, landed);
              expect(tier, `${plan} ${period} tier ${landed} in the captured plans response`).toBeTruthy();
              const label = `calculator ${PLAN_LABEL[plan]} ${period} ${landed}`;
              const url = await clickCta(page, page.locator(SEL.calcCta), captured, label);
              await ensureOnPricing(page, oracle, label);
              expectSignupUrl(url, origin, plan, tier?.stripe_plan_id, label);
              checked++;
            }
          });
        }
      }
      expect(checked, 'tier × period states checked').toBe(2 * PAID_PLANS.reduce((n, p) => n + EXPECTED_TIER_COUNTS[p], 0));

      await test.step('rounded per-period prices are unique within each plan (getStripePlanId takes the FIRST match)', async () => {
        for (const plan of PAID_PLANS) {
          for (const period of PERIODS) {
            const prices = oracle.tiers[plan]
              .filter((t) => t.plan_mode === period)
              .map((t) => (period === 'month' ? String(t.price) : String(Math.round(parseInt(String(t.first_year_price), 10) / 12))));
            const dups = prices.filter((p, i) => prices.indexOf(p) !== i);
            expect(dups, `${PLAN_LABEL[plan]} ${period}: duplicate rounded prices would send the wrong Stripe plan`).toEqual([]);
          }
        }
      });
    },
  );

  test(
    'PEPR-07 — Every card CTA (Free, Business, Premium, Growth in both tables, both periods), Request Demo and the Compare/Calculate links route correctly at 1440 and 1280 px',
    { tag: tags('PEPR-07'), annotation: [PR_ANNOTATION] },
    async ({ page }) => {
      test.setTimeout(240_000); // 2 widths × (20 CTA clicks + 9 anchor links + 3 real /schedule_demo/ navigations)
      const captured = await interceptSignup(page);

      for (const vp of CTA_VIEWPORTS) {
        await test.step(`${vp.width}x${vp.height}`, async () => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const { oracle } = await openPricing(page);
          const origin = new URL(page.url()).origin;
          await revealDetailedTable(page);

          // 1. Card CTAs, Yearly then Monthly.
          for (const period of PERIODS) {
            await setPeriod(page, period);
            expect(await page.locator(`${SEL.topArea} ${SEL.cardCtas}`).count(), 'top cards: Free + Business + Premium + Growth CTAs').toBe(4);
            expect(await page.locator(`${SEL.detailWrap} ${SEL.cardCtas}`).count(), 'detailed table: paid-plan CTAs').toBeGreaterThanOrEqual(3);
            const ctas = page.locator(SEL.cardCtas);
            const n = await ctas.count();
            const visibleClicked = { top: 0, detailed: 0 };
            const notShown: string[] = [];
            for (let i = 0; i < n; i++) {
              await setPeriod(page, period);
              await ensureDetailedRevealed(page);
              const cta = ctas.nth(i);
              const cls = (await cta.getAttribute('class')) ?? '';
              const kind = /\btrial-type-(free|business|premium|growth)\b/.exec(cls)?.[1] as CtaKind | undefined;
              expect(kind, `card CTA #${i} has a trial-type-{free,business,premium,growth} class (${cls})`).toBeTruthy();
              const where = await cta.evaluate((el, s) => (el.closest(s.top) ? 'top' : el.closest(s.detail) ? 'detailed' : 'other'), {
                top: SEL.topArea,
                detail: SEL.detailWrap,
              });
              const label = `${vp.width}px ${period === 'year' ? 'Yearly' : 'Monthly'} ${where} ${kind} CTA #${i}`;
              if (!(await (await clickTargetOf(cta)).isVisible())) {
                notShown.push(label); // a layout copy the theme hides at this width is not a clickable CTA
                continue;
              }
              const url = await clickCta(page, cta, captured, label);
              await ensureOnPricing(page, oracle, label);
              const k = kind as CtaKind;
              expectSignupUrl(url, origin, k, k === 'free' ? undefined : oracle.cards[k][period].stripeId, label);
              if (where === 'top') visibleClicked.top++;
              else if (where === 'detailed') visibleClicked.detailed++;
            }
            if (notShown.length) test.info().annotations.push({ type: 'cta-not-shown', description: notShown.join('; ') });
            expect(visibleClicked.top, `${vp.width}px ${period}: visible top-card CTAs clicked (Free + 3 paid)`).toBe(4);
            expect(visibleClicked.detailed, `${vp.width}px ${period}: visible detailed-table CTAs clicked`).toBeGreaterThanOrEqual(3);
          }

          // 3. Anchor links (before the Request Demo navigations leave the page).
          const groups = [
            { name: 'Compare features…', loc: page.locator(`${SEL.topArea} a[href="#pricing-table"]`), href: '#pricing-table', text: /compare features/i, min: 4 },
            { name: 'Calculate your price', loc: page.locator(`${SEL.topArea} a[href="#pricing-calculator"]`), href: '#pricing-calculator', text: /calculate your price/i, min: 3 },
            { name: 'Compare all plans', loc: page.locator(`${SEL.calc} ${SEL.compareAll}`), href: '#pricing-table', text: /compare all plans/i, min: 1 },
          ] as const;
          for (const g of groups) {
            const n = await g.loc.count();
            let clicked = 0;
            for (let i = 0; i < n; i++) {
              const a = g.loc.nth(i);
              if (!(await a.isVisible())) continue; // e.g. the empty <a href="#pricing-table"></a> in the Growth card
              await expect(a, `${g.name} #${i} text`).toHaveText(g.text);
              expect(await a.getAttribute('href'), `${g.name} #${i} href`).toBe(g.href);
              // Fresh state for this link: detailed table hidden again, no hash (what a reload would give).
              await page.evaluate(() => {
                document.body.classList.remove('show-table');
                history.replaceState(null, '', location.pathname + location.search);
              });
              if (g.name === 'Compare all plans') {
                const box = await a.boundingBox();
                await a.click({ position: { x: Math.min(8, Math.max(1, (box?.width ?? 16) / 4)), y: (box?.height ?? 16) / 2 } });
              } else {
                await a.click();
              }
              await expect.poll(() => page.evaluate(() => location.hash), { message: `${vp.width}px ${g.name} #${i}: URL hash` }).toBe(g.href);
              if (g.href === '#pricing-table') {
                await expect(page.locator(SEL.body), `${vp.width}px ${g.name} #${i} reveals the detailed table`).toHaveClass(/(^|\s)show-table(\s|$)/);
                await expect(page.locator(SEL.table), `${vp.width}px ${g.name} #${i}: #pricing-table is shown`).toBeVisible();
              } else {
                await expect(page.locator(SEL.calc), `${vp.width}px ${g.name} #${i}: #pricing-calculator is shown`).toBeVisible();
              }
              clicked++;
            }
            expect(clicked, `${vp.width}px: visible '${g.name}' links`).toBeGreaterThanOrEqual(g.min);
          }

          // 2. Request Demo (Enterprise card + calculator + table row): real GET navigations, last.
          const demos = await page.locator(SEL.requestDemo).count();
          expect(demos, 'Request Demo CTAs (calculator + detailed Enterprise card + table row)').toBeGreaterThanOrEqual(2);
          let demosLanded = 0;
          let onPricing = true;
          for (let i = 0; i < demos; i++) {
            if (!onPricing) await openPricing(page); // back from /schedule_demo/
            onPricing = true;
            const demo = page.locator(SEL.requestDemo).nth(i);
            const inCalc = await demo.evaluate((el, calc) => !!el.closest(calc), SEL.calc);
            if (inCalc) await selectCalcTab(page, 'enterprise');
            else await ensureDetailedRevealed(page);
            const label = `${vp.width}px Request Demo #${i} (${inCalc ? 'calculator' : 'detailed table'})`;
            if (!(await (await clickTargetOf(demo)).isVisible())) {
              test.info().annotations.push({ type: 'cta-not-shown', description: label });
              continue;
            }
            const isButton = await demo.evaluate((el) => el.tagName === 'BUTTON' || !el.querySelector('a[href]'));
            await expectRequestDemoLands(page, demo, label, isButton);
            onPricing = false;
            demosLanded++;
          }
          expect(demosLanded, `${vp.width}px: Request Demo CTAs that reached ${SCHEDULE_DEMO_PATH} (calculator + Enterprise card at least)`).toBeGreaterThanOrEqual(2);
        });
      }
    },
  );

  test(
    'PEPR-14 — Production /pricing/ serves the legacy page with production prices from its plans API, and LiteSpeed lazy-load stays off',
    { tag: tags('PEPR-14'), annotation: [PR_ANNOTATION] },
    async ({ page }) => {
      test.skip(!IS_PROD, 'PEPR-14 is the production cut-over check; it runs with TEST_ENV=production (GET + client-side clicks only)');
      const { status, plansUrl, oracle } = await openPricing(page); // includes the wpconsent Reject/Decline step
      expect(status).toBe(200);
      expect(plansHost(plansUrl), 'production prices come from dashboard-public-api.pushengage.com').toBe('dashboard-public-api.pushengage.com');
      test.info().annotations.push({ type: 'oracle', description: `production: ${describeCards(oracle)}` });

      await expect(page.locator(SEL.body), '<body> carries pe-legacy-pricing').toHaveClass(/(^|\s)pe-legacy-pricing(\s|$)/);
      await expect(page.locator(SEL.v2Markup), 'no v2 markup on production').toHaveCount(0);

      await test.step('Yearly cards = production oracle (both tables)', async () => {
        await expectSwitchState(page, 'year');
        await expectCards(page, oracle, 'year', 'top', { visible: true });
        await revealDetailedTable(page);
        await expectCards(page, oracle, 'year', 'detail', { visible: true });
      });

      await test.step('Monthly cards = production oracle (both tables)', async () => {
        await setPeriod(page, 'month');
        await expectCards(page, oracle, 'month', 'top', { visible: true });
        await expectCards(page, oracle, 'month', 'detail', { visible: true });
      });

      await test.step('no LiteSpeed lazy-load + original comparison-table content', async () => {
        await scrollToBottom(page);
        await expect(page.locator('img[data-lazyloaded]'), 'lazy-loaded images on production /pricing/').toHaveCount(0);
        const table = (await page.locator(SEL.table).textContent()) ?? '';
        expect(table, 'comparison table has the WORKFLOWS section').toContain('WORKFLOWS');
        expect(table, "comparison table has no 'TRAGETING' typo (#1069 is staging content)").not.toContain('TRAGETING');
      });
    },
  );

  // ── Later waves append here: PEPR-02 (staging-only /pricing-v2/), 08 (signup Order Summary), 09–13 (devices:
  //    test.describe + test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent }) from devices[…]
  //    minus defaultBrowserType, locator.tap(), annotation "chromium emulation of WebKit-tested setups"),
  //    15–25 (open issues #1069–#1079, annotation {type:'issue'}), 26 (data check).
});
