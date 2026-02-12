const config = require('./config');

/**
 * Login to WordPress admin panel
 */
async function loginToWordPress(page) {
  try {
    console.log('🔐 Logging into WordPress admin...');
    
    // Navigate to WordPress login
    await page.goto(config.wpAdminUrl, { waitUntil: 'networkidle' });
    
    // Check if already logged in
    const dashboardElement = await page.$('[class*="dashboard"]');
    if (dashboardElement) {
      console.log('✓ Already logged in');
      return true;
    }
    
    // Wait for login form
    await page.waitForSelector('input[name="log"]', { timeout: 5000 });
    
    // Enter credentials
    await page.fill('input[name="log"]', config.wpUsername);
    await page.fill('input[name="pwd"]', config.wpPassword);
    
    // Click login button
    await page.click('input[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/\/admin\/$/, { timeout: 10000 });
    console.log('✓ Login successful');
    
    return true;
  } catch (error) {
    console.error('✗ Login failed:', error.message);
    throw error;
  }
}

module.exports = {
  loginToWordPress,
};
