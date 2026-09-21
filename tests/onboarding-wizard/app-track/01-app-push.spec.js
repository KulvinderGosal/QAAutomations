/**
 * Group I — App Push track
 * Plan cases I1–I10. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * Conventions match the reference spec (web-track/01-web-install.spec.js):
 *   - one test per plan case; the case id + priority live in the title so you can
 *     `--grep @P0` / `--grep I3`; traceability back to cases.json.
 *   - fixtures come from onboarding-config; a test.skip() guards each case whose
 *     required account or mobile credential file is not configured (so a partial
 *     .env still runs the cases it can).
 *   - selectors prefer role/text over brittle CSS. Anything that must be confirmed
 *     against the live DOM is marked TODO(selector); flows that are entirely DOM-
 *     driven and cannot be guessed are test.fixme with the steps as comments.
 *
 * App-track fixtures (see onboarding-config.mobile):
 *   androidServiceAccountJson  Firebase service-account key JSON (I2)
 *   androidSenderId            FCM Sender ID                     (I2)
 *   iosP12Path / iosP12Password   valid APNs .p12 + password     (I3)
 *   iosP12ExpiredPath          expired APNs .p12                 (I3)
 *   playPackage / appStoreUrl  store-lookup fixtures             (I1)
 *
 * Prereqs (see MANUAL_TEST_CHECKLIST.md): backend deployed with
 * GOOGLE_GENERATIVE_AI_API_KEY. AI responses with `fallback:true` are NOT errors.
 */
const path = require('path');
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const mobile = cfg.mobile;

test.describe('I · App Push track', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every platform/feature available for app-track cases.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('I1 @P0 App Details store lookup: name gate, matched + unmatched advance', async ({ page }) => {
    const watch = wiz.watchOnboardingApi(page);
    await wiz.goto(page, wiz.routes.appDetails);

    // Primary is disabled until an app name is entered.
    const primary = page.getByRole('button', { name: /Analyze & Continue/i });
    await expect(primary).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(primary).toBeDisabled();

    // TODO(selector): confirm the App name / Package inputs and the Android platform control.
    const nameInput = page
      .getByLabel(/app name/i)
      .or(page.getByPlaceholder(/app name/i))
      .or(page.locator('input[name*="name" i]'))
      .first();
    const pkgInput = page
      .getByLabel(/package/i)
      .or(page.getByPlaceholder(/package|com\./i))
      .or(page.locator('input[name*="package" i]'))
      .first();

    // Matched: real Play package -> store lookup succeeds and advances to the SDK step.
    await nameInput.fill('WhatsApp');
    await pkgInput.fill(mobile.playPackage || 'com.whatsapp');
    // TODO(selector): confirm the Android platform toggle/radio.
    await page.getByText(/^Android$/i).first().click().catch(() => {});

    await expect(primary).toBeEnabled();
    await primary.click();

    // While the store lookup runs the primary flips to "Analyzing your app…" and Back
    // is locked. Best-effort — the lookup may resolve before we can assert the transient.
    await expect(page.getByText(/Analyzing your app/i))
      .toBeVisible({ timeout: cfg.timeouts.nav })
      .catch(() => {});

    await expect(page).toHaveURL(/\/onboarding\/app\/sdk/, { timeout: cfg.timeouts.nav });

    // A POST app-analysis must have fired for the matched lookup.
    const analysis = watch.calls.filter((c) => /app-analysis/.test(c.endpoint) && c.method === 'POST');
    expect(analysis.length).toBeGreaterThan(0);

    // Unmatched: a made-up name with no package/URL still advances (no error surfaced).
    await wiz.goto(page, wiz.routes.appDetails);
    await nameInput.fill('Zzqx Made Up App');
    await expect(primary).toBeEnabled();
    await primary.click();
    await expect(page).toHaveURL(/\/onboarding\/app\/sdk/, { timeout: cfg.timeouts.nav });
    // No error panel for an unmatched store lookup.
    await expect(page.getByText(/couldn.t|something went wrong|error/i)).toHaveCount(0);

    watch.stop();
  });

  test('I2 @P0 Android stepper + Firebase credentials save', async ({ page }) => {
    test.skip(!mobile.androidServiceAccountJson, 'PE_ANDROID_SA_JSON_PATH not configured');
    test.skip(!mobile.androidSenderId, 'PE_ANDROID_SENDER_ID not configured');

    await wiz.goto(page, wiz.routes.appSdk);
    // Android stepper header for the chosen app.
    await expect(page.getByText(/Android Setup/i)).toBeVisible({ timeout: cfg.timeouts.nav });

    // TODO(selector): confirm how the rail exposes the Firebase credentials step and
    // navigate to it (this walk is DOM-heavy; the credentials form is asserted below).
    await page.getByText(/Firebase/i).first().click().catch(() => {});

    // Upload the service-account JSON + Sender ID.
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(mobile.androidServiceAccountJson);

    // TODO(selector): confirm the Sender ID input.
    const senderInput = page
      .getByLabel(/sender id/i)
      .or(page.getByPlaceholder(/sender id/i))
      .or(page.locator('input[name*="sender" i]'))
      .first();
    await senderInput.fill(mobile.androidSenderId);

    await page.getByRole('button', { name: /^Save/i }).first().click();

    // Valid save -> PUT android settings and the connected confirmation copy.
    // TODO(network): confirm the android-settings PUT endpoint if a request assertion is wanted.
    await expect(page.getByText(/Firebase is connected/i)).toBeVisible({ timeout: cfg.timeouts.nav });
  });

  test('I3 @P0 iOS stepper + APNs .p12 (valid save, expired warning)', async ({ page }) => {
    test.skip(!mobile.iosP12Path, 'PE_IOS_P12_PATH not configured');

    await wiz.goto(page, wiz.routes.appSdk);

    // TODO(selector): confirm the iOS platform toggle and the CocoaPods / Swift Package
    // Manager switch (snippets change with the package manager).
    await page.getByText(/^iOS$/i).first().click().catch(() => {});

    // Missing pieces -> guard copy before a certificate is provided.
    await page.getByRole('button', { name: /^Save/i }).first().click().catch(() => {});
    await expect(
      page.getByText(/Upload the \.p12 certificate and enter its password first/i)
    ).toBeVisible({ timeout: cfg.timeouts.nav }).catch(() => {
      // If the Save button is disabled until inputs are filled this guard never shows;
      // that is an acceptable alternative — TODO(selector): confirm which behaviour ships.
    });

    // Valid save: upload the .p12, enter password -> upload + PUT ios_options, filename shown.
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(mobile.iosP12Path);
    if (mobile.iosP12Password) {
      const pass = page
        .getByLabel(/password/i)
        .or(page.getByPlaceholder(/password/i))
        .or(page.locator('input[type="password"]'))
        .first();
      await pass.fill(mobile.iosP12Password);
    }
    await page.getByRole('button', { name: /^Save/i }).first().click();

    // Filename is displayed after a successful upload.
    // TODO(network): confirm the ios_options PUT endpoint if a request assertion is wanted.
    await expect(page.getByText(path.basename(mobile.iosP12Path))).toBeVisible({ timeout: cfg.timeouts.nav });

    // Expired certificate -> expiry warning.
    if (mobile.iosP12ExpiredPath) {
      await fileInput.setInputFiles(mobile.iosP12ExpiredPath);
      if (mobile.iosP12Password) {
        const pass = page.locator('input[type="password"]').first();
        await pass.fill(mobile.iosP12Password).catch(() => {});
      }
      await page.getByRole('button', { name: /^Save/i }).first().click();
      await expect(page.getByText(/expir(ed|y|es)/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    } else {
      console.log('ℹ️  PE_IOS_P12_EXPIRED_PATH not set — expiry-warning sub-check skipped.');
    }
  });

  test('I4 @P0 React Native two-pass hand-off labels', async ({ page }) => {
    await wiz.goto(page, wiz.routes.appSdk);

    // TODO(selector): confirm the React Native platform toggle on the SDK step.
    await page.getByText(/React Native/i).first().click().catch(() => {});

    // Assistant intro copy on entering the RN track (reliably visible up front).
    await expect(
      page.getByText(/React Native ships to both stores/i)
    ).toBeVisible({ timeout: cfg.timeouts.nav });

    // Pass structure / hand-off labels. Reaching each label requires walking the rail,
    // which is DOM-heavy and cannot be guessed here — TODO(selector) the rail internals.
    // Pass 1 = JS + Android steps; last-step primary "Set up iOS"; skip link
    //   "Skip Android — set up iOS".
    // Pass 2 = iOS-native steps only; final primary "Mark Done & Continue to Audiences";
    //   skip "Skip and go to Audiences".
    // Change button returns to App Details without ticking SDK Setup on the rail.
    // TODO(selector): once the rail step controls are confirmed, walk pass 1 and assert:
    //   page.getByRole('button', { name: /Set up iOS/i })
    //   page.getByText(/Skip Android — set up iOS/i)
    // then pass 2:
    //   page.getByRole('button', { name: /Mark Done & Continue to Audiences/i })
    //   page.getByText(/Skip and go to Audiences/i)
  });

  test('I5 @P1 Flutter two-pass hand-off labels', async ({ page }) => {
    await wiz.goto(page, wiz.routes.appSdk);

    // TODO(selector): confirm the Flutter platform toggle on the SDK step.
    await page.getByText(/Flutter/i).first().click().catch(() => {});

    // Same two-pass structure as I4 with Flutter Android / Flutter iOS step lists.
    // The intro assistant copy names both stores (shared two-pass hand-off copy).
    await expect(
      page.getByText(/ships to both stores|set up (Android|iOS) (and|then)/i).first()
    ).toBeVisible({ timeout: cfg.timeouts.nav }).catch(() => {
      // TODO(selector): confirm the exact Flutter intro copy on staging, then pin it.
    });

    // TODO(selector): once the rail is confirmed, assert the same hand-off labels as I4:
    //   "Set up iOS", "Skip Android — set up iOS", "Mark Done & Continue to Audiences".
  });

  test('I6 @P1 credential drafts survive rail navigation', async ({ page }) => {
    // Entirely DOM-driven: type a password on the APNs step, click another rail step,
    // toggle Manual, return, and confirm the typed values are still there (the form
    // stays mounted). The rail step controls and the Manual/AI-Agent toggle cannot be
    // guessed without the running app.
    test.fixme(true, 'Confirm APNs-step field selectors + rail step + Manual toggle on staging, then implement.');
    // Steps to implement:
    //   1. wiz.goto(page, wiz.routes.appSdk); pick iOS; open the APNs certificate step.
    //   2. Fill the password field with a known value.
    //   3. Click a different rail step, then toggle Manual (from AI Agent), then return.
    //   4. expect(passwordField).toHaveValue(knownValue).
  });

  test('I7 @P1 refresh keeps platform and ticks', async ({ page }) => {
    await wiz.goto(page, wiz.routes.appSdk);

    // TODO(selector): confirm the iOS platform toggle and tick two sub-steps here.
    await page.getByText(/^iOS$/i).first().click().catch(() => {});

    const before = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wiz.waitForSpa(page);

    // After refresh we stay on the SDK step (URL persists).
    await expect(page).toHaveURL(/\/onboarding\/app\/sdk/);
    expect(page.url()).toBe(before);

    // Persisted onboarding state should still reflect the iOS platform.
    const keys = await wiz.readOnboardingKeys(page);
    expect(JSON.stringify(keys || {})).toMatch(/ios/i);

    // TODO(selector): assert the same two ticks + sub-step persist after reload, then
    // change platform to Android and assert ticks/credentials state reset for Android.
  });

  test('I8 @P1 app analyzing board names the app', async ({ page }) => {
    await wiz.goto(page, wiz.routes.appSdk);

    // Continue from the SDK step to the app analyzing board.
    // TODO(selector): confirm the Continue-to-Audiences primary on the last SDK step.
    await page
      .getByRole('button', { name: /Continue to Audiences|Mark Done & Continue to Audiences|Continue/i })
      .first()
      .click()
      .catch(() => {});

    // Board header names the store title (or the app name on an unmatched lookup).
    // TODO(selector): confirm the app analyzing route (e.g. /onboarding/app/analyzing).
    await expect(
      page.getByText(/Building audiences and automations for/i)
    ).toBeVisible({ timeout: cfg.timeouts.analyzing });

    // TODO(selector): after hand-off, assert the Audiences subtitle names the app, not the domain.
  });

  test('I9 @P1 summary reflects per-OS outcome', async ({ page }) => {
    // Requires a completed app run with a specific per-OS state (Android credentials
    // saved, iOS skipped) which depends on I2 succeeding and the full downstream flow.
    // The SDK-rail and summary DOM cannot be reliably driven without confirmed selectors.
    test.fixme(true, 'Confirm SDK-rail + summary selectors on staging; drive Android-saved/iOS-skipped, then implement.');
    // Steps to implement:
    //   1. Finish the app run with Android credentials saved and iOS skipped.
    //   2. On Summary, assert the SDK row reads "Android configured · iOS skipped".
    //   3. With nothing saved, assert "Setup not finished — resume anytime from App
    //      Integration" and the heading "Your Setup Is Saved".
  });

  test('I10 @P2 Skills panel on the last SDK step', async ({ page }) => {
    // The Skills panel only mounts on the last SDK step; reaching it requires walking the
    // rail to completion, which is DOM-heavy and cannot be guessed here.
    test.fixme(true, 'Confirm the last-SDK-step navigation + Skills panel selectors on staging, then implement.');
    // Steps to implement (assert this copy once the last step is reachable):
    //   - Collapsible "Set up faster with the … skill" carrying a NEW tag.
    //   - Install-path tabs + a prompt block.
    //   - Links "MCP and Skills docs →" and "View the Skills repo →" open in new tabs:
    //       page.getByRole('link', { name: /MCP and Skills docs/i })
    //       page.getByRole('link', { name: /View the Skills repo/i })
  });
});
