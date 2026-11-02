/**
 * LedgerPort backend — Admin discount creation, promo-code rules
 * POST /api/v1/admin/discounts   (INTERNAL auth)
 * (Asana: "QA: Admin discount creation — promo code rules")
 *
 * Rules under test:
 *   1. applyMode='auto' WITH promoCode  → HTTP 400 "Promo codes are only
 *      allowed on coupon-mode discounts" (was silently accepted before).
 *   2. applyMode='coupon' WITH promoCode → 201; the stored code is TRIMMED +
 *      UPPERCASED regardless of input casing (send "  save10  " → stored SAVE10).
 *   3. applyMode='auto' WITHOUT promoCode → 201 (unchanged).
 *   (The checkout-side rule — entering an auto discount's code → not_found while
 *    it still auto-applies once — needs the coupon-validate + checkout flow; it's
 *    covered separately and noted in the report, not here.)
 *
 * ⚠️ INTERNAL endpoint: this needs an internal service token, NOT the user JWT.
 * Provide it via env; the header name/scheme is configurable because it isn't a
 * standard Bearer:
 *   ADMIN_INTERNAL_TOKEN   the internal token (required — self-skips without it)
 *   ADMIN_AUTH_HEADER      header name (default "Authorization")
 *   ADMIN_AUTH_PREFIX      value prefix (default "Bearer ")
 * Internal endpoints may also be network-restricted — if so this must run from
 * an allowed context, not a QA browser session.
 *
 * This CREATES discount rows on the target env — names are QA-prefixed + unique,
 * every row is created with startsAt in the far future (so an applyMode='auto' row can
 * never auto-apply to a real staging checkout), and afterEach DELETEs each created row
 * (DELETE /admin/discounts/:id → 204) and FAILS the test if the cleanup is refused.
 * STAGING ONLY — production is read-only, so the describe skips there.
 *
 * Payload field names (discountType 'percent'|'flat', discountValue) follow the backend's
 * createDiscountSchema (apps/account-service/validators/discount.validators.ts — code
 * corroboration only, local snapshot); the earlier type/value keys were rejected by Joi
 * as unknown, so DISC-2/3 could never reach 201 and DISC-1 400'd for the wrong reason.
 *
 * Run:  LP_ENV=staging ADMIN_INTERNAL_TOKEN=… \
 *         npx playwright test admin-discounts-api --project=authenticated-staging
 */
import { test, expect } from '@playwright/test';
import { ACTIVE } from '../../config/env';

const ENDPOINT = `${ACTIVE.apiBaseURL}/admin/discounts`;
const TOKEN = process.env.ADMIN_INTERNAL_TOKEN || '';
const HEADER = process.env.ADMIN_AUTH_HEADER || 'Authorization';
const PREFIX = process.env.ADMIN_AUTH_PREFIX ?? 'Bearer ';

const runId = `${Date.now().toString(36)}`; // unique per run for QA-prefixed names
const adminHeaders = () => ({ 'Content-Type': 'application/json', [HEADER]: `${PREFIX}${TOKEN}` });
const FAR_FUTURE = '2099-01-01T00:00:00.000Z'; // never active → an auto discount can't touch real checkouts
const discount = (over: Record<string, unknown>) => ({
  name: `QA-TEST ${runId}`,
  discountType: 'percent',
  discountValue: 10,
  startsAt: FAR_FUTURE,
  ...over,
});

/** Ids of rows this test created — deleted in afterEach. */
const created: string[] = [];
async function track(r: { status(): number; json(): Promise<any> }): Promise<any> {
  const j = await r.json().catch(() => ({}));
  const id = j?.discount?.id ?? j?.data?.id ?? j?.id;
  if (r.status() === 201 || r.status() === 200) {
    expect(id, `created discount has an id (needed for cleanup) · ${JSON.stringify(j)}`).toBeTruthy();
  }
  if (id != null) created.push(String(id));
  return j;
}

test.describe('Admin discount creation — promo-code rules @admin-discounts', () => {
  test.skip(ACTIVE.name === 'production', 'Production is read-only: these cases CREATE discount rows. Staging only (LP_ENV=staging).');
  test.skip(!TOKEN, 'Set ADMIN_INTERNAL_TOKEN (internal service token) to run these.');

  test.afterEach(async ({ page }) => {
    while (created.length) {
      const id = created.pop()!;
      const d = await page.request.delete(`${ENDPOINT}/${id}`, { headers: adminHeaders(), failOnStatusCode: false });
      expect([200, 204], `cleanup: DELETE admin/discounts/${id} (row "QA-TEST ${runId}" is left behind otherwise)`).toContain(d.status());
    }
  });

  test('LP-ADM-DISC-1 | applyMode=auto + promoCode → 400', async ({ page }) => {
    const r = await page.request.post(ENDPOINT, {
      headers: adminHeaders(),
      data: discount({ applyMode: 'auto', promoCode: `AUTO${runId}` }),
      failOnStatusCode: false,
    });
    expect(r.status(), 'route exists (live probe 2026-07-13 returned 403, not 404) — a 404 is a regression').not.toBe(404);
    const j = await track(r); // a wrongly-accepted row is still cleaned up
    if (r.status() === 401 || r.status() === 403) test.skip(true, `Internal auth rejected (${r.status()}) — check ADMIN_INTERNAL_TOKEN/header.`);
    expect(r.status(), 'auto + promoCode must be rejected').toBe(400);
    expect(JSON.stringify(j), 'error message').toMatch(/only allowed on coupon-mode/i);
  });

  test('LP-ADM-DISC-2 | applyMode=coupon + "  save10  " → 201, stored TRIMMED UPPERCASE', async ({ page }) => {
    const r = await page.request.post(ENDPOINT, {
      headers: adminHeaders(),
      data: discount({ applyMode: 'coupon', promoCode: `  save10-${runId}  ` }),
      failOnStatusCode: false,
    });
    expect(r.status(), 'route exists (live probe 2026-07-13 returned 403, not 404) — a 404 is a regression').not.toBe(404);
    const j = await track(r);
    if (r.status() === 401 || r.status() === 403) test.skip(true, `Internal auth rejected (${r.status()}).`);
    expect(r.status(), JSON.stringify(j)).toBe(201);
    // stored code must be trimmed + uppercased (no leading/trailing space, all caps)
    const stored = j.promoCode ?? j.discount?.promoCode ?? j.data?.promoCode;
    expect(stored, `stored promoCode · ${JSON.stringify(j)}`).toBe(`SAVE10-${runId}`.toUpperCase());
    expect(stored).toBe(stored?.trim());
  });

  test('LP-ADM-DISC-3 | applyMode=auto without promoCode → 201', async ({ page }) => {
    const r = await page.request.post(ENDPOINT, {
      headers: adminHeaders(),
      data: discount({ applyMode: 'auto' }),
      failOnStatusCode: false,
    });
    expect(r.status(), 'route exists (live probe 2026-07-13 returned 403, not 404) — a 404 is a regression').not.toBe(404);
    const j = await track(r);
    if (r.status() === 401 || r.status() === 403) test.skip(true, `Internal auth rejected (${r.status()}).`);
    expect(r.status(), JSON.stringify(j)).toBe(201);
    const stored = j.discount ?? j.data ?? j;
    expect(stored.applyMode, 'stored as an auto discount').toBe('auto');
    expect(stored.promoCode ?? null, 'auto discount has no promo code').toBeNull();
  });
});
