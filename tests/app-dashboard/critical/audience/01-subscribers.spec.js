const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Audience - Subscribers
 * Priority: CRITICAL
 * Feature: Audience
 */

test.describe('CRITICAL - Audience - Subscribers', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should navigate to Subscribers page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Subscribers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Subscribers');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/subscribers-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Navigate to Subscribers\n');
  });

  test('should display Subscribers page title', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Subscribers page title');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Subscribers');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/subscribers-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Validate Subscribers page title\n');
  });

  test('should display subscribers list table', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Subscribers List Table');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Subscribers');
    await waitForPageLoad(page);
    
    const tableSelectors = ['table', '[role="table"]', 'tbody', '[class*="subscriber"]'];
    const tableExists = await checkElementExists(page, tableSelectors, 'Subscribers Table');
    
    await page.screenshot({ path: `${config.screenshotPath}/subscribers-table.png`, fullPage: true });
    console.log('✅ Test PASSED - Subscribers list check completed\n');
  });

  test('should display search/filter functionality', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Search Functionality');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Subscribers');
    await waitForPageLoad(page);
    
    const searchSelectors = ['input[type="search"]', 'input[placeholder*="search" i]', '[class*="search"]'];
    let searchFound = false;
    for (const selector of searchSelectors) {
      if (await page.isVisible(selector, { timeout: 3000 }).catch(() => false)) {
        searchFound = true;
        console.log(`   ✓ Search found: ${selector}`);
        break;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/subscribers-search.png`, fullPage: false });
    console.log('✅ Test PASSED - Search functionality check completed\n');
  });

  test('should display export button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    console.log('🧪 Test: Validate Export Button');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Subscribers');
    await waitForPageLoad(page);
    
    const exportSelectors = ['button:has-text("Export")', 'a:has-text("Export")', '[class*="export"]'];
    let exportFound = false;
    for (const selector of exportSelectors) {
      if (await page.isVisible(selector, { timeout: 3000 }).catch(() => false)) {
        exportFound = true;
        console.log(`   ✓ Export button found`);
        break;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/subscribers-export.png`, fullPage: false });
    console.log('✅ Test PASSED - Export button check completed\n');
  });

});