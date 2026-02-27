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
 * Login to PushEngage App Dashboard and save session
 * @param {import('@playwright/test').Page} page
 * @param {Object} config - Configuration object with credentials
 */
async function loginToAppDashboard(page, config) {
  console.log('🔐 Checking PushEngage App Dashboard login status...');
  
  const appUrl = config.appUrl || process.env.APP_DASHBOARD_URL || 'https://app.pushengage.com';
  
  try {
    // Try to navigate to dashboard first
    await page.goto(appUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
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
    
    console.log('⚠️ Not logged in - captcha needs to be solved manually');
    console.log('   Please login manually in the browser and run the test again\n');
    return false;
    
  } catch (error) {
    console.error('❌ Login check error:', error.message);
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
      '[class*="profile"]'
    ];
    
    for (const selector of profileSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Click on Sign Out
    await page.click('text=Sign Out, a:has-text("Sign Out")');
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
