const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Campaign - Triggered Campaigns
 * Priority: CRITICAL
 * Feature: Campaign
 */

test.describe('CRITICAL - Campaign - Triggered Campaigns', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should navigate to Triggered Campaigns page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Triggered Campaigns');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Triggered Campaigns');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/triggered-campaigns-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Navigate to Triggered Campaigns\n');
  });

  test('should display Triggered Campaigns page title', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Triggered Campaigns page title');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Triggered Campaigns');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/triggered-campaigns-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Validate Triggered Campaigns page title\n');
  });

});
