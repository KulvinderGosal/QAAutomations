/**
 * Rock lp-pr237-silver — omnysync-backend PR #237 "Silver Listing" (QuickBooks
 * App Store technical + security compliance). Asana parent 1218179181761237
 * (15 SL-* subtasks) plus the 22-item compliance review (SLR-P/D/S/W/B/L).
 *
 * PUBLIC half: everything that needs NO saved session. It runs today even while
 * .auth/staging.json is expired. The JWT halves live in
 * tests/rocks/authenticated/lp-pr237-silver.spec.ts (same case keys).
 *
 * Path: tests/rocks/public/ so the `public-<env>` project (testMatch
 * /public\/.*\.spec\.ts/, Desktop Chrome, no storageState) picks it up.
 *
 * Wave 1 cases here:
 *   SL-S3-05  exchange-code redeem negatives (malformed / unknown 64-hex) never return tokens
 *   SL-S4-01  removed unauthenticated connection lookups 404 (anonymous half)
 *   SLR-D2    /quickbooks-disconnected spells out QuickBooks (no "QB" / "qb Online")
 *   SLR-D4    /quickbooks-disconnected without realmId: "ended" copy + 3 reconnect steps, no "couldn't verify"
 *   SLR-D5    Intuit trademark notice on the public layout (/login, /quickbooks-disconnected)
 * Later waves append SL-S1-01 (no-store headers), SL-S2-01 (no-echo), SL-S3-04
 * (login-initiate half) using the helpers at the top of this file.
 *
 * Known behaviour (dossier, do NOT report): removed lookup routes 404 through
 * the global not-found handler; the Cloudflare WAF on api-staging can block
 * payloads at the edge (reported as BLOCKED ENV/waf, never evaded).
 *
 * SAFETY: staging only. Read-only GETs plus a POST to the public redeem
 * endpoint with codes that cannot exist. No login, no form submit.
 *
 * Run (Validate stage only):
 *   LP_ENV=staging caffeinate -i npx playwright test tests/rocks/public/lp-pr237-silver.spec.ts \
 *     --project=public-staging --no-deps --reporter=list --retries=0 --workers=1 --trace=off
 */
import crypto from 'crypto';
import { test, expect } from '../../../fixtures/qa-api';
import type { Page, TestInfo } from '@playwright/test';
import { ACTIVE } from '../../../config/env';
import { BlockedError } from '../../../../packages/qa-core/errors';
import { detectWafChallenge, type ApiResponseLike } from '../../../../packages/qa-core/api/base';
import type { LpApi } from '../../../../packages/qa-core/api/lpApi';

// ------------------------------------ constants ------------------------------------

const PERSONA = `ledgerport-saas-automation:${ACTIVE.name}`;
const PARENT_ASANA = '1218179181761237';
const ASANA: Record<string, string> = {
  'SL-S3-05': '1218179418908090',
  'SL-S4-01': '1218178903259101',
  'SLR-D2': PARENT_ASANA,
  'SLR-D4': PARENT_ASANA,
  'SLR-D5': PARENT_ASANA,
};
const ISSUES: Record<string, string[]> = {
  'SLR-D2': ['awesomemotive/pushengage-ledgerport#307', 'awesomemotive/pushengage-ledgerport#309'],
  'SLR-D4': ['awesomemotive/pushengage-ledgerport#307'],
  'SLR-D5': ['awesomemotive/pushengage-ledgerport#309'],
};

/** Exact Intuit trademark notice (Marketing reqs; review item D5). */
const TRADEMARK_NOTICE = 'Intuit and QuickBooks are registered trademarks of Intuit Inc. Used with permission.';
/** Standalone "QB"/"qb" abbreviation (also catches "qb Online"). "QuickBooks"/"QBO" do not match. */
const QB_ABBREV = /\bqb\b/i;
/** Fields the removed lookups used to leak. */
const COMPANY_FIELDS = /companyId|companyName|companyEmail/;
const TOKEN_FIELDS = /accessToken|refreshToken|access_token|refresh_token/;

/** Real staging fixtures for the anonymous S4-01 half (account 202 / business 210, QA store). */
const STAGING_SHOP = 'ledgerport-staging-qa.myshopify.com';
const STAGING_BUSINESS_ID = '210';

// ------------------------------------ helpers ------------------------------------

/** Tags + annotations for one case key (asana gid, filed issues). */
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

interface Raw {
  status: number;
  headers: Record<string, string>;
  text: string;
  json: any;
  url: string;
  waf: boolean;
}

/** Reads a raw lpApi response. A Cloudflare block throws BLOCKED{ENV/waf} unless `allowWaf`. */
async function readRaw(res: ApiResponseLike, what: string, o: { allowWaf?: boolean } = {}): Promise<Raw> {
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
  return { status, headers, text, json, url: res.url(), waf };
}

/** Throws BLOCKED{ENV/waf} when the page is a Cloudflare challenge instead of the app. */
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
}

/** Opens the public Disconnect URL page with NO realmId and waits for its settled (non-loading) state. */
async function openDisconnectedPage(page: Page): Promise<void> {
  await page.goto('/quickbooks-disconnected', { waitUntil: 'domcontentloaded' });
  await assertAppReachable(page);
  expect(new URL(page.url()).pathname, 'stays on the public Disconnect URL page').toBe('/quickbooks-disconnected');
  await expect(page.getByRole('heading', { name: /disconnected/i }).first(), 'Disconnect page heading renders').toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Processing disconnection/i), 'page left its loading state').toHaveCount(0);
}

async function openLoginPage(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await assertAppReachable(page);
  await expect(page.locator('#email'), 'login form renders').toBeVisible({ timeout: 20_000 });
}

/** Every user-facing string on the page: visible text, img alt, placeholders, aria-labels, titles. */
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
    out.push({ where: 'document.title', value: document.title });
    return out;
  });
  return [{ where: 'innerText', value: text }, ...attrs];
}

function qbAbbreviations(strings: { where: string; value: string }[]): string[] {
  return strings
    .filter((s) => QB_ABBREV.test(s.value))
    .map((s) => {
      const m = s.value.match(/.{0,30}\bqb\b.{0,30}/i);
      return `${s.where}: "${m ? m[0] : s.value.slice(0, 60)}"`;
    });
}

/** Anonymous GET helper for the removed-lookup oracle. */
async function anonGet(lpApi: LpApi, path: string): Promise<Raw> {
  return readRaw(await lpApi.get(path, { anonymous: true }), `GET ${path} (anonymous)`);
}

function errorCode(body: any): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  if (typeof body.error === 'object' && body.error) return body.error.code;
  return body.code ?? (typeof body.error === 'string' ? body.error : undefined);
}

// ------------------------------------- tests -------------------------------------

test.describe('lp-pr237-silver — PR #237 Silver Listing (public, no session) @rock-lp-pr237-silver', () => {
  test.beforeEach(async () => {
    test.skip(
      ACTIVE.name !== 'staging',
      'Rock lp-pr237-silver targets staging (app-staging / api-staging). Production is read-only and these routes are not on its allow-list.',
    );
  });

  test(
    'SL-S3-05 — exchange-code redeem: malformed → 400 "code must be 64 characters", unknown 64-hex → 401 "Invalid or expired exchange code", never a token pair',
    caseMeta('SL-S3-05'),
    async ({ lpApi }, testInfo) => {
      // Baseline 1: malformed code.
      const malformed = await readRaw(
        await lpApi.post('auth/exchange-code/redeem', { code: 'not-a-valid-code' }, { anonymous: true }),
        'POST auth/exchange-code/redeem (malformed)',
      );
      note(testInfo, 'redeem-malformed', `HTTP ${malformed.status}`);
      expect(malformed.status, 'malformed code is a validation error').toBe(400);
      expect(malformed.json, 'malformed-code response is JSON').not.toBeNull();
      // Shipped (Joi) copy, live 2026-10-21: '"code" length must be 64 characters long' under
      // error.code VALIDATION_ERROR. The dossier's 'code must be 64 characters' is a paraphrase.
      expect(errorCode(malformed.json), 'malformed code → VALIDATION_ERROR').toBe('VALIDATION_ERROR');
      expect(malformed.text, 'validation message names the 64-character rule').toMatch(
        /\\?"?code\\?"?\s+(length\s+)?must be 64 characters/,
      );
      expect(malformed.text, 'no token pair in the malformed-code response').not.toMatch(TOKEN_FIELDS);

      // Baseline 2: well-formed but unknown 64-hex code (random, so it can never have been issued).
      const unknownCode = crypto.randomBytes(32).toString('hex');
      expect(unknownCode).toMatch(/^[0-9a-f]{64}$/);
      const unknown = await readRaw(
        await lpApi.post('auth/exchange-code/redeem', { code: unknownCode }, { anonymous: true }),
        'POST auth/exchange-code/redeem (unknown 64-hex)',
      );
      note(testInfo, 'redeem-unknown', `HTTP ${unknown.status}`);
      expect(unknown.status, 'an unknown code is rejected as invalid/expired').toBe(401);
      expect(unknown.json, 'unknown-code response is JSON').not.toBeNull();
      expect(unknown.text, 'rejection message').toContain('Invalid or expired exchange code');
      expect(unknown.text, 'no token pair in the unknown-code response').not.toMatch(TOKEN_FIELDS);
      note(
        testInfo,
        'scope',
        'Steps 1-3 (live Shopify-login chain + single-use re-redeem) are a login flow: ledgerport-shopify rock behind QA_ALLOW_LOGIN_SPECS. Stripe-return variant excluded (no purchases).',
      );
    },
  );

  test(
    'SL-S4-01 — removed unauthenticated connection lookups return 404 via the global not-found handler, no company fields (anonymous half)',
    caseMeta('SL-S4-01'),
    async ({ lpApi }, testInfo) => {
      // Oracle: a route that was never mounted. The removed lookups must answer exactly like it.
      const control = await anonGet(lpApi, `__qa-pr237-no-such-route-${crypto.randomBytes(4).toString('hex')}`);
      if (control.status !== 404 || !control.json) {
        throw new BlockedError({
          cls: 'ORACLE',
          code: 'no-404-baseline',
          persona: PERSONA,
          reason: `the never-mounted control route answered HTTP ${control.status} (json=${!!control.json}), so "route removed" cannot be told apart`,
          humanAction: 'Check the api-staging global not-found handler (expected a JSON 404) and re-run.',
        });
      }
      const controlKeys = Object.keys(control.json).sort();
      const controlCode = errorCode(control.json);
      note(testInfo, 'not-found-shape', `keys=[${controlKeys.join(',')}] code=${controlCode ?? '(none)'}`);

      const removed = [
        `connections/shop/${STAGING_SHOP}`,
        `connections/exists/${STAGING_BUSINESS_ID}`,
        `connections/business/${STAGING_BUSINESS_ID}/platform/shopify`,
      ];
      for (const path of removed) {
        const r = await anonGet(lpApi, path);
        note(testInfo, `GET ${path}`, `HTTP ${r.status}`);
        expect(r.status, `${path}: removed lookup returns 404 without auth`).toBe(404);
        expect(r.json, `${path}: 404 body is JSON`).not.toBeNull();
        expect(Object.keys(r.json).sort(), `${path}: same body shape as the global not-found handler`).toEqual(controlKeys);
        expect(errorCode(r.json), `${path}: same error code as an unmounted route`).toBe(controlCode);
        expect(r.text, `${path}: no company fields leak`).not.toMatch(COMPANY_FIELDS);
      }
      note(testInfo, 'scope', 'JWT half + business-scoped regressions: tests/rocks/authenticated/lp-pr237-silver.spec.ts');
    },
  );

  test(
    'SLR-D2 — /quickbooks-disconnected spells out QuickBooks: no "QB" / "qb Online" in text, img alt, placeholders or labels (public half)',
    caseMeta('SLR-D2'),
    async ({ page }, testInfo) => {
      await openDisconnectedPage(page);
      const strings = await userFacingStrings(page);
      expect(strings[0].value.length, 'page text was read').toBeGreaterThan(50);
      const hits = qbAbbreviations(strings);
      if (hits.length) note(testInfo, 'qb-abbreviations', hits.join(' | '));
      // Expected-fail ONLY while the exact #307 signature ("qb Online") is observed. Any other failure
      // (a new lone "QB", a missing header, a page change) is a real FAIL, and a fix turns this green.
      test.fail(
        hits.some((h) => /qb\s*online/i.test(h)),
        'awesomemotive/pushengage-ledgerport#307: known bug ("qb Online" header text + img alt on /quickbooks-disconnected; open 2026-10-21)',
      );
      expect(hits, 'no QB/qb abbreviation on /quickbooks-disconnected (header must read "QuickBooks Online")').toEqual([]);
      await expect(page.getByText('QuickBooks Online', { exact: true }).first(), 'header names "QuickBooks Online"').toBeVisible();
    },
  );

  test(
    'SLR-D4 — /quickbooks-disconnected without realmId: says the connection ended, lists the 3 reconnect steps, no "couldn\'t verify"',
    caseMeta('SLR-D4'),
    async ({ page }) => {
      await openDisconnectedPage(page);
      // Expected-fail ONLY while the exact #307 signature is on screen. A wrong heading / missing step
      // with the "couldn't verify" copy gone is a real FAIL (not masked as the known bug).
      const couldntVerify = await page.getByText(/couldn.t verify the disconnection/i).filter({ visible: true }).count();
      test.fail(couldntVerify > 0, 'awesomemotive/pushengage-ledgerport#307: known bug ("couldn\'t verify the disconnection" shown without a realmId; open 2026-10-21)');

      await expect(
        page.getByRole('heading', { name: /QuickBooks has been disconnected from LedgerPort|connection (has )?ended/i }).first(),
        'states that the QuickBooks connection has ended',
      ).toBeVisible();
      await expect(
        page.getByText(/couldn.t verify the disconnection/i),
        'no "We couldn\'t verify the disconnection on our end" without a realmId',
      ).toHaveCount(0);

      // Each step separately. "Sign in to reconnect" (the existing button) does NOT satisfy step 1.
      await expect(page.getByText(/Sign in to LedgerPort/i).first(), 'step 1: Sign in to LedgerPort').toBeVisible();
      await expect(page.getByText(/Open Connections/i).first(), 'step 2: Open Connections').toBeVisible();
      await expect(
        page.getByText(/Click Connect to QuickBooks and choose your company/i).first(),
        'step 3: Click Connect to QuickBooks and choose your company',
      ).toBeVisible();
    },
  );

  test(
    'SLR-D5 — Intuit trademark notice on the public layout (/login, /quickbooks-disconnected) (public half)',
    caseMeta('SLR-D5'),
    async ({ page }) => {
      const pages: { path: string; open: (p: Page) => Promise<void> }[] = [
        { path: '/login', open: openLoginPage },
        { path: '/quickbooks-disconnected', open: openDisconnectedPage },
      ];
      for (const { path, open } of pages) {
        await open(page);
        const notice = page.getByText(TRADEMARK_NOTICE, { exact: true });
        // Expected-fail ONLY while the #309 signature (notice entirely absent) is observed. A duplicated
        // or hidden notice is a real FAIL; a fix turns this green.
        if ((await notice.count()) === 0) {
          test.fail(true, 'awesomemotive/pushengage-ledgerport#309: known bug (no Intuit trademark notice on the public layout; open 2026-10-21)');
        }
        await expect(notice, `${path}: exactly one trademark notice`).toHaveCount(1);
        await expect(notice, `${path}: trademark notice is visible`).toBeVisible();
      }
    },
  );
});
