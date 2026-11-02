/**
 * Rock pe-site-pricing-demo — QA Pricing & Schedule-Demo on www.pushengage.com (production sweep).
 * Asana 1219167956413620 (completed 2026-10-05; checklist = the task notes' "works well" items, the
 * 8 findings and the closing comment) · findings awesomemotive/pushengage-site #458–#463, all OPEN
 * (assignee abhishekrijal, no dev comments) on 2026-10-20. TestPilot had no cases for this task, so
 * the dossier keyed them PESD-01…18.
 *
 * WAVE 1 (high priority / previously skipped): PESD-02, PESD-03, PESD-13, PESD-16.
 * Later waves append tests to the describes below; every shared helper lives at the top of this file.
 *   - desktop describe ........ PESD-05, 08, 09, 10, 11 (and 06: EMPTY test-drive path only)
 *   - tablet / phone describes  PESD-01, 04, 14, 15 (add `test.use({ viewport: TABLET|PHONE, isMobile: true, hasTouch: true })`)
 *   - HTTP describe ........... PESD-12 (reuse parseSitemapLocs / getText)
 *   - staging describe ........ PESD-07, PESD-17 (already declared at the bottom, empty for now)
 *   - PESD-18 (Calendly booking) is NOT specable: Calendly anti-bot + a real booking + wizard auto-submit.
 *
 * Target: the playwright.config baseURL (production https://www.pushengage.com when TEST_ENV is
 * unset/production). Only the staging describe overrides it.
 *
 * Run (Validate stage only, machine-wide serialized):
 *   caffeinate -i npx playwright test tests/rocks/pe-site-pricing-demo.spec.ts --project=chromium \
 *     --no-deps --reporter=list --retries=0 --workers=1 --trace=off
 *
 * Live state since the 2026-10-05 sweep: production /pricing/ serves the LEGACY template again
 * (PR #465 restore: body.pe-legacy-pricing, h1 "Simple Prices. No Surprises", plan CTAs are
 * `.pricing-front__action--trial.trial-type-<plan> a` with NO href, routed by theme JS to
 * /signup?planName=<plan>[&plan=<stripe_plan_id>]). v2 may return (Asana 1218696759512619), so the
 * pricing locators also accept v2's rendered `a[href*="planName=<plan>"]` links.
 *
 * SAFETY (production is read-only):
 *   1. Every test: POSTs to /wp-admin/admin-ajax.php are recorded (action name + "carried field
 *      data?" / "body readable?" booleans, never values) and ABORTED (page route on the exact glob +
 *      a context route that also catches query-string variants and popups). Service workers are
 *      blocked so they cannot bypass the routes. Form tests assert submissionAttempts() is empty.
 *   2. The test-drive box is never typed into on production (the theme sendBeacon-POSTs a real
 *      lindris_contact lead when CORE_SITE_ENV.environment === 'production'). Wave 2's PESD-07 must
 *      call assertNonProductionSiteEnv() first.
 *   3. Schedule-demo: PESD-16 fills step 1 with RFC-2606 data and NEVER clicks Continue and never
 *      presses Enter (WPForms maps Enter to Continue). The wizard's pagehide handler auto-submits
 *      wpforms_submit once the LAST page is visible, so no test may ever reach step 3; SUBMIT_FORMS is
 *      never read. The form is reset before the test ends.
 *   4. Plan CTAs: the /signup navigation is intercepted and answered with a local stub page, so the
 *      real signup page is never requested. The production plans API is not called by this spec;
 *      PESD-02 only reads the response the pricing page itself fetched.
 *   5. Contact Us: no ContactPage.revealForm() (it force-unhides the form and masks #458); the test
 *      clicks like a user, exactly once per control, and never submits.
 *   6. Sitemap crawl: request fixture GETs only, same-origin, capped and logged, pool <= 4. Redirects
 *      are followed by hand (max 5 hops) and every hop is re-checked by qa-core's target guard; a hop
 *      to a host outside the guard (e.g. an affiliate partner) is recorded, never requested.
 *   7. Cloudflare: a challenge page, or HTTP 403/429/503 / no response on a navigation, throws
 *      BlockedError{SESSION/waf}. Never a silent skip, never evaded.
 */
import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
  type Response as PwResponse,
  type Route,
  type TestInfo,
} from '@playwright/test';
import { BlockedError } from '../../../packages/qa-core/errors';
import { assertAllowedTarget, checkTarget } from '../../../packages/qa-core/guards/targets';
import { detectWafChallenge } from '../../../packages/qa-core/api/base';

// ───────────────────────── configuration ─────────────────────────

const ROCK = 'pe-site-pricing-demo';
const ASANA_TASK = '1219167956413620';
const STAGING_ORIGIN = 'https://staging.pushengage.com';

const PATHS = {
  pricing: '/pricing/',
  contact: '/contact-us/',
  scheduleDemo: '/schedule_demo/',
  sitemapIndex: '/sitemap.xml',
} as const;

const DESKTOP = { width: 1440, height: 900 };
/** Wave 2 viewports (PESD-01/04/14/15). Use with `isMobile: true, hasTouch: true`. */
const TABLET = { width: 768, height: 1024 };
const PHONE = { width: 390, height: 844 };

const WAF_ACTION = 're-run later / from an allow-listed IP';

/** Cloudflare / bot-challenge markers, matched against <title> + the first part of the body text. */
const CHALLENGE_RE =
  /just a moment\.\.\.|attention required!? \| cloudflare|checking your browser|verify you are human|cf-browser-verification|enable javascript and cookies to continue|ddos protection by cloudflare|sorry, you have been blocked|error 10(?:0\d|1\d|20)\b/i;

/** Sitemap crawl tunables (PESD-13). Caps are logged, never silent. */
const SITEMAP_PAGE_CAP = Number(process.env.PESD_SITEMAP_PAGE_CAP ?? 200); // all of page-sitemap (134 on 2026-10-20)
const SITEMAP_SAMPLE_PER_CHILD = Number(process.env.PESD_SITEMAP_SAMPLE ?? 15); // evenly spaced sample of every other child sitemap
const SITEMAP_TOTAL_CAP = Number(process.env.PESD_SITEMAP_TOTAL_CAP ?? 260);
const SITEMAP_CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.PESD_SITEMAP_CONCURRENCY ?? 4)));

// ───────────────────────── small utilities ─────────────────────────

const firstLine = (e: unknown): string => String((e as Error)?.message ?? e).split('\n')[0].slice(0, 160);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Poll a synchronous condition; resolves to its final value (no throw, the caller asserts). */
async function until(cond: () => boolean, timeoutMs: number, stepMs = 200): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(stepMs);
  }
  return cond();
}

function wafBlocked(reason: string): BlockedError {
  return new BlockedError({ cls: 'SESSION', code: 'waf', reason: `Cloudflare/WAF: ${reason}`, humanAction: WAF_ACTION });
}

/** The run's site origin (playwright.config baseURL or a describe override), checked against qa-core's target guard. */
function siteOrigin(baseURL: string | undefined): string {
  if (!baseURL) {
    throw new BlockedError({
      cls: 'HARNESS',
      code: 'no-baseurl',
      reason: 'no baseURL is configured for this project',
      humanAction: 'Run with the pushengage-site chromium project (playwright.config sets baseURL from TEST_ENV).',
    });
  }
  const origin = new URL(baseURL).origin;
  assertAllowedTarget(`${origin}/`, 'GET');
  return origin;
}

function annotate(testInfo: TestInfo, type: string, description: string): void {
  testInfo.annotations.push({ type, description });
}

// ───────────────────────── safety net: admin-ajax POSTs ─────────────────────────

/**
 * One aborted admin-ajax POST. Booleans only — field VALUES are never read into the log.
 * `fieldData`: the body carried WPForms field data (`wpforms[fields][…]`) or an `email` parameter.
 * `bodyReadable`: Playwright exposed the body; an unreadable body (Blob/FormData Chromium did not
 * serialise) cannot be proven harmless, so the submission check treats it as a submission attempt.
 */
type AjaxPost = { action: string; resourceType: string; fieldData: boolean; bodyReadable: boolean; at: string };
const ajaxLog = new WeakMap<Page, AjaxPost[]>();
/** The `**\/wp-admin/admin-ajax.php` glob, widened to query-string variants. */
const ADMIN_AJAX_ANY = /\/wp-admin\/admin-ajax\.php(?:[?#]|$)/;
const FIELD_DATA_RE = /wpforms(?:\[|%5B)fields(?:\]|%5D)|(?:^|&)email=|name="email"/i;

/** Action name of an admin-ajax POST (urlencoded, multipart FormData or sendBeacon body). Never logs values. */
function postAction(req: Request): string {
  const body = req.postData() ?? '';
  const multipart = /name="action"\r?\n\r?\n([^\r\n]*)/.exec(body);
  if (multipart) return multipart[1].slice(0, 64);
  const urlEncoded = new URLSearchParams(body).get('action');
  if (urlEncoded) return urlEncoded.slice(0, 64);
  const q = new URL(req.url()).searchParams.get('action');
  return q ? q.slice(0, 64) : 'unknown';
}

async function installSafetyNet(page: Page): Promise<AjaxPost[]> {
  const log: AjaxPost[] = [];
  const handler = async (route: Route): Promise<void> => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();
    const body = req.postData();
    log.push({
      action: postAction(req),
      resourceType: req.resourceType(),
      fieldData: body !== null && FIELD_DATA_RE.test(body),
      bodyReadable: body !== null,
      at: new Date().toISOString(),
    });
    return route.abort('blockedbyclient');
  };
  await page.route('**/wp-admin/admin-ajax.php', handler);
  await page.context().route(ADMIN_AJAX_ANY, handler);
  ajaxLog.set(page, log);
  return log;
}

function ajaxPosts(page: Page): AjaxPost[] {
  return ajaxLog.get(page) ?? [];
}

/** Lead/submission actions that must never even be attempted by this spec. */
const SUBMIT_ACTIONS = /^(?:wpforms_submit|lindris_contact)$/;

/**
 * Aborted POSTs that look like a submission: a submit/lead action, a body carrying form-field data,
 * or a body Playwright could not read. Expected noise (wpforms_get_token on focusin with a stale
 * cached token, wpforms_analytics_snapshot counts) is urlencoded, field-free, and not returned.
 */
function submissionAttempts(page: Page): Array<Pick<AjaxPost, 'action' | 'fieldData' | 'bodyReadable'>> {
  return ajaxPosts(page)
    .filter((p) => SUBMIT_ACTIONS.test(p.action) || p.fieldData || !p.bodyReadable)
    .map(({ action, fieldData, bodyReadable }) => ({ action, fieldData, bodyReadable }));
}

// ───────────────────────── navigation + Cloudflare gate ─────────────────────────

async function looksChallenged(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => '');
  const body = await page
    .evaluate(() => (document.body ? document.body.innerText : '').slice(0, 2000))
    .catch(() => '');
  return CHALLENGE_RE.test(`${title}\n${body}`);
}

/**
 * Navigate like a user and gate on Cloudflare. A challenge, HTTP 403/429/503 or a navigation that
 * never completes is BLOCKED{SESSION/waf}; any other HTTP >= 400 is a real failure.
 */
async function gotoChecked(page: Page, baseURL: string | undefined, path: string): Promise<PwResponse | null> {
  const url = new URL(path, siteOrigin(baseURL)).href;
  assertAllowedTarget(url, 'GET');
  let res: PwResponse | null;
  try {
    res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch (e) {
    throw wafBlocked(`navigation to ${path} did not complete (${firstLine(e)}); usually throttling of automated browsers`);
  }
  const status = res ? res.status() : 0;
  if (status === 403 || status === 429 || status === 503) throw wafBlocked(`${path} answered HTTP ${status}`);
  if (await looksChallenged(page)) throw wafBlocked(`${path} rendered a bot-challenge page`);
  if (res) expect(status, `${path} should load (HTTP < 400)`).toBeLessThan(400);
  return res;
}

/** Wait (bounded) for the window load event; heavy marketing pages bind their handlers from deferred bundles. */
async function settle(page: Page, timeout = 20_000): Promise<void> {
  await page.waitForLoadState('load', { timeout }).catch(() => undefined);
}

// ───────────────────────── pricing helpers (PESD-02; wave 2: 01, 09, 14, 15) ─────────────────────────

const PLAN_KEYS = ['free', 'business', 'premium', 'growth'] as const;
type PlanKey = (typeof PLAN_KEYS)[number];
type Period = 'year' | 'month';

const STRIPE_ID_RE = /^(?:plan|price)_[A-Za-z0-9]{6,}$/;
const SIGNUP_PATH_RE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?signup\/?$/i;
const PLANS_API_RE = /\/d\/v1\/misc\/payment\/plans(?:[?#]|$)/;
const SIGNUP_STUB_HTML =
  '<!doctype html><meta charset="utf-8"><title>QA stub: signup not loaded</title>' +
  '<p>pe-site-pricing-demo intercepted this /signup navigation; the real signup page was not requested.</p>';

/** Template-agnostic primary CTA candidates for one plan card. */
function planCtaCandidates(page: Page, plan: PlanKey): Locator {
  return page.locator(
    [
      `.pricing-front__action--trial.trial-type-${plan} a`, // legacy template (JS-routed, no href)
      `a[href*="planName=${plan}" i]`, // v2 template (rendered signupPlanURL)
    ].join(', '),
  );
}

async function firstVisible(candidates: Locator, timeout = 15_000): Promise<Locator | null> {
  const attached = await candidates
    .first()
    .waitFor({ state: 'attached', timeout })
    .then(
      () => true,
      () => false,
    );
  if (!attached) return null;
  const n = await candidates.count();
  for (let i = 0; i < n; i++) {
    const c = candidates.nth(i);
    if (await c.isVisible()) return c;
  }
  return null;
}

/**
 * Legacy template binds `.pricing-front__action--trial` (delegated jQuery click) only AFTER its own
 * plans fetch resolves; clicking earlier would do nothing. v2 links carry real hrefs.
 */
async function waitForPricingReady(page: Page): Promise<'legacy' | 'v2'> {
  await settle(page);
  const legacy = (await page.locator('body.pe-legacy-pricing').count()) > 0;
  if (legacy) {
    const bound = await page
      .waitForFunction(
        () => {
          const jq = (window as unknown as { jQuery?: { _data?: (el: unknown, key: string) => unknown } }).jQuery;
          if (!jq || typeof jq._data !== 'function') return false;
          const events = jq._data(document, 'events') as { click?: Array<{ selector?: string }> } | undefined;
          return !!events?.click?.some((h) => h.selector === '.pricing-front__action--trial');
        },
        null,
        { timeout: 30_000 },
      )
      .then(
        () => true,
        () => false,
      );
    expect(bound, 'legacy /pricing/ never bound its plan-CTA click handler (bound after the page loads its plans payload)').toBe(true);
  }
  return legacy ? 'legacy' : 'v2';
}

/** Billing period currently selected in the UI, or null when it cannot be read. */
async function readBillingPeriod(page: Page): Promise<Period | null> {
  const legacyToggle = page.locator('#plan-period-table').first();
  if ((await legacyToggle.count()) > 0) return (await legacyToggle.isChecked()) ? 'year' : 'month';
  return page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll('[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], input:checked'),
    );
    for (const el of els) {
      const id = (el as HTMLElement).id;
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent ?? '' : '';
      const text = `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''} ${label}`.toLowerCase();
      if (/\b(?:year|yearly|annual|annually)\b/.test(text)) return 'year' as const;
      if (/\b(?:month|monthly)\b/.test(text)) return 'month' as const;
    }
    return null;
  });
}

type Tier = { id: string; planType: string; mode: string; subscribers?: number };

function indexTiers(body: unknown): Map<string, Tier> {
  const map = new Map<string, Tier>();
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return map;
  for (const plan of data as Array<{ plan_type?: unknown; tiers?: unknown }>) {
    if (!Array.isArray(plan?.tiers)) continue;
    for (const t of plan.tiers as Array<{ stripe_plan_id?: unknown; plan_mode?: unknown; subscribers_limit?: unknown }>) {
      if (typeof t?.stripe_plan_id !== 'string' || !t.stripe_plan_id) continue;
      map.set(t.stripe_plan_id, {
        id: t.stripe_plan_id,
        planType: String(plan.plan_type ?? ''),
        mode: String(t.plan_mode ?? ''),
        subscribers: typeof t.subscribers_limit === 'number' ? t.subscribers_limit : undefined,
      });
    }
  }
  return map;
}

/** Passive read of the plans payload the pricing page fetches for itself (the spec never calls the API). */
function sniffPlansPayload(page: Page): { tiers: () => Map<string, Tier>; seen: () => number } {
  let tiers = new Map<string, Tier>();
  let seen = 0;
  page.on('response', (res) => {
    if (res.request().method() !== 'GET' || res.status() !== 200 || !PLANS_API_RE.test(res.url())) return;
    res
      .json()
      .then((body) => {
        const m = indexTiers(body);
        if (m.size) {
          tiers = m;
          seen += 1;
        }
      })
      .catch(() => undefined); // unreadable body = no oracle; the test reports BLOCKED{ORACLE}, never a pass
  });
  return { tiers: () => tiers, seen: () => seen };
}

type SignupNav = { url: string; topFrame: boolean };

/** Answer every /signup document navigation with a local stub (any host), recording the URL. */
async function stubSignupNavigations(context: BrowserContext): Promise<SignupNav[]> {
  const navs: SignupNav[] = [];
  await context.route(
    (url) => SIGNUP_PATH_RE.test(url.pathname),
    async (route) => {
      const req = route.request();
      if (!req.isNavigationRequest()) return route.abort('blockedbyclient');
      navs.push({ url: req.url(), topFrame: req.frame().parentFrame() === null });
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SIGNUP_STUB_HTML });
    },
  );
  return navs;
}

// ───────────────────────── Contact Us helpers (PESD-03; wave 2: 04, 05) ─────────────────────────

const CONTACT_FORM_ID = '#wpforms-form-1682';
const CONTACT_FIELDS = ['Name', 'Email', 'Website', 'Topic', 'Message'] as const;
/** WPForms conditional fields of form 1682: hidden until the Email field (the trigger) has a value. */
const CONTACT_CONDITIONAL_FIELDS: readonly string[] = ['Topic', 'Message'];

function ticketInviteLink(page: Page): Locator {
  return page.locator('#pe-ticketinvite a.pe-showcontact-from-block');
}

/**
 * Readiness only (not an assertion): wait until the theme bound its click handler on
 * "create a support ticket", the way a user's click lands after the page finished loading.
 */
async function waitForContactHandlers(page: Page): Promise<boolean> {
  await settle(page);
  return page
    .waitForFunction(
      () => {
        const jq = (window as unknown as { jQuery?: { _data?: (el: unknown, key: string) => unknown } }).jQuery;
        const el = document.querySelector('#pe-ticketinvite a.pe-showcontact-from-block');
        if (!jq || typeof jq._data !== 'function' || !el) return false;
        const events = jq._data(el, 'events') as { click?: unknown[] } | undefined;
        return !!events?.click?.length;
      },
      null,
      { timeout: 15_000 },
    )
    .then(
      () => true,
      () => false,
    );
}

// ───────────────────────── schedule-demo wizard helpers (PESD-16; wave 2: 17) ─────────────────────────

const WIZARD_STEP_TITLES = ['Tell us where to start', 'Help us prepare your call', 'Pick your time'];
/** RFC-2606 test data only. */
const DEMO_TEST_DATA = { email: 'qa-demo@example.com', first: 'QA', last: 'Automation', website: 'https://example.com' } as const;

/** The multi-step WPForms wizard on /schedule_demo/ (form 28814 on 2026-10-20), located by its page indicator. */
function demoWizard(page: Page): Locator {
  return page.locator('form.wpforms-form').filter({ has: page.locator('.wpforms-page-indicator') }).first();
}

async function waitForWpformsReady(form: Locator): Promise<boolean> {
  return form
    .evaluate(
      (f) =>
        new Promise<boolean>((resolve) => {
          const end = Date.now() + 20_000;
          const tick = () => {
            const jq = (window as unknown as { jQuery?: (el: Element) => { data: (k: string) => unknown } }).jQuery;
            if (jq && jq(f).data('validator')) return resolve(true);
            if (Date.now() > end) return resolve(false);
            setTimeout(tick, 250);
          };
          tick();
        }),
    )
    .catch(() => false);
}

type StepGate = { disabled: boolean; validator: boolean; valid: boolean | null; checked: number };

/**
 * How step 1's Continue is gated, read WITHOUT clicking it (clicking is forbidden on production).
 * WPForms renders Continue `disabled` server-side and re-enables every page button on wpformsReady;
 * clicking then runs the jQuery validator over the current page. So the gate is either the disabled
 * attribute or that same validator's verdict on the step-1 fields (`validator.check`, no UI side effect).
 */
async function readStepGate(form: Locator, pageSelector: string, cont: Locator): Promise<StepGate> {
  const disabled = await cont.isDisabled();
  const v = await form.evaluate((f, sel) => {
    type Validator = { check?: (el: Element) => unknown; settings?: { ignore?: string } };
    const jq = (window as unknown as { jQuery?: (el: Element) => { data: (k: string) => unknown; is: (s: string) => boolean } }).jQuery;
    const validator = jq ? (jq(f).data('validator') as Validator | undefined) : undefined;
    if (!jq || !validator || typeof validator.check !== 'function') return { validator: false, valid: null as boolean | null, checked: 0 };
    const pageEl = f.querySelector(sel);
    const els = Array.from(pageEl ? pageEl.querySelectorAll('input, select, textarea') : []) as HTMLInputElement[];
    const ignore = validator.settings?.ignore;
    const fields = els.filter((el) => el.name && el.type !== 'hidden' && el.type !== 'submit' && !el.disabled && !(ignore && jq(el).is(ignore)));
    let valid = true;
    for (const el of fields) {
      let r: unknown;
      try {
        r = validator.check(el);
      } catch {
        return { validator: false, valid: null as boolean | null, checked: 0 }; // validator unusable → no oracle
      }
      if (r === false) valid = false;
    }
    return { validator: true, valid, checked: fields.length };
  }, pageSelector);
  return { disabled, ...v };
}

const isGated = (g: StepGate) => g.disabled || (g.validator && g.valid === false);

// ───────────────────────── test-drive guard (wave 2: PESD-07, staging only) ─────────────────────────

/** Throws GUARDRAIL unless the page's own CORE_SITE_ENV says it is not production. Call BEFORE typing an email. */
async function assertNonProductionSiteEnv(page: Page): Promise<string> {
  const env = await page.evaluate(() => {
    const w = window as unknown as { CORE_SITE_ENV?: { environment?: string } };
    return w.CORE_SITE_ENV?.environment ?? null;
  });
  if (!env || env === 'production') {
    throw new BlockedError({
      cls: 'GUARDRAIL',
      code: 'production-lead-capture',
      reason: `window.CORE_SITE_ENV.environment is ${env ?? 'missing'}: an email in the test-drive box would sendBeacon a real lindris_contact lead`,
      humanAction: 'Run PESD-07 only against https://staging.pushengage.com (its CORE_SITE_ENV is not production).',
    });
  }
  return env;
}

// ───────────────────────── sitemap helpers (PESD-13; wave 2: 12) ─────────────────────────

/** AIOSEO wraps every <loc> in CDATA; the old fetchLocs regex in site-health.spec.js found 0 URLs. */
const LOC_RE = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi;

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(LOC_RE)].map((m) => decodeXml(m[1].trim())).filter(Boolean);
}

type Fetched = {
  url: string;
  status: number;
  finalUrl: string;
  body: string;
  headers: Record<string, string>;
  err?: string;
  /** Set when a redirect hop left the qa-core target guard: the hop was NOT requested (guard decision code). */
  offsite?: string;
  /** Set when the redirect chain exceeded MAX_REDIRECTS (a loop is a real defect). */
  loop?: boolean;
};

const MAX_REDIRECTS = 5;

/**
 * GET through the request fixture. Redirects are followed by hand so every hop passes qa-core's
 * target guard (like qa-core's own API client); a hop the guard refuses is reported, never requested.
 * Network errors/timeouts come back as status 0 for the caller to classify.
 */
async function getText(request: APIRequestContext, url: string, timeout = 20_000): Promise<Fetched> {
  assertAllowedTarget(url, 'GET');
  let current = url;
  for (let hop = 0; ; hop++) {
    let res: Awaited<ReturnType<APIRequestContext['get']>>;
    try {
      res = await request.get(current, { failOnStatusCode: false, maxRedirects: 0, timeout });
    } catch (e) {
      return { url, status: 0, finalUrl: current, body: '', headers: {}, err: firstLine(e) };
    }
    const status = res.status();
    const headers = res.headers();
    const location = headers['location'];
    if (status >= 300 && status < 400 && location) {
      if (hop >= MAX_REDIRECTS) return { url, status, finalUrl: current, body: '', headers, loop: true, err: `more than ${MAX_REDIRECTS} redirects` };
      let next: string;
      try {
        next = new URL(location, current).href;
      } catch {
        return { url, status, finalUrl: current, body: '', headers, err: `unparseable Location header on a ${status}` };
      }
      const decision = checkTarget(next, 'GET');
      if (!decision.allowed) return { url, status, finalUrl: next, body: '', headers, offsite: decision.code };
      current = next;
      continue;
    }
    return { url, status, finalUrl: current, body: await res.text(), headers };
  }
}

const isTransient = (f: Fetched) => f.status === 0 || f.status === 429 || f.status === 503;
const isSoftStatus = (f: Fetched) => f.status === 0 || f.status === 403 || f.status === 429 || f.status === 503;

/** One retry for transient results (timeouts / 429 / 503 under a burst are usually throttling, not an outage). */
async function getWithRetry(request: APIRequestContext, url: string): Promise<Fetched> {
  const first = await getText(request, url, 20_000);
  if (!isTransient(first)) return first;
  await sleep(1500);
  return getText(request, url, 30_000);
}

/**
 * Anchored to the START of <title> ("Page Not Found | PushEngage", "404 - …") so a blog post or doc
 * that merely talks about 404 pages is not flagged; body.error404 is WordPress's own 404 marker.
 */
const TITLE_NOT_FOUND = /^\s*(?:page not found|nothing found|404\b)/i;
/**
 * Rendered WordPress/PHP failure markup only (not prose that mentions errors, which documentation
 * pages do): the core fatal-error handler paragraph, PHP display_errors' <b>Fatal error</b>:, and
 * wpdb's error block.
 */
const FATAL_RE = /<p>\s*there has been a critical error on (?:this|your) website|<b>\s*fatal error\s*<\/b>\s*:|class=["']wpdberror["']/i;

/** Soft-404 / fatal-error signal in a 2xx/3xx body, or null. Uses WordPress's own error404 body class. */
function pageProblem(html: string): string | null {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = t ? t[1].replace(/\s+/g, ' ').trim() : '';
  if (TITLE_NOT_FOUND.test(title)) return `soft-404 (title "${title.slice(0, 60)}")`;
  if (/<body[^>]*\bclass="[^"]*\berror404\b/i.test(html)) return 'soft-404 (body.error404)';
  if (FATAL_RE.test(html)) return 'server/PHP fatal-error banner';
  return null;
}

function evenSample<T>(items: T[], k: number): T[] {
  if (items.length <= k) return items.slice();
  const out: T[] = [];
  for (let i = 0; i < k; i++) out.push(items[Math.floor((i * items.length) / k)]);
  return out;
}

async function runPool<T, R>(items: T[], worker: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

const isRecommendsCloak = (url: string) => /\/recommends\//i.test(new URL(url).pathname);
const NON_HTML_RE = /\.(?:xml|jpe?g|png|gif|webp|svg|ico|pdf|zip|mp4|css|js)(?:[?#]|$)/i;

// ═════════════════════════ PRODUCTION (read-only) ═════════════════════════

test.describe(
  `Rock ${ROCK} — production (read-only)`,
  {
    tag: '@rock-pe-site-pricing-demo',
    annotation: [
      { type: 'rock', description: ROCK },
      { type: 'asana', description: ASANA_TASK },
    ],
  },
  () => {
    test.use({ serviceWorkers: 'block' });

    test.beforeEach(async ({ page }) => {
      await installSafetyNet(page);
    });

    // ───────────── desktop 1440x900 ─────────────
    test.describe('desktop 1440x900', () => {
      test.use({ viewport: DESKTOP });

      test(
        'PESD-02 — each plan CTA (Free / Business / Premium / Growth) routes to its own /signup URL',
        { tag: ['@case:PESD-02'] },
        async ({ page, baseURL }, testInfo) => {
          test.setTimeout(240_000);
          const origin = siteOrigin(baseURL);
          const plans = sniffPlansPayload(page);
          const signupNavs = await stubSignupNavigations(page.context());

          type Row = { plan: PlanKey; template: string; period: Period | null; url?: string; planName?: string | null; planId?: string | null };
          const rows: Row[] = [];
          const problems: string[] = [];

          for (const plan of PLAN_KEYS) {
            // Fresh /pricing/ for every plan (the previous click left the page on the signup stub).
            await gotoChecked(page, baseURL, PATHS.pricing);
            const template = await waitForPricingReady(page);
            const period = await readBillingPeriod(page);
            const row: Row = { plan, template, period };
            rows.push(row);

            const cta = await firstVisible(planCtaCandidates(page, plan));
            if (!cta) {
              problems.push(`${plan}: no visible primary CTA on /pricing/ (${template} template)`);
              continue;
            }
            // Centre it so a bottom consent banner / chat launcher cannot sit on top of it (the banner is never clicked).
            await cta.evaluate((el) => el.scrollIntoView({ block: 'center' }));
            const before = signupNavs.length;
            await cta.click();
            const navigated = await until(() => signupNavs.length > before, 15_000);
            if (!navigated) {
              problems.push(`${plan}: clicking "${(await cta.innerText().catch(() => '?')).trim()}" did not navigate to /signup within 15s`);
              continue;
            }
            const nav = signupNavs[before];
            const u = new URL(nav.url);
            row.url = `${u.origin}${u.pathname}${u.search}`;
            row.planName = u.searchParams.get('planName');
            row.planId = u.searchParams.get('plan');

            if (!nav.topFrame) problems.push(`${plan}: the /signup navigation happened in a sub-frame, not the page`);
            if (u.origin !== origin) problems.push(`${plan}: went to ${u.origin}, expected the site's own origin ${origin}`);
            if (!SIGNUP_PATH_RE.test(u.pathname)) problems.push(`${plan}: path ${u.pathname} is not /signup`);
            if (row.planName !== plan) problems.push(`${plan}: planName=${row.planName ?? '(missing)'}, expected ${plan}`);
            if (plan === 'free') {
              if (row.planId) problems.push(`free: carries a paid plan id (plan=${row.planId})`);
            } else if (!row.planId || !STRIPE_ID_RE.test(row.planId)) {
              problems.push(`${plan}: plan=${row.planId ?? '(missing)'} is not a Stripe plan id (empty/"undefined" means the price→tier lookup failed)`);
            }
          }

          const paidIds = rows.filter((r) => r.plan !== 'free' && r.planId && STRIPE_ID_RE.test(r.planId)).map((r) => r.planId as string);
          if (new Set(paidIds).size !== paidIds.length) problems.push(`paid plans share a Stripe plan id: ${paidIds.join(', ')}`);

          // Billing-period oracle: the page's own plans payload (passively observed) + the UI toggle.
          const tiers = plans.tiers();
          let oracleGap: string | null = null;
          for (const r of rows) {
            if (r.plan === 'free' || !r.planId || !STRIPE_ID_RE.test(r.planId)) continue;
            if (!tiers.size) {
              oracleGap = 'the pricing page\'s own /d/v1/misc/payment/plans response was not observed/readable';
              break;
            }
            if (!r.period) {
              oracleGap = 'the selected billing period could not be read from the pricing UI';
              break;
            }
            const tier = tiers.get(r.planId);
            if (!tier) problems.push(`${r.plan}: plan id ${r.planId} is not in the page's plans payload`);
            else if (tier.planType !== r.plan) problems.push(`${r.plan}: plan id ${r.planId} belongs to the ${tier.planType} plan`);
            else if (tier.mode !== r.period) problems.push(`${r.plan}: plan id ${r.planId} is a ${tier.mode} tier but the UI shows the ${r.period} period`);
          }

          await testInfo.attach('pesd-02-plan-ctas.json', {
            body: JSON.stringify({ origin, plansPayloadsSeen: plans.seen(), rows }, null, 2),
            contentType: 'application/json',
          });
          annotate(testInfo, 'template', rows.map((r) => r.template)[0] ?? 'unknown');
          expect(problems, `Plan CTAs must each reach /signup with their own planName and plan id:\n${problems.join('\n')}`).toEqual([]);

          if (oracleGap) {
            throw new BlockedError({
              cls: 'ORACLE',
              code: 'plans-payload',
              reason: `PESD-02 routing checks passed, but the "plan id matches the current billing period" check could not run: ${oracleGap}`,
              humanAction: 'Re-run once; if it repeats, the /pricing/ template changed (v2?) — update readBillingPeriod()/sniffPlansPayload() for it.',
            });
          }
        },
      );

      test(
        "PESD-03 — Contact Us: 'Complete a form' reveals the contact form on the FIRST click at desktop width (#458)",
        { tag: ['@case:PESD-03'], annotation: [{ type: 'issue', description: 'pushengage-site#458' }] },
        async ({ page, baseURL }, testInfo) => {
          test.setTimeout(90_000);
          await gotoChecked(page, baseURL, PATHS.contact);
          const bound = await waitForContactHandlers(page);
          annotate(testInfo, 'ticket-link-handler-bound', String(bound));

          const form = page.locator(CONTACT_FORM_ID);
          await expect(form, 'the contact WPForms form is in the page').toHaveCount(1);
          await expect(form, 'the contact form is hidden on a fresh load').toBeHidden();

          // Step 2: "create a support ticket" opens the options block.
          const ticketLink = ticketInviteLink(page);
          await expect(ticketLink, "'create a support ticket' link is visible").toBeVisible();
          await ticketLink.click();
          const completeForm = page.getByRole('link', { name: 'Complete a form', exact: true });
          await expect(completeForm, "the options block (with 'Complete a form') appears after 'create a support ticket'").toBeVisible();

          // Was the theme's click handler on "Complete a form" bound when we clicked? (rules out a harness race)
          const completeFormBound = await completeForm
            .evaluate((el) => {
              const jq = (window as unknown as { jQuery?: { _data?: (el: unknown, key: string) => unknown } }).jQuery;
              const ev = jq && typeof jq._data === 'function' ? (jq._data(el, 'events') as { click?: unknown[] } | undefined) : undefined;
              const delegated = jq && typeof jq._data === 'function' ? (jq._data(document, 'events') as { click?: unknown[] } | undefined) : undefined;
              return `direct=${ev?.click?.length ?? 0} delegated-on-document=${delegated?.click?.length ?? 0}`;
            })
            .catch(() => 'unreadable');
          annotate(testInfo, 'complete-form-handlers', completeFormBound);

          // Step 3: ONE click on "Complete a form" — the expected behaviour is that this first click reveals the form.
          await completeForm.click();
          const firstClickReveals = await expect(form)
            .toBeVisible({ timeout: 5_000 })
            .then(
              () => true,
              () => false,
            );
          if (!firstClickReveals) {
            // Evidence for #458 only (never part of the verdict): does a SECOND click reveal it?
            await completeForm.click().catch(() => undefined);
            const secondClickReveals = await expect(form)
              .toBeVisible({ timeout: 5_000 })
              .then(
                () => true,
                () => false,
              );
            annotate(testInfo, 'second-click-reveals', String(secondClickReveals));
          }
          // Checks that are NOT #458 run BEFORE test.fail is declared, so a broken form, missing fields or a
          // submission attempt fail this test for real instead of being absorbed as the "expected" failure.
          // (With #458 present the second click above is what revealed the form.)
          // Live 2026-10-21 (review): Topic + Message (and a content block) are WPForms CONDITIONAL fields
          // (`wpforms-conditional-field`, server-rendered display:none; WPForms JS toggles its -show/-hide class at runtime) that appear only once Email has a value —
          // so on reveal only Name/Email/Website are on screen. Nothing is typed on production, so the
          // conditional ones are asserted present-but-hidden (by design), never "visible".
          for (const label of CONTACT_FIELDS) {
            const fieldLabel = form.locator('.wpforms-field-label').filter({ hasText: new RegExp(`^\\s*${label}\\b`) }).first();
            const conditional = await fieldLabel.evaluate((el) => !!el.closest('.wpforms-field.wpforms-conditional-field'));
            if (CONTACT_CONDITIONAL_FIELDS.includes(label)) {
              expect(conditional, `${label} is a conditional field (shown after Email is filled)`).toBe(true);
              await expect(fieldLabel, `${label} field is in the form`).toBeAttached();
            } else {
              await expect(fieldLabel, `${label} field is shown`).toBeVisible();
            }
          }
          await expect(form.locator('button.wpforms-submit, button[type="submit"]').first(), 'Submit button is shown (never clicked)').toBeVisible();
          expect(submissionAttempts(page), 'nothing was submitted (no submit action, no field data in any admin-ajax POST)').toEqual([]);

          // Known bug (validated live 2026-10-21 on production at 1440x900): the first click does nothing and a
          // second click reveals the form — exactly #458 (OPEN). test.fail covers ONLY the assertion below; when
          // the fix ships this test "unexpectedly passes": drop the test.fail line then.
          test.fail(true, 'awesomemotive/pushengage-site#458: known bug — first click on "Complete a form" does not reveal the contact form at >= 1024px');
          expect(firstClickReveals, "#458: the contact form must be visible after the FIRST click on 'Complete a form' at >= 1024px").toBe(true);
        },
      );

      test(
        'PESD-16 — Schedule-demo wizard step 1 renders with required-field validation (Continue gated)',
        { tag: ['@case:PESD-16'] },
        async ({ page, baseURL }, testInfo) => {
          test.setTimeout(120_000);
          await gotoChecked(page, baseURL, PATHS.scheduleDemo);
          await settle(page);

          const form = demoWizard(page);
          await expect(form, '/schedule_demo/ renders the multi-step demo wizard').toBeVisible();
          const wpformsReady = await waitForWpformsReady(form);
          annotate(testInfo, 'wpforms-ready', String(wpformsReady));

          // 3-step indicator, page 1 active, pages 2 and 3 not shown.
          await expect(form.locator('.wpforms-page-indicator-page-title')).toHaveText(WIZARD_STEP_TITLES);
          await expect(form.locator('.wpforms-page-indicator-page').first()).toHaveClass(/\bactive\b/);
          const step1 = form.locator('.wpforms-page-1');
          await expect(step1).toBeVisible();
          await expect(form.locator('.wpforms-page-2'), 'step 2 is not shown yet').toBeHidden();
          await expect(form.locator('.wpforms-page.last'), 'step 3 (last page) is not shown').toBeHidden();

          // Step-1 fields + required markers.
          const email = step1.getByLabel('Work email');
          const first = step1.getByLabel('First name');
          const last = step1.getByLabel('Last name');
          const website = step1.getByLabel('Company website');
          const agenda = step1.getByLabel('Add to the agenda');
          for (const [name, loc] of [['Work email', email], ['First name', first], ['Last name', last], ['Company website', website], ['Agenda', agenda]] as const) {
            await expect(loc, `${name} field is visible on step 1`).toBeVisible();
          }
          // Validated live 2026-10-21: the theme hides WPForms' "*" (.wpforms-required-label is display:none);
          // the visible convention is "(optional)" on the one optional field. So "required" is asserted on the
          // inputs themselves (the `required` attribute the validator enforces) + the visible "(optional)" label.
          for (const [name, loc] of [['Work email', email], ['First name', first], ['Last name', last], ['Company website', website]] as const) {
            await expect(loc, `${name} is required`).toHaveAttribute('required', '');
          }
          await expect(step1.locator('.wpforms-field-label', { hasText: 'Add to the agenda' }).first(), 'the agenda label says it is optional').toContainText(/\(optional\)/i);
          await expect(agenda, 'the agenda is optional (no required attribute)').not.toHaveAttribute('required');

          const cont = step1.getByRole('button', { name: 'Continue' });
          await expect(cont, 'Continue is shown on step 1').toBeVisible();

          // Empty step 1 → Continue is gated.
          const emptyGate = await readStepGate(form, '.wpforms-page-1', cont);
          annotate(testInfo, 'gate-empty', JSON.stringify(emptyGate));
          if (!emptyGate.disabled && !emptyGate.validator) {
            throw new BlockedError({
              cls: 'ORACLE',
              code: 'wizard-gate',
              reason: 'Continue is enabled and the WPForms validator is not readable, so the step-1 gate cannot be verified without clicking Continue (forbidden on production)',
              humanAction: 'Verify the gate on staging (PESD-17 clicks Continue there), or re-run once the page finished loading.',
            });
          }
          expect(isGated(emptyGate), 'with the required fields empty, Continue must not be able to advance step 1').toBe(true);

          // Invalid email + blur (Tab, never Enter) → visible validation error, still gated.
          await email.fill('not-an-email');
          await email.press('Tab');
          const emailError = step1.locator('.wpforms-field-email').locator('em.wpforms-error, label.wpforms-error').first();
          await expect(emailError, 'an email validation error appears after blur').toBeVisible();
          await expect(email).toHaveAttribute('aria-invalid', 'true');
          const invalidGate = await readStepGate(form, '.wpforms-page-1', cont);
          annotate(testInfo, 'gate-invalid-email', JSON.stringify(invalidGate));
          expect(isGated(invalidGate), 'with an invalid email, Continue stays gated').toBe(true);

          // Valid RFC-2606 data, WITHOUT clicking Continue → gate opens, nothing is submitted.
          await email.fill(DEMO_TEST_DATA.email);
          await first.fill(DEMO_TEST_DATA.first);
          await last.fill(DEMO_TEST_DATA.last);
          await website.fill(DEMO_TEST_DATA.website);
          await website.press('Tab');
          await expect(emailError, 'the email error clears for a valid address').toBeHidden();
          await expect(email).not.toHaveAttribute('aria-invalid', 'true');
          await expect(cont, 'Continue is enabled once step 1 is valid').toBeEnabled();
          const validGate = await readStepGate(form, '.wpforms-page-1', cont);
          annotate(testInfo, 'gate-valid', JSON.stringify(validGate));
          if (validGate.validator) expect(validGate.valid, 'the WPForms validator accepts the filled step 1').toBe(true);

          await expect(step1, 'still on step 1 (Continue was never clicked)').toBeVisible();
          await expect(form.locator('.wpforms-page.last'), 'step 3 was never reached').toBeHidden();
          const posts = ajaxPosts(page);
          annotate(testInfo, 'admin-ajax-posts-aborted', posts.map((p) => p.action).join(',') || 'none');
          expect(
            submissionAttempts(page),
            'no wpforms_submit / lead POST was attempted, and no admin-ajax POST carried the typed step-1 field data',
          ).toEqual([]);

          // Leave nothing typed behind.
          await form.evaluate((f) => (f as HTMLFormElement).reset());
        },
      );
    });

    // ───────────── HTTP-level (request fixture) ─────────────
    test.describe('HTTP crawl', () => {
      test(
        'PESD-13 — sitemap health: published sitemap pages return < 400 and are not soft-404s (only /recommends/ cloaks may fail)',
        { tag: ['@case:PESD-13'] },
        async ({ request, baseURL }, testInfo) => {
          test.setTimeout(10 * 60_000);
          const origin = siteOrigin(baseURL);
          const host = new URL(origin).host;

          // 1. Sitemap index (first request: the Cloudflare gate).
          const index = await getText(request, `${origin}${PATHS.sitemapIndex}`, 30_000);
          if (index.status === 0 || index.status === 403 || index.status === 429 || index.status === 503 || detectWafChallenge(index.status, index.headers, index.body) || CHALLENGE_RE.test(index.body.slice(0, 3000))) {
            throw wafBlocked(`${PATHS.sitemapIndex} answered HTTP ${index.status || 'no response'}${index.err ? ` (${index.err})` : ''}`);
          }
          expect(index.status, `${PATHS.sitemapIndex} is published`).toBe(200);
          const indexLocs = parseSitemapLocs(index.body);
          expect(indexLocs.length, `${PATHS.sitemapIndex} lists <loc> entries (CDATA-aware parse)`).toBeGreaterThan(0);

          const childSitemaps = indexLocs.filter((l) => /\.xml(?:[?#]|$)/i.test(l));
          const hard: string[] = [];
          const soft: string[] = [];
          const notes: string[] = [];
          type Planned = { url: string; source: string };
          const planned: Planned[] = [];
          const seen = new Set<string>();
          const addPages = (locs: string[], source: string) => {
            for (const loc of locs) {
              let u: URL;
              try {
                u = new URL(loc);
              } catch {
                hard.push(`${source}: malformed <loc> "${loc.slice(0, 80)}"`);
                continue;
              }
              if (u.host !== host) {
                notes.push(`${source}: off-origin <loc> not crawled: ${u.origin}${u.pathname}`);
                continue;
              }
              if (NON_HTML_RE.test(u.pathname) || seen.has(u.href)) continue;
              seen.add(u.href);
              planned.push({ url: u.href, source });
            }
          };

          // 2. Child sitemaps: all of page-sitemap, an even sample of the others.
          const discovered: Record<string, number> = {};
          if (childSitemaps.length === 0) {
            discovered[PATHS.sitemapIndex] = indexLocs.length;
            addPages(evenSample(indexLocs, SITEMAP_PAGE_CAP), PATHS.sitemapIndex);
          }
          for (const child of childSitemaps) {
            const name = new URL(child).pathname;
            const res = await getWithRetry(request, child);
            if (isSoftStatus(res) || detectWafChallenge(res.status, res.headers, res.body)) {
              soft.push(`${name} → HTTP ${res.status || 'no response'} (WAF/throttle — unverifiable)`);
              continue;
            }
            if (res.loop || res.offsite) {
              hard.push(`${name} → ${res.loop ? `redirect loop (${res.err})` : `redirects off-site to ${new URL(res.finalUrl).origin}`} (child sitemap listed in the index is not served)`);
              continue;
            }
            if (res.status >= 400) {
              hard.push(`${name} → HTTP ${res.status} (child sitemap listed in the index is broken)`);
              continue;
            }
            const locs = parseSitemapLocs(res.body);
            discovered[name] = locs.length;
            if (!locs.length) {
              hard.push(`${name} → 0 <loc> entries`);
              continue;
            }
            const isPageSitemap = /page-sitemap|posts-page/i.test(name);
            addPages(isPageSitemap ? evenSample(locs, SITEMAP_PAGE_CAP) : evenSample(locs, SITEMAP_SAMPLE_PER_CHILD), name);
          }
          let crawl = planned;
          if (crawl.length > SITEMAP_TOTAL_CAP) {
            notes.push(`crawl capped at ${SITEMAP_TOTAL_CAP} of ${crawl.length} planned URLs`);
            crawl = crawl.slice(0, SITEMAP_TOTAL_CAP);
          }
          const totalDiscovered = Object.values(discovered).reduce((a, b) => a + b, 0);
          console.log(
            `[PESD-13] ${childSitemaps.length} child sitemap(s), ${totalDiscovered} <loc> discovered; crawling ${crawl.length} ` +
              `(page-sitemap up to ${SITEMAP_PAGE_CAP}, ${SITEMAP_SAMPLE_PER_CHILD}/other child, total cap ${SITEMAP_TOTAL_CAP}, pool ${SITEMAP_CONCURRENCY})`,
          );
          expect(crawl.length, 'the sitemap exposes page URLs to crawl').toBeGreaterThan(0);

          // 3. Crawl (GET, <= 4 in flight).
          let ok = 0;
          const redirected: string[] = [];
          const cloaks: string[] = [];
          const results = await runPool(crawl, (p) => getWithRetry(request, p.url), SITEMAP_CONCURRENCY);
          results.forEach((r, i) => {
            const { url, source } = crawl[i];
            const path = new URL(url).pathname;
            if (isSoftStatus(r) || detectWafChallenge(r.status, r.headers, r.body)) {
              soft.push(`${path} → HTTP ${r.status || 'no response'}${r.err ? ` (${r.err})` : ''}`);
              return;
            }
            if (r.loop) {
              hard.push(`${path} → redirect loop (${r.err}) [${source}]`);
              return;
            }
            if (r.offsite) {
              // A 3xx (< 400) to a host outside the guard: not requested, so its body is unknown; log it.
              const offsiteNote = `${path} → HTTP ${r.status} to ${new URL(r.finalUrl).origin} (off-site hop not followed: ${r.offsite})`;
              if (isRecommendsCloak(url)) {
                cloaks.push(offsiteNote);
                return;
              }
              ok += 1;
              redirected.push(offsiteNote);
              return;
            }
            if (r.status >= 400) {
              if (isRecommendsCloak(url)) cloaks.push(`${path} → HTTP ${r.status}`);
              else hard.push(`${path} → HTTP ${r.status} [${source}]`);
              return;
            }
            const problem = pageProblem(r.body);
            if (problem) {
              if (isRecommendsCloak(url)) cloaks.push(`${path} → ${problem}`);
              else hard.push(`${path} → ${problem} [${source}]`);
              return;
            }
            ok += 1;
            if (r.finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '')) redirected.push(`${path} → ${r.finalUrl}`);
          });

          const report = { origin, discovered, crawled: crawl.length, ok, hard, soft, cloaks, redirected, notes };
          await testInfo.attach('pesd-13-sitemap-crawl.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
          annotate(testInfo, 'crawl', `${crawl.length} crawled / ${ok} ok / ${hard.length} broken / ${soft.length} unverifiable / ${cloaks.length} /recommends/ non-200`);
          console.log(`[PESD-13] ok=${ok} broken=${hard.length} unverifiable=${soft.length} recommends-non200=${cloaks.length} redirected=${redirected.length}`);
          if (soft.length) console.log(`[PESD-13] unverifiable (WAF/throttle, not an outage):\n  - ${soft.slice(0, 40).join('\n  - ')}`);
          if (notes.length) console.log(`[PESD-13] notes:\n  - ${notes.slice(0, 20).join('\n  - ')}`);

          expect(hard, `Published sitemap URLs that are down (HTTP >= 400 other than WAF codes) or soft-404:\n${hard.join('\n')}`).toEqual([]);
          const softLimit = Math.max(5, Math.ceil(crawl.length * 0.2));
          if (soft.length > softLimit) {
            throw wafBlocked(`${soft.length}/${crawl.length} sitemap URLs were unverifiable (403/429/503/timeout) — more than ${softLimit}; the crawl cannot vouch for the site`);
          }
          expect(ok, 'at least one sitemap page was verified').toBeGreaterThan(0);
        },
      );
    });
  },
);

// ═════════════════════════ STAGING (wave 2: PESD-07, PESD-17) ═════════════════════════

test.describe(
  `Rock ${ROCK} — staging`,
  {
    tag: '@rock-pe-site-pricing-demo',
    annotation: [
      { type: 'rock', description: ROCK },
      { type: 'asana', description: ASANA_TASK },
    ],
  },
  () => {
    test.use({ baseURL: STAGING_ORIGIN, serviceWorkers: 'block', viewport: DESKTOP });

    test.beforeEach(async ({ page }) => {
      await installSafetyNet(page);
    });

    // Wave 2 lands here:
    //   PESD-07 — call assertNonProductionSiteEnv(page) BEFORE typing an email into the test-drive box.
    //   PESD-17 — fill step 1 with DEMO_TEST_DATA, click Continue ONCE, assert step 2 + gated required selects
    //             with readStepGate(form, '.wpforms-page-2', next); NEVER advance to the last page.
  },
);
