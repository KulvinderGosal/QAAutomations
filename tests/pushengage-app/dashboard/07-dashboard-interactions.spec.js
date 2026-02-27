const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, clickCreateCampaign } = require('../utils/app-helpers');
const config = require('../utils/config');

/**
 * Test Suite: Dashboard - User Interactions
 * Priority: HIGH
 * Feature: Dashboard
 * 
 * This test validates user interactions and actions
 * that can be performed from the dashboard.
 */

test.describe('HIGH - Dashboard - User Interactions', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config);
    expect(loginSuccess).toBe(true);
    
    await navigateToPage(page, 'Dashboard');
    await waitForPageLoad(page);
    await closeModalIfPresent(page);
  });
  
  test('should be able to click "Create a Campaign" button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Create Campaign Button Click');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const clicked = await clickCreateCampaign(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-create-campaign-clicked.png`, 
      fullPage: true 
    });
    
    expect(clicked).toBe(true);
    console.log('✅ Test PASSED - Create Campaign button is clickable\n');
  });
  
  test('should display campaign type options after clicking Create Campaign', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Campaign Type Options');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await clickCreateCampaign(page);
    await page.waitForTimeout(2000);
    
    const campaignTypes = [
      'Push Broadcast',
      'Drip Autoresponder',
      'Triggered Campaign',
      'RSS Auto Push'
    ];
    
    const results = {};
    
    for (const type of campaignTypes) {
      try {
        const isVisible = await page.isVisible(`:has-text("${type}")`, { timeout: 3000 });
        results[type] = isVisible;
        console.log(`   ${isVisible ? '✓' : '⚠️'} ${type}`);
      } catch (e) {
        results[type] = false;
        console.log(`   ⚠️ ${type} not found`);
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-campaign-type-options.png`, 
      fullPage: true 
    });
    
    const foundCount = Object.values(results).filter(Boolean).length;
    console.log(`\n📊 Results: ${foundCount}/${campaignTypes.length} campaign types found`);
    
    // Test passes if at least 2 campaign types are visible
    expect(foundCount).toBeGreaterThanOrEqual(2);
    console.log('✅ Test PASSED - Campaign type options are displayed\n');
  });
  
  test('should be able to click on site selector dropdown', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Site Selector Dropdown Click');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
      const dropdownSelectors = [
        '[role="combobox"]',
        'button:has-text("Android")',
        '[class*="site-select"]'
      ];
      
      let clicked = false;
      for (const selector of dropdownSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`   ✓ Clicked site selector: ${selector}`);
          clicked = true;
          await page.waitForTimeout(2000);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.screenshot({ 
        path: `${config.screenshotPath}/dashboard-site-selector-clicked.png`, 
        fullPage: false 
      });
      
      expect(clicked).toBe(true);
      console.log('✅ Test PASSED - Site selector dropdown is clickable\n');
      
    } catch (error) {
      console.log('❌ Test FAILED - Could not click site selector');
      throw error;
    }
  });
  
  test('should be able to click on user profile menu', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate User Profile Menu Click');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
      const profileSelectors = [
        'button:has-text("Kulvinder")',
        '[class*="user-menu"]',
        '[class*="profile-menu"]',
        'button[aria-label*="profile" i]'
      ];
      
      let clicked = false;
      for (const selector of profileSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`   ✓ Clicked user profile menu: ${selector}`);
          clicked = true;
          await page.waitForTimeout(2000);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.screenshot({ 
        path: `${config.screenshotPath}/dashboard-profile-menu-clicked.png`, 
        fullPage: false 
      });
      
      expect(clicked).toBe(true);
      console.log('✅ Test PASSED - User profile menu is clickable\n');
      
    } catch (error) {
      console.log('❌ Test FAILED - Could not click user profile menu');
      throw error;
    }
  });
  
  test('should display user menu options', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate User Menu Options');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Click on user profile menu
    const profileSelectors = [
      'button:has-text("Kulvinder")',
      '[class*="user-menu"]'
    ];
    
    for (const selector of profileSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(2000);
    
    const menuOptions = [
      'My Account',
      'Billing',
      'Site Management',
      'User Management',
      'Sign Out'
    ];
    
    const results = {};
    
    for (const option of menuOptions) {
      try {
        const isVisible = await page.isVisible(`text=${option}`, { timeout: 3000 });
        results[option] = isVisible;
        console.log(`   ${isVisible ? '✓' : '⚠️'} ${option}`);
      } catch (e) {
        results[option] = false;
        console.log(`   ⚠️ ${option} not found`);
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-user-menu-options.png`, 
      fullPage: false 
    });
    
    const foundCount = Object.values(results).filter(Boolean).length;
    console.log(`\n📊 Results: ${foundCount}/${menuOptions.length} menu options found`);
    
    // Test passes if at least 4 out of 5 menu options are visible
    expect(foundCount).toBeGreaterThanOrEqual(4);
    console.log('✅ Test PASSED - User menu options are displayed\n');
  });
  
  test('should be able to navigate using sidebar menu', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Sidebar Menu Navigation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const menuItems = ['Campaign', 'Analytics', 'Dashboard'];
    let navigatedCount = 0;
    
    for (const item of menuItems) {
      try {
        await page.click(`a:has-text("${item}")`, { timeout: 5000 });
        console.log(`   ✓ Navigated to: ${item}`);
        await page.waitForTimeout(2000);
        navigatedCount++;
      } catch (e) {
        console.log(`   ⚠️ Could not navigate to: ${item}`);
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-sidebar-navigation.png`, 
      fullPage: true 
    });
    
    console.log(`\n📊 Results: Navigated to ${navigatedCount}/${menuItems.length} menu items`);
    
    // Test passes if at least 2 navigations were successful
    expect(navigatedCount).toBeGreaterThanOrEqual(2);
    console.log('✅ Test PASSED - Sidebar menu navigation works\n');
  });
});
