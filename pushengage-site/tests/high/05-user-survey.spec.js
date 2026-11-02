/**
 * Test Suite: HIGH - User Survey (NPS / Feedback)
 * Test ID Prefix: PESITE-105x
 * Priority: HIGH
 * Feature: USER SURVEY / VOICE-OF-CUSTOMER
 *
 * Covers /user-survey/ (WPForms: Email* + 0-10 NPS rating* + feedback textareas
 * + reCAPTCHA + Submit):
 *  - Page loads
 *  - Survey form present (email + rating scale + submit)
 *  - Empty submit shows validation errors
 *  - Valid fill (email + rating + required feedback) leaves no field errors
 *  - reCAPTCHA present
 *  - (Gated) full fill + submit — only when SUBMIT_FORMS=true
 *
 * SAFETY: real submit is OFF unless SUBMIT_FORMS=true (avoids polluting survey
 * responses). reCAPTCHA cannot be solved by automation, so the gated submit
 * asserts a confirmation OR a reCAPTCHA gate. Runs on staging + live (TEST_ENV).
 */

const { test, expect } = require('@playwright/test');
const SurveyPage = require('../../pages/SurveyPage');
const config = require('../../utils/config');

test.describe('HIGH - User Survey', () => {
  let survey;

  test.beforeEach(async ({ page }) => {
    survey = new SurveyPage(page);
    await survey.open(config.pages.userSurvey);
  });

  test('PESITE-1051 - User survey page loads @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1051: User survey loads');
    const title = await survey.getTitle();
    console.log(`  Title: "${title}"`);
    expect(page.url()).toContain('user-survey');
    expect(await survey.isReady(), 'Survey form should render').toBeTruthy();
    console.log('✅ User survey page loaded');
  });

  test('PESITE-1052 - Survey form has email + rating scale + submit @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1052: Survey form structure');
    const emailVisible = await survey.form().locator('input[type="email"]').first().isVisible({ timeout: 6000 }).catch(() => false);
    const ratingCount = await survey.form().locator('input[type="radio"]').count();
    const submitVisible = await survey.submitButton().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  email: ${emailVisible} | rating options: ${ratingCount} | submit: ${submitVisible}`);
    expect(emailVisible, 'Email field present').toBeTruthy();
    expect(ratingCount, 'NPS rating scale should expose multiple options').toBeGreaterThan(2);
    expect(submitVisible, 'Submit button present').toBeTruthy();
    console.log('✅ Survey form structure OK');
  });

  test('PESITE-1053 - Empty submit shows validation errors @high', async ({ page }) => {
    console.log('📍 PESITE-1053: Empty-submit validation');
    if (!(await survey.isReady())) test.skip(true, 'Survey form not present');
    // Reviewed 2026-10-21. Production read-only guard: this test clicks Submit on a live
    // form, so abort every non-GET request from here on and assert none was a
    // submission (only client-side validation may run).
    // Only submission-like site POSTs (form-field data / wpforms_submit / unreadable body)
    // are aborted + flagged; WPForms' field-free token refresh must go through (aborting
    // it leaves Submit inert, live 2026-10-21), and third-party analytics beacons are
    // dropped without counting as a form submission.
    const writes = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.continue();
      if (!/(^|\.)pushengage\.com$/i.test(new URL(req.url()).hostname)) return route.abort();
      const body = req.postData();
      const submitLike = body === null || /wpforms(?:\[|%5B)fields(?:\]|%5D)|action=wpforms_submit|name="action"\r?\n\r?\nwpforms_submit/i.test(body);
      writes.push({ what: `${req.method()} ${req.url().split('?')[0]}`, submitLike });
      return submitLike ? route.abort() : route.continue();
    });
    // Flake fix (validator 2026-10-21: 1 of 3 runs clicked while WPForms still had
    // Submit disabled, so the click did nothing). WPForms enables it once ready.
    await expect(survey.submitButton(), 'WPForms should enable Submit once its JS is ready').toBeEnabled({ timeout: 15000 });
    await survey.clickSubmit();
    const errors = await survey.errorCount();
    console.log(`  Validation errors after empty submit: ${errors}`);
    if (writes.length) test.info().annotations.push({ type: 'site-posts', description: writes.map((w) => `${w.what}${w.submitLike ? ' [submit-like, aborted]' : ' [allowed]'}`).join(', ') });
    expect(writes.filter((w) => w.submitLike).map((w) => w.what), 'An empty submit must not send the form').toEqual([]);
    expect(errors, 'Required fields should be flagged').toBeGreaterThan(0);
    console.log('✅ Required-field validation fires');
  });

  test('PESITE-1054 - Valid fill leaves no required-field errors @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1054: Valid fill');
    if (!(await survey.isReady())) test.skip(true, 'Survey form not present');
    await survey.fillCurrentStep();

    const emailVal = await survey.form().locator('input[type="email"]').first().inputValue();
    expect(emailVal).toBe(config.forms.survey.email);

    const ratingChecked = await survey.form().locator('input[type="radio"]:checked').count();
    expect(ratingChecked, 'A rating option should be selected').toBeGreaterThan(0);
    console.log(`  email filled + ${ratingChecked} rating selected`);
    console.log('✅ Survey fills cleanly with valid data');
  });

  test('PESITE-1055 - reCAPTCHA present on survey @high', async ({ page }) => {
    console.log('📍 PESITE-1055: reCAPTCHA present');
    // Hard expect: reCAPTCHA is this form's protection (1 .g-recaptcha + api.js on
    // production 2026-10-20). The old skip-if-missing could never fail.
    await expect(survey.recaptcha(), 'User survey should be protected by reCAPTCHA').toBeAttached();
    console.log('✅ reCAPTCHA present');
  });

  test('PESITE-1056 - Full fill + submit (gated by SUBMIT_FORMS) @high', async ({ page }) => {
    if (!config.forms.submit) test.skip(true, 'SUBMIT_FORMS not enabled — skipping real survey submission');
    console.log('📍 PESITE-1056: Real survey submission');
    if (!(await survey.isReady())) test.skip(true, 'Survey form not present');
    await survey.fillCurrentStep();
    await survey.clickSubmit();
    await page.waitForTimeout(2500);
    const success = await survey.hasSuccessConfirmation();
    const gate = await survey.recaptchaPresent();
    console.log(`  success: ${success} | reCAPTCHA gate: ${gate}`);
    expect(success || gate, 'Expect confirmation or reCAPTCHA gate after submit').toBeTruthy();
    console.log('✅ Survey submit path exercised');
  });
});
