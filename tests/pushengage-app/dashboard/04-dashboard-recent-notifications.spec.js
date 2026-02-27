const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, checkElementExists } = require('../utils/app-helpers');
const config = require('../utils/config');

/**
 * Test Suite: Dashboard - Recent Notifications Section
 * Priority: HIGH
 * Feature: Dashboard
 * 
 * This test validates the Recent Notifications section
 * on the dashboard.
 */

test.describe('HIGH - Dashboard - Recent Notifications', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config);
    expect(loginSuccess).toBe(true);
    
    await navigateToPage(page, 'Dashboard');
    await waitForPageLoad(page);
    await closeModalIfPresent(page);
  });
  
  test('should display "Recent Notifications" section', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Recent Notifications Section');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const sectionSelectors = [
      'text=Recent Notifications',
      ':has-text("Recent Notifications")',
      'h2:has-text("Recent")',
      '[class*="recent-notification"]'
    ];
    
    const sectionExists = await checkElementExists(page, sectionSelectors, 'Recent Notifications Section');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-recent-notifications.png`, 
      fullPage: true 
    });
    
    expect(sectionExists).toBe(true);
    console.log('✅ Test PASSED - Recent Notifications section is displayed\n');
  });
  
  test('should display "See More" button in Recent Notifications', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate See More Button');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const seeMoreSelectors = [
      'button:has-text("See More")',
      'a:has-text("See More")',
      'button:has-text("View All")',
      'a:has-text("View All")'
    ];
    
    const seeMoreExists = await checkElementExists(page, seeMoreSelectors, 'See More Button');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-see-more-button.png`, 
      fullPage: false 
    });
    
    expect(seeMoreExists).toBe(true);
    console.log('✅ Test PASSED - See More button is displayed\n');
  });
  
  test('should be able to click "See More" button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate See More Button Click');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
      const seeMoreSelectors = [
        'button:has-text("See More")',
        'a:has-text("See More")'
      ];
      
      let clicked = false;
      for (const selector of seeMoreSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`   ✓ Clicked See More button: ${selector}`);
          clicked = true;
          await page.waitForTimeout(2000);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.screenshot({ 
        path: `${config.screenshotPath}/dashboard-see-more-clicked.png`, 
        fullPage: true 
      });
      
      expect(clicked).toBe(true);
      console.log('✅ Test PASSED - See More button is clickable\n');
      
    } catch (error) {
      console.log('❌ Test FAILED - Could not click See More button');
      throw error;
    }
  });
});
