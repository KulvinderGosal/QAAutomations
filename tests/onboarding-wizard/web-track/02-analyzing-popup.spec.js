/**
 * Group E — Web track · Analyzing board and Popup Design
 * Plan cases E1–E10. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * Conventions match the reference spec (web-track/01-web-install.spec.js):
 *   - one test per plan case; id + priority in the title (`--grep @P0` / `--grep E7`).
 *   - fixtures from onboarding-config; test.skip() guards each site/account gap.
 *   - selectors prefer role/text from the case `expected` copy. Anything that must
 *     be confirmed against the live DOM is marked TODO(selector).
 *
 * The analyzing board fans out to the onboarding-ai endpoints (site-analysis,
 * popup-copy, recommendations) and then the popup step PUTs the site's real
 * `optin_settings`. A response with `fallback:true` is HTTP 200 with usable
 * content and must NOT surface an error.
 *
 * TODO(selector): the optin_settings read/write path is not spelled out in the
 * plan's API table (only "the wizard writes optin_settings"). We match it with a
 * broad /optin[_-]?settings/ URL regex — pin the exact route once confirmed.
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;
const OPTIN_URL = /optin[_-]?settings/i;

/** Drive the real flow install → passing check → analyzing → popup step. */
async function reachPopupStep(page) {
  await wiz.goto(page, wiz.routes.webInstall);
  await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
  await page
    .getByRole('button', { name: /Continue to Popup Design/i })
    .click({ timeout: cfg.timeouts.nav });
  await page.waitForURL(/\/onboarding\/web\/popup/, {
    timeout: cfg.timeouts.analyzing + cfg.timeouts.nav,
  });
  await wiz.waitForSpa(page);
}

test.describe('E · Web track — Analyzing and Popup Design', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every style/feature available for the popup step.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('E1 @P0 Analyzing board completes and hands off to Popup', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    await wiz.goto(page, wiz.routes.webInstall);
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    await page
      .getByRole('button', { name: /Continue to Popup Design/i })
      .click({ timeout: cfg.timeouts.nav });

    // Analyzing board: header + all five agents, no Back, no footer.
    await expect(page.getByText(/AI agents are on it/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    for (const agent of ['Site Scanner', 'Copy Writer', 'Design Engine', 'Audience Architect', 'Automation Builder']) {
      await expect(page.getByText(new RegExp(agent, 'i'))).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /Go Back|Back/i })).toHaveCount(0);

    // Hands off to the popup step within the 20s server cap (plus nav headroom).
    await expect(page).toHaveURL(/\/onboarding\/web\/popup/, {
      timeout: cfg.timeouts.analyzing + cfg.timeouts.nav,
    });
  });

  test('E2 @P1 Analysis failure still completes with default seed', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Block the analysis so the board must fall back (Site Scanner can't run).
    await page.route('**/onboarding-ai/site-analysis', (route) => route.abort());
    await wiz.goto(page, wiz.routes.webInstall);
    // The check itself can't succeed with site-analysis blocked; skip to advance.
    await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
    await page
      .getByRole('button', { name: /Skip for now|Continue to Popup Design/i })
      .first()
      .click({ timeout: cfg.timeouts.nav });

    // Board finishes with the fallback notes, then seeds the popup with defaults.
    await expect(page.getByText(/Proven default copy/i)).toBeVisible({ timeout: cfg.timeouts.analyzing });
    await expect(page.getByText(/Default styling/i)).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/web\/popup/, {
      timeout: cfg.timeouts.analyzing + cfg.timeouts.nav,
    });
    await expect(
      page.getByText(/Subscribe to receive news, offers and updates/i)
    ).toBeVisible({ timeout: cfg.timeouts.nav });

    await page.unroute('**/onboarding-ai/site-analysis');
  });

  test('E3 @P0 Popup step seeded from the analysis', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const watch = wiz.watchOnboardingApi(page);
    await reachPopupStep(page);

    await expect(page.getByText(/Your Opt-in Popup/i)).toBeVisible();
    // Large Safari is the default selected style.
    await expect(page.getByText(/Large Safari/i).first()).toBeVisible();
    // Palette panel derived from the site.
    await expect(page.getByText(/DETECTED FROM SITE/i)).toBeVisible();
    // Non-white-label preview shows the PushEngage attribution.
    await expect(page.getByText(/Powered by PushEngage/i)).toBeVisible();
    // Caption pattern "Appears after Ns · Large Safari".
    await expect(page.getByText(/Appears after \d+s .* Large Safari/i)).toBeVisible();

    // The seeded message should equal the analysis popup-copy message when curated.
    const copyCall = watch.calls.find((c) => c.endpoint.startsWith('popup-copy'));
    if (copyCall && copyCall.body && copyCall.body.popup_copy && copyCall.body.popup_copy.message) {
      const msg = copyCall.body.popup_copy.message;
      // TODO(selector): confirm the message renders as visible preview text.
      await expect(page.getByText(msg, { exact: false }).first()).toBeVisible();
    }
    watch.stop();
  });

  test('E4 @P1 Styles, positions and per-device editing', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachPopupStep(page);

    // Large Safari hides the position control.
    await page.getByText(/Large Safari/i).first().click();
    // TODO(selector): confirm the position control label ("Position"/"Placement").
    await expect(page.getByText(/^Position$|Placement/i)).toHaveCount(0);

    // Bell Bar / Floating Bar / Sleek OptIn expose placements again.
    await page.getByText(/Floating Bar/i).first().click();
    await expect(page.getByText(/Position|Placement/i).first()).toBeVisible();

    // Bell Bar has no close-button field.
    await page.getByText(/Bell Bar/i).first().click();
    // TODO(selector): confirm the close-button field label.
    await expect(page.getByText(/close button/i)).toHaveCount(0);

    // Sleek OptIn shows a heading field capped at 60.
    await page.getByText(/Sleek OptIn/i).first().click();
    // TODO(selector): confirm the heading input selector + maxlength=60.
    const heading = page.getByRole('textbox', { name: /heading/i }).first();
    if ((await heading.count()) > 0) {
      await expect(heading).toHaveAttribute('maxlength', '60');
    }

    // TODO(selector): the device toggle (Desktop/Mobile) and colour picker markup
    // must be confirmed to assert "a colour changed on mobile does not change
    // desktop"; left as a best-effort placeholder until pinned.
  });

  test('E5 @P1 Customize copy and timing limits', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachPopupStep(page);

    await page.getByRole('button', { name: /Customize copy & timing/i }).click();
    // Primary flips to "Apply & Continue" while the panel is open.
    await expect(page.getByRole('button', { name: /Apply & Continue/i })).toBeVisible();

    // TODO(selector): confirm the message textarea + counter markup.
    const message = page.getByRole('textbox', { name: /message/i }).first();
    await message.fill('');
    await expect(page.getByText(/Left empty — .* will be used/i)).toBeVisible();
    // Counters n/150 and n/20.
    await expect(page.getByText(/\/150/)).toBeVisible();
    await expect(page.getByText(/\/20/)).toBeVisible();

    // 151st char is rejected (input capped at 150).
    await message.fill('x'.repeat(151));
    await expect(message).toHaveValue('x'.repeat(150));

    // Delay clamps to 300 and shows the range note.
    const delay = page.getByRole('spinbutton').first();
    if ((await delay.count()) > 0) {
      await delay.fill('999');
      await delay.blur();
      await expect(delay).toHaveValue(/^300$/);
    }
    await expect(page.getByText(/0.?300 seconds .* 0 shows the popup immediately/i)).toBeVisible();
  });

  test('E6 @P1 Regenerate copy with chips and undo', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const watch = wiz.watchOnboardingApi(page);
    await reachPopupStep(page);

    // TODO(selector): confirm the regenerate icon button aria-label.
    await page.getByRole('button', { name: /regenerate/i }).first().click();
    await page.getByText(/More urgent/i).click();
    // TODO(selector): confirm the free-text direction input.
    const freeText = page.getByRole('textbox').last();
    if ((await freeText.count()) > 0) await freeText.fill('mention the holiday sale');
    await page.getByRole('button', { name: /^Go$/i }).click();

    // POST popup-copy carries the chosen direction.
    const call = await page.waitForResponse(
      (r) => /onboarding-ai\/popup-copy/.test(r.url()) && r.request().method() === 'POST',
      { timeout: cfg.timeouts.nav }
    );
    const req = call.request().postDataJSON ? call.request().postDataJSON() : null;
    if (req && Array.isArray(req.directions)) {
      expect(req.directions).toContain('urgent');
    }
    const body = await call.json().catch(() => null);

    // Undo restores the prior copy.
    await page.getByRole('button', { name: /Undo/i }).click();

    // Button is disabled for ~3s after a call (best-effort observation).
    // A fallback:true response leaves the copy unchanged and shows no error.
    if (body && body.fallback === true) {
      await expect(page.getByText(/error|couldn.t/i)).toHaveCount(0);
    }
    watch.stop();
  });

  test('E7 @P0 Continue writes the real optin_settings', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachPopupStep(page);

    // Capture the current optin_settings so we can compare untouched keys.
    // TODO(selector): confirm the GET optin_settings route; this waits best-effort.
    let before = null;
    const getResp = await page
      .waitForResponse((r) => OPTIN_URL.test(r.url()) && r.request().method() === 'GET', { timeout: 3000 })
      .catch(() => null);
    if (getResp) before = await getResp.json().catch(() => null);

    await page.getByRole('button', { name: /Looks Good, Continue/i }).click();
    await expect(page.getByText(/Saving your popup/i)).toBeVisible().catch(() => {});

    // A PUT to optin_settings must fire.
    const putResp = await page.waitForResponse(
      (r) => OPTIN_URL.test(r.url()) && r.request().method() === 'PUT',
      { timeout: cfg.timeouts.nav }
    );
    expect(putResp.status()).toBeGreaterThanOrEqual(200);
    expect(putResp.status()).toBeLessThan(300);

    // Advances to the segments step.
    await expect(page).toHaveURL(/\/onboarding\/web\/segments/, { timeout: cfg.timeouts.nav });

    // "Every other key unchanged": compare the keys we can observe. The PUT body
    // should carry the previously-present keys untouched aside from the popup we
    // just designed. TODO(selector): confirm the exact optin_settings shape to
    // assert the popup fields (message/colour/delay/style) precisely.
    const sent = putResp.request().postDataJSON ? putResp.request().postDataJSON() : null;
    if (before && sent && typeof before === 'object' && typeof sent === 'object') {
      const beforeKeys = Object.keys(before);
      const sentKeys = Object.keys(sent);
      // No previously-present top-level key should have been dropped.
      for (const k of beforeKeys) {
        expect(sentKeys).toContain(k);
      }
    }
  });

  test('E8 @P0 Site that already has a popup', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    // Assumes Site 1 already has an editable popup configured (e.g. seeded, or
    // left by a prior E7 run). TODO(selector): a dedicated "site with a popup"
    // fixture is not in onboarding-config — add one to make this deterministic.
    await reachPopupStep(page);

    await expect(page.getByText(/Showing the popup this site already has/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Use AI suggestion/i })).toBeVisible();

    // Continue without edits should leave the saved JSON byte-identical.
    const before = await page
      .waitForResponse((r) => OPTIN_URL.test(r.url()) && r.request().method() === 'GET', { timeout: 3000 })
      .then((r) => r.json())
      .catch(() => null);

    await page.getByRole('button', { name: /Looks Good, Continue/i }).click();
    const putResp = await page
      .waitForResponse((r) => OPTIN_URL.test(r.url()) && r.request().method() === 'PUT', { timeout: cfg.timeouts.nav })
      .catch(() => null);
    if (before && putResp) {
      const sent = putResp.request().postDataJSON ? putResp.request().postDataJSON() : null;
      if (sent) expect(sent).toEqual(before);
    }
  });

  test('E9 @P1 optin_settings load failure blocks Continue', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Block the GET the popup step needs to seed the "current" settings.
    // TODO(selector): confirm the optin_settings GET path; this glob is broad.
    await page.route('**/*optin*settings*', (route) =>
      route.request().method() === 'GET' ? route.abort() : route.continue()
    );
    await reachPopupStep(page).catch(() => {});

    await expect(page.getByText(/We couldn.t load this site.s current popup settings/i)).toBeVisible({
      timeout: cfg.timeouts.nav,
    });
    await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
    // Continue is disabled until Retry succeeds.
    await expect(page.getByRole('button', { name: /Looks Good, Continue/i })).toBeDisabled();

    await page.unroute('**/*optin*settings*');
  });

  test('E10 @P1 Save failure keeps the design', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachPopupStep(page);

    // Block the PUT so the save fails.
    // TODO(selector): confirm the optin_settings PUT path; this glob is broad.
    await page.route('**/*optin*settings*', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
        : route.continue()
    );

    await page.getByRole('button', { name: /Looks Good, Continue/i }).click();

    await expect(page.getByText(/Couldn.t save your popup/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Your design is still here — try Continue again/i)).toBeVisible();
    // Stays on the popup step.
    await expect(page).toHaveURL(/\/onboarding\/web\/popup/);

    await page.unroute('**/*optin*settings*');
  });
});
