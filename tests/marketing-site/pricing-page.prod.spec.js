const { test, expect } = require('@playwright/test');

/**
 * Suite: MARKETING SITE — PRICING PAGE (PRODUCTION)
 * URL:   https://www.pushengage.com/pricing
 * Scope: Page health, plan CTAs + plan-param integrity, signup-page handoff,
 *        monthly/yearly toggle, and the "book a strategy call" handoff.
 *
 * NON-DESTRUCTIVE: verifies the signup form renders but never creates an account.
 *
 * Run (sandbox):
 *   PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *   npx playwright test --config playwright-marketing.config.js pricing-page
 */

const PRICING = 'https://www.pushengage.com/pricing';

async function dismissCookie(page) {
  for (const sel of ['button:has-text("Accept")', 'button:has-text("Reject")']) {
    try {
      const b = page.locator(sel).first();
      if (await b.isVisible({ timeout: 1500 })) { await b.click(); return; }
    } catch (e) { /* no-op */ }
  }
}

test.describe('PushEngage Pricing Page (Production)', () => {
  test('PE-MKT-PRICING-001: page loads with correct title and no page errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    const resp = await page.goto(PRICING, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), 'HTTP status').toBeLessThan(400);
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    await expect(page).toHaveTitle(/Pricing/i);
    // Plan names should be present
    for (const plan of ['Growth', 'Premium', 'Business']) {
      await expect(page.getByText(plan, { exact: false }).first()).toBeVisible();
    }
    expect(pageErrors, `JS page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('PE-MKT-PRICING-002: plan CTAs carry the correct plan params', async ({ page }) => {
    await page.goto(PRICING, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/signup/"]')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: a.getAttribute('href'),
      }))
    );

    const expectations = [
      { param: 'planName=free' },
      { param: 'planName=growth' },
      { param: 'planName=premium' },
      { param: 'planName=business' },
    ];
    for (const exp of expectations) {
      const match = hrefs.find((h) => (h.href || '').includes(exp.param));
      expect(match, `A signup CTA should exist for ${exp.param}`).toBeTruthy();
    }
    // Paid plans must also carry a Stripe plan id
    for (const param of ['planName=growth', 'planName=premium', 'planName=business']) {
      const match = hrefs.find((h) => (h.href || '').includes(param));
      expect(match.href, `${param} should include a plan id`).toMatch(/plan=plan_/);
    }
  });

  test('PE-MKT-PRICING-003: Free plan CTA opens the signup form (no account created)', async ({ page }) => {
    await page.goto(PRICING, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    const freeHref = await page
      .locator('a[href*="/signup/"][href*="planName=free"]')
      .first()
      .getAttribute('href');
    expect(freeHref).toBeTruthy();

    const url = freeHref.startsWith('http') ? freeHref : `https://www.pushengage.com${freeHref}`;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBeLessThan(400);
    await page.waitForTimeout(4000);

    // Registration form must render
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"], input[type="submit"]').first()).toBeVisible();
    // Do NOT submit — leave production clean.
  });

  test('PE-MKT-PRICING-006: all four plan CTAs navigate to a working signup page', async ({ page }) => {
    const plans = [
      { label: 'Try it free', slug: 'free' },
      { label: 'Get Growth', slug: 'growth' },
      { label: 'Get Premium', slug: 'premium' },
      { label: 'Get Business', slug: 'business' },
    ];
    for (const plan of plans) {
      await page.goto(PRICING, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await dismissCookie(page);
      const link = page.locator(`a:has-text("${plan.label}")`).first();
      await link.scrollIntoViewIfNeeded().catch(() => {});
      await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), link.click()]);
      await page.waitForTimeout(3000);
      expect(page.url(), `${plan.label} should land on signup for ${plan.slug}`).toContain(`planName=${plan.slug}`);
      await expect(page.locator('input[type="email"]').first(), `signup form renders for ${plan.slug}`).toBeVisible();
    }
  });

  test('PE-MKT-PRICING-004: monthly/yearly toggle updates displayed pricing', async ({ page }) => {
    await page.goto(PRICING, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    const readPrices = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('*'))
          .map((e) => (e.childNodes[0]?.textContent || '').trim())
          .filter((t) => /^\$\d/.test(t))
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(',')
      );

    const before = await readPrices();
    const monthly = page.locator('button:has-text("Monthly")').first();
    await expect(monthly).toBeVisible();
    await monthly.click();
    await page.waitForTimeout(1500);
    const after = await readPrices();

    expect(before.length, 'some prices should render').toBeGreaterThan(0);
    expect(after, 'prices should change when toggling billing period').not.toEqual(before);
  });

  test('PE-MKT-PRICING-005: "book a strategy call" links to the schedule-demo page', async ({ page }) => {
    await page.goto(PRICING, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    const demoLink = page.locator('a[href*="schedule_demo"]').first();
    await expect(demoLink).toBeVisible();
    const href = await demoLink.getAttribute('href');
    expect(href).toContain('schedule_demo');
  });
});
