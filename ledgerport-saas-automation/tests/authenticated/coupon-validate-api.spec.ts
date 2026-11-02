/**
 * LedgerPort backend — Authenticated coupon validation endpoint
 * POST /api/v1/account/coupons/validate
 * (Asana: "QA: Authenticated coupon validation endpoint (LedgerPort backend)")
 *
 * Full acceptance matrix from the task:
 *   Rejections (HTTP 200, { valid:false, reason }):
 *     - maxPerAccount=1 already redeemed by THIS account → account_limit_reached
 *     - requiresAgency=true on a non-agency account       → agency_required
 *     - minOrderLimit=100 with <100 synced orders/month   → order_volume_ineligible
 *     - globally exhausted (redemptions ≥ maxRedemptions) → limit_reached
 *   Per-account isolation: the account-limited coupon from a DIFFERENT account → valid:true
 *   Valid unrestricted coupon → { valid:true } + discount details
 *   Auth failures (HTTP 401): missing / malformed / tampered token
 *
 * WHY page.request (not a plain APIRequestContext): the API sits behind
 * Cloudflare. Calls made from the authenticated browser context carry its
 * Cloudflare-clearance cookie, so they pass where a raw request would be
 * challenged. The Bearer token is read live from the app's localStorage.
 *
 * FIXTURES — set these before running (staging test coupons + a 2nd account):
 *   CPN_VALID           unrestricted valid coupon        (default STRIPE50)
 *   CPN_ACCOUNT_LIMIT   maxPerAccount=1, already redeemed by the auth account
 *   CPN_AGENCY          requiresAgency=true
 *   CPN_ORDER_VOLUME    minOrderLimit=100
 *   CPN_EXHAUSTED       globally exhausted
 *   SECOND_ACCOUNT_TOKEN  a JWT for a DIFFERENT account (per-account isolation)
 * Cases with no fixture self-skip (they don't fail) so the suite is green on
 * whatever you've supplied. The endpoint shipped with the `task/unified-api`
 * backend deploy (live on staging since 2026-07-13) — a 404 now FAILS as a regression.
 *
 * Run:  LP_ENV=staging CPN_ACCOUNT_LIMIT=... CPN_AGENCY=... \
 *         npx playwright test coupon-validate-api --project=authenticated-staging
 */
import { test, expect, Page } from '@playwright/test';
import { ACTIVE } from '../../config/env';

const ENDPOINT = `${ACTIVE.apiBaseURL}/account/coupons/validate`;

const CPN = {
  valid: process.env.CPN_VALID || 'STRIPE50',
  accountLimit: process.env.CPN_ACCOUNT_LIMIT || '',
  agency: process.env.CPN_AGENCY || '',
  orderVolume: process.env.CPN_ORDER_VOLUME || '',
  exhausted: process.env.CPN_EXHAUSTED || '',
};
const SECOND_ACCOUNT_TOKEN = process.env.SECOND_ACCOUNT_TOKEN || '';

const jsonH = { 'Content-Type': 'application/json' };
const authH = (tok: string) => ({ ...jsonH, Authorization: `Bearer ${tok}` });
const body = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  platform: 'stripe',
  planCode: 'scale',
  ...extra,
});

/** Live access token from the authenticated app's localStorage. */
async function liveToken(page: Page): Promise<string> {
  await page.goto('/');
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('__LEDGERPORT_AUTH_STATE__') || '{}')?.state?.tokens?.accessToken || '';
    } catch {
      return '';
    }
  });
}

test.describe('Coupon validation endpoint — POST /account/coupons/validate @coupon-api', () => {
  // Production is read-only (GET/HEAD only): every case here POSTs to the coupon endpoint. Staging only.
  test.skip(ACTIVE.name === 'production', 'Production is read-only: these cases POST to /account/coupons/validate. Staging only (LP_ENV=staging).');
  // ── Auth failures (HTTP 401) — no valid session required ──────────────────
  test('LP-CPN-401-1 | missing token → 401', async ({ page }) => {
    const r = await page.request.post(ENDPOINT, { headers: jsonH, data: body(CPN.valid), failOnStatusCode: false });
    expect(r.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    expect(r.status(), 'missing token must be rejected 401').toBe(401);
  });

  test('LP-CPN-401-2 | malformed token → 401', async ({ page }) => {
    const r = await page.request.post(ENDPOINT, { headers: authH('not.a.real.jwt'), data: body(CPN.valid), failOnStatusCode: false });
    expect(r.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    expect(r.status()).toBe(401);
  });

  test('LP-CPN-401-3 | tampered token → 401', async ({ page }) => {
    const tok = await liveToken(page);
    test.skip(!tok, 'No session token in storageState — run `npm run auth:capture`.');
    // Control: the UNTAMPERED token must be accepted, otherwise a 401 below only proves the token
    // expired, not that the signature is checked (it passed vacuously on 2026-10-21 with an expired session).
    const control = await page.request.post(ENDPOINT, { headers: authH(tok), data: body(CPN.valid), failOnStatusCode: false });
    expect(control.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    if (control.status() === 401) test.skip(true, 'Session expired (the untampered token is 401 too) — run `npm run auth:capture`.');
    const tampered = `${tok.slice(0, -4)}AAAA`; // flip the signature tail
    const r = await page.request.post(ENDPOINT, { headers: authH(tampered), data: body(CPN.valid), failOnStatusCode: false });
    expect(r.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    expect(r.status()).toBe(401);
  });

  // ── Valid, unrestricted coupon → valid:true + discount ────────────────────
  test('LP-CPN-VALID | valid unrestricted coupon → valid:true + discount', async ({ page }) => {
    const tok = await liveToken(page);
    test.skip(!tok, 'No session token — run `npm run auth:capture`.');
    const r = await page.request.post(ENDPOINT, { headers: authH(tok), data: body(CPN.valid), failOnStatusCode: false });
    expect(r.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    if (r.status() === 401) test.skip(true, 'Session expired — run `npm run auth:capture`.');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.valid, JSON.stringify(j)).toBe(true);
    expect(JSON.stringify(j), 'expected discount details in the response').toMatch(/discount|percent|amount|off/i);
  });

  // ── Rejection reasons (HTTP 200, valid:false, reason) ─────────────────────
  const reasonCase = (id: string, label: string, code: string, reason: string) =>
    test(`${id} | ${label} → reason ${reason}`, async ({ page }) => {
      test.skip(!code, `No fixture coupon for "${reason}" — set the env var.`);
      const tok = await liveToken(page);
      test.skip(!tok, 'No session token — run `npm run auth:capture`.');
      const r = await page.request.post(ENDPOINT, { headers: authH(tok), data: body(code), failOnStatusCode: false });
      expect(r.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
      if (r.status() === 401) test.skip(true, 'Session expired — run `npm run auth:capture`.');
      expect(r.status(), 'a restricted coupon still returns HTTP 200').toBe(200);
      const j = await r.json();
      expect(j.valid, JSON.stringify(j)).toBe(false);
      expect(j.reason, JSON.stringify(j)).toBe(reason);
    });

  reasonCase('LP-CPN-R1', 'maxPerAccount=1 already redeemed by this account', CPN.accountLimit, 'account_limit_reached');
  reasonCase('LP-CPN-R3', 'requiresAgency on a non-agency account', CPN.agency, 'agency_required');
  reasonCase('LP-CPN-R4', 'minOrderLimit=100 with <100 synced orders this month', CPN.orderVolume, 'order_volume_ineligible');
  reasonCase('LP-CPN-R5', 'globally exhausted coupon', CPN.exhausted, 'limit_reached');

  // ── Per-account isolation: the account-limited coupon from a DIFFERENT account → valid:true ──
  test('LP-CPN-R2 | per-account isolation: different account → valid:true', async ({ page }) => {
    test.skip(!CPN.accountLimit || !SECOND_ACCOUNT_TOKEN, 'Needs CPN_ACCOUNT_LIMIT + SECOND_ACCOUNT_TOKEN.');
    const r = await page.request.post(ENDPOINT, { headers: authH(SECOND_ACCOUNT_TOKEN), data: body(CPN.accountLimit), failOnStatusCode: false });
    expect(r.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    if (r.status() === 401) test.skip(true, 'SECOND_ACCOUNT_TOKEN invalid/expired.');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.valid, `same coupon must be valid for a different account · ${JSON.stringify(j)}`).toBe(true);
  });
});
