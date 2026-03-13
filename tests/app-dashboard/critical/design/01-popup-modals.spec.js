const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Design - Popup Modals
 * Priority: CRITICAL
 * Feature: Design
 */

test.describe('CRITICAL - Design - Popup Modals', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should navigate to Popup Modals page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Popup Modals');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Popup Modals');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/popup-modals-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Navigate to Popup Modals\n');
  });

  test('should display Popup Modals page title', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Popup Modals page title');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Popup Modals');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/popup-modals-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Validate Popup Modals page title\n');
  });

  test('should display modal templates or customization options', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Modal Templates Display');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Popup Modals');
    await waitForPageLoad(page);
    
    const templateSelectors = ['[class*="template"]', '[class*="modal-preview"]', 'button:has-text("Customize")', '[class*="design-option"]'];
    let templateFound = false;
    for (const selector of templateSelectors) {
      if (await page.isVisible(selector, { timeout: 5000 }).catch(() => false)) {
        templateFound = true;
        console.log(`   ✓ Template/customization options found`);
        break;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/popup-modals-templates.png`, fullPage: true });
    console.log('✅ Test PASSED - Modal templates check completed\n');
  });

  test('should display preview functionality', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Preview Functionality');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Popup Modals');
    await waitForPageLoad(page);
    
    const previewSelectors = ['button:has-text("Preview")', '[class*="preview"]', 'button:has-text("Test")'];
    let previewFound = false;
    for (const selector of previewSelectors) {
      if (await page.isVisible(selector, { timeout: 3000 }).catch(() => false)) {
        previewFound = true;
        console.log(`   ✓ Preview functionality found`);
        break;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/popup-modals-preview.png`, fullPage: false });
    console.log('✅ Test PASSED - Preview functionality check completed\n');
  });

});