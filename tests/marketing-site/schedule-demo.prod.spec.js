const { test, expect } = require('@playwright/test');

/**
 * Suite: MARKETING SITE — SCHEDULE DEMO PAGE (PRODUCTION)
 * URL:   https://www.pushengage.com/schedule_demo/
 * Scope: Page health, multi-step WPForms wizard — step-1 required validation,
 *        advancing to step 2, and verifying step-2 qualifying fields render.
 *
 * NON-DESTRUCTIVE: walks the client-side page-break wizard but NEVER performs the
 * final submit, so no real demo request / lead is created in production.
 *
 * Run (sandbox):
 *   PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *   npx playwright test --config playwright-marketing.config.js schedule-demo
 */

const DEMO = 'https://www.pushengage.com/schedule_demo/';

async function dismissCookie(page) {
  for (const sel of ['button:has-text("Accept")', 'button:has-text("Reject")']) {
    try {
      const b = page.locator(sel).first();
      if (await b.isVisible({ timeout: 1500 })) { await b.click(); return; }
    } catch (e) { /* no-op */ }
  }
}

test.describe('PushEngage Schedule Demo Page (Production)', () => {
  test('PE-MKT-DEMO-001: page loads with correct title and demo form present', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    const resp = await page.goto(DEMO, { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBeLessThan(400);
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    await expect(page).toHaveTitle(/Demo/i);
    await expect(page.locator('form.wpforms-form, form[id*="wpforms"]').first()).toBeVisible();
    await expect(page.locator('#wpforms-28814-field_1')).toBeVisible(); // work email
    expect(pageErrors, `JS page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('PE-MKT-DEMO-002: step 1 enforces required fields on empty continue', async ({ page }) => {
    await page.goto(DEMO, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    const cont = page.locator('button:has-text("Continue"), .wpforms-page-next').first();
    await cont.scrollIntoViewIfNeeded();
    await cont.click();
    await page.waitForTimeout(1500);

    const errorCount = await page.locator('.wpforms-error:visible, label.wpforms-error:visible').count();
    expect(errorCount, 'required-field validation messages should show').toBeGreaterThan(0);
    // Wizard must not advance past step 1
    await expect(page.getByText(/STEP 1 OF/i).first()).toBeVisible();
  });

  test('PE-MKT-DEMO-003: valid step 1 advances to the qualifying step (no final submit)', async ({ page }) => {
    await page.goto(DEMO, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    const ts = Date.now();
    await page.fill('#wpforms-28814-field_1', `kgosal+qa_demo_${ts}@awesomemotive.com`);
    await page.fill('#wpforms-28814-field_2', 'QA');
    await page.fill('#wpforms-28814-field_2-last', `Automation${ts}`);
    await page.fill('#wpforms-28814-field_4', 'https://www.example.com');

    await page.locator('button:has-text("Continue"), .wpforms-page-next').first().click();
    await page.waitForTimeout(2000);

    // Step 2 qualifying fields
    await expect(page.getByText(/STEP 2 OF/i).first()).toBeVisible();
    await expect(page.locator('#wpforms-28814-field_7')).toBeVisible(); // Your role
    await expect(page.locator('#wpforms-28814-field_8')).toBeVisible(); // Monthly sessions
    await expect(page.locator('#wpforms-28814-field_9')).toBeVisible(); // Mobile app
    // Intentionally stop here — do not click final submit / create a lead.
  });
});
