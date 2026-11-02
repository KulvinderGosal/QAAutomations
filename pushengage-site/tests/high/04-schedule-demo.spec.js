/**
 * Test Suite: HIGH - Schedule a Demo
 * Test ID Prefix: PESITE-104x
 * Priority: HIGH
 * Feature: DEMO REQUEST / LEAD CAPTURE
 *
 * Covers the /schedule_demo/ page (since 2026-10: a 3-page WPForms wizard, see the
 * "2026-10 demo wizard" note below; all checks stay on step 1):
 *  - Demo page loads
 *  - Demo form is present with required fields + Continue + (last-page) submit
 *  - Empty Continue shows WPForms validation errors
 *  - Invalid email shows a validation error
 *  - Valid data fills cleanly with no field errors (ready to continue)
 *  - Anti-spam protection is present (reCAPTCHA or the WPForms anti-spam token)
 *  - (Gated) full fill + submit — refused (GUARDRAIL) even with SUBMIT_FORMS=true
 *
 * SAFETY: A real submit emails the PushEngage sales team, so it is OFF by
 * default. Set SUBMIT_FORMS=true (ideally with TEST_ENV=staging) to enable it.
 * Even when enabled, the live reCAPTCHA cannot be solved by automation
 * (we never bypass CAPTCHAs), so the test asserts either a success confirmation
 * OR that the form correctly halted at the reCAPTCHA challenge.
 */

const { test, expect } = require('@playwright/test');
const SchedulePage = require('../../pages/SchedulePage');
const config = require('../../utils/config');
const { BlockedError } = require('../../../packages/qa-core/errors.ts');

// ── 2026-10 demo wizard ───────────────────────────────────────────────────────
// /schedule_demo/ is now a 3-page WPForms wizard (form 28814, prod 2026-10-20):
//   page 1 "Tell us where to start": Work email*, First/Last name*, Company website*,
//          optional agenda, Continue
//   page 2 "Help us prepare your call": role / sessions / mobile-app selects
//   page 3 "Pick your time": Calendly + "Send my preferred time" submit
// SchedulePage (Name/City/Country) targets the retired form, so the tests below
// use wizard locators. SAFETY: never leave page 1. Once page 3 is visible the
// wizard's pagehide handler auto-submits a REAL demo request (fetch keepalive).
function demoWizard(page) {
  return page.locator('form.wpforms-form').filter({ has: page.locator('.wpforms-page-1') }).first();
}

/**
 * Read-only guard: abort every non-GET request from this page and record it, so
 * nothing typed into the demo form can leave the browser (WPForms submit /
 * analytics snapshots / lead beacons all POST to admin-ajax.php).
 */
async function blockWrites(page) {
  const writes = [];
  await page.route('**/*', (route) => {
    const req = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.continue();
    // Record the action name + "carried field data?" only (never values).
    const body = req.postData();
    const action = (body && (/name="action"\r?\n\r?\n([^\r\n]*)/.exec(body) || [])[1])
      || (body && new URLSearchParams(body).get('action')) || new URL(req.url()).searchParams.get('action') || '';
    writes.push({
      what: `${req.method()} ${req.url().split('?')[0]}${action ? ` (${action.slice(0, 40)})` : ''}`,
      action,
      fieldData: body !== null && /wpforms(?:\[|%5B)fields(?:\]|%5D)|(?:^|&)email=|name="email"/i.test(body),
      bodyReadable: body !== null,
    });
    return route.abort();
  });
  return writes;
}

/**
 * Aborted writes that look like a submission: a submit/lead action, a body carrying
 * form-field data, or a body Playwright could not read. Validated live 2026-10-21:
 * WPForms POSTs `wpforms_get_token` (urlencoded, no fields) to admin-ajax on focus
 * when the cached anti-spam token is stale — that is expected noise, not a submit.
 */
function submissionAttempts(writes) {
  return writes
    .filter((w) => /^(?:wpforms_submit|lindris_contact)$/.test(w.action) || w.fieldData || !w.bodyReadable)
    .map((w) => w.what);
}

test.describe('HIGH - Schedule a Demo', () => {
  let demo;

  test.beforeEach(async ({ page }) => {
    demo = new SchedulePage(page);
    await demo.open();
  });

  test('PESITE-1041 - Schedule-demo page loads @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1041: Demo page loads');
    const title = await demo.getTitle();
    console.log(`  Title: "${title}"`);
    expect(page.url()).toContain('schedule_demo');
    expect(title.toLowerCase()).toContain('demo');
    console.log('✅ Demo page loaded');
  });

  test('PESITE-1042 - Demo form is present with required fields + submit @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1042: Demo form readiness (wizard)');
    // Validated live 2026-10-21: SchedulePage.isFormReady() looks for the RETIRED
    // Name/City/Country form, so it is false on the current 3-page wizard. Check the
    // wizard instead: step-1 required fields, the Continue control, and the final
    // Submit (on page 3, so only attached — never reached; see the SAFETY note above).
    const form = demoWizard(page);
    await expect(form, 'Demo wizard form should render on /schedule_demo/').toBeVisible();
    const step1 = form.locator('.wpforms-page-1');
    for (const [name, sel] of [
      ['Work email', 'input[type="email"]'],
      ['First name', 'input.wpforms-field-name-first'],
      ['Last name', 'input.wpforms-field-name-last'],
      ['Company website', 'input[type="url"]'],
    ]) {
      const el = step1.locator(sel).first();
      await expect(el, `${name} should be on step 1`).toBeVisible();
      await expect(el, `${name} should be required`).toHaveAttribute('required', '');
    }
    await expect(step1.locator('.wpforms-page-next'), 'Step 1 should expose a Continue control').toBeVisible();
    const submit = form.locator('button.wpforms-submit, button[type="submit"]').first();
    await expect(submit, 'The wizard should carry a Submit button (on its last page)').toBeAttached();
    const label = ((await submit.textContent()) || '').trim();
    console.log(`  Submit button (last page, not reached): "${label}"`);
    console.log('✅ Demo wizard present with required step-1 fields + Continue + Submit');
  });

  test('PESITE-1043 - Empty submit shows validation errors @high', async ({ page }) => {
    console.log('📍 PESITE-1043: Empty-submit validation (wizard step 1)');
    const writes = await blockWrites(page);
    const form = demoWizard(page);
    await expect(form, 'Demo wizard form should render on /schedule_demo/').toBeVisible();
    const step1 = form.locator('.wpforms-page-1');
    const step2 = form.locator('.wpforms-page-2');
    const cont = step1.locator('.wpforms-page-next');
    await expect(cont, 'Step 1 should expose a Continue control').toBeVisible();
    expect(await step1.locator('input.wpforms-field-required').count(), 'Step 1 should mark its fields required').toBeGreaterThan(0);

    // Continue with nothing filled. The server renders Continue `disabled` and WPForms
    // enables every page button once its JS is ready (live 2026-10-21: enabled). A
    // Continue that never enables means the wizard is broken (nobody can proceed), so
    // that is a failure, not a "gated" pass.
    await expect(cont, 'WPForms should enable Continue once its JS is ready').toBeEnabled({ timeout: 15000 });
    await cont.click();
    await expect(step1.locator('.wpforms-error').filter({ visible: true }).first(),
      'Empty Continue should flag the required step-1 fields').toBeVisible();
    await expect(step1, 'Wizard should stay on step 1').toBeVisible();
    await expect(step2, 'Wizard must not advance to step 2 with empty required fields').toBeHidden();
    if (writes.length) test.info().annotations.push({ type: 'aborted-writes', description: writes.map((w) => w.what).join(', ') });
    expect(submissionAttempts(writes), 'Nothing should be submitted while validating an empty step').toEqual([]);
    console.log('✅ Empty step 1 is rejected (validation errors shown)');
  });

  test('PESITE-1044 - Invalid email shows validation error @high', async ({ page }) => {
    console.log('📍 PESITE-1044: Invalid-email validation (wizard step 1)');
    // Reviewed 2026-10-21: the old body used SchedulePage (retired Name/City/Country form):
    // it skipped if no email field, its clickSubmit() found no visible Submit on the wizard
    // (no-op), and it counted ANY visible error on the page. Now: wizard locators, blur via
    // Tab (never Enter: WPForms maps Enter to Continue), and the email field's own error.
    const writes = await blockWrites(page);
    const form = demoWizard(page);
    await expect(form, 'Demo wizard form should render on /schedule_demo/').toBeVisible();
    const step1 = form.locator('.wpforms-page-1');
    const email = step1.locator('input[type="email"]');
    await expect(email, 'Work email should be on step 1').toBeVisible();
    await email.fill('not-an-email');
    await email.press('Tab');

    const emailError = step1.locator('.wpforms-field-email').locator('em.wpforms-error, label.wpforms-error').first();
    await expect(emailError, 'Invalid email should show a validation error on the email field').toBeVisible();
    console.log(`  Email error: "${((await emailError.textContent()) || '').trim()}"`);
    await expect(email, 'The email input should be flagged invalid').toHaveAttribute('aria-invalid', 'true');
    await expect(form.locator('.wpforms-page-2'), 'Wizard must not advance').toBeHidden();
    if (writes.length) test.info().annotations.push({ type: 'aborted-writes', description: writes.map((w) => w.what).join(', ') });
    expect(submissionAttempts(writes), 'Nothing should be submitted while validating the email').toEqual([]);
    await form.evaluate((f) => f.reset());
    console.log('✅ Invalid-email validation fires');
  });

  test('PESITE-1045 - Valid data fills cleanly, form ready to submit @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1045: Valid fill of wizard step 1 — no field errors (never advances)');
    const writes = await blockWrites(page);
    const form = demoWizard(page);
    await expect(form, 'Demo wizard form should render on /schedule_demo/').toBeVisible();
    const step1 = form.locator('.wpforms-page-1');
    // RFC-2606 data only (config.forms.demo.email defaults to a real inbox; never type it on production).
    const data = { ...config.forms.demo, email: 'qa-demo@example.com', website: 'https://example.com' };
    const [first, ...rest] = String(data.name).split(' ');
    const email = step1.locator('input[type="email"]');
    const firstName = step1.locator('input.wpforms-field-name-first');
    const lastName = step1.locator('input.wpforms-field-name-last');
    const website = step1.locator('input[type="url"]');
    await email.fill(data.email);
    await firstName.fill(first);
    await lastName.fill(rest.join(' ') || 'Test');
    await website.fill(data.website);
    await website.blur();

    await expect(email).toHaveValue(data.email);
    await expect(firstName).toHaveValue(first);
    await expect(website).toHaveValue(data.website);
    await expect(step1.locator('.wpforms-error').filter({ visible: true }), 'Valid step-1 data should leave no field errors').toHaveCount(0);
    // Ready to continue, but do NOT click: reaching page 3 auto-submits a real request.
    await expect(step1.locator('.wpforms-page-next'), 'Continue should be enabled once step 1 is valid').toBeEnabled();
    if (writes.length) test.info().annotations.push({ type: 'aborted-writes', description: writes.map((w) => w.what).join(', ') });
    expect(submissionAttempts(writes), 'Nothing typed on step 1 should be sent (no submit, no field data)').toEqual([]);
    console.log('✅ Valid step-1 data accepted; Continue enabled (not clicked)');
  });

  test('PESITE-1046 - reCAPTCHA anti-spam protection present @high', async ({ page }) => {
    console.log('📍 PESITE-1046: anti-spam protection present on demo form');
    const form = demoWizard(page);
    await expect(form, 'Demo wizard form should render on /schedule_demo/').toBeVisible();
    // The old check skipped whenever reCAPTCHA was missing, so it could never fail.
    // Production 2026-10-20 (form 28814) has NO reCAPTCHA; its protection is the
    // WPForms anti-spam token (form[data-token]). Assert that SOME protection exists.
    const captchas = await page.locator('.g-recaptcha, iframe[src*="recaptcha"], .cf-turnstile, iframe[src*="challenges.cloudflare.com"], .h-captcha, iframe[src*="hcaptcha"]').count();
    const token = (await form.getAttribute('data-token')) || '';
    console.log(`  CAPTCHA widgets: ${captchas} | WPForms anti-spam token: ${token ? 'present' : 'absent'}`);
    if (!captchas) {
      test.info().annotations.push({ type: 'note', description: 'No reCAPTCHA on the demo wizard (form 28814) since the 2026-10 rebuild; protection = WPForms anti-spam token. Dev to confirm reCAPTCHA was dropped on purpose.' });
    }
    expect(captchas > 0 || token.length > 0, 'Demo form should carry anti-spam protection (reCAPTCHA/Turnstile/hCaptcha or the WPForms anti-spam token)').toBeTruthy();
    console.log(`✅ Anti-spam present (${captchas ? 'CAPTCHA widget' : 'WPForms token only'})`);
  });

  test('PESITE-1047 - Full fill + submit (gated by SUBMIT_FORMS) @high', async ({ page }) => {
    if (!config.forms.submit) {
      test.skip(true, 'SUBMIT_FORMS not enabled — skipping real demo submission (avoids emailing sales)');
    }
    console.log('📍 PESITE-1047: Real demo submission requested (SUBMIT_FORMS=true)');
    const form = demoWizard(page);
    await expect(form, 'Demo wizard form should render on /schedule_demo/').toBeVisible();
    // The demo form is now a wizard whose last page is a Calendly booking, and
    // reaching that page auto-submits a real demo request on pagehide. A full
    // submit books a real sales call in ANY environment, so it is refused even
    // with SUBMIT_FORMS=true. Step-1 behaviour is covered by PESITE-1043/1045.
    throw new BlockedError({
      cls: 'GUARDRAIL',
      code: 'real-demo-booking',
      reason: 'Full demo submit = 3-page wizard ending in a Calendly booking (page 3 auto-submits on pagehide); automation never reaches page 3',
      humanAction: 'verify the demo booking manually, or ask dev for a sandbox form/Calendly event before automating it',
    });
  });
});
