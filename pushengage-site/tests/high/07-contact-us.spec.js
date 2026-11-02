/**
 * Test Suite: HIGH - Contact Us (full fill + submit)
 * Test ID Prefix: PESITE-107x
 * Priority: HIGH
 * Feature: CONTACT US / LEAD CAPTURE
 *
 * Covers /contact-us/ — WPForms: Name*, Email*, Website*, Topic* (select),
 * Message* + reCAPTCHA + Submit. Fills EVERY field and submits.
 *
 * Data (per QA): email = config.forms.contact.email (QA_EMAIL in .env),
 * QA test message. SAFETY: real submit gated by SUBMIT_FORMS (default off).
 * reCAPTCHA isn't bypassed — gated submit asserts confirmation OR a reCAPTCHA
 * gate. Runs on staging + live (TEST_ENV).
 */

const { test, expect } = require('@playwright/test');
const ContactPage = require('../../pages/ContactPage');
const config = require('../../utils/config');

test.describe('HIGH - Contact Us (full fill + submit)', () => {
  let contact;

  test.beforeEach(async ({ page }) => {
    contact = new ContactPage(page);
    await contact.open(); // /contact-us/ (also reveals the hidden WPForms form)
  });

  test('PESITE-1070 - FINDING: classic contact form is hidden by default @high', async ({ page }) => {
    console.log('📍 PESITE-1070: Contact form hidden-by-default check');
    // Fresh load WITHOUT revealing, to capture the real user-facing state.
    await page.goto(config.pages.contactUs, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const hidden = await contact.isFormHiddenByDefault();
    const pushHelper = await page.locator('text=/PushHelper|AI Chatbot/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const ticketLink = await page.locator('a:has-text("support ticket"), a:has-text("Submit a Support Ticket")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  WPForms form hidden by default: ${hidden} | PushHelper visible: ${pushHelper} | support-ticket link: ${ticketLink}`);
    expect(hidden, 'The classic WPForms contact form is hidden by default on the redesigned /contact-us/ (page leads with PushHelper chat + support ticket)').toBeTruthy();
    console.log('ℹ️ FINDING: classic contact form hidden by default — subsequent tests reveal it to exercise fill+submit.');
  });

  test('PESITE-1071 - Contact Us page loads @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1071: Contact Us loads');
    console.log(`  Title: "${await contact.getTitle()}"`);
    expect(page.url()).toContain('contact');
    console.log('✅ Contact Us page loaded');
  });

  test('PESITE-1072 - All required fields present (Name/Email/Website/Topic/Message) @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1072: Required fields');
    const f = await contact.hasAllRequiredFields();
    console.log(`  name:${f.text} email:${f.email} website:${f.url} topic:${f.topic} message:${f.msg} submit:${f.submit}`);
    expect(f.all, 'Contact form should expose Name, Email, Website, Topic, Message + Submit').toBeTruthy();
    console.log('✅ All required contact fields present');
  });

  test('PESITE-1073 - Empty submit shows validation errors @high', async ({ page }) => {
    console.log('📍 PESITE-1073: Empty-submit validation');
    await contact.submit();
    const errors = await contact.errorCount();
    console.log(`  Validation errors after empty submit: ${errors}`);
    expect(errors, 'Required fields should be flagged').toBeGreaterThan(0);
    console.log('✅ Required-field validation fires');
  });

  test('PESITE-1074 - Fill all fields cleanly with QA data @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1074: Fill all fields');
    await contact.fillAll(config.forms.contact);

    const emailVal = await contact.emailInput().inputValue();
    console.log(`  email = "${emailVal}"`);
    expect(emailVal).toBe(config.forms.contact.email);

    const msgVal = await contact.messageBox().inputValue();
    expect(msgVal.length, 'Message should be filled').toBeGreaterThan(5);

    const submit = await contact.getSubmitBtn();
    await expect(submit).toBeEnabled();
    console.log('✅ All fields filled with QA data; submit enabled');
  });

  test('PESITE-1075 - reCAPTCHA present on contact form @high', async ({ page }) => {
    console.log('📍 PESITE-1075: reCAPTCHA present');
    // Hard expect: reCAPTCHA is the contact form's protection (present on production
    // 2026-10-20, passed 2026-09-30). The old skip-if-missing could never fail.
    await expect(contact.recaptcha(), 'Contact form should be protected by reCAPTCHA').toBeAttached();
    console.log('✅ reCAPTCHA present');
  });

  test('PESITE-1076 - Fill all + submit (gated by SUBMIT_FORMS) @high', async ({ page }) => {
    if (!config.forms.submit) test.skip(true, 'SUBMIT_FORMS not enabled — skipping real contact submission');
    console.log('📍 PESITE-1076: Real contact submission');
    await contact.fillAll(config.forms.contact);
    await contact.submit();
    await page.waitForTimeout(2500);

    const success = await contact.hasSuccessConfirmation();
    const gate = await contact.recaptchaPresent();
    console.log(`  success: ${success} | reCAPTCHA gate: ${gate}`);
    expect(success || gate, 'Expect confirmation or reCAPTCHA gate after submit').toBeTruthy();
    if (success) console.log('✅ Contact form submitted — confirmation shown');
    else console.log('ℹ️ Submission halted at reCAPTCHA (expected for automation — CAPTCHA not bypassed)');
  });
});
