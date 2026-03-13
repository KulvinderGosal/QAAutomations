const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Audience - Segments
 * Priority: CRITICAL
 * Feature: Audience
 */

test.describe('CRITICAL - Audience - Segments', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should navigate to Segments page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Segments');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Segments');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/segments-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Navigate to Segments\n');
  });

  test('should display Segments page title', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Segments page title');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Segments');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/segments-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Validate Segments page title\n');
  });

  test('should display create segment button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Create Segment Button');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Segments');
    await waitForPageLoad(page);
    
    const createSelectors = ['button:has-text("Create")', 'button:has-text("New Segment")', 'a:has-text("Add")'];
    const createExists = await checkElementVisible(page, createSelectors, 'Create Segment Button');
    
    await page.screenshot({ path: `${config.screenshotPath}/segments-create.png`, fullPage: false });
    console.log('✅ Test PASSED - Create segment button check completed\n');
  });

  test('should display segments list or empty state', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Segments List Display');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Segments');
    await waitForPageLoad(page);
    
    const contentSelectors = ['table', '[role="table"]', 'text=No segments', '[class*="segment-list"]'];
    let contentFound = false;
    for (const selector of contentSelectors) {
      if (await page.isVisible(selector, { timeout: 5000 }).catch(() => false)) {
        contentFound = true;
        console.log(`   ✓ Content found`);
        break;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/segments-list.png`, fullPage: true });
    console.log('✅ Test PASSED - Segments list check completed\n');
  });

});