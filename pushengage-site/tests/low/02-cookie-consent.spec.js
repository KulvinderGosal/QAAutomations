/**
 * Test Suite: LOW - Cookie Consent / GDPR Banner
 * Test ID Prefix: PESITE-302x
 * Priority: LOW
 * Feature: GDPR / COOKIE COMPLIANCE
 *
 * Covers:
 *  - Cookie banner appears on first visit
 *  - Banner has Accept / Decline options
 *  - Accepting dismisses the banner
 *  - Banner does not reappear after accepting (using storage state)
 *  - Declining also dismisses the banner
 *
 * 2026-10-20: rewritten for the WPConsent banner (see notes below the imports).
 */

const { test, expect } = require('@playwright/test');

// ── WPConsent banner (production, 2026-10-20) ─────────────────────────────────
// The banner is cloned from <template id="wpconsent-template"> into an OPEN shadow
// root on #wpconsent-container (Playwright CSS pierces it). Shown state =
// #wpconsent-banner-holder.wpconsent-banner-visible; buttons #wpconsent-accept-all
// ("Accept") and #wpconsent-cancel-all ("Reject"). The consent choice is stored in
// the wpconsent_preferences cookie. Settings: geolocation disabled, consent_type
// optin, records_of_consent on.
//
// The old findCookieBanner() took .first() of loose selectors ([id*="cookie"] hits
// the hidden #cookie-category-essential checkbox in the preferences modal) and
// skipped whenever that first match was hidden, so these tests never executed.
//
// SAFETY / read-only:
//  - WPConsent POSTs every choice to /wp-json/wpconsent/v1/log-consent (a consent
//    record). The tests stub that call locally, so no record is written anywhere.
//  - On production the dismiss/persist tests exercise "Reject" (privacy-preserving:
//    it keeps statistics/marketing scripts blocked); on other envs, or with
//    PESITE_COOKIE_CHOICE=accept, they exercise "Accept". Both run the same
//    savePreferences → cookie → hideBanner path.
const IS_PRODUCTION = (process.env.TEST_ENV || 'production') === 'production';
const CHOICE = process.env.PESITE_COOKIE_CHOICE === 'accept' || !IS_PRODUCTION ? 'accept' : 'reject';
const CHOICE_BUTTON = CHOICE === 'accept' ? '#wpconsent-accept-all' : '#wpconsent-cancel-all';

/** Fresh visit to the homepage with the consent-log write stubbed; returns the banner locator. */
async function openFresh(page, context) {
  await context.clearCookies();
  await page.route('**/wp-json/wpconsent/v1/log-consent**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // #wpconsent-root is server-rendered: missing = no consent banner at all.
  const hasRoot = (await page.locator('#wpconsent-root').count()) > 0;
  test.skip(!hasRoot && !IS_PRODUCTION, 'WPConsent is not installed on this environment (staging has no cookie banner; production does) — run with TEST_ENV=production.');
  await expect(page.locator('#wpconsent-root'), 'WPConsent (#wpconsent-root) should be rendered on the homepage').toBeAttached();
  return page.locator('#wpconsent-banner-holder');
}

// The holder is a 0x0 wrapper (its .wpconsent-banner child is the fixed-position panel), so
// Playwright always reports the holder itself as hidden — even while the banner is on screen
// (validated live 2026-10-21: holder had wpconsent-banner-visible, panel visible, holder "hidden").
// Visibility is therefore judged on the panel; the shown/closed STATE on the holder's class.
const panelOf = (banner) => banner.locator('.wpconsent-banner');

/** Wait for the banner to show on a fresh visit (skip only if WPConsent is geo-gating it). */
async function expectBannerShown(page, banner) {
  const shown = await expect(panelOf(banner)).toBeVisible({ timeout: 15000 }).then(() => true, () => false);
  if (!shown) {
    const geo = await page.evaluate(() => !!(window.wpconsent && window.wpconsent.geolocation && window.wpconsent.geolocation.enabled)).catch(() => false);
    test.skip(geo, 'WPConsent geolocation is enabled and does not show the banner to this runner location — geo-gated, not a defect.');
  }
  await expect(panelOf(banner), 'Cookie consent banner should be visible on a fresh visit').toBeVisible();
  await expect(banner).toHaveClass(/wpconsent-banner-visible/);
}

/** Make the consent choice and assert the banner closes + the choice is stored. */
async function chooseAndAssertDismissed(page, context, banner) {
  // Belt and braces with the route stub (keepalive fetches can bypass routing):
  // switch off WPConsent's consent-record POST for this page before choosing.
  await page.evaluate(() => { if (window.wpconsent) window.wpconsent.records_of_consent = '0'; });
  const btn = banner.locator(CHOICE_BUTTON);
  await expect(btn, `Cookie banner should offer ${CHOICE === 'accept' ? 'Accept' : 'Reject'}`).toBeVisible();
  await btn.click();
  await expect(panelOf(banner), `Banner should close after choosing ${CHOICE}`).toBeHidden();
  await expect(banner, 'The banner holder should drop its visible state').not.toHaveClass(/wpconsent-banner-visible/);
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === 'wpconsent_preferences'),
    { message: 'The consent choice should be stored in the wpconsent_preferences cookie' }).toBe(true);
}

test.describe('LOW - Cookie Consent / GDPR Banner', () => {

  test('PESITE-3021 - Cookie consent banner appears on fresh visit @low', async ({ page, context }) => {
    console.log('📍 PESITE-3021: Cookie banner on fresh visit');
    const banner = await openFresh(page, context);
    await expectBannerShown(page, banner);
    console.log('✅ Cookie consent banner is displayed on first visit');
  });

  test('PESITE-3022 - Cookie banner has Accept button @low', async ({ page, context }) => {
    console.log('📍 PESITE-3022: Cookie banner has Accept option');
    const banner = await openFresh(page, context);
    await expectBannerShown(page, banner);

    const accept = banner.locator('#wpconsent-accept-all');
    await expect(accept, 'Cookie banner should have an Accept button').toBeVisible();
    await expect(accept).toHaveText(/accept/i);
    const reject = banner.locator('#wpconsent-cancel-all');
    console.log(`  Accept: "${((await accept.textContent()) || '').trim()}" | Reject visible: ${await reject.isVisible()}`);
    console.log('✅ Cookie banner has Accept button (not clicked)');
  });

  test('PESITE-3023 - Accepting cookies dismisses the banner @low', async ({ page, context }) => {
    console.log(`📍 PESITE-3023: consent choice dismisses cookie banner (exercising: ${CHOICE})`);
    test.info().annotations.push({ type: 'consent-choice', description: CHOICE === 'accept' ? 'Accept clicked' : 'production: Reject clicked (privacy-preserving; same dismiss path as Accept). Set PESITE_COOKIE_CHOICE=accept to click Accept.' });
    const banner = await openFresh(page, context);
    await expectBannerShown(page, banner);
    await chooseAndAssertDismissed(page, context, banner);
    console.log(`✅ Cookie banner dismissed after choosing ${CHOICE}`);
  });

  test('PESITE-3024 - Cookie banner does not reappear after accepting @low', async ({ page, context }) => {
    console.log(`📍 PESITE-3024: banner does not reappear after a consent choice (exercising: ${CHOICE})`);
    test.info().annotations.push({ type: 'consent-choice', description: CHOICE === 'accept' ? 'Accept clicked' : 'production: Reject clicked (privacy-preserving; same persist path as Accept). Set PESITE_COOKIE_CHOICE=accept to click Accept.' });
    const banner = await openFresh(page, context);
    await expectBannerShown(page, banner);
    await chooseAndAssertDismissed(page, context, banner);

    // Reload — WPConsent must read the stored choice and keep the banner closed.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(banner, 'WPConsent should re-initialise after reload').toBeAttached({ timeout: 15000 });
    // WPConsent un-hides #wpconsent-container when its CSS loads and decides banner
    // display in the same tick, so wait for that before judging "hidden".
    await page.waitForFunction(() => {
      const c = document.getElementById('wpconsent-container');
      return !!c && c.style.display === 'block';
    }, null, { timeout: 15000 });
    await expect(panelOf(banner), 'Cookie banner should not reappear after the user made a choice').toBeHidden();
    await expect(banner).not.toHaveClass(/wpconsent-banner-visible/);
    console.log('✅ Cookie banner does not reappear after a consent choice');
  });
});
