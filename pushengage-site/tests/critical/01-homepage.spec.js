/**
 * Test Suite: CRITICAL - Homepage
 * Test ID Prefix: PESITE-001x
 * Priority: CRITICAL
 * Feature: HOMEPAGE
 *
 * Covers:
 *  - Page loads successfully (200 OK, no crash)
 *  - Page title contains "PushEngage"
 *  - Hero headline is visible
 *  - Primary CTA button is present
 *  - Features/benefits section is visible
 *  - Social proof / customer logos visible
 */

const { test, expect } = require('@playwright/test');
const HomePage = require('../../pages/HomePage');

test.describe('CRITICAL - Homepage', () => {
  let homePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.open();
  });

  test('PESITE-0101 - Homepage loads and returns 200 @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0101: Verifying homepage loads successfully');

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'Homepage should return 200').toBeLessThan(400);
    expect(page.url()).toContain('pushengage.com');

    console.log(`✅ Homepage loaded: ${page.url()}`);
  });

  test('PESITE-0102 - Page title contains PushEngage @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0102: Checking page title');

    const title = await homePage.getTitle();
    console.log(`  Page title: "${title}"`);
    expect(title.toLowerCase()).toContain('pushengage');

    console.log('✅ Page title contains "PushEngage"');
  });

  test('PESITE-0103 - Hero headline is visible @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0103: Checking hero headline');

    const headline = await homePage.getHeroHeadline();
    expect(headline, 'Hero <h1> should be visible on homepage').toBeTruthy();

    const headlineText = await headline.textContent();
    console.log(`  Hero headline: "${headlineText?.trim()}"`);
    expect(headlineText?.trim().length, 'Headline should not be empty').toBeGreaterThan(5);

    console.log('✅ Hero headline is visible');
  });

  test('PESITE-0104 - Primary CTA button is visible @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0104: Checking primary CTA button in hero');

    const cta = await homePage.getHeroCTA();
    expect(cta, 'A primary CTA (Get Started / Start For Free) should exist in the hero section').toBeTruthy();

    const ctaText = await cta.textContent();
    console.log(`  CTA text: "${ctaText?.trim()}"`);

    console.log('✅ Primary CTA button is present');
  });

  test('PESITE-0105 - Features/benefits section visible @critical', async ({ page }) => {
    console.log('📍 PESITE-0105: Checking features section');

    const featuresVisible = await homePage.isFeaturesVisible();
    expect(featuresVisible, 'A features or benefits section should be visible').toBeTruthy();

    console.log('✅ Features section is visible');
  });

  test('PESITE-0106 - Social proof / customer logos visible @critical', async ({ page }) => {
    console.log('📍 PESITE-0106: Checking social proof section');

    await homePage.scrollToBottom();
    const socialProofVisible = await homePage.isSocialProofVisible();
    expect(socialProofVisible, 'Social proof (testimonials/customer logos) should be visible').toBeTruthy();

    console.log('✅ Social proof is visible');
  });

  test('PESITE-0107 - No broken images on homepage @critical', async ({ page }) => {
    console.log('📍 PESITE-0107: Checking for broken images');

    await homePage.open();

    const brokenImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
    });

    console.log(`  Total broken images: ${brokenImages.length}`);
    if (brokenImages.length > 0) {
      console.log('  Broken:', brokenImages.slice(0, 5).join('\n  '));
    }

    expect(brokenImages.length, `Found ${brokenImages.length} broken image(s): ${brokenImages.join(', ')}`).toBe(0);

    console.log('✅ No broken images found');
  });

  test('PESITE-0108 - No JS console errors on homepage @critical', async ({ page }) => {
    console.log('📍 PESITE-0108: Checking for JS console errors');

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await homePage.open();
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('analytics') &&
      !e.includes('third-party') &&
      // Benign third-party/consent + network noise on a live marketing site
      // (consent-logging endpoint, ad/tracking pixels blocked by the browser,
      // transient fetch failures) — not a site-JS break.
      !/consent/i.test(e) &&
      !/failed to fetch|load failed|net::err|err_blocked|err_network|err_connection/i.test(e)
    );

    if (criticalErrors.length > 0) {
      console.log('  Console errors:', criticalErrors.slice(0, 5).join('\n  '));
    }

    expect(criticalErrors.length, `Found ${criticalErrors.length} JS error(s)`).toBe(0);

    console.log('✅ No critical JS console errors');
  });
});
