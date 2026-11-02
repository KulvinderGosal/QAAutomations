/**
 * Test Suite: HIGH - CTA Button Flows
 * Test ID Prefix: PESITE-102x
 * Priority: HIGH
 * Feature: CONVERSION PATHS / CTA BUTTONS
 *
 * Covers:
 *  - Header "Get Started" navigates to signup
 *  - Hero CTA navigates to signup
 *  - Pricing page plan CTA navigates to signup
 *  - Footer "Get Started" / CTA navigates to signup
 *  - All primary CTAs have valid hrefs (no #, no javascript:void)
 */

const { test, expect } = require('@playwright/test');
const HomePage = require('../../pages/HomePage');
const NavigationPage = require('../../pages/NavigationPage');
const PricingPage = require('../../pages/PricingPage');
const { waitForPageLoad } = require('../../utils/helpers');

// The marketing site's conversion paths: header "Get Started" → /pricing/, the
// hero "Book a strategy call" → /demo, and the app subdomain (signup lives in
// the app now — /register redirects to /pricing). Accept all of these.
const SIGNUP_PATTERN = /signup|register|get-started|start-free|pricing|demo|app\.pushengage/i;

test.describe('HIGH - CTA Buttons / Conversion Paths', () => {

  test('PESITE-1021 - Header Get Started CTA links to signup @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1021: Header CTA → signup');

    const nav = new NavigationPage(page);
    await nav.goto('/');

    const cta = await nav.getNavLink('getStarted');
    expect(cta, 'Header Get Started CTA should exist').toBeTruthy();

    const href = await cta.getAttribute('href');
    console.log(`  Header CTA href: ${href}`);
    expect(href, 'Header CTA should point to a signup/register URL').toMatch(SIGNUP_PATTERN);

    console.log('✅ Header CTA links to signup');
  });

  test('PESITE-1022 - Hero CTA navigates to signup @smoke @high', async ({ page }) => {
    console.log('📍 PESITE-1022: Hero CTA → signup');

    const homePage = new HomePage(page);
    await homePage.open();

    const cta = await homePage.getHeroCTA();
    expect(cta, 'Hero CTA should be present').toBeTruthy();

    const href = await cta.getAttribute('href');
    console.log(`  Hero CTA href: ${href}`);

    if (href && !href.startsWith('http') && !href.startsWith('/')) {
      console.log('⚠️  Href is relative without leading slash');
    }

    expect(href, 'Hero CTA should link to signup/register').toMatch(SIGNUP_PATTERN);

    console.log('✅ Hero CTA links to signup');
  });

  test('PESITE-1023 - Pricing plan CTA links to signup @high', async ({ page }) => {
    console.log('📍 PESITE-1023: Pricing CTA → signup');

    const pricingPage = new PricingPage(page);
    await pricingPage.open();

    const cta = await pricingPage.getPlanCTA();
    expect(cta).toBeTruthy();

    const href = await cta.getAttribute('href');
    console.log(`  Pricing CTA href: ${href}`);
    if (href && href !== '#') {
      expect(href).toMatch(SIGNUP_PATTERN);
    } else {
      // "Get Started" CTAs are <a> without href — they JS-navigate to
      // app.pushengage.com / signup. Verify functionally by clicking.
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 8000 }).catch(() => null),
        cta.click().catch(() => undefined),
      ]);
      let dest = page.url();
      if (popup) dest = popup.url();
      else { await page.waitForURL(SIGNUP_PATTERN, { timeout: 12000 }).catch(() => undefined); dest = page.url(); }
      console.log(`  CTA (JS-navigated) landed on: ${dest}`);
      expect(dest, 'Pricing CTA should lead to a signup/app URL').toMatch(SIGNUP_PATTERN);
    }

    console.log('✅ Pricing CTA links to signup');
  });

  test('PESITE-1024 - Footer CTA / Get Started links to signup @high', async ({ page }) => {
    console.log('📍 PESITE-1024: Footer CTA → signup');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // The site footer is footer#colophon.site-footer (an article footer.entry-footer
    // comes first in the DOM). Since the 2026-07 funnel change it has no "Get
    // Started"/signup link: its conversion link is "Plans & Pricing" → /pricing/
    // (the header "Get Started" goes there too; signup starts from the plan CTAs).
    // The old probe looked only for signup wording, so it skipped on every run.
    const footer = page.locator('footer#colophon, footer.site-footer').first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer, 'The site footer should render').toBeVisible();

    const footerCTA = footer
      .getByRole('link', { name: /get started|start for free|try (it )?free|sign\s*up|plans\s*&\s*pricing/i })
      .filter({ visible: true })
      .first();
    await expect(footerCTA, 'Footer should expose a conversion link (Get Started / Sign up / Plans & Pricing)').toBeVisible();

    const text = ((await footerCTA.textContent()) || '').replace(/\s+/g, ' ').trim();
    const href = await footerCTA.getAttribute('href');
    console.log(`  Footer CTA "${text}" href: ${href}`);
    expect(href, 'Footer CTA should point to the signup funnel (signup / pricing / app)').toMatch(SIGNUP_PATTERN);
    expect(href, 'Footer CTA must not be a dead link').not.toMatch(/^(#|javascript:)/i);

    console.log('✅ Footer CTA links to signup');
  });

  test('PESITE-1025 - All visible CTAs have valid hrefs (not # or void) @high', async ({ page }) => {
    console.log('📍 PESITE-1025: Validate CTA hrefs are not broken');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const ctaSelectors = [
      'a:has-text("Get Started")',
      'a:has-text("Start For Free")',
      'a:has-text("Try Free")',
    ];

    const invalidCTAs = [];

    for (const selector of ctaSelectors) {
      const elements = await page.locator(selector).all();
      for (const el of elements) {
        if (!(await el.isVisible().catch(() => false))) continue;
        const href = await el.getAttribute('href');
        const text = await el.textContent();
        if (!href || href === '#' || href.startsWith('javascript:')) {
          invalidCTAs.push({ text: text?.trim(), href });
        }
      }
    }

    console.log(`  Invalid CTA hrefs: ${invalidCTAs.length}`);
    if (invalidCTAs.length > 0) {
      console.log('  Details:', JSON.stringify(invalidCTAs, null, 2));
    }

    expect(invalidCTAs.length, `${invalidCTAs.length} CTA(s) have broken/empty hrefs`).toBe(0);

    console.log('✅ All CTA buttons have valid href attributes');
  });
});
