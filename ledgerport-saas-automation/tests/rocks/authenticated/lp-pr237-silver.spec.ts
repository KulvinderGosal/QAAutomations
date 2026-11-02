/**
 * Rock lp-pr237-silver — omnysync-backend PR #237 "Silver Listing" (QuickBooks
 * App Store technical + security compliance). Asana parent 1218179181761237
 * (15 SL-* subtasks) plus the 22-item compliance review (SLR-P/D/S/W/B/L).
 *
 * AUTHENTICATED half: the JWT / signed-in parts. The anonymous halves (redeem
 * negatives, unauth 404s, the public Disconnect URL page and /login) live in
 * tests/rocks/public/lp-pr237-silver.spec.ts under the same case keys.
 *
 * Path: tests/rocks/authenticated/ so the `authenticated-<env>` project
 * (testMatch /authenticated\/.*\.spec\.ts/, Desktop Chrome, storageState
 * .auth/<env>.json, metadata.persona → lpApi) picks it up.
 *
 * Wave 1 cases here:
 *   SL-S3-01  QuickBooks initiate allow-list baseline (dashboard origin → Intuit) + JSON callback rejection
 *   SL-S3-02  Shopify-app origin is allow-listed; foreign / lookalike origins 400
 *   SL-S3-03  initiate refuses foreign, lookalike, userinfo, scheme-downgrade, non-http and relative redirects
 *   SL-S4-01  removed lookups 404 WITH a JWT; business-scoped routes still 200 (JWT half)
 *   SL-T4-01  accounting block exposes status + lastError; "Reauthorize QuickBooks" present IFF status === 'error'
 *   SLR-D1    Connect control is Intuit's C2QB button image (base + hover), not a text button
 *   SLR-D2    no "QB"/"qb Online" on /connections and the Shopify/WooCommerce sync-settings screens (signed-in half)
 *   SLR-D5    trademark notice in the signed-in dashboard layout (signed-in half)
 * Later waves append SL-S1-01 (/me + connections + overview no-store), SL-S3-04
 * (connect half) and SL-T2-01 (account 108 persona, plan-limit 403) using the
 * helpers at the top of this file.
 *
 * Fixtures are derived from the session's own data (GET businesses,
 * businesses/:id, businesses/:id/connections): nothing is hard-coded to
 * business 210. The saved session (.auth/staging.json, account 145) expired on
 * 2026-10-19, so today these report [BLOCKED:SESSION/...] until a human runs
 * `LP_ENV=staging npm run auth:capture`.
 *
 * Known behaviour (dossier, do NOT report):
 *   - initiate returns HTTP 200 JSON with an authorization URL (not a raw 302);
 *   - the QuickBooks callback with a bad state returns JSON 400 "Invalid or expired state token…";
 *   - Cloudflare blocks the literal `javascript:` payload at the edge → annotated BLOCKED ENV/waf,
 *     and the http/https-only gate is proven via the data:/ftp:/file: siblings (never encoded/evaded);
 *   - a pending store connection also gets an unrelated "incomplete setup" item (ignored);
 *   - reconnecting a business that already has a mapping is allowed at the plan limit.
 *
 * SAFETY (non-negotiable): staging only. The authorization URL is NEVER followed,
 * the Connect / Reconnect controls are NEVER clicked, nothing is disconnected or
 * deleted, no plan change. Switching business only changes the in-browser store of
 * this test's own context (the switcher does not call the API; .auth is untouched).
 *
 * Run (Validate stage only):
 *   LP_ENV=staging LP_STAGING_EMAIL= LP_STAGING_PASSWORD= LP_EMAIL= LP_PASSWORD= \
 *   caffeinate -i npx playwright test tests/rocks/authenticated/lp-pr237-silver.spec.ts \
 *     --project=authenticated-staging --no-deps --reporter=list --retries=0 --workers=1 --trace=off
 */
import crypto from 'crypto';
import { test, expect } from '../../../fixtures/qa-api';
import type { Page, TestInfo } from '@playwright/test';
import { ACTIVE } from '../../../config/env';
import { goto } from '../../helpers/app';
import { assertSessionUsable, captureCommand } from '../../helpers/session';
import { BlockedError, BlockedSessionError } from '../../../../packages/qa-core/errors';
import { ApiError, detectWafChallenge, type ApiResponseLike } from '../../../../packages/qa-core/api/base';
import type { LpApi } from '../../../../packages/qa-core/api/lpApi';

// ------------------------------------ constants ------------------------------------

const PERSONA = `ledgerport-saas-automation:${ACTIVE.name}`;
const APP_ORIGIN = new URL(ACTIVE.baseURL).origin;
const API_BASE = ACTIVE.apiBaseURL.replace(/\/+$/, '');
const SHOPIFY_APP_ORIGIN = 'https://staging-shopify-app.ledgerport.com';

const PARENT_ASANA = '1218179181761237';
const ASANA: Record<string, string> = {
  'SL-S3-01': '1218179046864377',
  'SL-S3-02': '1218179418957327',
  'SL-S3-03': '1218179046871801',
  'SL-S4-01': '1218178903259101',
  'SL-T4-01': '1218179183245063',
  'SLR-D1': PARENT_ASANA,
  'SLR-D2': PARENT_ASANA,
  'SLR-D5': PARENT_ASANA,
};
const ISSUES: Record<string, string[]> = {
  'SLR-D2': ['awesomemotive/pushengage-ledgerport#309'],
  'SLR-D5': ['awesomemotive/pushengage-ledgerport#309'],
};

const REDIRECT_REJECTED = 'redirectUrl is not an allowed redirect destination';
const PLAN_LIMIT = /Maximum accounting connections/i;
const REAUTH_TITLE = 'Reauthorize QuickBooks';
const REAUTH_DESCRIPTION = 'QuickBooks token refresh failed. Please reconnect.';
const TRADEMARK_NOTICE = 'Intuit and QuickBooks are registered trademarks of Intuit Inc. Used with permission.';
/** Standalone "QB"/"qb" abbreviation (also catches "qb Online"). "QuickBooks"/"QBO" do not match. */
const QB_ABBREV = /\bqb\b/i;
const COMPANY_FIELDS = /companyId|companyName|companyEmail/;
const TOKEN_FIELDS = /accessToken|refreshToken|access_token|refresh_token/;
/** Intuit's "Connect to QuickBooks" (C2QB) button art is 223×36 at native size. */
const C2QB_SIZE = { width: 223, height: 36 };

// ------------------------------------ types ------------------------------------

interface LpBusiness {
  id: string;
  name: string;
  isDefault?: boolean;
}
interface LpConnection {
  id: string;
  businessId?: string;
  connectionName?: string;
  status?: string;
  lastError?: string | null;
  ecommerce: { platform?: string; storeDomain?: string | null } | null;
  accounting: (Record<string, unknown> & { status?: string; lastError?: string | null; companyId?: string | null }) | null;
}
interface LpBusinessDetail extends LpBusiness {
  accounting: Array<{ id: string; status?: string; companyId?: string }>;
  connections: LpConnection[];
}
interface ActionRequired {
  id?: string;
  type?: string;
  priority?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  connectionId?: string;
}

// ------------------------------------ helpers ------------------------------------

function caseMeta(key: string) {
  return {
    tag: ['@silver-listing', `@case:${key}`],
    annotation: [
      { type: 'asana', description: ASANA[key] },
      ...(ISSUES[key] || []).map((description) => ({ type: 'issue', description })),
    ],
  };
}

function note(testInfo: TestInfo, type: string, description: string): void {
  testInfo.annotations.push({ type, description });
}

function errorCode(body: any): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  if (typeof body.error === 'object' && body.error) return body.error.code;
  return body.code ?? (typeof body.error === 'string' ? body.error : undefined);
}

const unwrap = <T>(body: any): T => (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;

interface Raw {
  status: number;
  headers: Record<string, string>;
  text: string;
  json: any;
  waf: boolean;
}

/**
 * Reads a raw lpApi response (status is asserted by the caller). A Cloudflare block
 * throws BLOCKED{ENV/waf} unless `allowWaf`; a 401 on an authed call throws BLOCKED{SESSION}.
 */
async function readRaw(res: ApiResponseLike, what: string, o: { allowWaf?: boolean; authed?: boolean } = {}): Promise<Raw> {
  const status = res.status();
  const headers = res.headers();
  const text = await res.text().catch(() => '');
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const waf = detectWafChallenge(status, headers, text) || (status === 403 && json === null && /cloudflare/i.test(text));
  if (waf && !o.allowWaf) {
    throw new BlockedError({
      cls: 'ENV',
      code: 'waf',
      persona: PERSONA,
      reason: `${what} was answered by a Cloudflare challenge/block (HTTP ${status}), not the LedgerPort API`,
      humanAction: 'Run from an allow-listed network or ask devs for a WAF skip rule on api-staging. Never bypass the challenge.',
    });
  }
  if (o.authed && status === 401) {
    throw new BlockedSessionError({
      code: 'rejected',
      persona: PERSONA,
      reason: `${what}: api-staging rejected the saved session (HTTP 401)`,
      humanAction: captureCommand(ACTIVE),
    });
  }
  return { status, headers, text, json, waf };
}

/** Throws BLOCKED when the page is a Cloudflare challenge or a bounce to /login. */
async function assertAppReachable(page: Page): Promise<void> {
  const title = await page.title().catch(() => '');
  const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 2000);
  if (/just a moment|attention required/i.test(title) || /verify you are human|checking your browser/i.test(body)) {
    throw new BlockedError({
      cls: 'ENV',
      code: 'waf',
      persona: PERSONA,
      reason: `Cloudflare challenge on ${new URL(page.url()).host} (title "${title}")`,
      humanAction: 'Load app-staging.ledgerport.com in a normal browser / from an allow-listed IP, then re-run. Never bypass the challenge.',
    });
  }
  if (/\/login/i.test(new URL(page.url()).pathname)) {
    throw new BlockedSessionError({
      code: 'login-redirect',
      persona: PERSONA,
      refreshable: false,
      reason: `LedgerPort ${ACTIVE.name} bounced to /login — the saved session was rejected`,
      humanAction: captureCommand(ACTIVE),
    });
  }
}

// ---- session data (token-free; derived from the session's own businesses) ----

async function listBusinesses(lpApi: LpApi): Promise<LpBusiness[]> {
  const data = unwrap<{ businesses?: LpBusiness[] }>(await lpApi.getJson('businesses'));
  const list = (data?.businesses || []).map((b) => ({ ...b, id: String(b.id) }));
  if (!list.length) {
    throw new BlockedError({
      cls: 'FIXTURE',
      code: 'no-business',
      persona: PERSONA,
      reason: 'the session account has no business',
      humanAction: 'Capture a staging session for an account that owns at least one business (LP_ENV=staging npm run auth:capture).',
    });
  }
  return list;
}

async function businessDetail(lpApi: LpApi, id: string): Promise<LpBusinessDetail> {
  const d = unwrap<LpBusinessDetail>(await lpApi.getJson(`businesses/${id}`));
  return { ...d, id: String(d.id ?? id), accounting: d.accounting || [], connections: d.connections || [] };
}

async function businessConnections(lpApi: LpApi, id: string): Promise<LpConnection[]> {
  const data = unwrap<{ connections?: LpConnection[] }>(await lpApi.getJson(`businesses/${id}/connections`));
  expect(Array.isArray(data?.connections), `GET businesses/${id}/connections returns a connection list`).toBe(true);
  return (data.connections || []).map((c) => ({ ...c, id: String(c.id) }));
}

const hasAccounting = (d: LpBusinessDetail) =>
  d.accounting.length > 0 || d.connections.some((c) => Boolean(c.accounting?.companyId));

let detailsCache: LpBusinessDetail[] | null = null;
/** Every session business with its accounting + connections (cached per worker; workers = 1). */
async function allBusinessDetails(lpApi: LpApi): Promise<LpBusinessDetail[]> {
  if (detailsCache) return detailsCache;
  const list = await listBusinesses(lpApi);
  const out: LpBusinessDetail[] = [];
  for (const b of list) out.push({ ...(await businessDetail(lpApi, b.id)), name: b.name });
  detailsCache = out;
  return out;
}

// ---- QuickBooks initiate gate ----

async function initiate(lpApi: LpApi, businessId: string, redirectUrl: string, o: { allowWaf?: boolean } = {}): Promise<Raw> {
  return readRaw(
    await lpApi.get('oauth/quickbooks/initiate', { params: { businessId, redirectUrl } }),
    `GET oauth/quickbooks/initiate (redirectUrl=${redirectUrl})`,
    { allowWaf: o.allowWaf, authed: true },
  );
}

function authorizationUrlOf(json: any): string | undefined {
  const d = unwrap<any>(json) || {};
  return d.authorizationUrl ?? d.authorization_url ?? json?.authorizationUrl ?? json?.authorization_url;
}

/** Control row: 200 JSON with an Intuit authorize URL whose redirect_uri is the api-staging callback. Never followed. */
function expectIntuitAuthorize(r: Raw, label: string): void {
  expect(r.status, `${label}: allow-listed redirect → 200`).toBe(200);
  const url = authorizationUrlOf(r.json);
  expect(url, `${label}: response carries an authorization URL`).toBeTruthy();
  const u = new URL(String(url));
  expect(u.host, `${label}: authorization URL is on Intuit`).toBe('appcenter.intuit.com');
  expect(u.pathname, `${label}: Intuit OAuth2 connect path`).toMatch(/^\/connect\/oauth2/);
  expect(u.searchParams.get('redirect_uri'), `${label}: redirect_uri is the api-staging QuickBooks callback`).toBe(
    `${API_BASE}/oauth/quickbooks/callback`,
  );
  expect(r.text, `${label}: no token in the initiate response`).not.toMatch(TOKEN_FIELDS);
}

/** Negative row: 400, no Intuit URL; `exact` also requires the allow-list message. */
function expectRejected(r: Raw, label: string, exact = true): void {
  expect(r.status, `${label}: refused with 400`).toBe(400);
  expect(r.text, `${label}: no Intuit authorization URL is issued`).not.toContain('appcenter.intuit.com');
  if (exact) expect(r.text, `${label}: allow-list message`).toContain(REDIRECT_REJECTED);
}

let initiateBusiness: LpBusinessDetail | null = null;
/**
 * A session business where the control initiate returns 200. Businesses that already
 * have a QuickBooks mapping come first (reconnect is allowed at the plan limit), so
 * the SL-T2-01 plan-limit 403 cannot mask the allow-list result.
 */
async function pickInitiateBusiness(lpApi: LpApi, testInfo: TestInfo): Promise<LpBusinessDetail> {
  if (initiateBusiness) return initiateBusiness;
  const details = await allBusinessDetails(lpApi);
  const ordered = [...details.filter(hasAccounting), ...details.filter((d) => !hasAccounting(d))];
  const limited: string[] = [];
  for (const d of ordered) {
    const r = await initiate(lpApi, d.id, `${APP_ORIGIN}/connections`);
    if (r.status === 403 && PLAN_LIMIT.test(r.text)) {
      limited.push(d.id);
      continue;
    }
    initiateBusiness = d;
    note(testInfo, 'initiate-business', `business ${d.id} (has QuickBooks mapping: ${hasAccounting(d)})`);
    return d;
  }
  throw new BlockedError({
    cls: 'FIXTURE',
    code: 'plan-limit',
    persona: PERSONA,
    reason: `every session business hits the accounting plan limit on initiate (${limited.join(', ')}), which masks the redirect allow-list`,
    humanAction: 'Capture a staging session whose account has a business with a QuickBooks mapping or is under its accounting limit.',
  });
}

// ---- dashboard UI ----

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Select `target` through the header business switcher (Switch Business dialog), like a user would. */
async function selectBusiness(page: Page, target: LpBusiness, all: LpBusiness[]): Promise<void> {
  await goto(page, '/connections');
  await assertAppReachable(page);
  const names = new RegExp(`^\\s*(${all.map((b) => escapeRe(b.name)).join('|')})\\s*$`);
  const trigger = page.getByRole('combobox').filter({ hasText: names }).first();
  await expect(trigger, 'business switcher shows a session business').toBeVisible({ timeout: 20_000 });
  if (((await trigger.innerText()) || '').trim() === target.name) return;
  await trigger.click();
  await page.getByRole('menuitem', { name: /switch business/i }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: /switch business/i });
  await expect(dialog, 'Switch Business dialog').toBeVisible();
  await dialog.getByRole('button', { name: target.name, exact: true }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('combobox').filter({ hasText: target.name }).first(), `switched to "${target.name}"`).toBeVisible({
    timeout: 20_000,
  });
}

async function userFacingStrings(page: Page): Promise<{ where: string; value: string }[]> {
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  const attrs = await page.evaluate(() => {
    const out: { where: string; value: string }[] = [];
    const pick = (sel: string, attr: string) =>
      document.querySelectorAll(sel).forEach((el) => {
        const v = el.getAttribute(attr);
        if (v && v.trim()) out.push({ where: `${el.tagName.toLowerCase()}[${attr}]`, value: v.trim() });
      });
    pick('img[alt]', 'alt');
    pick('[placeholder]', 'placeholder');
    pick('[aria-label]', 'aria-label');
    pick('[title]', 'title');
    return out;
  });
  return [{ where: 'innerText', value: text }, ...attrs];
}

function qbAbbreviations(where: string, strings: { where: string; value: string }[]): string[] {
  return strings
    .filter((s) => QB_ABBREV.test(s.value))
    .map((s) => {
      const m = s.value.match(/.{0,30}\bqb\b.{0,30}/i);
      return `${where} ${s.where}: "${m ? m[0] : s.value.slice(0, 60)}"`;
    });
}

/** Opens a connection's sync-settings tab and waits for its config to load. */
async function openSettingsTab(page: Page, conn: LpConnection, platform: string, tab: { value: string; label: string }) {
  const configLoaded = page.waitForResponse((r) => r.url().includes(`/connections/${conn.id}/sync-config`), { timeout: 30_000 });
  await page.goto(`/connections/${conn.id}/settings?platform=${platform}&tab=${tab.value}`, { waitUntil: 'domcontentloaded' });
  await assertAppReachable(page);
  await configLoaded;
  await expect(page.getByRole('heading', { name: 'Sync Settings' }).first(), 'Sync Settings page renders').toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('tab', { name: tab.label, selected: true }), `${platform} "${tab.label}" tab is open`).toBeVisible();
}

// ------------------------------------- tests -------------------------------------

test.describe('lp-pr237-silver — PR #237 Silver Listing (signed-in) @rock-lp-pr237-silver', () => {
  test.beforeEach(async () => {
    test.skip(
      ACTIVE.name !== 'staging',
      'Rock lp-pr237-silver targets staging (app-staging / api-staging). Production is read-only and these routes are not on its allow-list.',
    );
    // Offline, token-free. Missing/expired → BLOCKED{SESSION}; lpApi re-checks the access token per call.
    assertSessionUsable(ACTIVE, { allowRefreshable: true, persona: PERSONA });
  });

  test(
    'SL-S3-01 — QuickBooks initiate from the dashboard origin reaches Intuit (200 + appcenter.intuit.com); bogus-state callback is JSON 400, not HTML',
    caseMeta('SL-S3-01'),
    async ({ lpApi }, testInfo) => {
      const biz = await pickInitiateBusiness(lpApi, testInfo);

      const control = await initiate(lpApi, biz.id, `${APP_ORIGIN}/connections`);
      expectIntuitAuthorize(control, 'dashboard origin /connections');

      // The callback Intuit redirects to, with a state that was never issued (anonymous: Intuit sends no JWT).
      const state = crypto.randomBytes(16).toString('hex');
      const cb = await readRaw(
        await lpApi.get('oauth/quickbooks/callback', {
          anonymous: true,
          params: { state, code: 'qa-pr237-bogus', realmId: '0' },
        }),
        'GET oauth/quickbooks/callback (bogus state)',
      );
      note(testInfo, 'callback-bogus-state', `HTTP ${cb.status} ${cb.headers['content-type'] || ''}`);
      expect(cb.status, 'bogus state is refused').toBe(400);
      expect(cb.headers['content-type'] || '', 'callback error is JSON, not an HTML page').toMatch(/application\/json/i);
      expect(cb.json, 'callback error body parses as JSON').not.toBeNull();
      expect(cb.text, 'callback error message').toContain('Invalid or expired state');
      expect(cb.text, 'no token in the callback error').not.toMatch(TOKEN_FIELDS);
      note(testInfo, 'scope', 'Steps 1-2 (click Connect QuickBooks → Intuit consent → back connected) need Intuit consent: manual.');
    },
  );

  test(
    'SL-S3-02 — Shopify-app origin is allow-listed (200 → Intuit); foreign and lookalike origins → 400 allow-list error',
    caseMeta('SL-S3-02'),
    async ({ lpApi }, testInfo) => {
      const biz = await pickInitiateBusiness(lpApi, testInfo);

      const embedded = await initiate(lpApi, biz.id, `${SHOPIFY_APP_ORIGIN}/connections`);
      expectIntuitAuthorize(embedded, 'Shopify-app origin /connections');

      for (const redirectUrl of ['https://evil-example.com/x', `${APP_ORIGIN}.evil.com/x`]) {
        expectRejected(await initiate(lpApi, biz.id, redirectUrl), redirectUrl);
      }
      note(testInfo, 'scope', 'The literal embedded click-through needs a destructive disconnect + Intuit consent: manual.');
    },
  );

  test(
    'SL-S3-03 — initiate refuses foreign, lookalike, userinfo, http-downgrade, non-http and relative redirects with 400; dashboard control → 200',
    caseMeta('SL-S3-03'),
    async ({ lpApi }, testInfo) => {
      const biz = await pickInitiateBusiness(lpApi, testInfo);
      const host = new URL(APP_ORIGIN).host;

      const exactRows = [
        'https://evil.example/callback',
        `https://${host}.attacker.example/`,
        `https://${host}@attacker.example/`,
        `http://${host}/`,
        '/connections',
      ];
      for (const redirectUrl of exactRows) {
        expectRejected(await initiate(lpApi, biz.id, redirectUrl), redirectUrl);
      }

      // javascript: — the WAF may block the literal payload at the edge. That is ENV, not product; never encode around it.
      const js = await initiate(lpApi, biz.id, 'javascript:alert(1)', { allowWaf: true });
      if (js.waf) {
        note(testInfo, 'BLOCKED ENV/waf', 'javascript:alert(1) blocked by Cloudflare at the edge; http/https-only gate proven via data:/ftp:/file: below');
      } else {
        expectRejected(js, 'javascript:alert(1)', false);
        note(testInfo, 'javascript:', `HTTP ${js.status}`);
      }

      // Non-http(s) siblings prove the http/https-only gate.
      for (const redirectUrl of ['data:text/plain,ledgerport-qa', `ftp://${host}/connections`, 'file:///connections']) {
        expectRejected(await initiate(lpApi, biz.id, redirectUrl), redirectUrl, false);
      }

      expectIntuitAuthorize(await initiate(lpApi, biz.id, `${APP_ORIGIN}/connections`), 'control: dashboard origin /connections');
    },
  );

  test(
    'SL-S4-01 — removed connection lookups 404 with a JWT too; businesses/:id/connections and connections/:id/sync-config still 200 (JWT half)',
    caseMeta('SL-S4-01'),
    async ({ lpApi }, testInfo) => {
      const details = await allBusinessDetails(lpApi);
      const withShop = details.find((d) => d.connections.some((c) => c.ecommerce?.platform?.toLowerCase() === 'shopify' && c.ecommerce.storeDomain));
      const biz = withShop || details[0];
      const conns = await businessConnections(lpApi, biz.id);
      const storefront = conns.find((c) => c.ecommerce);
      const shopConn = conns.find((c) => c.ecommerce?.platform?.toLowerCase() === 'shopify' && c.ecommerce.storeDomain);
      const shop = shopConn?.ecommerce?.storeDomain?.replace(/^https?:\/\//, '') || 'ledgerport-staging-qa.myshopify.com';
      if (!shopConn) {
        note(testInfo, 'FIXTURE', `no Shopify connection in the session; shop lookup checked with ${shop} (not owned by this account)`);
      }
      note(testInfo, 'fixtures', `business ${biz.id}, shop ${shop}, storefront connection ${storefront?.id ?? '(none)'}`);

      // Oracle with the same JWT: a never-mounted route.
      const control = await readRaw(
        await lpApi.get(`__qa-pr237-no-such-route-${crypto.randomBytes(4).toString('hex')}`),
        'GET <unmounted route> (JWT)',
        { authed: true },
      );
      if (control.status !== 404 || !control.json) {
        throw new BlockedError({
          cls: 'ORACLE',
          code: 'no-404-baseline',
          persona: PERSONA,
          reason: `the never-mounted control route answered HTTP ${control.status} with a JWT, so "route removed" cannot be told apart`,
          humanAction: 'Check the api-staging global not-found handler (expected a JSON 404) and re-run.',
        });
      }
      const controlKeys = Object.keys(control.json).sort();
      const controlCode = errorCode(control.json);

      for (const path of [
        `connections/shop/${shop}`,
        `connections/exists/${biz.id}`,
        `connections/business/${biz.id}/platform/shopify`,
      ]) {
        const r = await readRaw(await lpApi.get(path), `GET ${path} (JWT)`, { authed: true });
        note(testInfo, `GET ${path} (JWT)`, `HTTP ${r.status}`);
        expect(r.status, `${path}: removed lookup is 404 even with a JWT`).toBe(404);
        expect(r.json, `${path}: 404 body is JSON`).not.toBeNull();
        expect(Object.keys(r.json).sort(), `${path}: same shape as the global not-found handler`).toEqual(controlKeys);
        expect(errorCode(r.json), `${path}: same error code as an unmounted route (not a handler-level 404)`).toBe(controlCode);
        expect(r.text, `${path}: no company fields`).not.toMatch(COMPANY_FIELDS);
      }

      // Regressions: the business-scoped neighbours are still mounted.
      expect(Array.isArray(conns), 'businesses/:id/connections → 200 list').toBe(true);
      if (storefront) {
        const cfg = await lpApi.getJson(`connections/${storefront.id}/sync-config`);
        expect(cfg, `connections/${storefront.id}/sync-config → 200 with a body`).toBeTruthy();
      } else {
        note(testInfo, 'FIXTURE', 'sync-config neighbour route not exercised: no storefront connection in the session businesses');
      }
    },
  );

  test(
    'SL-T4-01 — accounting block exposes status + lastError; "Reauthorize QuickBooks" (critical, exact description, Reconnect) exists IFF status === "error"',
    caseMeta('SL-T4-01'),
    async ({ page, lpApi }, testInfo) => {
      const details = await allBusinessDetails(lpApi);
      const errorBusinesses: { biz: LpBusinessDetail; conns: LpConnection[] }[] = [];
      let checkedBlocks = 0;
      let firstWithBlock: LpBusinessDetail | null = null;

      for (const biz of details) {
        const conns = await businessConnections(lpApi, biz.id);
        const withAccounting = conns.filter((c) => c.accounting);
        if (!withAccounting.length) continue;
        firstWithBlock = firstWithBlock || biz;

        for (const c of withAccounting) {
          expect(Object.keys(c.accounting!), `business ${biz.id} connection ${c.id}: accounting.status present`).toContain('status');
          expect(Object.keys(c.accounting!), `business ${biz.id} connection ${c.id}: accounting.lastError present`).toContain('lastError');
          checkedBlocks++;
        }

        let overview: any;
        try {
          overview = unwrap<any>(await lpApi.getJson('analytics/overview', { params: { business_id: biz.id } }));
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            throw new BlockedError({
              cls: 'DEPLOY',
              code: 'no-overview',
              persona: PERSONA,
              reason: 'GET analytics/overview is not mounted on api-staging (404)',
              humanAction: 'Confirm the analytics-service overview endpoint is deployed to staging, then re-run.',
            });
          }
          throw e;
        }
        const actions: ActionRequired[] = overview?.actionsRequired;
        expect(Array.isArray(actions), `business ${biz.id}: analytics overview has an actionsRequired list`).toBe(true);

        const errored: LpConnection[] = [];
        for (const c of withAccounting) {
          const isError = c.accounting!.status === 'error';
          const item = actions.find(
            (a) =>
              a.connectionId != null &&
              String(a.connectionId) === c.id &&
              a.type === 'reauthorize_quickbooks' &&
              a.title === REAUTH_TITLE &&
              a.description === REAUTH_DESCRIPTION,
          );
          note(testInfo, `business ${biz.id} / connection ${c.id}`, `accounting.status=${c.accounting!.status} item=${item ? 'yes' : 'no'}`);
          expect(Boolean(item), `connection ${c.id}: "${REAUTH_TITLE}" item present IFF accounting.status === 'error'`).toBe(isError);
          if (isError) {
            expect(c.accounting!.lastError, `connection ${c.id}: lastError carries the refresh failure`).toBe(REAUTH_DESCRIPTION);
            expect(item!.priority, `connection ${c.id}: reauthorize item is critical`).toBe('critical');
            expect(item!.actionLabel, `connection ${c.id}: CTA is Reconnect`).toBe('Reconnect');
            errored.push(c);
          }
        }
        if (errored.length) errorBusinesses.push({ biz, conns: errored });
      }

      if (!checkedBlocks || !firstWithBlock) {
        throw new BlockedError({
          cls: 'FIXTURE',
          code: 'no-accounting',
          persona: PERSONA,
          reason: 'no session business has a store connection linked to QuickBooks (no accounting block to check)',
          humanAction: 'Capture a session for an account with a QuickBooks-linked store (account 139 business 143, or account 84 business 79).',
        });
      }
      if (!errorBusinesses.length) {
        note(
          testInfo,
          'positive-case',
          'no accounting.status === "error" in this session: only the "absent when healthy" direction was exercised (needs the account-139 / account-84 persona for the positive case)',
        );
      }

      // UI half: the business Overview / Resolution Center, like the manual test. Never click Reconnect.
      const uiBiz = errorBusinesses[0]?.biz || firstWithBlock;
      await selectBusiness(page, uiBiz, details);
      let overviewCalls = 0;
      page.on('response', (r) => {
        if (/\/analytics\/overview\b/.test(r.url())) overviewCalls++;
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await assertAppReachable(page);
      const resolutionCenter = page.getByText(/Resolution Center|Action Required/i).first();
      await resolutionCenter.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
      note(testInfo, 'overview-ui', `landed on ${new URL(page.url()).pathname}; analytics/overview calls=${overviewCalls}`);
      if (!(await resolutionCenter.isVisible()) && overviewCalls === 0) {
        throw new BlockedError({
          cls: 'DEPLOY',
          code: 'no-resolution-center',
          persona: PERSONA,
          reason: `the SaaS dashboard build on ${ACTIVE.name} renders no Overview / Resolution Center ('/' → ${new URL(page.url()).pathname}, no analytics/overview request); the API half above was asserted`,
          humanAction: 'Confirm with devs which surface hosts the SaaS Resolution Center (the WP plugin / Shopify app Overview render it), or deploy it to app-staging, then re-run.',
        });
      }
      const expectedErrors = errorBusinesses.find((e) => e.biz.id === uiBiz.id)?.conns.length ?? 0;
      const descriptions = page.getByText(REAUTH_DESCRIPTION, { exact: true });
      if (expectedErrors > 0) {
        await expect(page.getByText(REAUTH_TITLE, { exact: true }).first(), 'Resolution Center shows "Reauthorize QuickBooks"').toBeVisible();
        await expect(descriptions, 'one critical reauthorize item per errored connection').toHaveCount(expectedErrors);
        await expect(page.getByRole('button', { name: /^Reconnect$/ }).first(), 'Reconnect CTA is offered (not clicked)').toBeVisible();
      } else {
        await expect(descriptions, 'no token-refresh reauthorize item while every mapping is healthy').toHaveCount(0);
      }
    },
  );

  test(
    'SLR-D1 — on a business without QuickBooks, the Connect control is Intuit\'s C2QB button image (223×36, hover swaps the art), not a text button',
    caseMeta('SLR-D1'),
    async ({ page, lpApi }, testInfo) => {
      const details = await allBusinessDetails(lpApi);
      const target = details.find((d) => !hasAccounting(d));
      if (!target) {
        throw new BlockedError({
          cls: 'FIXTURE',
          code: 'all-connected',
          persona: PERSONA,
          reason: `every session business (${details.map((d) => d.id).join(', ')}) already has QuickBooks, so no Connect control is rendered`,
          humanAction: "Capture a session for an account with a business that has no QuickBooks mapping (e.g. account 108 'newtestbuss'), or add an empty business on staging.",
        });
      }
      note(testInfo, 'business', `${target.id} "${target.name}" (no accounting mapping)`);

      await selectBusiness(page, target, details);
      await goto(page, '/connections');
      await assertAppReachable(page);
      await expect(page.getByText('Choose your accounting system').first(), 'accounting selection card renders').toBeVisible({
        timeout: 20_000,
      });

      const control = page.getByRole('button', { name: /connect to quickbooks|continue with quickbooks|connect quickbooks/i }).first();
      await expect(control, 'a Connect-to-QuickBooks control is shown').toBeVisible();
      expect(((await control.innerText()) || '').trim(), 'the control is Intuit button art, not a text label').toBe('');
      const art = control.locator('img').filter({ visible: true });
      await expect(art, 'exactly one visible C2QB image in the control').toHaveCount(1);
      const box = await art.first().boundingBox();
      expect(box, 'C2QB image has a layout box').not.toBeNull();
      expect(Math.round(box!.width), 'C2QB image at native width').toBe(C2QB_SIZE.width);
      expect(Math.round(box!.height), 'C2QB image at native height').toBe(C2QB_SIZE.height);
      const baseSrc = await art.first().getAttribute('src');

      await control.hover(); // hover only — never click (would start the Intuit OAuth flow)
      await expect
        .poll(async () => control.locator('img').filter({ visible: true }).first().getAttribute('src'), {
          message: 'hover swaps to the C2QB hover art',
        })
        .not.toBe(baseSrc);
    },
  );

  test(
    'SLR-D2 — no "QB"/"qb Online" on /connections and the Shopify / WooCommerce sync-settings screens (labels, alt, placeholders) (signed-in half)',
    caseMeta('SLR-D2'),
    async ({ page, lpApi }, testInfo) => {
      const details = await allBusinessDetails(lpApi);
      const hits: string[] = [];
      let screens = 0;

      // /connections with the QuickBooks card (a business that has QuickBooks).
      const qbBiz = details.find(hasAccounting);
      if (qbBiz) {
        await selectBusiness(page, qbBiz, details);
        await goto(page, '/connections');
        await assertAppReachable(page);
        await expect(page.getByRole('heading', { name: /Storefront Connections/i }), '/connections renders').toBeVisible({ timeout: 20_000 });
        hits.push(...qbAbbreviations('/connections', await userFacingStrings(page)));
        screens++;
      } else {
        note(testInfo, 'FIXTURE', 'no business with QuickBooks: the /connections QuickBooks card was not scanned');
      }

      const plans: { platform: 'shopify' | 'woocommerce'; tabs: { value: string; label: string }[] }[] = [
        { platform: 'shopify', tabs: [{ value: 'customers', label: 'Customers' }, { value: 'accounting', label: 'Accounting' }] },
        {
          platform: 'woocommerce',
          tabs: [
            { value: 'customers', label: 'Customers' },
            { value: 'orders', label: 'Orders' },
            { value: 'products', label: 'Products' },
          ],
        },
      ];
      for (const plan of plans) {
        const owner = details.find((d) =>
          d.connections.some((c) => c.ecommerce?.platform?.toLowerCase() === plan.platform && c.status !== 'pending'),
        );
        const conn = owner?.connections.find((c) => c.ecommerce?.platform?.toLowerCase() === plan.platform && c.status !== 'pending');
        if (!owner || !conn) {
          note(testInfo, 'FIXTURE', `no ${plan.platform} connection in the session: its settings screens were not scanned`);
          continue;
        }
        await selectBusiness(page, owner, details);
        for (const tab of plan.tabs) {
          await openSettingsTab(page, conn, plan.platform, tab);
          hits.push(...qbAbbreviations(`${plan.platform}/${tab.value}`, await userFacingStrings(page)));
          screens++;
        }
      }

      if (!screens) {
        throw new BlockedError({
          cls: 'FIXTURE',
          code: 'no-screens',
          persona: PERSONA,
          reason: 'no QuickBooks-connected business and no Shopify/WooCommerce connection in the session: nothing to scan',
          humanAction: 'Capture a session for an account with a QuickBooks-connected Shopify or WooCommerce store.',
        });
      }
      note(testInfo, 'screens-scanned', String(screens));
      if (hits.length) note(testInfo, 'qb-abbreviations', hits.join(' | '));
      // Declared only after every screen was reached + scanned, and only while the exact #309 signature
      // ("qb Online") is observed: a new lone "QB" elsewhere is a real FAIL, a fix turns this green.
      test.fail(
        hits.some((h) => /qb\s*online/i.test(h)),
        'awesomemotive/pushengage-ledgerport#309: known bug ("qb Online" alt/title on the /connections QuickBooks card; in the deployed connections chunk 2026-10-21)',
      );
      expect(hits, 'QuickBooks is spelled out on every signed-in screen (no "QB"/"qb" in text, alt, placeholders, labels)').toEqual([]);
    },
  );

  test(
    'SLR-D5 — Intuit trademark notice in the signed-in dashboard layout (/connections, /audit-log) (signed-in half)',
    caseMeta('SLR-D5'),
    async ({ page }) => {
      for (const path of ['/connections', '/audit-log']) {
        await goto(page, path);
        await assertAppReachable(page);
        await expect(page.getByRole('heading', { level: 1 }).first(), `${path} renders`).toBeVisible({ timeout: 20_000 });
        const notice = page.getByText(TRADEMARK_NOTICE, { exact: true });
        // Declared only once the page rendered, and only while the #309 signature (notice absent) is
        // observed, so BLOCKED/login errors or a duplicated/hidden notice are never masked as the known bug.
        if ((await notice.count()) === 0) {
          test.fail(true, 'awesomemotive/pushengage-ledgerport#309: known bug (no Intuit trademark notice; no "registered trademarks" string in the deployed bundle 2026-10-21)');
        }
        await expect(notice, `${path}: exactly one trademark notice`).toHaveCount(1);
        await expect(notice, `${path}: trademark notice is visible`).toBeVisible();
      }
    },
  );
});
