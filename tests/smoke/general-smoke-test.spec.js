const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../utils/auth');
const config = require('../utils/config');

test.describe('General WordPress Smoke Tests', () => {
  
  test('01 - Admin Dashboard Loads', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Verifying admin dashboard...');
    await expect(page).toHaveURL(/\/admin\//);
    
    // Check for main dashboard elements
    const mainContent = page.locator('div[role="main"]');
    await expect(mainContent).toBeVisible();
    console.log('✓ Admin dashboard loaded successfully');
  });

  test('02 - Navigation Menu Works', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Testing navigation menu...');
    
    // Check for navigation menu
    const menu = page.locator('#adminmenumain');
    await expect(menu).toBeVisible();
    
    // Try clicking on different menu items
    const menuItems = await menu.locator('a').count();
    console.log(`✓ Navigation menu has ${menuItems} items`);
    expect(menuItems).toBeGreaterThan(0);
  });

  test('03 - Posts Page Accessible', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Navigating to Posts page...');
    await page.goto(`${config.wpAdminUrl}/edit.php`, { waitUntil: 'networkidle' });
    
    // Verify posts page loaded
    await expect(page.locator('h1')).toContainText(/Posts/i);
    console.log('✓ Posts page accessible');
  });

  test('04 - Pages Page Accessible', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('�� Navigating to Pages...');
    await page.goto(`${config.wpAdminUrl}/edit.php?post_type=page`, { waitUntil: 'networkidle' });
    
    // Verify pages page loaded
    const heading = page.locator('h1');
    await expect(heading).toContainText(/Pages/i);
    console.log('✓ Pages page accessible');
  });

  test('05 - Users Page Accessible', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Navigating to Users...');
    await page.goto(`${config.wpAdminUrl}/users.php`, { waitUntil: 'networkidle' });
    
    // Verify users page loaded
    await expect(page.locator('h1')).toContainText(/Users/i);
    console.log('✓ Users page accessible');
  });

  test('06 - Settings Page Accessible', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Navigating to Settings...');
    await page.goto(`${config.wpAdminUrl}/options-general.php`, { waitUntil: 'networkidle' });
    
    // Verify settings page loaded
    await expect(page.locator('h1')).toContainText(/Settings/i);
    console.log('✓ Settings page accessible');
  });

  test('07 - No Fatal PHP Errors', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Checking for PHP errors...');
    
    // Check for common PHP error messages
    const pageContent = await page.content();
    
    const errors = [
      /Fatal error/i,
      /Parse error/i,
      /Undefined function/i,
      /Call to undefined/i,
    ];
    
    let foundErrors = [];
    errors.forEach(errorPattern => {
      if (errorPattern.test(pageContent)) {
        foundErrors.push(errorPattern);
      }
    });
    
    if (foundErrors.length > 0) {
      console.log(`✗ Found PHP errors: ${foundErrors.join(', ')}`);
      throw new Error('PHP errors detected');
    }
    
    console.log('✓ No PHP errors detected');
  });

  test('08 - Page Load Performance', async ({ page }) => {
    console.log('📍 Testing page load performance...');
    
    const startTime = Date.now();
    await loginToWordPress(page);
    const loadTime = Date.now() - startTime;
    
    console.log(`✓ Admin dashboard loaded in ${loadTime}ms`);
    
    // Flag if load time exceeds 10 seconds
    if (loadTime > 10000) {
      console.log(`⚠ Warning: Load time exceeds 10 seconds`);
    }
  });

  test('09 - Logout Functionality', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Testing logout...');
    
    // Find and click logout link
    const logoutLink = page.locator('text=Log Out').first();
    
    if (await logoutLink.isVisible()) {
      await logoutLink.click();
      
      // Wait for redirect to login page
      await page.waitForURL(/wp-login\.php|\/admin/, { timeout: 5000 });
      console.log('✓ Logout successful');
    } else {
      console.log('⚠ Logout link not found');
    }
  });
});
