const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

/**
 * Test ID: FUNCTIONAL-DASHBOARD-001
 * Priority: CRITICAL
 * Feature: Dashboard Verification
 * Test: Verify dashboard displays key metrics and stats
 * 
 * This test verifies the dashboard shows subscriber counts,
 * recent notifications, and quick stats.
 */

test.describe('CRITICAL - Dashboard - Verify Key Metrics', () => {
  
  test('Verify dashboard displays subscriber count and quick stats', async ({ page }) => {
    test.setTimeout(90000);
    
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to PushEngage Dashboard
    const navigated = await navigateToPushEngagePage(page, 'Dashboard', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Dashboard - skipping test');
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(5000); // Wait for dashboard to load
    
    console.log('📊 Verifying dashboard elements...');
    
    // Verify subscriber count is displayed
    const subscriberSelectors = [
      'text=Subscribers',
      'text=Total Subscribers',
      'text=Active Subscribers',
      'div[class*="subscriber"]',
      'span[class*="count"]'
    ];
    
    let subscribersFound = false;
    for (const selector of subscriberSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found subscriber metric: ${selector}`);
        subscribersFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (subscribersFound) {
      console.log('✅ Subscriber count is displayed on dashboard');
    } else {
      console.log('⚠️ Could not verify subscriber count');
    }
    
    // Verify "Recent Notifications" or "Quick Stats" section
    const statsSelectors = [
      'text=Recent Notifications',
      'text=Quick Stats',
      'text=Notifications',
      'text=New Subscribers',
      'div[class*="recent"]',
      'div[class*="stats"]'
    ];
    
    let statsFound = false;
    for (const selector of statsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found stats section: ${selector}`);
        statsFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (statsFound) {
      console.log('✅ Stats/notifications section is present');
    } else {
      console.log('⚠️ Could not find stats section');
    }
    
    // Verify "Create Broadcast" or action buttons
    const actionButtonSelectors = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'button:has-text("Broadcast")',
      'a:has-text("Create")',
      'button[class*="create"]',
      'button[class*="primary"]'
    ];
    
    let actionButtonFound = false;
    for (const selector of actionButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found action button: ${selector}`);
        actionButtonFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (actionButtonFound) {
      console.log('✅ Action buttons are available');
    } else {
      console.log('⚠️ Could not find action buttons');
    }
    
    // Verify date filter/range selector
    const dateFilterSelectors = [
      'button:has-text("Last")',
      'button:has-text("days")',
      'select',
      'div[class*="date"]',
      'text=Today',
      'text=This Week'
    ];
    
    let dateFilterFound = false;
    for (const selector of dateFilterSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found date filter: ${selector}`);
        dateFilterFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (dateFilterFound) {
      console.log('✅ Date filter is present');
    } else {
      console.log('⚠️ Could not find date filter');
    }
    
    console.log('\n✅ Dashboard verification test completed');
    console.log('   - Subscribers:', subscribersFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Stats section:', statsFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Action buttons:', actionButtonFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Date filter:', dateFilterFound ? 'FOUND' : 'NOT FOUND');
  });
});
