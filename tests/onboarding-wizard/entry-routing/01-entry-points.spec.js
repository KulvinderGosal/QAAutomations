/**
 * Group B — Entry points and routing
 * Plan cases B1–B11. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * How a user reaches the wizard and how the app frame behaves around it.
 * Conventions follow the reference spec (web-track/01-web-install.spec.js):
 *   - one test per plan case; id + priority live in the title so `--grep @P0`
 *     / `--grep B7` work and the test traces back to cases.json.
 *   - fixtures come from onboarding-config; test.skip() guards each case whose
 *     site/account is not configured, so a partial .env still runs.
 *   - selectors prefer role/text; anything to confirm against the live DOM is
 *     marked TODO(selector). Cases that need state we can't yet reach (a brand
 *     new account, a run advanced to the popup step) are test.fixme with the
 *     robust steps kept as comments.
 *
 * Prereqs (see MANUAL_TEST_CHECKLIST.md): backend deployed with
 * GOOGLE_GENERATIVE_AI_API_KEY, free-plan migration run. AI responses with
 * `fallback:true` are NOT errors.
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

test.describe('B · Entry points and routing', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every platform/feature available for routing cases.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('B1 @P0 Add new site lands directly in the wizard', async ({ page }) => {
    // Creating a site is a real account side effect; use a unique throwaway URL.
    const newUrl = `https://qa-b1-${Date.now()}.example.com`;
    await wiz.goto(page, '/settings/sites');

    // TODO(selector): confirm the "Add new site" trigger + create-modal URL field + submit.
    await page.getByRole('button', { name: /add (new )?site/i }).first().click();
    const urlInput = page.locator('input[name*="url" i], input[placeholder*="url" i], input[type="url"]').first();
    await urlInput.fill(newUrl);
    await page.getByRole('button', { name: /add site|create|save/i }).first().click();

    // No "Site created successfully" modal — navigates straight into the picker.
    await expect(page).toHaveURL(/\/onboarding(\/|$|\?)/, { timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Site created successfully/i)).toHaveCount(0);
    await expect(page.getByText(/What do you want to set up\?/i)).toBeVisible();

    // pe_ai_onboarding_pending_<newId> === "1", and currentSite is the new id.
    const keys = await wiz.readOnboardingKeys(page);
    const pending = Object.entries(keys).find(([k]) => /^pe_ai_onboarding_pending_/.test(k));
    expect(pending && pending[1]).toBe('1');
    const current = await wiz.currentSiteId(page);
    if (pending && current) expect(pending[0]).toContain(String(current));
  });

  test('B2 @P0 Shopify-session account adding a normal site reaches the wizard', async ({ page }) => {
    // This case specifically needs the Shopify-connected account.
    test.skip(!cfg.accounts.shopify.email, 'PE_SHOPIFY_* not configured');
    await auth.login(page, 'shopify');

    const newUrl = `https://qa-b2-${Date.now()}.example.com`;
    await wiz.goto(page, '/settings/sites');
    // TODO(selector): confirm add-site trigger + fields.
    await page.getByRole('button', { name: /add (new )?site/i }).first().click();
    const urlInput = page.locator('input[name*="url" i], input[placeholder*="url" i], input[type="url"]').first();
    await urlInput.fill(newUrl);
    await page.getByRole('button', { name: /add site|create|save/i }).first().click();

    // Lands on the AI picker for the new site, NOT /shopify-onboarding.
    await expect(page).toHaveURL(/\/onboarding(\/|$|\?)/, { timeout: cfg.timeouts.nav });
    await expect(page).not.toHaveURL(/\/shopify-onboarding/);
    await expect(page.getByText(/What do you want to set up\?/i)).toBeVisible();
  });

  test('B3 @P0 Shopify site still goes to Shopify onboarding', async ({ page }) => {
    test.skip(!cfg.accounts.shopify.email, 'PE_SHOPIFY_* not configured');
    await auth.login(page, 'shopify');

    // TODO(selector): ensure the Shopify store is the active site (header SiteSelector).
    // The Shopify-connected account's default site is expected to be the Shopify store.
    await wiz.goto(page, wiz.routes.picker);
    await expect(page).toHaveURL(/\/shopify-onboarding/, { timeout: cfg.timeouts.nav });
    // The AI wizard must never mount for a Shopify site.
    await expect(page.getByText(/What do you want to set up\?/i)).toHaveCount(0);
  });

  test('B4 @P1 Browser Back right after creating a site', async ({ page }) => {
    const newUrl = `https://qa-b4-${Date.now()}.example.com`;
    await wiz.goto(page, '/settings/sites');
    // TODO(selector): confirm add-site trigger + fields.
    await page.getByRole('button', { name: /add (new )?site/i }).first().click();
    const urlInput = page.locator('input[name*="url" i], input[placeholder*="url" i], input[type="url"]').first();
    await urlInput.fill(newUrl);
    await page.getByRole('button', { name: /add site|create|save/i }).first().click();
    await expect(page).toHaveURL(/\/onboarding(\/|$|\?)/, { timeout: cfg.timeouts.nav });

    // Immediately press browser Back → Settings › Sites with the new site selected.
    await page.goBack();
    await wiz.waitForSpa(page);
    await expect(page).toHaveURL(/\/settings\/sites/, { timeout: cfg.timeouts.nav });

    // Dashboard then shows the "{Site name} isn't set up yet" card with Start Setup.
    await wiz.goto(page, '/');
    await expect(page.getByText(/isn.t set up yet/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Start Setup/i }).or(page.getByText(/Start Setup/i)).first()
    ).toBeVisible();
  });

  test('B5 @P1 Failed site create does not navigate', async ({ page }) => {
    const newUrl = `https://qa-b5-${Date.now()}.example.com`;
    // Force the create request to fail with a 4xx (stand-in for hitting the site limit).
    // TODO(selector): confirm the site-create endpoint path/matcher.
    await page.route('**/sites**', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Site limit reached' }),
        });
      }
      return route.continue();
    });

    await wiz.goto(page, '/settings/sites');
    await page.getByRole('button', { name: /add (new )?site/i }).first().click();
    const urlInput = page.locator('input[name*="url" i], input[placeholder*="url" i], input[type="url"]').first();
    await urlInput.fill(newUrl);
    await page.getByRole('button', { name: /add site|create|save/i }).first().click();

    // Error in the modal; stay on Settings › Sites; no navigation to /onboarding.
    await expect(page).not.toHaveURL(/\/onboarding/);
    await expect(page).toHaveURL(/\/settings\/sites/);
    await page.unroute('**/sites**');
  });

  test('B6 @P0 New-user login lands on the new picker', async ({ page }) => {
    test.fixme(
      true,
      'Needs a freshly provisioned account (no sites, first login) — not modeled in onboarding-config. ' +
        'Add a PE_ACCOUNT_NEW_* fixture on staging, then implement.'
    );
    // Steps (once a brand-new account fixture exists):
    //  - await auth.login(page, 'new');
    //  - await expect(page).toHaveURL(/\/onboarding(\/|$)/);
    //  - await expect(page.getByText(/What do you want to set up\?/i)).toBeVisible();
    //  - assert the three channel cards (Web Push / App Push / Chat Widget) render;
    //  - assert none of the classic Step 1 UI appears.
  });

  test('B7 @P1 Deep links: cold step URL and summary guard', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Cold open of a step URL renders the Install step for the current site.
    await wiz.goto(page, wiz.routes.webInstall);
    await expect(page).toHaveURL(/\/onboarding\/web\/install/);
    await expect(
      page.getByRole('button', { name: /Confirm and Check Status/i })
        .or(page.getByText(/Pick your platform|WordPress|Custom Site/i)).first()
    ).toBeVisible({ timeout: cfg.timeouts.nav });

    // Summary with no active run is replaced back to the picker — it never resurrects.
    await wiz.goto(page, wiz.routes.webSummary);
    await expect(page).not.toHaveURL(/summary/, { timeout: cfg.timeouts.nav });
    await expect(page.getByText(/What do you want to set up\?/i)).toBeVisible();
  });

  test('B8 @P1 Four-segment onboarding URL is a 404', async ({ page }) => {
    await wiz.goto(page, '/onboarding/web/install/extra');

    // The app's Not Found page renders, not a broken wizard.
    // TODO(selector): confirm the app's 404 copy.
    await expect(
      page.getByText(/not found|page.*(doesn.t|does not).*exist|404/i).first()
    ).toBeVisible({ timeout: cfg.timeouts.nav });
    // The install step must NOT render under this bad URL.
    await expect(page.getByRole('button', { name: /Confirm and Check Status/i })).toHaveCount(0);
  });

  test('B9 @P0 Sider hides in the wizard and returns after every exit', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');

    // Baseline on a normal dashboard page (best-effort — see wiz.isSiderVisible TODO(selector)).
    await wiz.goto(page, '/');

    // Inside the wizard the left sider is hidden on every step.
    await wiz.goto(page, wiz.routes.webInstall);
    expect(await wiz.isSiderVisible(page)).toBeFalsy();

    // Exit via browser Back → sider returns immediately, no reload needed.
    await page.goBack();
    await wiz.waitForSpa(page);
    await expect(page).not.toHaveURL(/\/onboarding/);
    expect(await wiz.isSiderVisible(page)).toBeTruthy();
    // Other exits (Skip to Dashboard, Summary "Go to Dashboard", header logo, site switch)
    // share the same mount/unmount class on #pe-page-sider; a leak hides the sider app-wide.
  });

  test('B10 @P1 Alert stack suppressed inside the wizard', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');

    // The whole PageAlert stack (and the resume banner) is hidden on onboarding paths.
    await wiz.goto(page, wiz.routes.webInstall);
    // TODO(selector): confirm the PageAlert stack / resume-banner container.
    const alertStack = page.locator('[class*="PageAlert" i], [class*="alert-stack" i], [class*="resume-banner" i]');
    await expect(alertStack).toHaveCount(0);
    await expect(page.getByText(/Resume your setup/i)).toHaveCount(0);
    // Note: proving the stack RETURNS on the next non-onboarding page needs an account
    // carrying a live alert (payment / iOS cert / dummy-data); assert on /campaigns there.
  });

  test('B11 @P1 Header site switch mid-run', async ({ page }) => {
    test.skip(!site.site1.url || !site.site2.url, 'Site 1 / Site 2 not configured');
    test.fixme(
      true,
      'Needs a run advanced to the popup step on Site 1 (passing install + analyzing) and a confirmed ' +
        'header SiteSelector; confirm wiz.switchSite selectors on staging, then implement.'
    );
    // Steps (once the popup step is reachable and the switcher selector is pinned):
    //  - reach /onboarding/web/popup on Site 1;
    //  - const watch = wiz.watchOnboardingApi(page);
    //  - await wiz.switchSite(page, site.site2.name);
    //  - await expect(page).toHaveURL(/\/onboarding(\/|$)/); // picker, clean run for Site 2
    //  - await wiz.switchSite(page, site.site1.name);
    //  - await expect(page).toHaveURL(/\/onboarding\/web\/popup/); // Site 1 run resumes with its data
    //  - assert no site-analysis request for Site 1's URL fired while Site 2 was active.
  });
});
