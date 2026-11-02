/**
 * Test Suite: HIGH - Affiliate Survey (multi-step)
 * Test ID Prefix: PESITE-106x
 * Priority: HIGH
 * Feature: AFFILIATE / PARTNER SURVEY
 *
 * Covers /affiliates-survey/ — a 4-step WPForms form (Next/Next/Next/Submit):
 *   step 1: Name*, Email*, Website*, Industry*, Monthly visitors*
 *   later : promotion channels, "use PushEngage?" Yes/No*, use cases, goals*,
 *           resources*, suggestions  + reCAPTCHA + Submit
 *
 *  - Page loads
 *  - Step-1 form present (Name + Email + Website + a "Next" step control)
 *  - Empty "Next" on step 1 shows validation errors
 *  - Filling step 1 advances to step 2 (multi-step navigation works)
 *  - reCAPTCHA present
 *  - (Gated) full multi-step fill + submit — only when SUBMIT_FORMS=true
 *
 * SAFETY: real submit gated by SUBMIT_FORMS (avoids fake affiliate applications).
 * reCAPTCHA isn't bypassed. Runs on staging + live (TEST_ENV).
 */

const { test, expect } = require('@playwright/test');
const SurveyPage = require('../../pages/SurveyPage');
const config = require('../../utils/config');

test.describe('HIGH - Affiliate Survey (multi-step)', () => {
  let survey;

  test.beforeEach(async ({ page }) => {
    survey = new SurveyPage(page);
    await survey.open(config.pages.affiliateSurvey);
  });

  test('PESITE-1061 - Affiliate survey page loads @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1061: Affiliate survey loads');
    console.log(`  Title: "${await survey.getTitle()}"`);
    expect(page.url()).toContain('affiliates-survey');
    expect(await survey.isReady(), 'Survey form should render').toBeTruthy();
    console.log('✅ Affiliate survey page loaded');
  });

  test('PESITE-1062 - Step 1 has Name + Email + Website + a multi-step control @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1062: Step-1 structure');
    const form = survey.form();
    const nameVisible = await form.locator('input[type="text"]').first().isVisible({ timeout: 6000 }).catch(() => false);
    const emailVisible = await form.locator('input[type="email"]').first().isVisible().catch(() => false);
    const urlVisible = await form.locator('input[type="url"]').first().isVisible().catch(() => false);
    const hasNext = await survey.hasNext();
    console.log(`  name: ${nameVisible} | email: ${emailVisible} | website: ${urlVisible} | Next(step) control: ${hasNext}`);
    expect(nameVisible && emailVisible && urlVisible, 'Step 1 should have Name, Email, Website').toBeTruthy();
    expect(hasNext, 'Affiliate survey should be multi-step (Next control present)').toBeTruthy();
    console.log('✅ Step-1 structure OK (multi-step form)');
  });

  test('PESITE-1063 - Empty "Next" on step 1 shows validation errors @high', async ({ page }) => {
    console.log('📍 PESITE-1063: Step-1 empty validation');
    if (!(await survey.hasNext())) test.skip(true, 'Multi-step Next control not present');
    await survey.nextButton().click().catch(() => {});
    await page.waitForTimeout(600);
    const errors = await survey.errorCount();
    console.log(`  Validation errors after empty Next: ${errors}`);
    expect(errors, 'Step-1 required fields should be flagged').toBeGreaterThan(0);
    console.log('✅ Step-1 validation fires');
  });

  test('PESITE-1064 - Filling step 1 advances to step 2 @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1064: Step-1 → step-2 navigation');
    if (!(await survey.hasNext())) test.skip(true, 'Multi-step Next control not present');

    const nameField = survey.form().locator('input[type="text"]').first();
    await survey.fillCurrentStep();
    await survey.nextButton().click().catch(() => {});
    await page.waitForTimeout(1000);

    // After advancing, step-1's first text (Name) should no longer be visible.
    const stillOnStep1 = await nameField.isVisible({ timeout: 1500 }).catch(() => false);
    const errors = await survey.errorCount();
    console.log(`  still on step 1: ${stillOnStep1} | errors: ${errors}`);
    expect(stillOnStep1, 'Filling step 1 + Next should advance past the Name field').toBeFalsy();
    console.log('✅ Multi-step navigation advances after a valid step');
  });

  test('PESITE-1065 - reCAPTCHA present on affiliate survey @high', async ({ page }) => {
    console.log('📍 PESITE-1065: anti-spam protection present on affiliate survey');
    const form = survey.form();
    await expect(form, 'Affiliate survey form should render').toBeVisible();
    // The old check skipped whenever reCAPTCHA was missing, so it could never fail.
    // Production 2026-10-20 (form 23319): no .g-recaptcha and no recaptcha/api.js on
    // any step; protection = the WPForms anti-spam token (form[data-token]).
    const captchas = await page.locator('.g-recaptcha, iframe[src*="recaptcha"], .cf-turnstile, iframe[src*="challenges.cloudflare.com"], .h-captcha, iframe[src*="hcaptcha"]').count();
    const token = (await form.getAttribute('data-token')) || '';
    console.log(`  CAPTCHA widgets: ${captchas} | WPForms anti-spam token: ${token ? 'present' : 'absent'}`);
    if (!captchas) {
      test.info().annotations.push({ type: 'note', description: 'No reCAPTCHA on /affiliates-survey/ (form 23319) on 2026-10-20; protection = WPForms anti-spam token. Dev to confirm reCAPTCHA was dropped on purpose.' });
    }
    expect(captchas > 0 || token.length > 0, 'Affiliate survey should carry anti-spam protection (reCAPTCHA/Turnstile/hCaptcha or the WPForms anti-spam token)').toBeTruthy();
    console.log(`✅ Anti-spam present (${captchas ? 'CAPTCHA widget' : 'WPForms token only'})`);
  });

  test('PESITE-1066 - Full multi-step fill + submit (gated by SUBMIT_FORMS) @high', async ({ page }) => {
    if (!config.forms.submit) test.skip(true, 'SUBMIT_FORMS not enabled — skipping real affiliate-survey submission');
    console.log('📍 PESITE-1066: Full multi-step submit');
    if (!(await survey.isReady())) test.skip(true, 'Survey form not present');

    const steps = await survey.stepThrough();
    console.log(`  advanced ${steps} step(s)`);
    await survey.clickSubmit();
    await page.waitForTimeout(2500);

    const success = await survey.hasSuccessConfirmation();
    const gate = await survey.recaptchaPresent();
    console.log(`  success: ${success} | reCAPTCHA gate: ${gate}`);
    expect(success || gate, 'Expect confirmation or reCAPTCHA gate after submit').toBeTruthy();
    console.log('✅ Multi-step submit path exercised');
  });
});
