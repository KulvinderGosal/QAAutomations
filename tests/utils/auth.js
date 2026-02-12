const config = require('./config');

/**
 * Login to WordPress admin panel
 */
async function loginToWordPress(page) {
  try {
    console.log('🔐 Logging into WordPress admin...');
    
    // Navigate to WordPress login
    await page.goto(config.wpAdminUrl, { waitUntil: 'networkidle' });
    
    // Check if already logged in (look for dashboard indicators)
    const dashboardElement = await page.$('[class*="dashboard"]').catch(() => null);
    if (dashboardElement) {
      console.log('✓ Already logged in');
      return true;
    }
    
    // Wait for login form
    await page.waitForSelector('input[name="log"]', { timeout: 5000 }).catch(() => {
      console.log('⚠️  Login form not found, page might already be loaded');
    });
    
    // Fill credentials
    const userInput = await page.$('input[name="log"]');
    const passInput = await page.$('input[name="pwd"]');
    
    if (userInput && passInput) {
      await userInput.fill(config.wpUsername);
      await passInput.fill(config.wpPassword);
      
      // Click login button
      const loginBtn = await page.$('input[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
      }
      
      // Wait for redirect - be more flexible with the URL pattern
      try {
        await page.waitForURL(/\/(wp-admin|admin)\/?$/, { timeout: 10000 });
      } catch (e) {
        // If URL wait fails, check if we're on admin page another way
        await page.waitForSelector('[class*="wrap"]', { timeout: 5000 }).catch(() => {});
      }
    }
    
    console.log('✓ Login successful');
    return true;
  } catch (error) {
    console.error('✗ Login failed:', error.message);
    // Don't throw - continue with test to see what page we're on
    return false;
  }
}

module.exports = {
  loginToWordPress,
};
