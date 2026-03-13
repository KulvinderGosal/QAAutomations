const { expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Get the path to the storage state file
 */
function getStorageStatePath() {
  const stateDir = path.join(process.cwd(), 'test-results', '.auth');
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  return path.join(stateDir, 'app-dashboard-state.json');
}

/**
 * Login to PushEngage App Dashboard
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} password
 */
async function loginToAppDashboard(page, username, password) {
  console.log('🔐 Logging into PushEngage App Dashboard...');
  
  const appUrl = process.env.APP_DASHBOARD_URL || 'https://app.pushengage.com';
  
  try {
    await page.goto(appUrl + '/login', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    
    // Check if already logged in
    if (!currentUrl.includes('login')) {
      console.log('✅ Already logged in to PushEngage App Dashboard\n');
      
      // Save the session state
      const context = page.context();
      await context.storageState({ path: getStorageStatePath() });
      console.log('   ➜ Session state saved for reuse\n');
      
      return true;
    }
    
    // Fill login credentials
    console.log('   ➜ Filling login credentials...');
    
    // Email field
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[aria-label*="email" i]'
    ];
    
    for (const selector of emailSelectors) {
      try {
        await page.fill(selector, username, { timeout: 5000 });
        console.log('   ✓ Email filled');
        break;
      } catch (e) {
        continue;
      }
    }
    
    // Password field
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="password" i]',
      'input[aria-label*="password" i]'
    ];
    
    for (const selector of passwordSelectors) {
      try {
        await page.fill(selector, password, { timeout: 5000 });
        console.log('   ✓ Password filled');
        break;
      } catch (e) {
        continue;
      }
    }
    
    // Click login button
    const loginBtnSelectors = [
      'button:has-text("Log in")',
      'button:has-text("Login")',
      'button[type="submit"]',
      'input[type="submit"]'
    ];
    
    for (const selector of loginBtnSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log('   ✓ Login button clicked');
        break;
      } catch (e) {
        continue;
      }
    }
    
    // Wait for navigation
    await page.waitForTimeout(5000);
    
    const newUrl = page.url();
    
    if (!newUrl.includes('login')) {
      console.log('✅ Successfully logged in to PushEngage App Dashboard\n');
      
      // Save the session state
      const context = page.context();
      await context.storageState({ path: getStorageStatePath() });
      console.log('   ➜ Session state saved for reuse\n');
      
      return true;
    } else {
      console.log('⚠️ Login may have failed or requires captcha');
      await page.screenshot({ 
        path: 'test-results/login-failed.png', 
        fullPage: true 
      });
      return false;
    }
    
  } catch (error) {
    console.error('❌ Login error:', error.message);
    await page.screenshot({ 
      path: 'test-results/login-error.png', 
      fullPage: true 
    });
    return false;
  }
}

/**
 * Check if user is already logged in
 * @param {import('@playwright/test').Page} page
 */
async function isLoggedIn(page) {
  const currentUrl = page.url();
  return currentUrl.includes('app.pushengage.com') && 
         !currentUrl.includes('login');
}

/**
 * Logout from PushEngage App Dashboard
 * @param {import('@playwright/test').Page} page
 */
async function logoutFromAppDashboard(page) {
  console.log('🚪 Logging out from PushEngage App Dashboard...');
  
  try {
    // Click on user profile dropdown
    const profileSelectors = [
      'button:has-text("Kulvinder")',
      '[class*="user-menu"]',
      '[class*="profile"]',
      '[aria-label*="profile" i]',
      '[aria-label*="account" i]'
    ];
    
    for (const selector of profileSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log('   ✓ Profile menu clicked');
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Click on Sign Out
    const signOutSelectors = [
      'text=Sign Out',
      'a:has-text("Sign Out")',
      'button:has-text("Sign Out")',
      'a:has-text("Logout")',
      'button:has-text("Logout")'
    ];
    
    for (const selector of signOutSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log('   ✓ Sign Out clicked');
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Verify logout
    await page.waitForURL(/.*login.*/, { timeout: 10000 });
    console.log('✅ Successfully logged out\n');
    
    // Clear saved session
    const statePath = getStorageStatePath();
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    return false;
  }
}

module.exports = {
  loginToAppDashboard,
  isLoggedIn,
  logoutFromAppDashboard,
  getStorageStatePath
};
