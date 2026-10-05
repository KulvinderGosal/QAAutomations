const { test, expect } = require('@playwright/test');

/**
 * Suite: MARKETING SITE — SUBMITTABLE FORMS INVENTORY (PRODUCTION)
 *
 * Exercises the site's other submittable forms without creating real-world
 * transactions:
 *   - "Take PushEngage for a Test Drive" email capture (email -> handoff)
 *   - Blog search
 *   - Newsletter "Join Us" optin (render + required validation only; NOT subscribed)
 */

async function dismissCookie(page) {
  for (const sel of ['button:has-text("Accept")']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1200 })) { await b.click(); return; } } catch (e) { /* no-op */ }
  }
}

test.describe('Marketing Site — Submittable Forms (Production)', () => {
  // The CTA says "Your Email Address…" + "Take PushEngage for a Test Drive", which implies
  // the email should start a trial/signup. Observed: it ignores the email and redirects to
  // /pricing/. Guarded as a known UX issue.
  test('PE-MKT-FORM-TESTDRIVE: email capture should hand the email to signup — [KNOWN ISSUE]', async ({ page }) => {
    test.fail(true, 'Test-drive capture discards the entered email and redirects to /pricing/ (not /signup/). Remove when it carries the email to signup.');
    await page.goto('https://www.pushengage.com/integrations/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);

    const input = page.locator('.pushengage-cta-test-drive-form__input').first();
    await input.scrollIntoViewIfNeeded();
    await input.fill('kgosal+qa_td@awesomemotive.com');
    await Promise.all([
      page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      page.locator('.pushengage-cta-test-drive-form__button a').first().click(),
    ]);
    await page.waitForTimeout(3000);
    // Expected behaviour: land on signup with the email carried through.
    expect(page.url()).toContain('/signup/');
    const email = await page.evaluate(() => document.querySelector('#pushengage-email-input,input[type=email]')?.value || '');
    expect(email).toContain('kgosal+qa_td@awesomemotive.com');
  });

  test('PE-MKT-FORM-TESTDRIVE-NAV: test-drive CTA navigates somewhere valid (no dead click)', async ({ page }) => {
    await page.goto('https://www.pushengage.com/integrations/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);
    const before = page.url();
    await page.locator('.pushengage-cta-test-drive-form__input').first().fill('kgosal+qa_td@awesomemotive.com');
    await Promise.all([
      page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      page.locator('.pushengage-cta-test-drive-form__button a').first().click(),
    ]);
    await page.waitForTimeout(2500);
    expect(page.url(), 'CTA should navigate away from the source page').not.toEqual(before);
    expect(page.url()).toMatch(/pushengage\.com\/(pricing|signup)\//);
  });

  test('PE-MKT-FORM-BLOGSEARCH: blog search returns results', async ({ page }) => {
    await page.goto('https://www.pushengage.com/blog/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);
    const input = page.locator('input[type=search][name="s"]').first();
    await input.fill('push notifications');
    await Promise.all([
      page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      page.locator('button:has-text("Search")').first().click().catch(() => input.press('Enter')),
    ]);
    await page.waitForTimeout(3000);
    expect(page.url()).toMatch(/[?&]s=/);
    expect(await page.locator('article, .post, h2 a').count()).toBeGreaterThan(0);
  });

  test('PE-MKT-FORM-NEWSLETTER: optin renders and enforces required email (not subscribed)', async ({ page }) => {
    await page.goto('https://www.pushengage.com/workflows/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookie(page);
    const form = page.locator('form[id^="sp-optin-form"]').first();
    await expect(form).toBeVisible();
    // Empty submit must be blocked by native required validation. Do NOT submit a real email.
    await page.locator('button:has-text("Join Us")').first().click();
    await page.waitForTimeout(1000);
    const blocked = await page.evaluate(() => {
      const el = document.querySelector('form[id^="sp-optin-form"] input[type=email]');
      return el && el.required && el.validity && el.validity.valid === false;
    });
    expect(blocked, 'empty newsletter submit should be blocked by required validation').toBeTruthy();
  });
});
