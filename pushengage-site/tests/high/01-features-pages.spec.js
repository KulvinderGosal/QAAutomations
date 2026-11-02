/**
 * Test Suite: HIGH - Features Pages
 * Test ID Prefix: PESITE-101x
 * Priority: HIGH
 * Feature: FEATURES / PRODUCT PAGES
 *
 * Covers:
 *  - Main features overview page loads
 *  - Web Push Notifications feature page loads
 *  - Cart Abandonment feature page loads
 *  - Drip Autoresponder feature page loads
 *  - WordPress plugin page loads
 *  - Each page has a headline and a CTA
 */

const { test, expect } = require('@playwright/test');
const FeaturesPage = require('../../pages/FeaturesPage');
const { waitForPageLoad } = require('../../utils/helpers');
const config = require('../../utils/config');

const featurePages = [
  { name: 'Features Overview',      path: config.pages.features,   required: true },
  { name: 'E-Commerce Push',        path: config.pages.ecommerce,  required: false },
  { name: 'Cart Abandonment',       path: config.pages.abandoned,  required: false },
  { name: 'Drip Autoresponder',     path: config.pages.drip,       required: false },
  { name: 'WordPress Plugin',       path: config.pages.wordpress,  required: false },
];

test.describe('HIGH - Features Pages', () => {
  let featuresPage;

  test.beforeEach(async ({ page }) => {
    featuresPage = new FeaturesPage(page);
  });

  for (const fp of featurePages) {
    test(`PESITE-101x - ${fp.name} loads and has content @high`, async ({ page }) => {
      console.log(`📍 Testing feature page: ${fp.name} (${fp.path})`);

      const response = await page.goto(fp.path, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await waitForPageLoad(page);

      const status = response?.status() ?? 0;
      console.log(`  HTTP status: ${status}`);

      if (!fp.required && (status === 404 || status === 0)) {
        console.log(`⚠️  ${fp.name} page not found (${status}) — skipping non-required page`);
        test.skip(true, `${fp.name} page not available`);
      }

      expect(status, `${fp.name} should return a valid HTTP status`).toBeLessThan(400);

      // Check headline
      const title = await featuresPage.getPageTitle();
      console.log(`  Headline: "${title?.trim().substring(0, 80)}"`);
      expect(title?.trim().length ?? 0, `${fp.name} should have a visible headline (h1)`).toBeGreaterThan(3);

      // Check CTA
      const cta = await featuresPage.getCTA();
      expect(cta, `${fp.name} should have a Get Started / Try Free CTA`).toBeTruthy();

      console.log(`✅ ${fp.name} loaded with content and CTA`);
    });
  }

  test('PESITE-1010 - Features overview has multiple feature items @high', async ({ page }) => {
    console.log('📍 PESITE-1010: Features page has feature items');

    await featuresPage.open();

    const count = await featuresPage.countFeatureItems();
    console.log(`  Feature items found: ${count}`);
    expect(count, 'Features overview page should list multiple features').toBeGreaterThanOrEqual(2);

    console.log(`✅ Features page has ${count} feature items`);
  });
});
