/**
 * Group J — Resume checklist, banner and persistence
 * Plan cases J1–J9. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * Conventions match the reference spec (web-track/01-web-install.spec.js):
 *   - one test per plan case; the case id + priority live in the title so you
 *     can `--grep @P0` / `--grep J5`; traceability back to cases.json.
 *   - fixtures come from onboarding-config; a test.skip() guards each case when
 *     its required site/account is not configured.
 *   - selectors prefer text/role. Anything that must be confirmed against the
 *     live DOM is marked TODO(selector) — report mismatches and I'll pin them.
 *
 * This group leans on the localStorage helpers in onboarding-helpers:
 *   wiz.readSnapshot(page, siteId)   → parsed pe_ai_onboarding_data_<siteId>
 *   wiz.readOnboardingKeys(page)     → every pe_ai_onboarding* key/value
 *   wiz.setRawSnapshot(page, id, v)  → seed a raw snapshot string
 *   wiz.snapshotKey(siteId)          → the data key name
 *
 * `fallback:true` responses are NOT errors (see cases.json "known").
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

test.describe('J · Resume checklist, banner and persistence', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every platform/feature available for the runs.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('J1 @P0 resume card restores the exact step', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Drive a real run to the popup step: install must pass on Site 1.
    await wiz.goto(page, wiz.routes.webInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    await page.getByRole('button', { name: /Continue to Popup Design/i })
      .click({ timeout: cfg.timeouts.nav });
    // Analyzing hands off to the popup step within ~20s even on a slow backend.
    await page.waitForURL(/\/onboarding\/web\/popup/, { timeout: cfg.timeouts.analyzing });
    await wiz.waitForSpa(page);

    // Edit the popup message so we can prove it survives the resume.
    // TODO(selector): confirm the popup message textarea on the popup step.
    const message = page.locator('textarea').first();
    const edited = `QA resume marker ${Date.now()}`;
    await message.fill(edited);

    // Leave to the dashboard.
    // TODO(selector): confirm the "Skip setup and go to the Dashboard" affordance.
    await page.getByRole('button', { name: /Skip setup and go to the Dashboard/i })
      .or(page.getByText(/Skip setup and go to the Dashboard/i)).first().click();
    await wiz.waitForSpa(page);

    // Resume card copy.
    await expect(page.getByText(/Finish setting up Web Push/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/\d+ of \d+ done/i).first()).toBeVisible();
    await expect(page.getByText(/About .*min left/i).first()).toBeVisible();

    // Continue Setup deep-links back to the popup step.
    await page.getByRole('button', { name: /Continue Setup/i })
      .or(page.getByText(/Continue Setup/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/web\/popup/);

    // The edited message is intact.
    await expect(page.locator('textarea').first()).toHaveValue(edited);

    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'ai_onboarding_resumed');
    expect(events.length).toBeGreaterThan(0);
  });

  test('J2 @P0 cross-page banner and dismiss cap', async ({ page }) => {
    test.skip(!site.site1.url || !site.site1.id, 'Site 1 (with id) not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Start an active web run (entering the track is enough to arm the banner).
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up Web Push/i })
      .or(page.getByText(/Set up Web Push/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/web\/install/);

    // Banner shows on non-dashboard, non-wizard pages.
    await wiz.goto(page, '/campaigns');
    const banner = page.getByText(/Finish setting up Web Push/i).first();
    await expect(banner).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Next up:/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue Setup/i })
      .or(page.getByText(/Continue Setup/i)).first()).toBeVisible();

    // Dismiss ✕ three times across visits.
    // TODO(selector): confirm the banner dismiss control (aria-label / icon button).
    const dismiss = () =>
      page.getByRole('button', { name: /close|dismiss/i }).first()
        .click({ timeout: cfg.timeouts.action }).catch(() => {});
    for (const route of ['/campaigns', '/analytics', '/campaigns']) {
      await wiz.goto(page, route);
      if (await page.getByText(/Finish setting up Web Push/i).first().isVisible().catch(() => false)) {
        await dismiss();
      }
    }

    // After the third dismiss the banner never returns for this site.
    await wiz.goto(page, '/analytics');
    await expect(page.getByText(/Finish setting up Web Push/i)).toHaveCount(0);

    // The dismiss counter key records the cap.
    const keys = await wiz.readOnboardingKeys(page);
    const dismissedKey = Object.keys(keys).find((k) => k.startsWith('pe_ai_onboarding_checklist_dismissed'));
    expect(dismissedKey, 'a dismiss-counter key should exist').toBeTruthy();

    // A second site still shows the banner (per-site counter).
    test.skip(!site.site2.url, 'Site 2 not configured — cannot verify the per-site reset');
    if (site.site2.name) await wiz.switchSite(page, site.site2.name);
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up Web Push/i })
      .or(page.getByText(/Set up Web Push/i)).first().click();
    await wiz.goto(page, '/campaigns');
    await expect(page.getByText(/Finish setting up Web Push/i).first())
      .toBeVisible({ timeout: cfg.timeouts.nav });
  });

  test('J3 @P1 skipped steps in the checklist', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Drive to the audiences step, then skip it.
    await wiz.goto(page, wiz.routes.webInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    await page.getByRole('button', { name: /Continue to Popup Design/i })
      .click({ timeout: cfg.timeouts.nav });
    await page.waitForURL(/\/onboarding\/web\/popup/, { timeout: cfg.timeouts.analyzing });
    await wiz.waitForSpa(page);
    // TODO(selector): confirm the popup step's continue label ("Looks Good, Continue").
    await page.getByRole('button', { name: /Looks Good, Continue/i }).click();
    await page.waitForURL(/\/onboarding\/web\/segments/, { timeout: cfg.timeouts.nav });

    // Skip audiences: deselect all → the primary reads "Continue without audiences".
    // TODO(selector): confirm the deselect-all / skip affordance on the segments step.
    await page.getByRole('button', { name: /Continue without audiences/i })
      .or(page.getByText(/Continue without audiences/i)).first().click();

    // Leave to the dashboard and read the checklist.
    await wiz.goto(page, '/');
    await expect(page.getByText(/Finish setting up Web Push/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    // The audiences row is flagged Skipped and the ring does not count it as done.
    await expect(page.getByText(/Skipped/i).first()).toBeVisible();
  });

  test('J4 @P1 refresh at every step keeps data', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Install (after a pass) — reload keeps the check result.
    await wiz.goto(page, wiz.routes.webInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    const domain = site.site1.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    await expect(page.getByText(new RegExp(`PushEngage is live on ${escapeRe(domain)}`, 'i')))
      .toBeVisible({ timeout: cfg.timeouts.nav });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wiz.waitForSpa(page);
    await expect(page.getByText(new RegExp(`PushEngage is live on ${escapeRe(domain)}`, 'i')))
      .toBeVisible({ timeout: cfg.timeouts.nav });

    // Popup (after edits) — reload keeps the edited message.
    await page.getByRole('button', { name: /Continue to Popup Design/i })
      .click({ timeout: cfg.timeouts.nav });
    await page.waitForURL(/\/onboarding\/web\/popup/, { timeout: cfg.timeouts.analyzing });
    await wiz.waitForSpa(page);
    // TODO(selector): confirm the popup message textarea.
    const edited = `QA refresh marker ${Date.now()}`;
    await page.locator('textarea').first().fill(edited);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wiz.waitForSpa(page);
    await expect(page.locator('textarea').first()).toHaveValue(edited);

    // NOTE: on the segments step selection is remote and resets to defaults on
    // refresh — the plan calls this acceptable, so it is not asserted here.
  });

  test('J5 @P0 finished run never resurrects', async ({ page }) => {
    test.skip(!site.site1.id, 'Site 1 id not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Seed the snapshot a completed web run leaves behind.
    const finished = JSON.stringify({ track: null, screen: 'channel_select', completed: ['web'] });
    await wiz.goto(page, wiz.routes.picker);
    await wiz.setRawSnapshot(page, site.site1.id, finished);

    // Picker: Web Push is Done; no resume card / banner.
    await wiz.goto(page, wiz.routes.picker);
    await expect(page.getByText(/Done/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Finish setting up Web Push/i)).toHaveCount(0);

    // Summary with no active run is replaced back to the picker.
    await wiz.goto(page, wiz.routes.webSummary);
    await expect(page).toHaveURL(/\/onboarding(\/?$|\?)/);

    // The snapshot still reflects the finished shape (nothing resurrected it).
    const snap = await wiz.readSnapshot(page, site.site1.id);
    expect(snap && snap.track).toBeNull();
    expect(snap && snap.screen).toBe('channel_select');
    expect(snap && snap.completed).toContain('web');
  });

  test('J6 @P1 logout sweeps onboarding storage', async ({ page }) => {
    // Seed onboarding keys for two sites plus an unrelated key that must survive.
    const id1 = site.site1.id || 'siteA';
    const id2 = site.site2.id || 'siteB';
    await wiz.goto(page, '/');
    await page.evaluate(({ id1, id2 }) => {
      localStorage.setItem(`pe_ai_onboarding_data_${id1}`, JSON.stringify({ track: 'web' }));
      localStorage.setItem(`pe_ai_onboarding_data_${id2}`, JSON.stringify({ track: 'chat' }));
      localStorage.setItem(`pe_ai_onboarding_pending_${id2}`, '1');
      localStorage.setItem(`pe_ai_onboarding_checklist_dismissed_${id1}`, '2');
      localStorage.setItem('pe_lifecycle_signals_demo', JSON.stringify({ keep: true }));
      localStorage.setItem('pe_unrelated_pref', 'keep-me');
    }, { id1, id2 });

    // Log out through the UI.
    // TODO(selector): confirm the account menu → Log out path in the app header.
    const userMenu = page.locator('header [class*="user" i], header [class*="account" i], header [class*="avatar" i]').first();
    if (await userMenu.isVisible().catch(() => false)) await userMenu.click().catch(() => {});
    await page.getByRole('menuitem', { name: /log ?out|sign ?out/i })
      .or(page.getByText(/log ?out|sign ?out/i)).first().click({ timeout: cfg.timeouts.action });
    await page.waitForURL((url) => String(url).includes('/login'), { timeout: cfg.timeouts.nav });

    // All pe_ai_onboarding* keys are gone; other keys remain.
    const onboardingKeys = await wiz.readOnboardingKeys(page);
    expect(Object.keys(onboardingKeys)).toHaveLength(0);
    const survivors = await page.evaluate(() => ({
      lifecycle: localStorage.getItem('pe_lifecycle_signals_demo'),
      unrelated: localStorage.getItem('pe_unrelated_pref'),
    }));
    expect(survivors.lifecycle).not.toBeNull();
    expect(survivors.unrelated).toBe('keep-me');
    // NOTE (plan): repeat this pass in Safari private mode — logout must still complete.
  });

  test('J7 @P1 corrupt snapshot does not crash', async ({ page }) => {
    test.skip(!site.site1.id, 'Site 1 id not configured');

    // Collect any console errors / uncaught page errors while rendering.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await wiz.goto(page, wiz.routes.picker);
    const corruptValues = ['x', '{"screen":"nope"}', '{"version":2,"completed":"x"}'];
    for (const raw of corruptValues) {
      await wiz.setRawSnapshot(page, site.site1.id, raw);
      await wiz.goto(page, wiz.routes.picker);
      // Picker still renders — the heading is present, not a blank page.
      await expect(page.getByText(/What do you want to set up\?/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    }

    expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    // Ignore unrelated network noise; only flag hard render/parse crashes.
    const hardErrors = consoleErrors.filter((t) => /onboarding|snapshot|JSON|undefined|cannot read/i.test(t));
    expect(hardErrors, `console errors: ${hardErrors.join(' | ')}`).toHaveLength(0);
  });

  test('J8 @P1 two sites, two runs', async ({ page }) => {
    test.skip(!site.site1.url || !site.site2.url || !site.site1.id || !site.site2.id,
      'Site 1 / Site 2 (with ids) not configured');

    // Site 1: start a web run.
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up Web Push/i })
      .or(page.getByText(/Set up Web Push/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/web\/install/);

    // Site 2: start a chat run — must begin clean, not inherit Site 1's run.
    if (site.site2.name) await wiz.switchSite(page, site.site2.name);
    await wiz.goto(page, wiz.routes.picker);
    // A fresh site has no in-progress run before we pick a channel.
    const preSnap2 = await wiz.readSnapshot(page, site.site2.id);
    expect(!preSnap2 || preSnap2.track == null || preSnap2.track !== 'web').toBeTruthy();
    await page.getByRole('button', { name: /Set up Chat Widget/i })
      .or(page.getByText(/Set up Chat Widget/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/channels/);

    // Snapshots are independent and keyed per site.
    const snap1 = await wiz.readSnapshot(page, site.site1.id);
    const snap2 = await wiz.readSnapshot(page, site.site2.id);
    expect(snap1 && snap1.track).toBe('web');
    expect(snap2 && snap2.track).toBe('chat');

    // Switch back to Site 1: its web run is still there.
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const snap1Again = await wiz.readSnapshot(page, site.site1.id);
    expect(snap1Again && snap1Again.track).toBe('web');
  });

  test('J9 @P2 not-started nudge dismissal', async ({ page }) => {
    test.skip(!site.site1.id, 'Site 1 id not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Simulate a just-created site awaiting setup (the B1 pending flag).
    await wiz.goto(page, '/');
    await page.evaluate((id) => {
      localStorage.setItem(`pe_ai_onboarding_pending_${id}`, '1');
    }, site.site1.id);
    await wiz.goto(page, '/');

    // The "isn't set up yet" nudge is shown.
    await expect(page.getByText(/isn't set up yet/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });

    // Dismiss it.
    // TODO(selector): confirm the nudge dismiss control on the dashboard card.
    await page.getByRole('button', { name: /close|dismiss/i }).first()
      .click({ timeout: cfg.timeouts.action }).catch(() => {});

    // pending key removed; the checklist dismiss counter is NOT incremented.
    const keys = await wiz.readOnboardingKeys(page);
    expect(keys[`pe_ai_onboarding_pending_${site.site1.id}`]).toBeUndefined();
    const dismissedKey = Object.keys(keys).find((k) => k.startsWith('pe_ai_onboarding_checklist_dismissed'));
    expect(dismissedKey, 'the not-started nudge must not consume a resume-banner dismissal').toBeFalsy();
  });
});

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
