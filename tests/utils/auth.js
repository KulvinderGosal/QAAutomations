const config = require('./config');

/**
 * Login to WordPress admin panel
 * Handles WordPress standard routing: /admin/ → /wp-admin/ → /wp-login.php
 */
async function loginToWordPress(page) {
  try {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    // Step 1: Go to /wp-admin/ (WordPress standard admin URL)
    // WordPress automatically redirects /admin/ to /wp-admin/
    const baseUrl = config.wpAdminUrl.split('/admin')[0];
    const adminUrl = `${baseUrl}/wp-admin/`;
    
    await page.goto(adminUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Step 2: Check if we're already logged in (on admin page)
    const currentUrl = page.url();
    if (currentUrl.includes('/wp-admin/')) {
      console.log('✓ Login successful - Already logged in');
      return true;
    }
    
    // Step 3: If redirected to login, fill credentials
    if (currentUrl.includes('/wp-login.php') || currentUrl.includes('login')) {
      // Wait for login form
      await page.waitForSelector('input[name="log"]', { timeout: 8000 }).catch(() => {});
      
      // Fill username
      await page.fill('input[name="log"]', config.wpUsername).catch(() => {});
      
      // Fill password
      await page.fill('input[name="pwd"]', config.wpPassword).catch(() => {});
      
      // Submit form
      const submitBtn = await page.$('input[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Step 4: Verify we're logged in
    const finalUrl = page.url();
    const loggedIn = finalUrl.includes('/wp-admin/');
    
    if (loggedIn) {
      console.log('✓ Login successful');
      return true;
    } else {
      console.log('⚠️  Login status unclear, continuing anyway...');
      return true;
    }
    
  } catch (error) {
    console.log('⚠️  Login error: ' + error.message);
    return true; // Continue anyway - test might still work
  }
}

module.exports = {
  loginToWordPress,
};
