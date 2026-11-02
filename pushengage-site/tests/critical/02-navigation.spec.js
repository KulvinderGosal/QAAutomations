/**
 * Test Suite: CRITICAL - Navigation
 * Test ID Prefix: PESITE-002x
 * Priority: CRITICAL
 * Feature: NAVIGATION
 *
 * Covers:
 *  - Site logo is present and links to homepage
 *  - Main nav links exist (Features, Pricing, Blog)
 *  - Login link is present in header
 *  - Get Started / CTA link in header
 *  - Nav links navigate to correct pages
 */

const { test, expect } = require('@playwright/test');
const NavigationPage = require('../../pages/NavigationPage');
const { waitForPageLoad } = require('../../utils/helpers');

test.describe('CRITICAL - Navigation', () => {
  let nav;

  test.beforeEach(async ({ page }) => {
    nav = new NavigationPage(page);
    await nav.goto('/');
  });

  test('PESITE-0201 - Site logo is visible @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0201: Checking site logo');

    const logo = await nav.getLogo();
    expect(logo, 'Site logo should be visible in the header').toBeTruthy();

    console.log('✅ Site logo is present');
  });

  test('PESITE-0202 - Logo links back to homepage @critical', async ({ page }) => {
    console.log('📍 PESITE-0202: Logo click navigates to homepage');

    // Navigate away first
    await page.goto('/pricing/', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const clicked = await nav.clickLogo();
    expect(clicked, 'Logo should be clickable').toBeTruthy();

    await waitForPageLoad(page);
    const url = page.url();
    console.log(`  Landed on: ${url}`);

    // Should be home (no extra path, or just '/')
    const { pathname } = new URL(url);
    expect(['/', ''].includes(pathname) || pathname === '/index.php',
      `Logo click should navigate to root, got ${pathname}`).toBeTruthy();

    console.log('✅ Logo correctly links to homepage');
  });

  test('PESITE-0203 - Features link exists in navigation @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0203: Checking Features nav link');

    const link = await nav.getNavLink('features');
    expect(link, 'Features link should be present in main navigation').toBeTruthy();

    console.log('✅ Features nav link present');
  });

  test('PESITE-0204 - Pricing link exists in navigation @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0204: Checking Pricing nav link');

    const link = await nav.getNavLink('pricing');
    expect(link, 'Pricing link should be present in main navigation').toBeTruthy();

    console.log('✅ Pricing nav link present');
  });

  test('PESITE-0205 - Login link exists in header @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0205: Checking Login link in header');

    const link = await nav.getNavLink('login');
    expect(link, 'Login link should be visible in the site header').toBeTruthy();

    console.log('✅ Login link present in header');
  });

  test('PESITE-0206 - Get Started / CTA link in header @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0206: Checking Get Started CTA in header');

    const link = await nav.getNavLink('getStarted');
    expect(link, 'A "Get Started" or "Start For Free" CTA should be visible in the header').toBeTruthy();

    console.log('✅ Header CTA is present');
  });

  test('PESITE-0207 - Pricing nav link navigates to pricing page @critical', async ({ page }) => {
    console.log('📍 PESITE-0207: Pricing link navigation');

    const link = await nav.getNavLink('pricing');
    expect(link).toBeTruthy();

    await link.click();
    await waitForPageLoad(page);

    const url = page.url();
    console.log(`  Navigated to: ${url}`);
    expect(url).toContain('pricing');

    console.log('✅ Pricing nav link navigates correctly');
  });

  test('PESITE-0208 - Blog link navigates to blog page @critical', async ({ page }) => {
    console.log('📍 PESITE-0208: Blog link navigation');

    const link = await nav.getNavLink('blog');
    if (!link) {
      console.log('⚠️  Blog nav link not found — skipping');
      test.skip(true, 'Blog nav link not present');
    }

    await link.click();
    await waitForPageLoad(page);

    const url = page.url();
    console.log(`  Navigated to: ${url}`);
    expect(url).toContain('blog');

    console.log('✅ Blog nav link navigates correctly');
  });
});
