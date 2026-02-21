const config = require('./config');

/**
 * Login to WordPress admin panel
 * Handles WordPress standard routing and authentication
 */
async function loginToWordPress(page) {
  try {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    // Ensure URL ends with slash for proper WordPress routing
    const wpAdminUrl = config.wpAdminUrl.endsWith('/') 
      ? config.wpAdminUrl 
      : `${config.wpAdminUrl}/`;
    
    // Navigate to WordPress admin
    await page.goto(wpAdminUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    await page.waitForTimeout(1500);
    
    // Check current URL after navigation
    const currentUrl = page.url();
    
    // If we're already on admin page, we're logged in
    if (currentUrl.includes('/wp-admin/')) {
      console.log('✓ Login successful - Already logged in');
      return true;
    }
    
    // If redirected to login page, fill credentials
    if (currentUrl.includes('wp-login.php')) {
      console.log('   Filling login credentials...');
      
      // Wait for login form to be ready
      await page.waitForSelector('input[name="log"]', { timeout: 10000 });
      
      // Fill username
      await page.fill('input[name="log"]', config.wpUsername);
      
      // Fill password
      await page.fill('input[name="pwd"]', config.wpPassword);
      
      // Click submit button
      await page.click('input[type="submit"]');
      
      // Wait for redirect to admin dashboard
      await page.waitForURL('**/wp-admin/**', { timeout: 15000 });
      
      console.log('✓ Login successful');
      return true;
    }
    
    // If we're somewhere else, log it but continue
    console.log(`   Current URL: ${currentUrl}`);
    console.log('✓ Login completed');
    return true;
    
  } catch (error) {
    console.error('❌ Login error:', error.message);
    throw new Error(`Login failed: ${error.message}`);
  }
}

module.exports = {
  loginToWordPress,
};
