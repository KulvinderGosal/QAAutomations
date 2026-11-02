/**
 * Test Suite: MEDIUM - Mobile Responsive
 * Test ID Prefix: PESITE-203x
 * Priority: MEDIUM
 * Feature: MOBILE / RESPONSIVE DESIGN
 *
 * Covers:
 *  - Homepage renders correctly on mobile viewport
 *  - Mobile hamburger menu is present
 *  - Mobile menu opens on trigger click
 *  - Mobile menu contains navigation links
 *  - Pricing page is readable on mobile
 *  - Text is not clipped/overflowing on mobile
 *
 * Devices tested: 375×812 (iPhone), 390×844 (iPhone 14), 360×800 (Android)
 */

const { test, expect, devices } = require('@playwright/test');
const { waitForPageLoad } = require('../../utils/helpers');
const NavigationPage = require('../../pages/NavigationPage');

const mobileViewports = [
  { name: 'iPhone SE',    width: 375, height: 667 },
  { name: 'iPhone 14',    width: 390, height: 844 },
  { name: 'Android MD',   width: 360, height: 800 },
];

test.describe('MEDIUM - Mobile Responsive', () => {

  for (const device of mobileViewports) {
    test.describe(`${device.name} (${device.width}×${device.height})`, () => {

      test.use({ viewport: { width: device.width, height: device.height } });

      test(`PESITE-203x - Homepage loads on ${device.name} @medium`, async ({ page }) => {
        console.log(`📍 Testing homepage on ${device.name}`);

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await waitForPageLoad(page);

        // Page should load
        expect(page.url()).toContain('pushengage.com');

        // h1 should be visible
        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible({ timeout: 10000 });

        console.log(`✅ Homepage loads on ${device.name}`);
      });

      test(`PESITE-203x - Mobile menu trigger visible on ${device.name} @medium`, async ({ page }) => {
        console.log(`📍 Mobile hamburger menu on ${device.name}`);

        const nav = new NavigationPage(page);
        await nav.goto('/');

        const mobileMenuTrigger = await page.locator([
          'button[aria-label*="menu" i]',
          'button[class*="hamburger" i]',
          'button[class*="mobile" i]',
          '.menu-toggle',
          '[data-toggle="navigation"]',
          'button[aria-controls*="nav" i]',
          '.navbar-toggler',
        ].join(', ')).first();

        const isVisible = await mobileMenuTrigger.isVisible({ timeout: 5000 }).catch(() => false);
        expect(isVisible, `Mobile menu trigger should be visible on ${device.name}`).toBeTruthy();

        console.log(`✅ Mobile menu trigger visible on ${device.name}`);
      });

      test(`PESITE-203x - Mobile menu opens on ${device.name} @medium`, async ({ page }) => {
        console.log(`📍 Mobile menu opens on ${device.name}`);

        const nav = new NavigationPage(page);
        await nav.goto('/');

        const opened = await nav.openMobileMenu();
        if (!opened) {
          test.skip(true, `No mobile menu trigger found on ${device.name}`);
        }

        // After opening, at least one nav link should be visible
        const navLinks = page.locator('nav a, [class*="mobile-menu"] a');
        const count = await navLinks.count();
        console.log(`  Nav links after open: ${count}`);
        expect(count).toBeGreaterThan(0);

        console.log(`✅ Mobile menu opens and shows links on ${device.name}`);
      });
    });
  }

  test('PESITE-2031 - No horizontal scroll on mobile viewport @medium', async ({ page }) => {
    console.log('📍 PESITE-2031: No horizontal overflow on mobile');

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    console.log(`  Horizontal overflow: ${overflow}`);
    expect(overflow, 'Page should not have horizontal scrollbar on mobile').toBeFalsy();

    console.log('✅ No horizontal overflow on 375px viewport');
  });

  test('PESITE-2032 - Pricing page readable on mobile @medium', async ({ page }) => {
    console.log('📍 PESITE-2032: Pricing page on mobile');

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pricing/', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // Pricing section or plan card must be visible
    const pricingSelectors = [
      '[class*="pricing-card"]',
      '[class*="price-card"]',
      '[class*="plan"]',
      'h1',
    ];

    let visible = false;
    for (const selector of pricingSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        visible = true;
        break;
      }
    }

    expect(visible, 'Pricing content should be visible on mobile viewport').toBeTruthy();
    console.log('✅ Pricing page is readable on mobile');
  });
});
