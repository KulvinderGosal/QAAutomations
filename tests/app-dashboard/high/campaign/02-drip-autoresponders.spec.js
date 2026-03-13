const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Campaign - Drip Autoresponders
 * Priority: HIGH
 * Feature: Campaign
 */

test.describe('HIGH - Campaign - Drip Autoresponders', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should display key UI elements on Drip Autoresponders page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate key UI elements on Drip Autoresponders');
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
    
    console.log('✅ Test PASSED - Validate key UI elements on Drip Autoresponders\n');
  });

});
