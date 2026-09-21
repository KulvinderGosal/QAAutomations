/**
 * Group R — Responsive, visual and accessibility
 * Plan cases R1–R4. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * These exercise the wizard at 1440 / 1024 / 768 / 375 px, by keyboard, and across
 * step transitions. The robust, machine-checkable facts are asserted directly:
 *   - no horizontal page scroll (scrollWidth <= innerWidth + 1) at each width,
 *   - the footer primary stays visible and reachable,
 *   - Tab moves focus onto real interactive controls,
 *   - a step opens scrolled to the top.
 * Pixel-level layout (rail collapse, panel stacking, focus-ring appearance) and
 * AA-contrast / type-scale judgements need a visual diff or axe, so those are
 * test.fixme with the steps + what to confirm spelled out — never faked.
 *
 * Conventions match the reference spec (web-track/01-web-install.spec.js).
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

const WIDTHS = [
  { w: 1440, h: 900, name: 'desktop' },
  { w: 1024, h: 768, name: 'laptop' },
  { w: 768, h: 1024, name: 'tablet' },
  { w: 375, h: 812, name: 'mobile' },
];

/** True when the document has no horizontal overflow (1px tolerance for rounding). */
async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return el.scrollWidth <= window.innerWidth + 1;
  });
}

test.describe('R · Responsive, visual and accessibility', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('R1 @P1 wizard at four widths', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // The install step is the most reliable stage to hold across every width.
    for (const { w, h, name } of WIDTHS) {
      await page.setViewportSize({ width: w, height: h });
      await wiz.goto(page, wiz.routes.webInstall);

      // No horizontal page scroll at any width.
      expect(await noHorizontalScroll(page), `horizontal scroll at ${name} (${w}px)`).toBeTruthy();

      // The footer primary must stay visible (never overflow off-screen).
      // TODO(selector): confirm the footer container; primary is the install CTA.
      await expect(
        page.getByRole('button', { name: /Confirm and Check Status|Continue|Skip for now/i }).first()
      ).toBeVisible();
    }

    // TODO: walking ALL THREE tracks (app + chat) at each width, and confirming the
    //   rail collapses to the mobile stepper, split panels stack, and preview frames
    //   scale, is a visual judgement — cover with a visual diff / screenshot review.
  });

  test('R2 @P1 keyboard operation', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    // Tab should move focus off <body> onto real interactive controls.
    const interactive = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
    let reachedInteractive = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return { tag: null, role: null };
        return { tag: el.tagName, role: el.getAttribute('role'), tabindex: el.getAttribute('tabindex') };
      });
      if (info.tag && (interactive.has(info.tag) || (info.role && /button|tab|link|radio|checkbox/.test(info.role)) || info.tabindex === '0')) {
        reachedInteractive = true;
        break;
      }
    }
    expect(reachedInteractive, 'Tab did not land on any interactive control').toBeTruthy();

    // Focus must actually leave <body> (i.e. the page is keyboard-navigable).
    const active = await page.evaluate(() => (document.activeElement ? document.activeElement.tagName : null));
    expect(active).not.toBe('BODY');

    // Visible focus RING appearance, Enter/Space operability of each specific tile /
    // tab / radio, and "the SW host change does not swallow keyboard events" need a
    // visual + interaction review (and the SW host option is platform-gated).
    // TODO(selector): confirm platform tiles, Manual/AI tabs, SW host radios, copy
    //   buttons, popup chips, and the App SDK status rail; then assert Enter/Space
    //   activation per control and a visible :focus-visible ring.
  });

  test('R3 @P2 type scale', async ({ page }) => {
    // 14px base; nothing under 12px except uppercase section labels; assistant strips
    // and hints readable at AA contrast. Contrast + the "uppercase-label exception"
    // are visual/axe judgements, so this is deferred rather than partially faked.
    test.fixme(true, [
      'Type scale + AA contrast — needs axe / manual review.',
      'Confirm: body base is 14px; no text < 12px except uppercase section labels;',
      '  assistant strips and hint text meet AA contrast.',
      'A light computed-style probe (getComputedStyle(body).fontSize) can seed this',
      '  once the target container for the 14px base is confirmed.',
    ].join(' '));
  });

  test('R4 @P1 step transitions and scroll', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // A freshly-entered step must open scrolled to the top.
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up Web Push/i })
      .or(page.getByText(/Set up Web Push/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/web\/install/);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);

    // Scroll down, then return to the picker via "Choose a different channel" and
    // confirm the next step also opens at the top.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('button', { name: /Choose a different channel/i })
      .or(page.getByText(/Choose a different channel/i)).first().click().catch(() => {});
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);

    // No visible fade-flash / double render on advance, and the App SDK stepper pane
    // scrolling to top on pass change, are visual behaviours.
    // TODO: cover the no-flash / no-double-render and the SDK stepper-pane scroll
    //   with a video/visual review across several advances.
  });
});
