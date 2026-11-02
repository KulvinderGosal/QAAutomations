/**
 * Test Suite: CRITICAL - Pricing Page
 * Test ID Prefix: PESITE-003x
 * Priority: CRITICAL
 * Feature: PRICING
 *
 * Covers:
 *  - Pricing page loads successfully
 *  - Plan cards are visible (min 2 plans)
 *  - Free plan option is present
 *  - At least one paid plan is present
 *  - CTA buttons on plans are present
 *  - Monthly / Annual billing toggle works
 *  - Page title contains "Pricing"
 */

const { test, expect } = require('@playwright/test');
const PricingPage = require('../../pages/PricingPage');

// Monthly/Yearly billing switch, template-agnostic. PricingPage.toggleSelectors
// (input[id*=toggle], button:has-text(Monthly), [class*=billing-toggle]) match
// neither template, which is why 0306/0307 self-skipped on every run.
//   legacy (served on prod + staging 2026-10-20, PR #465 restore):
//     .pricing-front-interval-switch > "Monthly" | label.pricing-front-switch-label
//     (for the visually hidden checkbox #plan-period-table) | "Yearly"
//   v2 (parked): Monthly / Yearly buttons — matched by the role-based fallbacks.
const BILLING_TOGGLE = [
  '.pricing-front-interval-switch',
  '[class*="billing-toggle"]',
  '[class*="period-toggle"]',
  '[role="tablist"]:has-text("Monthly")',
  '[role="radiogroup"]:has-text("Monthly")',
  '[role="group"]:has-text("Monthly")',
].join(', ');
// Paid-plan price readouts (legacy); generic fallback only when those are absent.
const PLAN_PRICE = '.pricing-front-business-price, .pricing-front-premium-price, .pricing-front-growth-price';
const PLAN_PRICE_FALLBACK = '[class*="plan"] [class*="price"]';

test.describe('CRITICAL - Pricing Page', () => {
  let pricingPage;

  test.beforeEach(async ({ page }) => {
    pricingPage = new PricingPage(page);
    await pricingPage.open();
  });

  test('PESITE-0301 - Pricing page loads successfully @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0301: Verifying pricing page loads');

    expect(page.url()).toContain('pricing');

    const title = await pricingPage.getTitle();
    console.log(`  Page title: "${title}"`);
    expect(title.toLowerCase()).toMatch(/pricing|plans/);

    console.log('✅ Pricing page loaded successfully');
  });

  test('PESITE-0302 - At least 2 pricing plan cards are visible @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0302: Checking plan cards');

    const count = await pricingPage.countPlanCards();
    console.log(`  Plan cards found: ${count}`);
    expect(count, 'Should have at least 2 pricing plan cards').toBeGreaterThanOrEqual(2);

    console.log(`✅ Found ${count} plan cards`);
  });

  test('PESITE-0303 - Free plan option is present @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0303: Checking for free plan');

    const freePlan = await pricingPage.getFreePlan();
    expect(freePlan, 'A Free plan tier should be visible on pricing page').toBeTruthy();

    const text = await freePlan.textContent();
    console.log(`  Free plan element text: "${text?.trim().substring(0, 60)}..."`);

    console.log('✅ Free plan is present');
  });

  test('PESITE-0304 - At least one paid plan is present @critical', async ({ page }) => {
    console.log('📍 PESITE-0304: Checking for paid plan');

    const paidPlan = await pricingPage.getPaidPlan();
    expect(paidPlan, 'At least one paid plan (Business/Professional/Premium) should be visible').toBeTruthy();

    const text = await paidPlan.textContent();
    console.log(`  Paid plan text: "${text?.trim().substring(0, 60)}"`);

    console.log('✅ Paid plan is present');
  });

  test('PESITE-0305 - CTA buttons present on pricing plans @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0305: Checking plan CTA buttons');

    const cta = await pricingPage.getPlanCTA();
    expect(cta, 'CTA buttons (Get Started / Start For Free) should be on pricing cards').toBeTruthy();

    const ctaText = await cta.textContent();
    console.log(`  CTA text: "${ctaText?.trim()}"`);

    console.log('✅ Plan CTA buttons are present');
  });

  test('PESITE-0306 - Monthly/Annual billing toggle is visible @critical', async ({ page }) => {
    console.log('📍 PESITE-0306: Checking billing toggle');

    // A missing billing toggle on /pricing/ is a defect, not a reason to skip.
    const toggle = page.locator(BILLING_TOGGLE).filter({ visible: true }).first();
    await expect(toggle, 'A Monthly/Yearly billing toggle should be visible on /pricing/').toBeVisible();
    await expect(toggle, 'Billing toggle should offer Monthly').toContainText(/monthly/i);
    await expect(toggle, 'Billing toggle should offer Yearly/Annual').toContainText(/yearly|annual/i);
    console.log('✅ Billing toggle is present');
  });

  test('PESITE-0307 - Billing toggle switches pricing display @critical', async ({ page }) => {
    console.log('📍 PESITE-0307: Testing billing toggle interaction');

    const toggle = page.locator(BILLING_TOGGLE).filter({ visible: true }).first();
    await expect(toggle, 'A Monthly/Yearly billing toggle should be visible on /pricing/').toBeVisible();

    // Compare ONE specific plan price (the old any-[class*=price] diff passed on
    // any DOM change).
    const priceSel = (await page.locator(PLAN_PRICE).count()) ? PLAN_PRICE : PLAN_PRICE_FALLBACK;
    const price = page.locator(priceSel).filter({ visible: true }).first();
    await expect(price, 'A plan price should render before toggling').toBeVisible();
    await expect(price).toHaveText(/\d/);
    const before = ((await price.textContent()) || '').trim();

    // Legacy: click the switch label (the checkbox is visually hidden). v2: click
    // whichever period button is not the current one.
    const legacyLabel = toggle.locator('label.pricing-front-switch-label, label');
    const checkbox = toggle.locator('input[type="checkbox"]');
    const wasChecked = (await checkbox.count()) ? await checkbox.first().isChecked() : null;
    if (await legacyLabel.count()) {
      await legacyLabel.first().click({ force: true }); // same control/click as PESITE-9102
    } else {
      const periodBtn = toggle.getByRole('button', { name: /monthly|yearly|annual/i })
        .or(toggle.getByRole('tab', { name: /monthly|yearly|annual/i }))
        .or(toggle.getByRole('radio', { name: /monthly|yearly|annual/i }));
      await expect(periodBtn.first(), 'Billing toggle should expose Monthly/Yearly controls').toBeVisible();
      const selected = toggle.locator('[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"], .active, .is-active');
      const current = ((await selected.first().textContent({ timeout: 2000 }).catch(() => '')) || '').trim();
      await periodBtn.filter({ hasNotText: current || '\u0000' }).first().click();
    }

    await expect(price, `Toggling the billing period should change the displayed price (was "${before}")`).not.toHaveText(before);
    if (wasChecked !== null) await expect(checkbox.first(), 'The period checkbox should flip').toBeChecked({ checked: !wasChecked });
    console.log(`  Price before: "${before}" → after: "${((await price.textContent()) || '').trim()}"`);

    console.log('✅ Billing toggle updates pricing display');
  });
});
