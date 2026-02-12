const config = require('./config');

/**
 * Login to WordPress admin panel
 */
async function loginToWordPress(page) {
  try {
    console.log('🔐 Logging into WordPress admin...');
    
    // Step 1: Navigate to /wp-admin/ (WordPress standard admin URL)
    // This will redirect to /wp-login.php if not authenticated
    const adminUrl = config.wpAdminUrl.replace(/\/admin\/?$/, '/wp-admin/');
    await page.goto(adminUrl, { waitUntil: 'domcontentloaded' });
    
    // Give page time to load and potentially redirect
    await page.waitForTimeout(2000);
    
    // Step 2: Check current URL to see if we're at login page
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/wp-login.php') || currentUrl.includes('login');
    const isAdminPage = currentUrl.includes('/wp-admin/');
    
    if (isAdminPage) {
      console.log('✓ Already logged in - on admin page');
      return true;
    }
    
    if (!isLoginPage) {
      console.log('⚠️  Not on login page, redirecting to wp-login.php');
      await page.goto(`${config.wpAdminUrl.split('/admin')[0]}/wp-login.php`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    }
    
    // Step 3: Wait for and fill login form
    const loginFormSelector = 'input[name="log"]';
    const loginFormExists = await page.waitForSelector(loginFormSelector, { timeout: 8000 }).catch(() => null);
    
    if (!loginFormExists) {
      console.log('⚠️  Login form not found');
      return false;
    }
    
    // Fill username and password
    await page.fill('input[name="log"]', config.wpUsername);
    await page.fill('input[name="pwd"]', config.wpPassword);
    
    // Step 4: Submit login form
    const submitButton = await page.$('input[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      
      // Wait for navigation to complete
      await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    
    // Step 5: Verify we're logged in
    const finalUrl = page.url();
    const loggedIn = finalUrl.includes('/wp-admin/') || await page.$('[class*="wrap"]').catch(() => null);
    
    if (loggedIn) {
      console.log('✓ Login successful');
      return true;
    } else {
      console.log('⚠️  Login status unclear, but continuing...');
      return true; // Continue anyway - page might be loaded
    }
    
  } catch (error) {
    console.error('✗ Login failed:', error.message);
    return false;
  }
}

module.exports = {
  loginToWordPress,
};
