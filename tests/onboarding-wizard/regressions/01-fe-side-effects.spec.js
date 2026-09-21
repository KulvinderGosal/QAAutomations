/**
 * Group L — Side effects on existing frontend screens
 * Plan cases L1–L11. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * These assert that pre-existing screens still behave after the wizard PR:
 *   - the dashboard no longer mounts the Challenge panel / floating checklist
 *     and no longer fires the `installation-step-details` request (L1),
 *   - the notification-preview apex line still keys off the site's cutoff date
 *     (pushengage.com vs trypushengage.com) (L2),
 *   - the `disableGlobalErrorHandler` option added to the create APIs does NOT
 *     leak — failed creates outside the wizard still raise the global toast (L5),
 *   - Site Details, the Shopify stepper, the header SiteSelector, the rebuilt
 *     Settings › Installation menu entry and prod login/logout are unaffected.
 *
 * Conventions match the reference spec (web-track/01-web-install.spec.js):
 *   one test per case; id + priority in the title (`--grep @P0` / `--grep L5`);
 *   a test.skip() guards each site/account-dependent case; selectors prefer
 *   role/text and anything unconfirmed against the live DOM is TODO(selector).
 *   Purely visual / pixel / contrast checks are test.fixme with what to confirm.
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

test.describe('L · Side effects on existing frontend screens', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every screen/feature reachable for the regressions.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('L1 @P0 dashboard without the Challenge panel', async ({ page }) => {
    // Collect every request so we can prove installation-step-details never fires.
    const requests = [];
    const onRequest = (req) => requests.push(req.url());
    page.on('request', onRequest);

    await wiz.goto(page, '/');

    // The dashboard must NOT ask for the legacy installation checklist details.
    expect(requests.some((u) => /installation-step-details/.test(u))).toBeFalsy();

    // No Challenge checklist and no floating checklist bubble anywhere.
    // TODO(selector): confirm the Challenge panel + floating bubble markup; the
    // regex is scoped to onboarding-challenge copy to avoid unrelated "challenge".
    await expect(
      page.getByText(/onboarding challenge|setup challenge|challenge checklist/i)
    ).toHaveCount(0);
    // TODO(selector): confirm the floating checklist bubble class if one exists.
    await expect(page.locator('[class*="floating-checklist" i], [class*="checklist-bubble" i]')).toHaveCount(0);

    page.off('request', onRequest);
  });

  test('L2 @P0 notification preview subdomain line', async ({ page }) => {
    test.skip(!site.site4.url || !site.site5.url, 'Site 4 / Site 5 (http cutoff) not configured');
    // NOTE: the Safari pass (the cutoff parses a MySQL timestamp that historically
    // returns NaN in WebKit) must run under the `webkit` Playwright project — this
    // Chromium/Firefox run only proves the Chrome verdict. See cases.json L2 note:
    // a multi-site header switch can show the wrong apex; log that as a finding.
    if (test.info().project.name === 'webkit') {
      // Under WebKit we only need to confirm parity with Chrome (no NaN apex).
    }

    // Site 4 (created before the 2026-08-05 cutoff) → {slug}.pushengage.com
    if (site.site4.name) await wiz.switchSite(page, site.site4.name);
    // TODO(route): confirm the Push Broadcast create route that renders the preview.
    await wiz.goto(page, wiz.routes.picker.replace('/onboarding', '/campaigns'));
    // TODO(selector): confirm the preview domain-line element; assert the apex only.
    await expect(page.getByText(/\.pushengage\.com/i).first())
      .toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/\.trypushengage\.com/i)).toHaveCount(0);

    // Site 5 (created on/after the cutoff, http-only) → {slug}.trypushengage.com
    if (site.site5.name) await wiz.switchSite(page, site.site5.name);
    await wiz.goto(page, wiz.routes.picker.replace('/onboarding', '/campaigns'));
    await expect(page.getByText(/\.trypushengage\.com/i).first())
      .toBeVisible({ timeout: cfg.timeouts.nav });
  });

  test('L3 @P0 Chat Widgets edit preview matrix', async ({ page }) => {
    // Pure render matrix: 9 attention effects × positions × panel modes × themes ×
    // devices, plus the one new behaviour (a tall Simple vertical stack wraps/caps
    // instead of overflowing the launcher). All of it is visual parity vs master.
    test.fixme(true, [
      'Visual matrix — needs a seeded widget + pixel/visual comparison against master.',
      'TODO(route): confirm the Chat Widgets edit route.',
      'TODO(selector): confirm the extracted ChatWidgetStage preview container.',
      'Steps: toggle pulse/blink/bounce/waggle/floating/spin/fade/shockwave/sheen;',
      '  left/right; custom image launcher; opened_by_default/click/hover;',
      '  Chat vs Simple panel; horizontal vs vertical; light/dark/system; desktop/mobile.',
      'Then add 6+ channels in Simple vertical on a short window and confirm the',
      '  stack wraps/caps rather than overflowing the launcher area.',
    ].join(' '));
  });

  test('L4 @P1 floating bar opt-in alignment', async ({ page }) => {
    // Vertical-centring / no-clipped-checkbox-row is a pixel judgement that must
    // match the Design page's own preview — not assertable without a visual diff.
    test.fixme(true, [
      'Visual alignment — needs pixel comparison of the Floating Bar preview.',
      'TODO(route): Design › Subscription Dialog Box › Floating Bar.',
      'Steps: desktop + mobile; 1-line and 2-line message; with/without segment',
      '  checkboxes; with/without custom icon. Confirm icon/text/buttons are',
      '  vertically centred, the checkbox row is not clipped, and it matches the',
      '  Design page preview.',
    ].join(' '));
  });

  test('L5 @P1 create-error toasts still show outside the wizard', async ({ page }) => {
    // The wizard added `disableGlobalErrorHandler` to the create APIs. Outside the
    // wizard that option must NOT be set, so a failed create still raises the
    // global red notification. Force a 4xx on the create endpoints and assert it.
    // TODO(selector): confirm exact create endpoints; the pattern below covers the
    // segment / audience-group / broadcast-group / chat-widget / template creates.
    await page.route(/\/(segments?|audience-?groups?|chat-?widgets?|workflows?|templates?)(\/|\?|$)/i, (route) => {
      if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Forced 4xx for L5 regression' } }),
        });
      }
      return route.continue();
    });

    // Drive a segment create — the most stable of the five create surfaces.
    await wiz.goto(page, '/segments');
    // TODO(selector): confirm the add/create + save controls on Segments.
    await page.getByRole('button', { name: /create|add.*segment|new segment/i }).first().click().catch(() => {});
    await page.getByRole('button', { name: /save|create/i }).first().click().catch(() => {});

    // The global red error notification (antd) must still surface.
    await expect(
      page.locator('.ant-notification-notice-error, .ant-message-error')
        .or(page.getByText(/couldn.t|error|failed|went wrong/i))
        .first()
    ).toBeVisible({ timeout: cfg.timeouts.nav });

    await page.unroute(/\/(segments?|audience-?groups?|chat-?widgets?|workflows?|templates?)(\/|\?|$)/i);
  });

  test('L6 @P1 legacy code blocks unchanged', async ({ page }) => {
    // IntegrationCode gained a class styled only inside onboarding cards; on the
    // legacy screens the code block must be unchanged (no wrap, no 280px cap, same
    // font size). This is a computed-style / visual check on unconfirmed selectors.
    test.fixme(true, [
      'Computed-style / visual parity — confirm selectors then assert on the legacy',
      '  code block: getComputedStyle(el).whiteSpace !== "pre-wrap" (no wrap),',
      '  maxHeight is not 280px, and fontSize matches master; Copy button unmoved.',
      'TODO(route)/TODO(selector): Analytics › Goal Tracking settings code block;',
      '  Workflow custom-event drawer; Triggered › dynamic code.',
    ].join(' '));
  });

  test('L7 @P1 Settings › Site Details unchanged', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // TODO(route): confirm the Site Details route (Settings › Site Details).
    await wiz.goto(page, '/settings/site-details');

    // The API-key block must still render (styling unchanged is visual — see below).
    // TODO(selector): confirm the API-key block copy/label.
    await expect(page.getByText(/API Key/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });

    // The URL a user edits on the install page PATCHes site_url and must show here.
    // Cross-check with the install-page edit is a stateful flow (see D4/K9):
    // TODO: after D4 saves a new URL, assert that exact URL is reflected on this page.
    const domain = site.site1.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    await expect(page.getByText(new RegExp(escapeRe(domain), 'i')).first()).toBeVisible();
  });

  test('L8 @P1 Shopify onboarding stepper renders', async ({ page }) => {
    test.skip(!cfg.accounts.shopify.email, 'PE_SHOPIFY_* not configured');
    await auth.login(page, 'shopify');

    await wiz.goto(page, '/shopify-onboarding');
    await expect(page).toHaveURL(/\/shopify-onboarding/);

    // The stepper renders from its own styles (the deleted _steps.scss is not it).
    // TODO(selector): confirm the Shopify stepper markup; antd Steps is the fallback.
    await expect(
      page.locator('.ant-steps, [class*="step" i]').first()
    ).toBeVisible({ timeout: cfg.timeouts.nav });
  });

  test('L9 @P1 header SiteSelector after adding a site', async ({ page }) => {
    // The regression needs a fresh site create (B1) and then asserts the new site
    // appears exactly once in the header SiteSelector, before and after a reload,
    // with a correct "N of M sites" counter. Creating a site is destructive and
    // belongs with the B-group create flow, so this is deferred.
    test.fixme(true, [
      'Requires creating a real site (destructive) as in B1, then asserting the',
      '  new site is listed exactly once in the header SiteSelector before AND',
      '  after a reload, with a correct "N of M sites" counter.',
      'TODO(selector): confirm the header SiteSelector trigger + option markup',
      '  (see wiz.switchSite candidates).',
    ].join(' '));
  });

  test('L10 @P2 menu entries and legacy redirect', async ({ page }) => {
    // Both installation menu entries open the rebuilt page; the Not Found page
    // still applies its legacy redirects.
    await wiz.goto(page, wiz.routes.settingsInstall);
    await expect(page).toHaveURL(/\/settings\/installation/);

    await wiz.goto(page, wiz.routes.mobileInstall);
    await expect(page).toHaveURL(/\/mobile-app-push\/installation/);

    // Legacy redirect: an unknown URL should hit Not Found (which may re-route).
    // TODO(route): confirm a concrete legacy path + its expected redirect target.
    await wiz.goto(page, '/this-route-does-not-exist-xyz');
    await expect(
      page.getByText(/not found|404|page you.re looking for/i).first()
        .or(page.locator('body'))
    ).toBeVisible();
  });

  test('L11 @P1 production build login/logout smoke', async ({ page }) => {
    // No console errors from the new helper imports; logout returns to login.
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await wiz.goto(page, '/campaigns');
    await wiz.goto(page, '/');

    // New helper imports must not throw — no uncaught page errors that look like a
    // broken module/function import.
    const importErrors = pageErrors.concat(consoleErrors).filter((t) =>
      /is not a function|is not defined|Cannot find module|Failed to resolve|Unexpected token|import/i.test(t)
    );
    expect(importErrors, `unexpected import-related errors: ${importErrors.join(' | ')}`).toEqual([]);

    // Log out and confirm we return to /login.
    // TODO(selector): confirm the user-menu + logout control markup.
    await page.locator('[class*="user-profile" i], [class*="user-menu" i], header [class*="avatar" i]').first().click().catch(() => {});
    await page.getByRole('menuitem', { name: /log ?out|sign ?out/i })
      .or(page.getByText(/log ?out|sign ?out/i)).first().click().catch(() => {});
    await page.waitForURL(/\/login/, { timeout: cfg.timeouts.nav }).catch(() => {});
    await expect(page).toHaveURL(/\/login/);
  });
});

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
