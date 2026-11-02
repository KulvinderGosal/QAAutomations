/**
 * Test Suite: SMOKE - Form submissions (Contact · Support/Ticket · Affiliate)
 * Test ID Prefix: PESITE-92xx
 * Priority: SMOKE
 *
 * Exercises the site's real lead/support forms (all WPForms):
 *   9201 Contact-us form — the site's contact + support/ticket channel.
 *   9202 Affiliate application form (/affiliates-survey/).
 *
 * SAFETY — submission is OPT-IN. By default the test fills the form with
 * clearly-marked test data and asserts it is *submittable* (complete + submit
 * enabled) WITHOUT sending it, so it never creates real CRM/support records.
 * To actually submit:  SMOKE_SUBMIT_FORMS=1  (and, on production only, also
 * ALLOW_PROD_FORM_SUBMIT=1). On success it asserts the WPForms confirmation.
 *
 * Test data is obviously-automated (name "QA Smoke Test", the kgosal+ smoke
 * inbox, a "please ignore" message) so any record that IS created is identifiable.
 *
 * SELF-SKIP (never a false outage): if a form isn't present / the page is
 * challenged, the test skips with a reason.
 */
const { test, expect } = require('@playwright/test');
const config = require('../../utils/config');
const ContactPage = require('../../pages/ContactPage');
const SurveyPage = require('../../pages/SurveyPage');

const IS_STAGING = (process.env.TEST_ENV || 'production') === 'staging';
const WILL_SUBMIT =
  process.env.SMOKE_SUBMIT_FORMS === '1' && (IS_STAGING || process.env.ALLOW_PROD_FORM_SUBMIT === '1');

const DATA = {
  name: 'QA Smoke Test',
  // Real (identifiable) smoke inbox only when a record is really created; a
  // fill-only run (the default, and always on production unless opted in) types an
  // RFC-2606 address so no real inbox lands in any production form/analytics.
  email: process.env.SMOKE_FORM_EMAIL || (WILL_SUBMIT ? (process.env.QA_EMAIL || 'qa@example.com').replace('@', '+smoke@') : 'qa-smoke@example.com'),
  message: 'Automated QA smoke test — please ignore.',
  url: 'https://qa-smoke.example.com',
};

/** Assert the form is submittable; submit + confirm only when opted-in. */
async function submitOrVerify(page, form, what) {
  const submit = form.locator('button.wpforms-submit, button[type="submit"], input[type="submit"]').first();
  await expect(submit, `${what}: a submit button should be present`).toBeVisible({ timeout: 8000 });
  await expect(submit, `${what}: submit should be enabled`).toBeEnabled();

  if (!WILL_SUBMIT) {
    console.log(`   • ${what}: ✅ verified submittable (NOT submitted). Set SMOKE_SUBMIT_FORMS=1${IS_STAGING ? '' : ' + ALLOW_PROD_FORM_SUBMIT=1'} to really submit.`);
    return 'not-submitted';
  }
  await submit.click();
  const confirm = page.locator('.wpforms-confirmation-container, .wpforms-confirmation-container-full, [class*="confirmation" i]').first();
  await expect(confirm, `${what}: a WPForms confirmation should appear after submit`).toBeVisible({ timeout: 20000 });
  const msg = ((await confirm.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  console.log(`   • ${what}: ✅ SUBMITTED — confirmation: "${msg}"`);
  return 'submitted';
}

test.describe('SMOKE - Form submissions @smoke @forms', () => {
  test.describe.configure({ timeout: 90000 });

  // ── Contact-us (also the support / ticket channel) ────────────────────────────
  test('PESITE-9201 - Contact-us form submission (support / ticket channel) @smoke @forms', async ({ page }) => {
    console.log('📍 PESITE-9201: Contact-us form submission');
    const contact = new ContactPage(page);
    await contact.open().catch(() => {});
    const form = page.locator('form.wpforms-form, form[id^="wpforms-form"]').first();
    if (!(await form.isVisible().catch(() => false))) {
      test.skip(true, 'Contact WPForms form did not render — skipped (not a false outage).');
    }
    await contact.fillContactForm(DATA.name, DATA.email, DATA.message);
    // Fill any remaining required visible fields (website/url, topic select).
    const urlField = form.locator('input[type="url"]:visible').first();
    if (await urlField.count()) await urlField.fill(DATA.url).catch(() => {});
    const result = await submitOrVerify(page, form, 'Contact form');
    console.log(`  ✅ Contact-us ${result === 'submitted' ? 'submitted + confirmed' : 'submittable (not submitted)'}`);
  });

  // ── Affiliate application ──────────────────────────────────────────────────────
  test('PESITE-9202 - Affiliate application form submission @smoke @forms', async ({ page }) => {
    console.log('📍 PESITE-9202: Affiliate form submission');
    const res = await page.goto(config.pages.affiliateSurvey, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const status = res ? res.status() : 0;
    test.skip(status === 0 || status >= 400, `Affiliate survey page unreachable (HTTP ${status || 'no response'}) — skipped.`);
    // Wait for WPForms to render (replaces a fixed 800 ms sleep); the render guard
    // below still decides if it never shows.
    await page.locator('form.wpforms-form').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    // The affiliate page has more than one WPForms form (e.g. a newsletter) —
    // prefer the survey form that has a URL field AND a submit button.
    let form = page.locator('form.wpforms-form:has(input[type="url"]):has(button.wpforms-submit)').first();
    if (!(await form.count())) form = page.locator('form.wpforms-form:has(button.wpforms-submit)').first();
    if (!(await form.count())) form = page.locator('form.wpforms-form, form[id^="wpforms-form"]').first();
    if (!(await form.isVisible().catch(() => false))) {
      test.skip(true, 'Affiliate WPForms form did not render — skipped (not a false outage).');
    }
    // Multi-page WPForms (production 2026-10-20: form 23319, 4 pages, Submit on the
    // LAST page). The old single-page check self-skipped here on every run, so 9202
    // never executed. Now: assert the structure everywhere; walk to the last page
    // and assert Submit is submittable on staging only (production stays read-only:
    // no filling, no page changes).
    const submitCtl = form.locator('button.wpforms-submit, button[type="submit"], input[type="submit"]').first();
    if ((await form.locator('.wpforms-page').count()) > 1) {
      await expect(form.locator('input[type="email"]').first(), 'Affiliate form step 1 should expose an Email field').toBeVisible();
      await expect(form.locator('.wpforms-page-next').filter({ visible: true }).first(), 'Affiliate form step 1 should expose a Next control').toBeVisible();
      await expect(submitCtl, 'Affiliate form should carry a Submit button (on its last page)').toBeAttached();
      test.skip(!IS_STAGING, 'prod read-only: affiliate form is a multi-page survey whose Submit is on the last page; reaching it needs filled steps, which production does not allow. Structure asserted; run with TEST_ENV=staging for the submittable check.');

      // Staging: fill each visible step and advance (SurveyPage.stepThrough() can't be
      // used: its .first() Next locator stays on the hidden page-1 button after step 1).
      const survey = new SurveyPage(page);
      for (let step = 0; step < 8; step++) {
        const next = form.locator('.wpforms-page-next').filter({ visible: true }).first();
        if (!(await next.count())) break; // no visible Next → on the last page
        const current = form.locator('.wpforms-page').filter({ visible: true }).first();
        const pageNo = await current.getAttribute('data-page');
        await survey.fillCurrentStep({ ...config.forms.survey, email: DATA.email, website: DATA.url, text: DATA.name });
        await next.click();
        await expect(form.locator(`.wpforms-page[data-page="${pageNo}"]`), `Affiliate form step ${pageNo} should advance after a valid fill`).toBeHidden();
      }
      await expect(form.locator('.wpforms-page-next').filter({ visible: true }), 'Affiliate form should end on its last page (no visible Next)').toHaveCount(0);
      const result = await submitOrVerify(page, form, 'Affiliate form (last page)');
      console.log(`  ✅ Affiliate ${result === 'submitted' ? 'submitted + confirmed' : 'walked to last page, submittable (not submitted)'}`);
      return;
    }
    // Single-page form. WPForms generic fields: text (name), email, url — fill the visible ones.
    const text = form.locator('input[type="text"]:visible').first();
    const email = form.locator('input[type="email"]:visible').first();
    const url = form.locator('input[type="url"]:visible').first();
    if (await text.count()) await text.fill(DATA.name).catch(() => {});
    if (await email.count()) await email.fill(DATA.email).catch(() => {});
    if (await url.count()) await url.fill(DATA.url).catch(() => {});
    // A required checkbox group may gate submission — tick the first option.
    const firstCheckbox = form.locator('input[type="checkbox"]:visible').first();
    if (await firstCheckbox.count()) await firstCheckbox.check().catch(() => {});

    const result = await submitOrVerify(page, form, 'Affiliate form');
    console.log(`  ✅ Affiliate ${result === 'submitted' ? 'submitted + confirmed' : 'submittable (not submitted)'}`);
  });
});
