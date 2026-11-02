/**
 * Test Suite: LOW - 404 Error Page
 * Test ID Prefix: PESITE-301x
 * Priority: LOW
 * Feature: ERROR PAGES
 *
 * Covers:
 *  - Navigating to a non-existent URL returns 404
 *  - 404 page has user-friendly content (not blank)
 *  - 404 page has navigation links so user can recover
 *  - 404 page has a link back to homepage
 */

const { test, expect } = require('@playwright/test');
const { waitForPageLoad } = require('../../utils/helpers');

test.describe('LOW - 404 Error Page', () => {

  test('PESITE-3011 - Non-existent URL returns 404 @low', async ({ page }) => {
    console.log('📍 PESITE-3011: 404 HTTP status for unknown URL');

    const response = await page.goto('/this-page-definitely-does-not-exist-xyz-123/', {
      waitUntil: 'domcontentloaded',
    });

    const status = response?.status() ?? 0;
    console.log(`  HTTP status: ${status}`);
    expect(status).toBe(404);

    console.log('✅ Non-existent URL correctly returns 404');
  });

  test('PESITE-3012 - 404 page is not blank @low', async ({ page }) => {
    console.log('📍 PESITE-3012: 404 page has content');

    await page.goto('/this-page-definitely-does-not-exist-xyz-123/', {
      waitUntil: 'domcontentloaded',
    });
    await waitForPageLoad(page);

    const bodyText = await page.locator('body').textContent();
    console.log(`  Body text length: ${bodyText?.trim().length}`);
    expect(bodyText?.trim().length ?? 0, '404 page should not be blank').toBeGreaterThan(10);

    console.log('✅ 404 page has content');
  });

  test('PESITE-3013 - 404 page has user-friendly error message @low', async ({ page }) => {
    console.log('📍 PESITE-3013: 404 page shows friendly error');

    await page.goto('/this-page-definitely-does-not-exist-xyz-123/', {
      waitUntil: 'domcontentloaded',
    });
    await waitForPageLoad(page);

    const friendlySelectors = [
      ':has-text("404")',
      ':has-text("not found")',
      ':has-text("page not found")',
      ':has-text("doesn\'t exist")',
      ':has-text("does not exist")',
      ':has-text("oops")',
    ];

    let hasMessage = false;
    for (const selector of friendlySelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false)) {
        hasMessage = true;
        const text = await page.locator(selector).first().textContent();
        console.log(`  Error message found: "${text?.trim().substring(0, 60)}"`);
        break;
      }
    }

    expect(hasMessage, '404 page should display a user-friendly error message').toBeTruthy();
    console.log('✅ 404 page shows friendly error message');
  });

  test('PESITE-3014 - 404 page has a link back to homepage @low', async ({ page }) => {
    console.log('📍 PESITE-3014: 404 page has home link');

    await page.goto('/this-page-definitely-does-not-exist-xyz-123/', {
      waitUntil: 'domcontentloaded',
    });
    await waitForPageLoad(page);

    const homeLinkSelectors = [
      'a[href="/"]',
      'a:has-text("Home")',
      'a:has-text("Go Home")',
      'a:has-text("Back to Home")',
      'header a[href="/"]',
    ];

    let homeLink = null;
    for (const selector of homeLinkSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        homeLink = el;
        break;
      }
    }

    expect(homeLink, '404 page should have a link back to the homepage').toBeTruthy();
    console.log('✅ 404 page has a home link');
  });

  test('PESITE-3015 - 404 page has working navigation @low', async ({ page }) => {
    console.log('📍 PESITE-3015: 404 page navigation works');

    await page.goto('/this-page-definitely-does-not-exist-xyz-123/', {
      waitUntil: 'domcontentloaded',
    });
    await waitForPageLoad(page);

    // Header/nav should still be present
    const navSelectors = ['header', 'nav', '[role="navigation"]'];
    let navFound = false;

    for (const selector of navSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false)) {
        navFound = true;
        break;
      }
    }

    expect(navFound, '404 page should still show main navigation').toBeTruthy();
    console.log('✅ 404 page shows navigation header');
  });
});
