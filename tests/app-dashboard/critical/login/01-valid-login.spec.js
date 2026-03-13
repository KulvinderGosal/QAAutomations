const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const config = require('../../utils/config');

/**
 * Test Suite: Login - Valid Credentials
 * Priority: CRITICAL
 * Feature: Authentication
 * 
 * This test validates that users can successfully log in
 * with valid credentials to the PushEngage app dashboard.
 */

test.describe('CRITICAL - Login - Valid Credentials', () => {
  
  test('should successfully login with valid credentials', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Login with Valid Credentials');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const loginSuccess = await loginToAppDashboard(
      page,
      config.appUsername,
      config.appPassword
    );
    
    expect(loginSuccess).toBe(true);
    
    // Verify URL changed from login page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('login');
    
    // Verify dashboard elements are present
    const isDashboardVisible = await page.isVisible('text=Dashboard', { timeout: 10000 });
    expect(isDashboardVisible).toBe(true);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/login-success.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully logged in\n');
  });
  
  test('should display user profile after login', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Verify User Profile Display After Login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const loginSuccess = await loginToAppDashboard(
      page,
      config.appUsername,
      config.appPassword
    );
    
    expect(loginSuccess).toBe(true);
    
    // Verify user profile elements
    const profileSelectors = [
      'button:has-text("Kulvinder")',
      '[class*="user-menu"]',
      '[class*="profile"]',
      '[aria-label*="profile" i]'
    ];
    
    let profileFound = false;
    for (const selector of profileSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          profileFound = true;
          console.log(`   ✓ User profile found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    expect(profileFound).toBe(true);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/login-user-profile.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - User profile displayed after login\n');
  });
  
  test('should display site selector after login', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Verify Site Selector Display After Login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const loginSuccess = await loginToAppDashboard(
      page,
      config.appUsername,
      config.appPassword
    );
    
    expect(loginSuccess).toBe(true);
    
    // Verify site selector dropdown
    const dropdownSelectors = [
      '[role="combobox"]',
      'select',
      'button:has-text("Android")',
      '[class*="site-select"]',
      '[class*="site-dropdown"]'
    ];
    
    let dropdownFound = false;
    for (const selector of dropdownSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          dropdownFound = true;
          console.log(`   ✓ Site selector found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    expect(dropdownFound).toBe(true);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/login-site-selector.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Site selector displayed after login\n');
  });
  
  test('should persist login session', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Verify Login Session Persistence');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // First login
    const loginSuccess = await loginToAppDashboard(
      page,
      config.appUsername,
      config.appPassword
    );
    
    expect(loginSuccess).toBe(true);
    
    // Navigate to another page
    await page.goto(config.appUrl + '/campaigns', { 
      waitUntil: 'domcontentloaded' 
    });
    await page.waitForTimeout(2000);
    
    // Verify still logged in (not redirected to login page)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('login');
    
    console.log('   ✓ Session persisted across navigation');
    
    // Navigate back to dashboard
    await page.goto(config.appUrl, { 
      waitUntil: 'domcontentloaded' 
    });
    await page.waitForTimeout(2000);
    
    // Verify still logged in
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('login');
    
    console.log('   ✓ Session still active on dashboard');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/login-session-persistence.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Login session persists\n');
  });
});
