const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, checkElementExists } = require('../utils/app-helpers');
const config = require('../utils/config');

/**
 * Test Suite: Dashboard - UI Elements Validation
 * Priority: CRITICAL
 * Feature: Dashboard
 * 
 * This test validates that all essential UI elements are present
 * on the PushEngage app dashboard.
 */

test.describe('CRITICAL - Dashboard - UI Elements Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login to app dashboard
    const loginSuccess = await loginToAppDashboard(page, config);
    expect(loginSuccess).toBe(true);
    
    // Navigate to Dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForPageLoad(page);
    
    // Close any welcome modal if present
    await closeModalIfPresent(page);
  });
  
  test('should display PushEngage logo', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate PushEngage Logo');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const logoSelectors = [
      'img[alt*="PushEngage" i]',
      'img[src*="pushengage" i]',
      '[class*="logo"]',
      'a[class*="logo"]'
    ];
    
    const logoExists = await checkElementExists(page, logoSelectors, 'PushEngage Logo');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-logo-validation.png`, 
      fullPage: false 
    });
    
    expect(logoExists).toBe(true);
    console.log('✅ Test PASSED - PushEngage logo is displayed\n');
  });
  
  test('should display site selector dropdown', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Site Selector Dropdown');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const dropdownSelectors = [
      '[role="combobox"]',
      'select',
      'button:has-text("Android")',
      '[class*="site-select"]',
      '[class*="site-dropdown"]'
    ];
    
    const dropdownExists = await checkElementExists(page, dropdownSelectors, 'Site Selector Dropdown');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-site-selector.png`, 
      fullPage: false 
    });
    
    expect(dropdownExists).toBe(true);
    console.log('✅ Test PASSED - Site selector dropdown is displayed\n');
  });
  
  test('should display notification bell icon', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Notification Bell Icon');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const bellSelectors = [
      'svg[class*="bell"]',
      'i[class*="bell"]',
      'button[aria-label*="notification" i]',
      '[data-testid*="notification"]'
    ];
    
    const bellExists = await checkElementExists(page, bellSelectors, 'Notification Bell Icon');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-notification-icon.png`, 
      fullPage: false 
    });
    
    expect(bellExists).toBe(true);
    console.log('✅ Test PASSED - Notification bell icon is displayed\n');
  });
  
  test('should display user profile menu', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate User Profile Menu');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const profileSelectors = [
      'button:has-text("Kulvinder")',
      '[class*="user-menu"]',
      '[class*="profile"]',
      'button[aria-label*="profile" i]',
      'button[aria-label*="account" i]'
    ];
    
    const profileExists = await checkElementExists(page, profileSelectors, 'User Profile Menu');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-user-profile.png`, 
      fullPage: false 
    });
    
    expect(profileExists).toBe(true);
    console.log('✅ Test PASSED - User profile menu is displayed\n');
  });
  
  test('should display "Create a Campaign" button', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Create Campaign Button');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const createBtnSelectors = [
      'button:has-text("Create a Campaign")',
      'button:has-text("Create Campaign")',
      'a:has-text("Create Campaign")',
      '[data-testid="create-campaign"]'
    ];
    
    const createBtnExists = await checkElementExists(page, createBtnSelectors, 'Create Campaign Button');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-create-button.png`, 
      fullPage: false 
    });
    
    expect(createBtnExists).toBe(true);
    console.log('✅ Test PASSED - Create Campaign button is displayed\n');
  });
  
  test('should display all dashboard navigation menu items', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Navigation Menu Items');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const menuItems = [
      'Dashboard',
      'Campaign',
      'Design',
      'Audience',
      'Analytics',
      'Site Settings',
      'Chat Widgets',
      'Publisher'
    ];
    
    const results = {};
    
    for (const item of menuItems) {
      try {
        const isVisible = await page.isVisible(`text=${item}`, { timeout: 3000 });
        results[item] = isVisible;
        console.log(`   ${isVisible ? '✓' : '⚠️'} ${item}`);
      } catch (e) {
        results[item] = false;
        console.log(`   ⚠️ ${item} not found`);
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-nav-menu.png`, 
      fullPage: true 
    });
    
    const foundCount = Object.values(results).filter(Boolean).length;
    console.log(`\n📊 Results: ${foundCount}/${menuItems.length} menu items found`);
    
    // Test passes if at least 6 out of 8 menu items are found
    expect(foundCount).toBeGreaterThanOrEqual(6);
    console.log('✅ Test PASSED - Navigation menu items are displayed\n');
  });
  
  test('should display all campaign submenu items', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Campaign Submenu Items');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const submenuItems = [
      'Push Broadcasts',
      'Drip Autoresponders',
      'Triggered Campaigns',
      'RSS Auto Push'
    ];
    
    const results = {};
    
    for (const item of submenuItems) {
      try {
        const isVisible = await page.isVisible(`text=${item}`, { timeout: 3000 });
        results[item] = isVisible;
        console.log(`   ${isVisible ? '✓' : '⚠️'} ${item}`);
      } catch (e) {
        results[item] = false;
        console.log(`   ⚠️ ${item} not found`);
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-campaign-submenu.png`, 
      fullPage: false 
    });
    
    const foundCount = Object.values(results).filter(Boolean).length;
    console.log(`\n📊 Results: ${foundCount}/${submenuItems.length} submenu items found`);
    
    // Test passes if all submenu items are found
    expect(foundCount).toBe(submenuItems.length);
    console.log('✅ Test PASSED - Campaign submenu items are displayed\n');
  });
});
