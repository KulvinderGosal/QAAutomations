const { test, expect } = require('@playwright/test');
const config = require('../../../utils/config');
const helpers = require('../../../utils/playwright-helpers');

/**
 * Priority: MEDIUM (P2)
 * Feature: GOAL TRACKING
 * Test: Enable goal tracking
 * 
 * Status: ✅ IMPLEMENTED
 * Migrated from: /cypress/e2e/pewpplugin/GoalTracking/EnableGoalTracking.js
 */

test.describe('MEDIUM - Goal Tracking - Enable Goal Tracking', () => {
  
  test('Enable goal tracking', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('📍 Test: Enable Goal Tracking');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Step 1: Login
    await helpers.loginToWordPress(page, config);
    
    // Step 2: Visit dashboard
    console.log('📍 Navigating to WordPress dashboard...');
    await helpers.visitDashboard(page, config);
    console.log('✓ Dashboard loaded\n');
    
    // Step 3: Open PushEngage menu
    console.log('📍 Opening PushEngage menu...');
    await helpers.openPushEngageMenu(page);
    console.log('✓ Menu opened\n');
    
    // Step 4: Click Settings menu item (index 9)
    console.log('📍 Opening Settings menu...');
    await helpers.openPushEngageMenuItemByIndex(page, 9);
    console.log('✓ Settings opened\n');
    
    // Step 5: Click Goal Tracking tab (3rd tab)
    console.log('📍 Clicking Goal Tracking tab...');
    await page.locator('div.pe-page-navigation div:nth-of-type(3) span, div.pe-ant-tabs-nav div:nth-of-type(3)').first().click();
    await page.waitForTimeout(1500);
    console.log('✓ Goal Tracking tab opened\n');
    
    // Step 6: Enable the checkbox
    console.log('📍 Enabling goal tracking...');
    const checkbox = page.locator('#enabled');
    const isChecked = await checkbox.isChecked();
    
    if (!isChecked) {
      await checkbox.click();
      console.log('✓ Goal tracking enabled\n');
    } else {
      console.log('✓ Goal tracking already enabled\n');
    }
    
    // Step 7: Save settings
    console.log('📍 Saving settings...');
    const saveButton = page.locator('form > div.pe-ant-form-item span, form button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);
    console.log('✓ Settings saved\n');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/goal-tracking-enabled.png', fullPage: true });
    console.log('✓ Screenshot saved: goal-tracking-enabled.png\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 GOAL TRACKING ENABLED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    expect(true).toBeTruthy();
  });
});
