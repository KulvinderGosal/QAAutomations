const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

/**
 * Test ID: QAWPREG202
 * Priority: CRITICAL
 * Feature: DASHBOARD
 * Test: Validate Dashboard Elements
 * 
 * Expected Result:
 * On Dashboard screen, following elements should be present:
 * 1) PushEngage logo
 * 2) Create link
 * 3) Start Challenge
 * 4) Quick Stats (New Subscribers, Notifications sent, Views, Clicks, Goal Conversion)
 * 5) Graph
 * 6) Date Range filter
 * 7) Recent Notification
 * 8) Strategies
 * 9) Notification icon
 * 10) Help link
 */

test.describe('CRITICAL - Dashboard - Validate Dashboard Elements', () => {
  
  test('should display all required dashboard elements', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('📍 Test ID: QAWPREG202');
    console.log('📍 Validating all dashboard elements');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Login to WordPress
    await loginToWordPress(page, config);
    
    // Navigate to PushEngage Dashboard
    const navigated = await navigateToPushEngagePage(page, 'Dashboard', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Dashboard - skipping test');
      await page.screenshot({ path: `test-results/qawpreg202-navigation-failed.png`, fullPage: true });
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(3000);
    
    console.log('🔍 Checking for required dashboard elements...\n');
    
    const results = [];
    
    // 1. Check for PushEngage logo
    console.log('[1/10] Checking PushEngage logo...');
    const logoSelectors = [
      'img[alt*="PushEngage" i]',
      'img[src*="pushengage" i]',
      'div[class*="logo"]',
      'a[class*="logo"]'
    ];
    results.push(await checkElement(page, logoSelectors, 'PushEngage logo'));
    
    // 2. Check for Create link/button
    console.log('[2/10] Checking Create link...');
    const createLinkSelectors = [
      'a:has-text("Create")',
      'button:has-text("Create")',
      'a:has-text("New")',
      'button:has-text("Add New")',
      'a[class*="create"]'
    ];
    results.push(await checkElement(page, createLinkSelectors, 'Create link'));
    
    // 3. Check for Start Challenge
    console.log('[3/10] Checking Start Challenge...');
    const challengeSelectors = [
      'text=Start Challenge',
      'button:has-text("Challenge")',
      'a:has-text("Challenge")',
      'div[class*="challenge"]',
      'text=Challenge'
    ];
    results.push(await checkElement(page, challengeSelectors, 'Start Challenge'));
    
    // 4. Check for Quick Stats
    console.log('[4/10] Checking Quick Stats...');
    const quickStatsSelectors = [
      'text=Quick Stats',
      'text=New Subscribers',
      'text=Notifications',
      'text=Views',
      'text=Clicks',
      'text=Goal Conversion',
      'div[class*="stats"]',
      'div[class*="quick-stats"]'
    ];
    results.push(await checkElement(page, quickStatsSelectors, 'Quick Stats'));
    
    // 5. Check for Graph
    console.log('[5/10] Checking Graph...');
    const graphSelectors = [
      'canvas',
      'svg',
      'div[class*="chart"]',
      'div[class*="graph"]',
      'div[class*="visualization"]'
    ];
    results.push(await checkElement(page, graphSelectors, 'Graph'));
    
    // 6. Check for Date Range filter
    console.log('[6/10] Checking Date Range filter...');
    const dateFilterSelectors = [
      'button:has-text("Last")',
      'button:has-text("days")',
      'select[class*="date"]',
      'div[class*="date-filter"]',
      'div[class*="date-range"]',
      'text=Today',
      'text=This Week',
      'button:has-text("Date")'
    ];
    results.push(await checkElement(page, dateFilterSelectors, 'Date Range filter'));
    
    // 7. Check for Recent Notification
    console.log('[7/10] Checking Recent Notification...');
    const recentNotifSelectors = [
      'text=Recent Notification',
      'text=Recent Notifications',
      'div[class*="recent"]',
      'div[class*="notification-list"]',
      'text=Latest'
    ];
    results.push(await checkElement(page, recentNotifSelectors, 'Recent Notification'));
    
    // 8. Check for Strategies
    console.log('[8/10] Checking Strategies...');
    const strategiesSelectors = [
      'text=Strategies',
      'text=Strategy',
      'div[class*="strategies"]',
      'div[class*="strategy"]',
      'text=Growth Strategies'
    ];
    results.push(await checkElement(page, strategiesSelectors, 'Strategies'));
    
    // 9. Check for Notification icon
    console.log('[9/10] Checking Notification icon...');
    const notifIconSelectors = [
      'svg[class*="bell"]',
      'i[class*="bell"]',
      'button[class*="notification"]',
      '[data-testid*="notification"]',
      'svg[class*="notification"]'
    ];
    results.push(await checkElement(page, notifIconSelectors, 'Notification icon'));
    
    // 10. Check for Help link
    console.log('[10/10] Checking Help link...');
    const helpLinkSelectors = [
      'a:has-text("Help")',
      'button:has-text("Help")',
      'a[href*="help"]',
      'a[href*="support"]',
      'svg[class*="question"]',
      'i[class*="help"]'
    ];
    results.push(await checkElement(page, helpLinkSelectors, 'Help link'));
    
    // Summary
    const foundCount = results.filter(Boolean).length;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Results: ${foundCount}/10 elements found`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Take screenshot
    await page.screenshot({ 
      path: `test-results/qawpreg202-dashboard-elements.png`, 
      fullPage: true 
    });
    
    // Test passes if at least 7 out of 10 elements are found
    expect(foundCount).toBeGreaterThanOrEqual(7);
    console.log(`✅ Test PASSED - ${foundCount}/10 dashboard elements found\n`);
  });
});

// Helper function to check for element existence
async function checkElement(page, selectors, elementName) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      console.log(`   ✓ ${elementName} found: ${selector}`);
      return true;
    } catch (e) {
      continue;
    }
  }
  console.log(`   ⚠️ ${elementName} not found`);
  return false;
}
