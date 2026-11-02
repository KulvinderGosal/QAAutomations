/**
 * Test Suite: MEDIUM - Footer Links
 * Test ID Prefix: PESITE-202x
 * Priority: MEDIUM
 * Feature: FOOTER / NAVIGATION LINKS
 *
 * Covers:
 *  - Footer is visible on homepage
 *  - Footer has Privacy Policy link
 *  - Footer has Terms of Service link
 *  - Footer has copyright notice
 *  - Key footer links navigate without 404
 *  - Social media links present
 */

const { test, expect } = require('@playwright/test');
const { waitForPageLoad } = require('../../utils/helpers');
const config = require('../../utils/config');

test.describe('MEDIUM - Footer Links', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  });

  test('PESITE-2021 - Footer is visible on homepage @medium', async ({ page }) => {
    console.log('📍 PESITE-2021: Footer visibility');

    const footerSelectors = ['footer', '[role="contentinfo"]', '#footer', '.site-footer'];
    let footerVisible = false;

    for (const selector of footerSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        footerVisible = true;
        console.log(`  Footer found: ${selector}`);
        break;
      }
    }

    expect(footerVisible, 'Footer should be visible on homepage').toBeTruthy();
    console.log('✅ Footer is visible');
  });

  test('PESITE-2022 - Footer has Privacy Policy link @medium', async ({ page }) => {
    console.log('📍 PESITE-2022: Privacy Policy in footer');

    const link = await page.locator(
      'footer a:has-text("Privacy"), footer a[href*="privacy"]'
    ).first();

    const visible = await link.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible, 'Footer should contain a Privacy Policy link').toBeTruthy();

    const href = await link.getAttribute('href');
    console.log(`  Privacy Policy href: ${href}`);

    console.log('✅ Privacy Policy link present in footer');
  });

  test('PESITE-2023 - Footer has Terms of Service link @medium', async ({ page }) => {
    console.log('📍 PESITE-2023: Terms of Service in footer');

    const link = await page.locator(
      'footer a:has-text("Terms"), footer a[href*="terms"]'
    ).first();

    const visible = await link.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible, 'Footer should contain a Terms of Service link').toBeTruthy();

    const href = await link.getAttribute('href');
    console.log(`  Terms href: ${href}`);

    console.log('✅ Terms of Service link present in footer');
  });

  test('PESITE-2024 - Footer has copyright notice @medium', async ({ page }) => {
    console.log('📍 PESITE-2024: Footer copyright notice');

    const copyrightSelectors = [
      'footer:has-text("©")',
      'footer:has-text("Copyright")',
      'footer:has-text("PushEngage")',
      '[class*="copyright"]',
    ];

    let copyrightFound = false;
    for (const selector of copyrightSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false)) {
        copyrightFound = true;
        break;
      }
    }

    expect(copyrightFound, 'Footer should contain a copyright notice').toBeTruthy();
    console.log('✅ Copyright notice present in footer');
  });

  test('PESITE-2025 - Footer social media links are present @medium', async ({ page }) => {
    console.log('📍 PESITE-2025: Social media links in footer');

    const socialSelectors = [
      'footer a[href*="twitter.com"]',
      'footer a[href*="x.com"]',
      'footer a[href*="facebook.com"]',
      'footer a[href*="linkedin.com"]',
      'footer a[href*="youtube.com"]',
      'footer [class*="social"]',
      'footer [aria-label*="Twitter" i]',
      'footer [aria-label*="Facebook" i]',
    ];

    let socialCount = 0;
    for (const selector of socialSelectors) {
      const count = await page.locator(selector).count();
      socialCount += count;
    }

    console.log(`  Social links found: ${socialCount}`);
    expect(socialCount, 'Footer should have at least 1 social media link').toBeGreaterThan(0);

    console.log(`✅ ${socialCount} social media links present in footer`);
  });

  test('PESITE-2026 - Privacy Policy page loads without 404 @medium', async ({ page }) => {
    console.log('📍 PESITE-2026: Privacy Policy page');

    const response = await page.goto(config.pages.privacy, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const status = response?.status() ?? 0;
    console.log(`  Status: ${status}`);
    expect(status).toBeLessThan(400);

    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    console.log(`  Page title: "${h1}"`);

    console.log('✅ Privacy Policy page loads');
  });

  test('PESITE-2027 - Terms of Service page loads without 404 @medium', async ({ page }) => {
    console.log('📍 PESITE-2027: Terms of Service page');

    const response = await page.goto(config.pages.terms, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const status = response?.status() ?? 0;
    console.log(`  Status: ${status}`);
    expect(status).toBeLessThan(400);

    console.log('✅ Terms of Service page loads');
  });
});
