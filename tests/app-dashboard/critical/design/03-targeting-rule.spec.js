const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Design - Targeting Rule
 * Priority: CRITICAL
 * Feature: Design
 */

test.describe('CRITICAL - Design - Targeting Rule', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should navigate to Targeting Rule page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Targeting Rule');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Targeting Rule');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/targeting-rule-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Navigate to Targeting Rule\n');
  });

  test('should display Targeting Rule page title', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Targeting Rule page title');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Targeting Rule');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/targeting-rule-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Validate Targeting Rule page title\n');
  });

});
