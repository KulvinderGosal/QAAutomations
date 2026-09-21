/**
 * Group K — Settings › Installation (reused wizard bodies)
 * Plan cases K1–K12. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * Settings › Installation and Mobile App Push › Installation are rebuilt on the
 * same bodies the wizard uses, but as a standalone page: sider visible, no step
 * rail, a Verified modal on pass and an inline diagnostic on fail. These specs
 * assert those differences and — critically (K4) — that the settings page never
 * mutates the saved onboarding run.
 *
 * Conventions match the reference spec (web-track/01-web-install.spec.js):
 *   - one test per plan case; id + priority in the title (`--grep @P0` / `K4`).
 *   - text/role selectors; unconfirmed ones are marked TODO(selector).
 *   - `fallback:true` is not an error (see cases.json "known").
 *
 * Routes: wiz.routes.settingsInstall = /settings/installation
 *         wiz.routes.mobileInstall   = /mobile-app-push/installation
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;
const mobile = cfg.mobile;

test.describe('K · Settings › Installation (reused bodies)', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every platform/feature available.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('K1 @P0 Website tab layout and controls', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.settingsInstall);

    // Website | Mobile switcher and the install heading.
    await expect(page.getByText(/Website/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Mobile/i).first()).toBeVisible();
    await expect(page.getByText(/Install PushEngage on Your Site/i)).toBeVisible();

    // Footer primary is present.
    await expect(page.getByRole('button', { name: /Confirm and Check Status/i })).toBeVisible();

    // None of the wizard chrome: no Back, no Skip, no rail, no channel switch.
    await expect(page.getByRole('button', { name: /^Go Back$/i })).toHaveCount(0);
    await expect(page.getByText(/Skip for now/i)).toHaveCount(0);
    await expect(page.getByText(/Choose a different channel/i)).toHaveCount(0);

    // On the Website tab the platform grid is open (no "Change" link).
    await expect(page.getByRole('button', { name: /^Change$/i })).toHaveCount(0);

    // Sider is visible here (unlike inside the wizard).
    expect(await wiz.isSiderVisible(page)).toBeTruthy();
  });

  test('K2 @P0 pass shows the Verified modal', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.settingsInstall);

    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();

    // Verified modal appears (not the wizard's inline "Continue" panel).
    await expect(page.getByText(/^Verified$/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Setup Verified Successfully\. Click OK to continue\./i)).toBeVisible();

    // Behind it, the pass panel + the settings-only primary.
    await expect(page.getByText(/Your site is configured correctly\./i)).toBeVisible();

    // OK → dashboard.
    await page.getByRole('button', { name: /^OK$/i }).click();
    await expect(page).toHaveURL(/\/(dashboard\/?|)$/, { timeout: cfg.timeouts.nav });

    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'verify_installation');
    expect(events.some((e) => Number(e.eventValue) === 1)).toBeTruthy();
  });

  test('K3 @P0 fail shows the inline diagnostic (no modal)', async ({ page }) => {
    test.skip(!site.site2.url, 'Site 2 not configured');
    if (site.site2.name) await wiz.switchSite(page, site.site2.name);
    await wiz.goto(page, wiz.routes.settingsInstall);

    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();

    const domain = site.site2.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // Same copy as D5 — inline, not a modal.
    await expect(page.getByText(new RegExp(`PushEngage isn.t live on ${escapeRe(domain)}`, 'i')))
      .toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/1 of 3 checks passed/i)).toBeVisible();
    await expect(page.getByText(/Recommended fix/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Check again/i })).toBeVisible();

    // No modal dialog is shown on failure.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(/^Verified$/i)).toHaveCount(0);
    await expect(page.getByText(/Verification Failed/i)).toHaveCount(0);
  });

  test('K4 @P0 settings page never touches the saved run', async ({ page }) => {
    test.skip(!site.site1.url || !site.site1.id, 'Site 1 (with id) not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Start a wizard run and leave it parked (entering the track writes a snapshot).
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up Web Push/i })
      .or(page.getByText(/Set up Web Push/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/web\/install/);

    const before = await wiz.readSnapshot(page, site.site1.id);
    expect(before, 'a run snapshot should exist before the settings visit').toBeTruthy();

    // Reset the telemetry buffer so we only measure the settings visit.
    await page.evaluate(() => { window.__peEvents = []; });

    // Use Settings › Installation: run a check (pass) and switch Manual / AI.
    await wiz.goto(page, wiz.routes.settingsInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    await expect(page.getByText(/^Verified$/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    await page.getByRole('button', { name: /^OK$/i }).click().catch(() => {});

    // Save Firebase creds on Mobile (only if the fixture is configured).
    if (mobile.androidServiceAccountJson && mobile.androidSenderId) {
      await wiz.goto(page, wiz.routes.mobileInstall);
      // TODO(selector): confirm the Firebase / Android credential save on the Mobile tab.
      await page.getByRole('button', { name: /^Save$/i }).first()
        .click({ timeout: cfg.timeouts.action }).catch(() => {});
    }

    // Return to the wizard: the run resumes with identical data.
    await wiz.goto(page, wiz.routes.picker);
    const after = await wiz.readSnapshot(page, site.site1.id);

    // The saved snapshot is byte-identical before/after the settings visit.
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));

    // The settings visit fired verify_installation but ZERO ai_onboarding_* events.
    const all = wiz.onboardingEvents(await wiz.getTelemetry(page));
    expect(all.some((e) => (e.event || e.eventName) === 'verify_installation')).toBeTruthy();
    const wizardEvents = all.filter((e) => {
      const name = e.event || e.eventName || '';
      return typeof name === 'string' && name.startsWith('ai_onboarding');
    });
    expect(wizardEvents, `unexpected wizard events from settings: ${wizardEvents.map((e) => e.event || e.eventName).join(', ')}`)
      .toHaveLength(0);
  });

  test('K5 @P1 `?type=` deep-link matrix', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Website route: wordpress/shopify pin the Website platform + suppress auto-detect.
    for (const [type, label] of [['wordpress', /WordPress/i], ['shopify', /Shopify/i]]) {
      await wiz.goto(page, `${wiz.routes.settingsInstall}?type=${type}`);
      await expect(page).toHaveURL(new RegExp(`type=${type}`));
      await expect(page.getByText(label).first()).toBeVisible({ timeout: cfg.timeouts.nav });
      // Pinned by ?type=, so no "AI DETECTED" badge.
      await expect(page.getByText(/AI DETECTED/i)).toHaveCount(0);
    }

    // Website route: garbage / no param behave like no param (Website auto-detects).
    for (const suffix of ['?type=garbage', '']) {
      await wiz.goto(page, `${wiz.routes.settingsInstall}${suffix}`);
      await expect(page.getByText(/Install PushEngage on Your Site/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    }

    // Mobile route: react_native / flutter open the Mobile tab with that platform.
    for (const [type, label] of [['react_native', /React Native/i], ['flutter', /Flutter/i]]) {
      await wiz.goto(page, `${wiz.routes.settingsInstall}?type=${type}`);
      // TODO(selector): confirm the Mobile-tab platform label rendering per platform.
      await expect(page.getByText(label).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    }

    // Mobile route with no param opens Mobile with Android.
    await wiz.goto(page, wiz.routes.mobileInstall);
    await expect(page.getByText(/Android/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });

    // An unrelated query param survives a Website→Mobile→Website round trip.
    await wiz.goto(page, `${wiz.routes.settingsInstall}?dummy-data=1`);
    // TODO(selector): confirm the Website | Mobile switcher control names.
    await page.getByRole('tab', { name: /Mobile/i }).or(page.getByText(/^Mobile$/i)).first()
      .click({ timeout: cfg.timeouts.action }).catch(() => {});
    // Switching to Mobile writes ?type=android.
    await expect(page).toHaveURL(/type=android/);
    await page.getByRole('tab', { name: /Website/i }).or(page.getByText(/^Website$/i)).first()
      .click({ timeout: cfg.timeouts.action }).catch(() => {});
    // Switching back to Website clears ?type but keeps dummy-data.
    await expect(page).not.toHaveURL(/type=/);
    await expect(page).toHaveURL(/dummy-data=1/);
  });

  test('K6 @P1 iOS certificate-expiry alert deep link', async ({ page }) => {
    // Un-automatable here: needs an account whose iOS certificate is expired so the
    // MobileAppPushSetupAlert renders, then a click on its link. Requires the
    // PE_IOS_P12_EXPIRED_PATH cert installed on the account and a real APNs alert.
    // Steps to confirm on staging, then implement:
    //   1. Trigger the iOS certificate expiry alert (upload the expired .p12).
    //   2. Click the alert's link.
    //   3. Expect URL /settings/installation?type=ios → Mobile tab, iOS platform, APNs form.
    //   4. Upload a fresh .p12 → saves; the alert clears on the next load.
    // Product note (cases.json): on master this landed in the classic Step 2 iOS
    // section — confirm support expects the Mobile tab.
    test.fixme(true, 'Needs an expired iOS cert + a live APNs expiry alert to click; confirm the Mobile-tab landing on staging.');
  });

  test('K7 @P0 Mobile tab: fields, tiles, stepper and verify', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.mobileInstall);

    // Four platform tiles.
    for (const tile of [/Android/i, /iOS/i, /React Native/i, /Flutter/i]) {
      await expect(page.getByText(tile).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    }

    // APP NAME is prefilled from the site name.
    // TODO(selector): confirm the APP NAME input on the Mobile tab.
    const appName = page.getByLabel(/App name/i)
      .or(page.locator('input[name*="app" i], input[name*="name" i]')).first();
    await expect(appName).not.toHaveValue('');

    // Pick Android (default) and run the check with 0 subscribers → error modal.
    // TODO(selector): confirm the Android tile selection control.
    await page.getByText(/Android/i).first().click().catch(() => {});
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();

    // 0 subscribers → Modal.error "Verification Failed" (legacy Android copy).
    await expect(page.getByText(/Verification Failed/i)).toBeVisible({ timeout: cfg.timeouts.nav });

    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'verify_installation');
    expect(events.some((e) => (e.label || e.install_platform) === 'android')).toBeTruthy();

    // NOTE: the ≥1-subscriber pass path (→ "Verified" modal → OK → dashboard, no
    // skip link) needs a real Android subscriber on the fixture site and cannot be
    // forced from the browser; verify it manually or with a seeded subscriber.
  });

  test('K8 @P1 two-pass walk on the settings page (React Native)', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.mobileInstall);

    // Watch the subscribers call to confirm the final check pins include_browsers=ios.
    const subscriberCalls = [];
    page.on('request', (req) => {
      const u = req.url();
      if (/subscribers/i.test(u) && /include_browsers/i.test(u)) subscriberCalls.push(u);
    });

    // Pick React Native.
    // TODO(selector): confirm the React Native tile control.
    await page.getByText(/React Native/i).first().click({ timeout: cfg.timeouts.action }).catch(() => {});

    // Pass 1 ends with "Set up iOS"; pass 2 shows no skip link at all.
    // TODO(selector): confirm the stepper "next pass" / "Set up iOS" affordance.
    await expect(page.getByText(/Set up iOS/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    await page.getByRole('button', { name: /Set up iOS/i })
      .or(page.getByText(/Set up iOS/i)).first().click({ timeout: cfg.timeouts.action }).catch(() => {});
    await expect(page.getByText(/Skip for now/i)).toHaveCount(0);

    // Final check.
    await page.getByRole('button', { name: /Confirm and Check Status/i })
      .click({ timeout: cfg.timeouts.action }).catch(() => {});
    // The final check calls subscribers with include_browsers: ios.
    await expect
      .poll(() => subscriberCalls.some((u) => /include_browsers=ios/i.test(u)), { timeout: cfg.timeouts.nav })
      .toBeTruthy();
  });

  test('K9 @P1 site URL pencil PATCHes from the settings page', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.settingsInstall);

    // Same behaviour as D4: invalid URL → inline error, nothing sent.
    // TODO(selector): confirm the pencil/edit affordance next to the site URL.
    await page.getByRole('button', { name: /edit|pencil/i }).first().click();
    const urlInput = page.locator('input[value*="http"], input[name*="url" i]').first();
    await urlInput.fill('asdf');
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/A Valid URL should be of the format/i)).toBeVisible();

    // Force a 4xx on the PATCH → URL reverts + inline error + notification.
    await page.route('**/sites/**', (route) => {
      if (route.request().method() === 'PATCH') return route.fulfill({ status: 400, body: '{}' });
      return route.continue();
    });
    await urlInput.fill(site.site1.url);
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/Couldn't save this URL/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Couldn't update your site URL/i)).toBeVisible();
    await page.unroute('**/sites/**');
  });

  test('K10 @P1 site switch mid-check', async ({ page }) => {
    test.skip(!site.site1.url || !site.site2.url, 'Site 1 / Site 2 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Delay the analysis so the switch happens before the result lands.
    await page.route('**/onboarding-ai/site-analysis', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      route.continue();
    });
    await wiz.goto(page, `${wiz.routes.settingsInstall}?type=wordpress`);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();

    // Switch to Site 2 while Site 1's check is in flight.
    if (site.site2.name) await wiz.switchSite(page, site.site2.name);

    // No Site 1 modal appears under Site 2; ?type cleared; no stuck spinner.
    await expect(page.getByText(/^Verified$/i)).toHaveCount(0);
    await expect(page).not.toHaveURL(/type=wordpress/);
    await expect(page.locator('.ant-spin-spinning')).toHaveCount(0);
    await page.unroute('**/onboarding-ai/site-analysis');
  });

  test('K11 @P1 styling of the reused bodies', async ({ page }) => {
    // Un-automatable without a live-DOM visual pass: this case asserts pixel-level
    // styling (32px input height, ~280px code-block cap, Copy button not
    // overlapping text, language-tab underline flush to the code's left edge,
    // stepper scroll within a bounded height, card padding) across viewport
    // heights 800/1080/1440 and widths 1440/768/375.
    // Steps to confirm on staging, then implement (e.g. bounding-box measurements
    // + screenshot comparisons at each viewport):
    //   1. Website tab: site URL editor, iOS APNs form, SDK code blocks,
    //      Kotlin/Java and Swift/Objective-C tabs.
    //   2. For each viewport: assert input heights, wrapping, code-block cap,
    //      Copy button placement, tab underline, stepper scroll, card padding.
    test.fixme(true, 'Pixel/styling across multiple viewports — needs a live-DOM visual pass and pinned box-metric selectors.');
  });

  test('K12 @P1 mobile route entry points', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Direct route opens the Mobile tab.
    await wiz.goto(page, wiz.routes.mobileInstall);
    await expect(page).toHaveURL(/\/mobile-app-push\/installation/);
    await expect(page.getByText(/Android/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });

    // Sidebar entry: Mobile App Push › Installation.
    // TODO(selector): confirm the sidebar menu labels for Mobile App Push › Installation.
    const sidebarLink = page.getByRole('link', { name: /Installation/i })
      .or(page.getByText(/Mobile App Push/i)).first();
    if (await sidebarLink.isVisible().catch(() => false)) {
      await sidebarLink.click().catch(() => {});
      await expect(page).toHaveURL(/\/mobile-app-push\/installation/);
    }
    // NOTE: the MobileAppPushSetupAlert link and the App Push page CTA are the
    // other two entry points; confirm their selectors on staging and assert each
    // also lands on /mobile-app-push/installation with the Mobile tab active.
  });
});

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
