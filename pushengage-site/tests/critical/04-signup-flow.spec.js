/**
 * Test Suite: CRITICAL - Signup / Registration Flow
 * Test ID Prefix: PESITE-004x
 * Priority: CRITICAL
 * Feature: SIGNUP / REGISTRATION
 *
 * Covers:
 *  - Signup page / registration form loads
 *  - Email, password, name fields are present
 *  - Google OAuth option is present
 *  - Empty form submission shows validation errors
 *  - Invalid email format shows validation error
 *  - Pricing page "Get Started" CTA links to signup
 *
 * NOTE: Actual account creation is NOT tested here to avoid
 * creating real accounts in production. Only UI/flow validation.
 */

const { test, expect } = require('@playwright/test');
const SignupPage = require('../../pages/SignupPage');
const PricingPage = require('../../pages/PricingPage');
const { waitForPageLoad } = require('../../utils/helpers');
const config = require('../../utils/config');

// ── Where signup lives now (production, 2026-10-20) ───────────────────────────
// /register/ (config.pages.signup) 301s to /pricing/, but the on-site signup is
// LIVE at /signup/ ("Create A PushEngage Account"): a React app mounted in
// #signup-root. The pricing plan CTAs send users there (/signup?planName=free →
// /signup/?planName=free). Step 1 = form#pushengage-signup-step1 (noValidate;
// client-side validation) with #pushengage-email-input, #pushengage-password-input,
// first/last name, website, industry, submit "Setup Your Account"; plus a
// "Register with Google" button above it. The old tests skipped unconditionally
// ("form removed") after loading /register/ → /pricing/.
//
// SAFETY (production is read-only): no valid data is ever entered, so the form
// never reaches its email-check / OTP / account calls. 0406/0407 additionally
// abort every non-GET request and assert none hit the PushEngage API.
const SIGNUP_PATH = '/signup/?planName=free';

/** Abort + record every non-GET request from the page from here on. */
async function blockWrites(page) {
  const writes = [];
  await page.route('**/*', (route) => {
    const req = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.continue();
    writes.push(`${req.method()} ${req.url().split('?')[0]}`);
    return route.abort();
  });
  return writes;
}

test.describe('CRITICAL - Signup / Registration Flow', () => {
  let signupPage;

  test.beforeEach(async ({ page }) => {
    signupPage = new SignupPage(page);
    await signupPage.goto(SIGNUP_PATH); // live on-site signup (see note above)
  });

  test('PESITE-0401 - Signup / registration page loads @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0401: Verifying signup page loads');

    const url = page.url();
    console.log(`  Signup URL: ${url}`);
    expect(new URL(url).pathname, 'Signup should stay on the on-site /signup/ page').toMatch(/^\/signup\/?$/);
    await expect(page, 'Signup page title').toHaveTitle(/create .*account|sign\s*up/i);
    await expect(page.locator('#signup-root #signup-title'), 'Signup app should render its heading').toBeVisible();

    const title = await signupPage.getTitle();
    console.log(`  Page title: "${title}"`);

    console.log('✅ Signup page loaded');
  });

  test('PESITE-0402 - Email field is visible on signup form @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0402: Checking email input field');

    const emailField = page.locator('#pushengage-signup-step1 input[type="email"]');
    await expect(emailField, 'Email input field should be visible').toBeVisible();

    console.log('✅ Email field is present');
  });

  test('PESITE-0403 - Password field is visible on signup form @critical', async ({ page }) => {
    console.log('📍 PESITE-0403: Checking password field');

    const passField = page.locator('#pushengage-signup-step1 input[type="password"]');
    await expect(passField, 'Password input field should be visible').toBeVisible();

    console.log('✅ Password field is present');
  });

  test('PESITE-0404 - Submit button is visible on signup form @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0404: Checking submit button');

    const btn = page.locator('#pushengage-signup-step1 button[type="submit"]');
    await expect(btn, 'Submit ("Setup Your Account") button should be visible').toBeVisible();
    await expect(btn).toBeEnabled();

    const text = await btn.textContent();
    console.log(`  Submit button text: "${text?.trim()}"`);

    console.log('✅ Submit button is present');
  });

  test('PESITE-0405 - Google OAuth / SSO option is visible @critical', async ({ page }) => {
    console.log('📍 PESITE-0405: Checking Google OAuth button');

    // Rendered above the email form ("Register with Google"); never clicked here.
    const googleBtn = page.locator('#signup-root').getByRole('button', { name: /google/i });
    await expect(googleBtn, 'Google OAuth "Register with Google" button should be visible').toBeVisible();

    console.log('✅ Google OAuth option is present');
  });

  test('PESITE-0406 - Empty form submission shows validation errors @critical', async ({ page }) => {
    console.log('📍 PESITE-0406: Testing empty form validation');
    const writes = await blockWrites(page);
    const form = page.locator('#pushengage-signup-step1');

    await form.locator('button[type="submit"]').click();

    const errors = form.locator('.pushengage-error-message[role="alert"]');
    await expect(errors.first(), 'Submitting the empty form should show a validation error').toBeVisible();
    const errorCount = await errors.count();
    console.log(`  Validation errors shown: ${errorCount}`);
    expect(errorCount, 'Submitting empty form should show at least 1 validation error').toBeGreaterThan(0);
    expect(new URL(page.url()).pathname, 'Empty submit should keep the user on /signup/').toMatch(/^\/signup\/?$/);
    expect(writes.filter((w) => /\/d\/v1\//.test(w)), 'Empty submit must not call the PushEngage API').toHaveLength(0);

    console.log('✅ Empty form submission shows validation errors');
  });

  test('PESITE-0407 - Invalid email shows validation error @critical', async ({ page }) => {
    console.log('📍 PESITE-0407: Testing invalid email validation');
    const writes = await blockWrites(page);
    const form = page.locator('#pushengage-signup-step1');

    await form.locator('input[type="email"]').fill('not-an-email');
    await form.locator('button[type="submit"]').click();

    const emailError = page.locator('#pushengage-email-error');
    await expect(emailError, 'Invalid email should trigger an email validation error').toBeVisible();
    console.log(`  Email error: "${((await emailError.textContent()) || '').trim()}"`);
    await expect(form.locator('input[type="email"]')).toHaveAttribute('aria-invalid', 'true');
    expect(writes.filter((w) => /\/d\/v1\//.test(w)), 'Invalid-email submit must not call the PushEngage API').toHaveLength(0);

    console.log('✅ Invalid email shows validation error');
  });

  test('PESITE-0408 - Pricing page CTA links to signup/registration @critical', async ({ page }) => {
    console.log('📍 PESITE-0408: Pricing CTA links to signup');

    const pricingPage = new PricingPage(page);
    await pricingPage.open();

    const cta = await pricingPage.getPlanCTA();
    expect(cta, 'A CTA button should be present on pricing page').toBeTruthy();

    const href = await cta.getAttribute('href');
    console.log(`  CTA href: ${href}`);
    const DEST = /signup|register|get-started|app\.pushengage/i;
    if (href && href !== '#') {
      expect(href, 'Pricing CTA should link to a signup/register URL').toMatch(DEST);
    } else {
      // The "Get Started" CTAs are <a> without an href — they navigate via a JS
      // click handler to app.pushengage.com (signup). Verify functionally.
      const before = page.url();
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 8000 }).catch(() => null),
        cta.click().catch(() => undefined),
      ]);
      let dest = before;
      if (popup) {
        dest = popup.url();
      } else {
        await page.waitForURL(DEST, { timeout: 12000 }).catch(() => undefined);
        dest = page.url();
      }
      console.log(`  CTA (JS-navigated) landed on: ${dest}`);
      expect(dest, 'Pricing CTA (JS-navigated) should lead to a signup/app URL').toMatch(DEST);
    }

    console.log('✅ Pricing CTA correctly leads to signup');
  });
});
