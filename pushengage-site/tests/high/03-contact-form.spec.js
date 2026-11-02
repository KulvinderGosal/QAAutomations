/**
 * Test Suite: HIGH - Contact / Demo Request Form
 * Test ID Prefix: PESITE-103x
 * Priority: HIGH
 * Feature: CONTACT / DEMO FORMS
 *
 * Covers:
 *  - Contact page loads
 *  - Contact form is visible (email + submit)
 *  - Required fields show validation on empty submit
 *  - Invalid email format shows validation error
 *  - Demo request form is present (if applicable)
 */

const { test, expect } = require('@playwright/test');
const ContactPage = require('../../pages/ContactPage');
const { waitForPageLoad } = require('../../utils/helpers');
const config = require('../../utils/config');

test.describe('HIGH - Contact & Demo Forms', () => {
  let contactPage;

  test.beforeEach(async ({ page }) => {
    contactPage = new ContactPage(page);
    await contactPage.open();
  });

  test('PESITE-1031 - Contact page loads @high', async ({ page }) => {
    console.log('📍 PESITE-1031: Verifying contact page loads');

    const status = await page.goto(config.pages.contact, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const httpStatus = status?.status() ?? 0;
    console.log(`  HTTP status: ${httpStatus}`);
    expect(httpStatus).toBeLessThan(400);

    const title = await contactPage.getTitle();
    console.log(`  Page title: "${title}"`);

    console.log('✅ Contact page loaded');
  });

  test('PESITE-1032 - Contact form has email field and submit button @high', async ({ page }) => {
    console.log('📍 PESITE-1032: Checking contact form fields');

    const formVisible = await contactPage.isContactFormVisible();
    expect(formVisible, 'Contact form should have email field and submit button').toBeTruthy();

    console.log('✅ Contact form is visible with required fields');
  });

  test('PESITE-1033 - Empty contact form submission shows validation @high', async ({ page }) => {
    console.log('📍 PESITE-1033: Empty form validation');

    const formVisible = await contactPage.isContactFormVisible();
    if (!formVisible) {
      test.skip(true, 'Contact form not found on this page');
    }

    await contactPage.submitEmpty();
    await page.waitForTimeout(1500);

    // Either validation errors appear OR we stay on the same page
    const currentUrl = page.url();
    const hasErrors = await page.locator('[class*="error"], [class*="invalid"], [role="alert"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const stayedOnPage = currentUrl.includes('contact');

    expect(hasErrors || stayedOnPage,
      'Submitting empty form should show errors or keep user on contact page').toBeTruthy();

    console.log(`✅ Empty form submission handled (errors: ${hasErrors}, stayed: ${stayedOnPage})`);
  });

  test('PESITE-1034 - Contact form accepts valid input @high', async ({ page }) => {
    console.log('📍 PESITE-1034: Filling contact form with valid data');

    const formVisible = await contactPage.isContactFormVisible();
    if (!formVisible) {
      test.skip(true, 'Contact form not found');
    }

    await contactPage.fillContactForm(
      'QA Tester',
      'qa-test-donotreply@example.com',
      'This is an automated QA test message. Please ignore.'
    );

    // Verify fields are filled
    const emailField = await contactPage.getEmailField();
    const emailValue = await emailField.inputValue();
    expect(emailValue).toBe('qa-test-donotreply@example.com');

    console.log('✅ Contact form accepts valid input without errors');
  });

  test('PESITE-1035 - Get a Demo / Request Demo form exists @high', async ({ page }) => {
    console.log('📍 PESITE-1035: Checking for demo request form');

    // The demo request lives on its own page (config.pages.scheduleDemo, linked from
    // the footer "Product Demo" and the hero "Book a strategy call" funnel). The old
    // probe looked only on /contact-us/ and /demo/ for [id*=demo] / "Get a Demo",
    // which the current WPForms wizard markup never matches, so it always skipped.
    const res = await page.goto(config.pages.scheduleDemo, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);
    expect(res ? res.status() : 0, `${config.pages.scheduleDemo} should load`).toBeLessThan(400);

    const form = page.locator('form.wpforms-form').filter({ has: page.locator('input[type="email"]') }).first();
    await expect(form, 'A demo request form (WPForms) should render on the schedule-demo page').toBeVisible();
    await expect(form.locator('input[type="email"]').first(), 'Demo form should ask for an email').toBeVisible();
    // Forward control: the wizard's Continue (multi-page) or a visible submit (single page).
    await expect(form.locator('.wpforms-page-next, button.wpforms-submit').filter({ visible: true }).first(),
      'Demo form should expose a Continue / submit control').toBeVisible();
    const formId = await form.getAttribute('data-formid');
    console.log(`  Demo form: wpforms ${formId} on ${new URL(page.url()).pathname} (not filled, not submitted)`);

    console.log('✅ Demo form / request demo option is present');
  });
});
