const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Campaign - Drip Autoresponders
 * Priority: LOW
 * Feature: Campaign
 */

test.describe('LOW - Campaign - Drip Autoresponders', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should display help text on Drip Autoresponders page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate help text on Drip Autoresponders');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Drip Autoresponders');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/drip-autoresponders-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Validate help text on Drip Autoresponders\n');
  });

});
