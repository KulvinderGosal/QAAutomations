/**
 * LedgerPort SaaS — Billing coupon code (Review & confirm step)
 * Target: /billing  →  "Change Plan"  →  pick a plan  →  "Review & confirm"
 *
 * The plan-change wizard's final "Review & confirm" step exposes a coupon field
 * ("ADD COUPON CODE" + Apply). This is the SECOND surface where the coupon logic
 * is deployed — the first being the marketing checkout
 * (staging.ledgerport.com/checkout, covered in the pushengage-ledgerport-site
 * suite). The two surfaces differ in one observed behaviour:
 *
 *   - Marketing checkout  → coupon matching is CASE-SENSITIVE (lowercase rejected) — a bug.
 *   - SaaS Review & confirm → coupon matching is CASE-INSENSITIVE (lowercase accepted) — correct.
 *
 * LP-BILL-CPN-004 pins that correct, case-insensitive behaviour so a regression
 * here would be caught.
 *
 * Coupon under test: STRIPE50 (50% off). It is a STAGING-ONLY test coupon, so the
 * discount/case tests self-skip on production (verified: prod rejects STRIPE50
 * with the same "that code isn't valid" path). Since 2026-10-21 the whole spec is
 * STAGING-ONLY: production is read-only and every test drives the plan-change wizard.
 *
 * NON-DESTRUCTIVE — this spec walks INTO the plan-change wizard and applies a
 * coupon, but NEVER clicks "Confirm & continue to payment": no plan change is
 * ever committed and no payment is initiated. Tagged @destructive purely because
 * it drives the plan-change wizard (consistent with billing.spec LP-BILL-004);
 * it is excluded from `test:safe`. It is NOT @smoke — it needs a fresh
 * interactive session and shouldn't run in the unattended every-3-day smoke.
 *
 * IDs: LP-BILL-CPN-001 → LP-BILL-CPN-0xx
 *
 * Auth: authenticated project, reuses .auth/<env>.json. The session lasts ~7
 * days; if it has expired the test self-skips with a clear "run auth:capture"
 * message instead of failing noisily.
 */
import { test, expect, Page, Locator } from '@playwright/test';
import { goto, ROUTES, overlay } from '../helpers/app';
import { ACTIVE } from '../../config/env';
import { assertSessionUsable, captureCommand } from '../helpers/session';

const COUPON = process.env.TEST_COUPON || 'STRIPE50';
const IS_STAGING = ACTIVE.name === 'staging';
const DISCOUNT = /50/.test(COUPON) ? 0.5 : null; // STRIPE50 => 50% off

// ---- locators (no data-testids in the app → role/placeholder/text anchors) ----

const changePlanButton = (page: Page) =>
  page.getByRole('button', { name: /change plan/i }).first();

/**
 * Plan action buttons on the plans view (NOT "Change Plan"/"Manage …"/"Current plan").
 * Includes "Get started" / "Choose plan" used by the 2026-09-22 3-card /billing/plans
 * redesign (same set as tests/rocks/authenticated/lp-issue19-defects.spec.ts).
 */
const planActionButtons = (page: Page) =>
  page.getByRole('button', { name: /^(upgrade|downgrade|select(\s+plan)?|choose|switch|get started)/i });

/** A contact-sales CTA (a tier with no self-serve checkout → no coupon field). */
const contactSalesButtons = (page: Page) =>
  page.getByRole('button', { name: /contact (sales|us)|talk to sales/i }).or(page.getByRole('link', { name: /contact (sales|us)|talk to sales/i }));

const couponInput = (page: Page) =>
  page
    .getByPlaceholder(/coupon/i)
    .or(page.getByRole('textbox', { name: /coupon/i }))
    .or(page.locator('input[name*="coupon" i]'))
    .first();

const couponReveal = (page: Page) =>
  page.getByText(/add coupon code|have a coupon|apply coupon|enter coupon/i).first();

const applyButton = (page: Page) => page.getByRole('button', { name: /^apply$/i }).first();
const removeControl = (page: Page) =>
  page.getByRole('button', { name: /^remove$/i }).and(page.locator(':visible')).first();

/** The coupon rejection error (same copy seen on staging + prod SaaS). */
const couponError = (page: Page) =>
  page.getByText(/isn.?t valid|not valid|invalid coupon|check it and try again/i).first();

/**
 * The "Confirm & continue to payment" button. Located ONLY so we can assert it
 * exists (we are truly on the review step) — it is NEVER clicked.
 */
const confirmPayButton = (page: Page) =>
  page.getByRole('button', { name: /confirm.*(payment|continue)|continue to payment/i }).first();

// ------------------------------------ helpers ------------------------------------

async function revealCoupon(page: Page): Promise<void> {
  if (!(await couponInput(page).isVisible())) {
    if (await couponReveal(page).isVisible()) await couponReveal(page).click();
  }
  await expect(couponInput(page), 'coupon input on Review & confirm').toBeVisible({ timeout: 8000 });
}

/**
 * From /billing, open "Change Plan" and click one enabled plan CTA (upgrade-first,
 * mirroring lp-issue19-defects) to land on "Review & confirm" with a coupon field.
 *
 * Every wizard step is an ASSERTION (selector drift on the redesigned billing UI
 * now FAILS instead of green-skipping all four tests). The only skip is a positive
 * precondition: the plans view offers nothing but contact-sales tiers.
 * "Confirm & continue to payment" is asserted, NEVER clicked.
 */
async function reachReviewWithCoupon(page: Page): Promise<void> {
  await expect(changePlanButton(page), '"Change Plan" on /billing').toBeVisible({ timeout: 10_000 });
  await changePlanButton(page).click();

  const anyCta = planActionButtons(page).first().or(contactSalesButtons(page).first());
  await expect(anyCta, 'plans view renders its plan CTAs').toBeVisible({ timeout: 20_000 });

  const all = planActionButtons(page);
  const n = await all.count();
  const ctas: { btn: Locator; rank: number }[] = [];
  for (let i = 0; i < n; i++) {
    const btn = all.nth(i);
    if (!(await btn.isVisible()) || !(await btn.isEnabled())) continue;
    const label = ((await btn.innerText()) || '').trim();
    ctas.push({ btn, rank: /^upgrade/i.test(label) ? 0 : /^downgrade/i.test(label) ? 2 : 1 });
  }
  if (!ctas.length && (await contactSalesButtons(page).count()) > 0) {
    test.skip(true, 'Plans view offers only contact-sales tiers on this account — no self-serve Review & confirm step.');
  }
  expect(ctas.length, 'at least one enabled self-serve plan CTA on the plans view').toBeGreaterThan(0);
  ctas.sort((x, y) => x.rank - y.rank);
  await ctas[0].btn.click();

  // We are on the review step (located only — NEVER clicked).
  await expect(confirmPayButton(page), '"Confirm & continue to payment" on Review & confirm').toBeVisible({ timeout: 20_000 });
  await revealCoupon(page);
}

/**
 * All $ amounts inside the order-summary block that contains the coupon input.
 * Scoped to that block (not the whole page) so plan-card prices on the plans
 * view don't leak in. Returns numbers, largest-first.
 */
async function summaryPrices(page: Page): Promise<number[]> {
  const text = await couponInput(page)
    .evaluate((el) => {
      let n: HTMLElement | null = el as HTMLElement;
      for (let i = 0; i < 8 && n; i++) {
        const p = n.parentElement;
        if (
          p &&
          /\$\s*\d/.test(p.innerText) &&
          /month|year|\/mo|\/yr|due|plan price|total|pay/i.test(p.innerText)
        ) {
          return p.innerText;
        }
        n = p;
      }
      return (el.closest('form,section,div,[role="dialog"]') as HTMLElement | null)?.innerText || '';
    })
    .catch(() => '');
  return [...text.matchAll(/\$\s*([0-9][0-9.,]*)/g)]
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((x) => !Number.isNaN(x) && x > 0)
    .sort((a, b) => b - a);
}

/** Apply a code and assert the ACCEPTED state: a Remove control, and no error. */
async function applyAndExpectAccepted(page: Page, code: string): Promise<number[]> {
  await revealCoupon(page);
  await couponInput(page).fill(code);
  await applyButton(page).click();
  await expect(removeControl(page)).toBeVisible();
  await expect(couponError(page)).toBeHidden();
  return summaryPrices(page);
}

// ------------------------------------- tests -------------------------------------

test.describe('Billing coupon — Review & confirm @coupon @destructive', () => {
  // Production is read-only: every test clicks a plan CTA into the plan-change wizard and LP-BILL-CPN-002+
  // submit a coupon (Apply → POST). That is not navigation-only, so the whole describe is staging-only.
  test.skip(!IS_STAGING, 'Production is read-only: this spec drives the plan-change wizard and applies coupons. Staging only (LP_ENV=staging).');

  test.beforeEach(async ({ page }) => {
    // Offline, token-free: an expired saved session → BLOCKED{SESSION} + capture command in ms
    // (it used to spend ~11 s per test and then FAIL on the missing "Change Plan").
    assertSessionUsable(ACTIVE, { allowRefreshable: true });
    // Hard stop: never let a plan CTA hand the page to a Stripe-hosted checkout/portal.
    await page.route(/^https:\/\/([a-z0-9-]+\.)*stripe\.com\//i, (route) =>
      route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()
        ? route.abort('blockedbyclient')
        : route.continue(),
    );
    await goto(page, ROUTES.billing);
    // Session expired (> ~7 days) → land on /login. Skip cleanly with guidance.
    // The SPA can render its login form without a /login URL, so the form counts as a bounce too.
    const loginForm = await page.getByRole('heading', { name: /^log in$/i }).first().isVisible().catch(() => false);
    if (/\/login/.test(new URL(page.url()).pathname) || loginForm) {
      test.skip(true, `No valid ${ACTIVE.name} session — run ${captureCommand(ACTIVE)}.`);
    }
    await reachReviewWithCoupon(page);
  });

  test('LP-BILL-CPN-001 | coupon field + Apply are present on Review & confirm', async ({ page }) => {
    await expect(couponInput(page)).toBeVisible();
    await expect(applyButton(page)).toBeVisible();
    // Sanity: we really are on the review step (but we never click it).
    await expect(confirmPayButton(page)).toBeVisible();
  });

  test('LP-BILL-CPN-002 | invalid coupon is rejected, price unchanged', async ({ page }) => {
    const before = await summaryPrices(page);
    // Without a baseline price "price unchanged" would pass vacuously.
    expect(before.length, 'a plan price should be shown before applying').toBeGreaterThan(0);
    await revealCoupon(page);
    await couponInput(page).fill('INVALID-TEST-9999');
    await applyButton(page).click();
    await expect(couponError(page)).toBeVisible();
    await expect(removeControl(page)).toBeHidden();
    const after = await summaryPrices(page);
    expect(after[0], 'top-line price unchanged after an invalid coupon').toBe(before[0]);
  });

  test(`LP-BILL-CPN-003 | ${COUPON} applies 50% off and Remove reverts`, async ({ page }) => {
    test.skip(!IS_STAGING, `${COUPON} is a staging-only test coupon (set LP_ENV=staging).`);

    const before = await summaryPrices(page);
    expect(before.length, 'a plan price should be shown before applying').toBeGreaterThan(0);

    const after = await applyAndExpectAccepted(page, COUPON);
    await expect(page.getByText(new RegExp(COUPON, 'i')).first()).toBeVisible();

    // A discounted figure (~50% of the pre-coupon top-line price) appears.
    if (DISCOUNT) {
      const target = before[0] * (1 - DISCOUNT);
      const tol = Math.max(1, before[0] * 0.02);
      expect(
        after.some((p) => Math.abs(p - target) <= tol),
        `expected a ~$${target.toFixed(2)} (50% off $${before[0]}) line; saw ${JSON.stringify(after)}`,
      ).toBeTruthy();
    }

    // Remove reverts to the original price.
    await removeControl(page).click();
    await expect(removeControl(page)).toBeHidden();
    const reverted = await summaryPrices(page);
    if (before.length && reverted.length) expect(reverted[0]).toBe(before[0]);
  });

  test(`LP-BILL-CPN-004 | coupon matching is case-INSENSITIVE (lowercase accepted)`, async ({ page }) => {
    // Contrast with the marketing checkout, where lowercase is wrongly rejected.
    test.skip(!IS_STAGING, `needs the staging-only ${COUPON} coupon.`);
    const before = await summaryPrices(page);
    // Without a baseline price the "same 50% discount" check below would be skipped silently.
    expect(before.length, 'a plan price should be shown before applying').toBeGreaterThan(0);
    const after = await applyAndExpectAccepted(page, COUPON.toLowerCase());
    if (DISCOUNT) {
      const target = before[0] * (1 - DISCOUNT);
      const tol = Math.max(1, before[0] * 0.02);
      expect(
        after.some((p) => Math.abs(p - target) <= tol),
        'lowercase coupon should apply the same 50% discount',
      ).toBeTruthy();
    }
  });
});
