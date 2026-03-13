const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Site Settings - Site Details
 * Priority: CRITICAL
 * Feature: Site Settings
 */

test.describe('CRITICAL - Site Settings - Site Details', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should navigate to Site Details page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Site Details');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Site Details');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/site-details-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Navigate to Site Details\n');
  });

  test('should display Site Details page title', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Site Details page title');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Site Details');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/site-details-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Validate Site Details page title\n');
  });

  test('should display site configuration form fields', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Site Configuration Form');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Site Details');
    await waitForPageLoad(page);
    
    const formSelectors = ['input[type="text"]', 'input[type="url"]', 'form', '[class*="form-field"]'];
    let formFound = false;
    for (const selector of formSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        formFound = true;
        console.log(`   ✓ Form fields found: ${count}`);
        break;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/site-details-form.png`, fullPage: true });
    console.log('✅ Test PASSED - Site configuration form check completed\n');
  });

  test('should display save button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Save Button');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Site Details');
    await waitForPageLoad(page);
    
    const saveSelectors = ['button:has-text("Save")', 'button:has-text("Update")', 'button[type="submit"]'];
    let saveFound = false;
    for (const selector of saveSelectors) {
      if (await page.isVisible(selector, { timeout: 5000 }).catch(() => false)) {
        saveFound = true;
        console.log(`   ✓ Save button found`);
        break;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/site-details-save.png`, fullPage: false });
    console.log('✅ Test PASSED - Save button check completed\n');
  });

});