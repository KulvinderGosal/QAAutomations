/**
 * LedgerPort backend — Coupon validation RATE LIMITS (separate buckets)
 * (Asana: "QA: Coupon validation rate limits — separate buckets per endpoint")
 *
 * Both endpoints are limited to 20 req/min per IP with SEPARATE buckets:
 *   public         POST /api/v1/coupons/validate
 *   authenticated  POST /api/v1/account/coupons/validate  (Bearer token)
 *
 * Matrix:
 *   1. Burst 21× the PUBLIC endpoint → 21st is HTTP 429 ("Too many coupon
 *      validation attempts").
 *   2. Immediately hit the AUTHENTICATED endpoint with a valid token → still
 *      200 (a public burst must not starve logged-in users → separate bucket).
 *   3. Burst 21× the AUTHENTICATED endpoint → its own 21st is 429; the public
 *      endpoint is unaffected.
 *   4. Both buckets reset after ~60s.
 *
 * SERIAL + slow on purpose: it deliberately trips 429s and waits ~60s for the
 * reset, so it's isolated from the other coupon specs (whose runs would
 * otherwise eat into these buckets). Run it ALONE.
 *
 * Requests go through the authenticated browser context (page.request) so they
 * carry the Cloudflare clearance cookie — a raw request is CF-challenged.
 * Both endpoints are deployed (live since 2026-07-13): a 404 FAILS as a regression.
 * Still self-skips when the session is expired.
 *
 * Run:  LP_ENV=staging npx playwright test coupon-ratelimit-api --project=authenticated-staging --workers=1
 */
import { test, expect, Page, APIResponse } from '@playwright/test';
import { ACTIVE } from '../../config/env';

test.describe.configure({ mode: 'serial' });

const PUBLIC_URL = `${ACTIVE.apiBaseURL}/coupons/validate`;
const AUTH_URL = `${ACTIVE.apiBaseURL}/account/coupons/validate`;
const COUPON = process.env.CPN_VALID || 'STRIPE50';
const LIMIT = Number(process.env.RATE_LIMIT || 20); // requests/min per bucket
const RESET_MS = Number(process.env.RATE_RESET_MS || 65_000);

const jsonH = { 'Content-Type': 'application/json' };
const authH = (tok: string) => ({ ...jsonH, Authorization: `Bearer ${tok}` });
const body = () => ({ code: COUPON, platform: 'stripe', planCode: 'scale' });

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

/** Fire n sequential requests; return the status codes in order. */
async function burst(page: Page, url: string, headers: Record<string, string>, n: number): Promise<number[]> {
  const codes: number[] = [];
  for (let i = 0; i < n; i++) {
    const r: APIResponse = await page.request.post(url, { headers, data: body(), failOnStatusCode: false });
    codes.push(r.status());
  }
  return codes;
}

test.describe('Coupon validation rate limits @coupon-ratelimit', () => {
  // Env precondition, not a product verdict: rate limiting is deployed but intentionally OFF on
  // staging (RATE_LIMIT_ENABLED=false; the Asana rate-limit task was closed no-defect 2026-07-16).
  // Live 2026-10-21: 21/21 public requests → 200. The bursts are POSTs, so production is excluded.
  test.skip(ACTIVE.name === 'production', 'Production is read-only: these specs burst POST requests. Staging only.');
  test.skip(
    process.env.LP_RATE_LIMIT_ENABLED !== '1',
    'BLOCKED ENV/rate-limit-disabled: rate limiting is intentionally OFF on staging (RATE_LIMIT_ENABLED=false, closed no-defect 2026-07-16). Set LP_RATE_LIMIT_ENABLED=1 when running against an env that enables it.',
  );

  test('LP-CPN-RL-1 | public endpoint 429s on the 21st, then authenticated still 200', async ({ page }) => {
    const tok = await liveToken(page);
    // Probe deploy first (single request): a 404 means the shipped route was removed.
    const probe = await page.request.post(PUBLIC_URL, { headers: jsonH, data: body(), failOnStatusCode: false });
    expect(probe.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);

    // 1. Burst the PUBLIC bucket. Expect the tail to include a 429.
    const publicCodes = await burst(page, PUBLIC_URL, jsonH, LIMIT + 1);
    expect(publicCodes.filter((c) => c === 429).length, `codes: ${publicCodes.join(',')}`).toBeGreaterThan(0);
    // The first request should NOT have been limited.
    expect(publicCodes[0]).not.toBe(429);

    // 2. Separate bucket: authenticated endpoint must still be 200 right after.
    test.skip(!tok, 'No session token — run `npm run auth:capture` (needed for the separate-bucket assertion).');
    const authRes = await page.request.post(AUTH_URL, { headers: authH(tok), data: body(), failOnStatusCode: false });
    expect(authRes.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    if (authRes.status() === 401) test.skip(true, 'Session expired — run `npm run auth:capture`.');
    expect(authRes.status(), 'a public burst must not starve the authenticated bucket').toBe(200);
  });

  test('LP-CPN-RL-2 | authenticated endpoint 429s on its own 21st; public unaffected after reset', async ({ page }) => {
    const tok = await liveToken(page);
    test.skip(!tok, 'No session token — run `npm run auth:capture`.');
    const probe = await page.request.post(AUTH_URL, { headers: authH(tok), data: body(), failOnStatusCode: false });
    expect(probe.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    if (probe.status() === 401) test.skip(true, 'Session expired — run `npm run auth:capture`.');

    // Let buckets reset from the previous test before measuring cleanly.
    await page.waitForTimeout(RESET_MS);

    // 3. Burst the AUTHENTICATED bucket → expect a 429 in the tail.
    const authCodes = await burst(page, AUTH_URL, authH(tok), LIMIT + 1);
    expect(authCodes.filter((c) => c === 429).length, `codes: ${authCodes.join(',')}`).toBeGreaterThan(0);

    // Public endpoint should be unaffected (separate bucket) — allow it a moment.
    const pub = await page.request.post(PUBLIC_URL, { headers: jsonH, data: body(), failOnStatusCode: false });
    expect([200, 429]).toContain(pub.status()); // 200 ideally; 429 only if the public bucket is independently full
    expect(pub.status(), 'public endpoint should not inherit the authenticated 429').not.toBe(429);
  });

  test('LP-CPN-RL-3 | buckets reset after ~60s', async ({ page }) => {
    // After the RESET window a fresh request must succeed again (not 429).
    await page.waitForTimeout(RESET_MS);
    const r = await page.request.post(PUBLIC_URL, { headers: jsonH, data: body(), failOnStatusCode: false });
    expect(r.status(), 'endpoint is deployed (live since 2026-07-13) — a 404 is a regression').not.toBe(404);
    expect(r.status(), 'bucket should have reset').not.toBe(429);
  });
});
