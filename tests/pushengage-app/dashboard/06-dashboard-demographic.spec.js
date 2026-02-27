const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, checkElementExists } = require('../utils/app-helpers');
const config = require('../utils/config');

/**
 * Test Suite: Dashboard - Demographic Overview
 * Priority: MEDIUM
 * Feature: Dashboard
 * 
 * This test validates the Demographic Overview section
 * on the dashboard.
 */

test.describe('MEDIUM - Dashboard - Demographic Overview', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config);
    expect(loginSuccess).toBe(true);
    
    await navigateToPage(page, 'Dashboard');
    await waitForPageLoad(page);
    await closeModalIfPresent(page);
  });
  
  test('should display "Demographic Overview" section', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Demographic Overview Section');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const demographicSelectors = [
      'text=Demographic Overview',
      ':has-text("Demographic Overview")',
      'h2:has-text("Demographic")',
      '[class*="demographic"]'
    ];
    
    const demographicExists = await checkElementExists(page, demographicSelectors, 'Demographic Overview Section');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-demographic-overview.png`, 
      fullPage: true 
    });
    
    expect(demographicExists).toBe(true);
    console.log('✅ Test PASSED - Demographic Overview section is displayed\n');
  });
  
  test('should display "View Full Report" button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate View Full Report Button');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const reportBtnSelectors = [
      'button:has-text("View Full Report")',
      'a:has-text("View Full Report")',
      'button:has-text("Full Report")',
      'a:has-text("Full Report")'
    ];
    
    const reportBtnExists = await checkElementExists(page, reportBtnSelectors, 'View Full Report Button');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-view-full-report.png`, 
      fullPage: false 
    });
    
    expect(reportBtnExists).toBe(true);
    console.log('✅ Test PASSED - View Full Report button is displayed\n');
  });
  
  test('should be able to click "View Full Report" button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate View Full Report Button Click');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
      const reportBtnSelectors = [
        'button:has-text("View Full Report")',
        'a:has-text("View Full Report")'
      ];
      
      let clicked = false;
      for (const selector of reportBtnSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`   ✓ Clicked View Full Report button: ${selector}`);
          clicked = true;
          await page.waitForTimeout(2000);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.screenshot({ 
        path: `${config.screenshotPath}/dashboard-full-report-clicked.png`, 
        fullPage: true 
      });
      
      expect(clicked).toBe(true);
      console.log('✅ Test PASSED - View Full Report button is clickable\n');
      
    } catch (error) {
      console.log('❌ Test FAILED - Could not click View Full Report button');
      throw error;
    }
  });
});
