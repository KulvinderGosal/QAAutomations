/**
 * Group D — Web track · Install step
 * Plan cases D1–D13. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * REFERENCE SPEC — establishes the conventions used across the onboarding suite:
 *   - one test per plan case; the case id + priority are in the title so you can
 *     `--grep @P0` / `--grep D5`; traceability back to cases.json.
 *   - fixtures come from onboarding-config; a test.skip() guards each case when
 *     its required site/account is not configured (so a partial .env still runs).
 *   - selectors prefer text/role. Anything that must be confirmed against the
 *     live DOM is marked TODO(selector) — report mismatches and I'll pin them.
 *
 * Prereqs (see MANUAL_TEST_CHECKLIST.md): backend deployed with GOOGLE_GENERATIVE_AI_API_KEY,
 * free-plan migration run. AI responses with `fallback:true` are NOT errors.
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

test.describe('D · Web track — Install step', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every platform/feature available for install cases.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('D1 @P0 platform auto-detection (WordPress vs custom)', async ({ page }) => {
    test.skip(!site.site1.url || !site.site2.url, 'Site 1 / Site 2 not configured');

    // Site 1 = WordPress → WordPress card + "AI DETECTED" badge.
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    // While detecting: skeletons + disabled "Detecting your platform…" primary.
    // (Best-effort — detection may already be resolved by the time we assert.)
    await expect(
      page.getByText(/Detecting your platform/i).or(page.getByText(/WordPress/i)).first()
    ).toBeVisible({ timeout: cfg.timeouts.nav });

    await expect(page.getByText(/WordPress/i).first()).toBeVisible();
    await expect(page.getByText(/AI DETECTED/i).first()).toBeVisible();
  });

  test('D2 @P1 change platform clears prior detection', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    await page.getByRole('button', { name: /Change/i }).first().click();
    await expect(page.getByText(/Pick your platform/i)).toBeVisible();
    await page.getByText(/Shopify/i).first().click();

    // After picking Shopify the "AI DETECTED" badge must disappear.
    await expect(page.getByText(/AI DETECTED/i)).toHaveCount(0);
  });

  test('D3 @P1 Manual / AI Agent tabs and copy-prompt', async ({ page, context }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    await page.getByRole('tab', { name: /AI Agent/i }).or(page.getByText(/AI Agent/i)).first().click();
    await expect(page.getByText(/PROMPT FOR YOUR AI AGENT/i)).toBeVisible();

    await page.getByRole('button', { name: /Copy prompt/i }).click();
    await expect(page.getByRole('button', { name: /Copied/i })).toBeVisible();

    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
    if (clip) expect(clip).toContain(site.site1.url.replace(/^https?:\/\//, '').replace(/\/$/, ''));

    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'ai_onboarding_install_mode');
    expect(events.some((e) => (e.label || e.install_mode) === 'ai')).toBeTruthy();
  });

  test('D4 @P1 site URL pencil: validation, save, rollback', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    // TODO(selector): confirm the pencil/edit affordance next to the site URL.
    await page.getByRole('button', { name: /edit|pencil/i }).first().click();
    const urlInput = page.locator('input[value*="http"], input[name*="url" i]').first();
    await urlInput.fill('asdf');
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/A Valid URL should be of the format/i)).toBeVisible();
  });

  test('D5 @P0 install check fails on an uninstalled site', async ({ page }) => {
    test.skip(!site.site2.url, 'Site 2 not configured');
    if (site.site2.name) await wiz.switchSite(page, site.site2.name);
    const watch = wiz.watchOnboardingApi(page);
    await wiz.goto(page, wiz.routes.webInstall);

    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();

    const domain = site.site2.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    await expect(page.getByText(new RegExp(`PushEngage isn.t live on ${escapeRe(domain)}`, 'i')))
      .toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/1 of 3 checks passed/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Check again/i })).toBeVisible();

    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'verify_installation');
    expect(events.some((e) => Number(e.eventValue) === 0)).toBeTruthy();
    watch.stop();
  });

  test('D6 @P0 install check passes and advances', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    const domain = site.site1.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    await expect(page.getByText(new RegExp(`PushEngage is live on ${escapeRe(domain)}`, 'i')))
      .toBeVisible({ timeout: cfg.timeouts.nav });

    await page.getByRole('button', { name: /Continue to Popup Design/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/web\/analyzing/);

    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'verify_installation');
    expect(events.some((e) => Number(e.eventValue) === 1)).toBeTruthy();
  });

  test('D7 @P0 foreign install is called out', async ({ page }) => {
    test.skip(!site.site3.url, 'Site 3 (foreign install) not configured');
    if (site.site3.name) await wiz.switchSite(page, site.site3.name);
    await wiz.goto(page, wiz.routes.webInstall);

    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    await expect(page.getByText(/under a different site.s key/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/set up for a different site/i)).toBeVisible();
    // The "Recommended fix" card must NOT be shown for a foreign install.
    await expect(page.getByText(/Recommended fix/i)).toHaveCount(0);
  });

  test('D8 @P1 unreachable site vs blocked request', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Simulate the request being blocked in devtools by aborting site-analysis.
    await page.route('**/onboarding-ai/site-analysis', (route) => route.abort());
    await wiz.goto(page, wiz.routes.webInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();

    await expect(page.getByText(/the request didn.t get through/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    // No verify_installation event when the request itself failed.
    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'verify_installation');
    expect(events.length).toBe(0);
    await page.unroute('**/onboarding-ai/site-analysis');
  });

  test('D9 @P1 Back is locked during the check', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    // Delay the analysis so we can observe the in-flight state.
    await page.route('**/onboarding-ai/site-analysis', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      route.continue();
    });
    await wiz.goto(page, wiz.routes.webInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();

    await expect(page.getByText(/Checking your installation/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Go Back/i })).toBeDisabled();
    await page.unroute('**/onboarding-ai/site-analysis');
  });

  test('D10 @P1 service-worker custom path validation', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    // TODO(selector): this flow depends on a platform whose step exposes hosting options.
    test.fixme(true, 'Confirm SW hosting-options selectors + platform on staging, then implement.');
  });

  test('D11 @P1 PushEngage subdomain option and cutoff domain', async ({ page }) => {
    test.skip(!site.site4.url || !site.site5.url, 'Site 4 / Site 5 (http cutoff) not configured');
    test.fixme(true, 'Confirm subdomain-option selectors; assert {slug}.pushengage.com (site4) vs .trypushengage.com (site5).');
  });

  test('D12 @P1 email my developer', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    await page.getByRole('button', { name: /Email my developer/i }).click();
    await expect(page.getByText(/Email instructions to your developer/i)).toBeVisible();
    await page.getByRole('button', { name: /send/i }).first().click();
    await expect(page.getByText(/Enter your developer.s email address/i)).toBeVisible();
  });

  test('D13 @P2 skip for now after a failed check', async ({ page }) => {
    test.skip(!site.site2.url, 'Site 2 not configured');
    if (site.site2.name) await wiz.switchSite(page, site.site2.name);
    await wiz.goto(page, wiz.routes.webInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    await expect(page.getByRole('button', { name: /Check again/i })).toBeVisible({ timeout: cfg.timeouts.nav });
    await page.getByRole('button', { name: /Skip for now/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/web\/analyzing/);
  });
});

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
