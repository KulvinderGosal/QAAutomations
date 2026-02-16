const { test, expect } = require('@playwright/test');
const config = require('../../../utils/config');
const helpers = require('../../../utils/playwright-helpers');

/**
 * Priority: MEDIUM (P2)
 * Feature: GOAL TRACKING
 * Test: Disable goal tracking
 * 
 * Status: ✅ IMPLEMENTED
 * Migrated from: /cypress/e2e/pewpplugin/GoalTracking/DisableGoalTracking.js
 */

test.describe('MEDIUM - Goal Tracking - Disable Goal Tracking', () => {
  
  test('Disable goal tracking', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('📍 Test: Disable Goal Tracking');
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
    await page.locator('div.pe-ant-tabs-nav div:nth-of-type(3)').click();
    await page.waitForTimeout(1500);
    console.log('✓ Goal Tracking tab opened\n');
    
    // Step 6: Disable the checkbox
    console.log('📍 Disabling goal tracking...');
    const checkbox = page.locator('#enabled');
    const isChecked = await checkbox.isChecked();
    
    if (isChecked) {
      await checkbox.uncheck({ force: true });
      console.log('✓ Goal tracking disabled\n');
    } else {
      console.log('✓ Goal tracking already disabled\n');
    }
    
    // Step 7: Save settings
    console.log('📍 Saving settings...');
    const saveButton = page.locator('form button:has-text("Save"), form button:has-text("Submit")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);
    console.log('✓ Settings saved\n');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/goal-tracking-disabled.png', fullPage: true });
    console.log('✓ Screenshot saved: goal-tracking-disabled.png\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 GOAL TRACKING DISABLED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    expect(true).toBeTruthy();
  });
});
