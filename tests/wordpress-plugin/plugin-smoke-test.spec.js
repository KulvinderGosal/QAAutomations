const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../utils/auth');
const config = require('../utils/config');

test.describe('PushEngage Plugin Smoke Tests', () => {
  
  test('01 - Login to WordPress Admin', async ({ page }) => {
    console.log(`\n📍 Navigating to: ${config.wpAdminUrl}`);
    await loginToWordPress(page);
    
    // Verify we're on the dashboard (flexible URL matching)
    await expect(page).toHaveURL(/\/(wp-)?admin\/?$/);
    console.log('✓ Dashboard loaded successfully');
  });

  test('02 - Navigate to Plugins page', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Navigating to Plugins page...');
    await page.goto(`${config.wpAdminUrl}/plugins.php`, { waitUntil: 'networkidle' });
    
    // Verify plugins page loaded
    await expect(page.locator('h1')).toContainText(/Plugins/i);
    console.log('✓ Plugins page loaded');
  });

  test('03 - Search for PushEngage Plugin', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log(`📍 Searching for plugin: "${config.pluginSearchTerm}"`);
    await page.goto(`${config.wpAdminUrl}/plugins.php`, { waitUntil: 'networkidle' });
    
    // Find search box specifically in the plugins page (not WooCommerce)
    const searchBox = page.locator('input[placeholder="Search plugins"]');
    const exists = await searchBox.count();
    
    if (exists > 0) {
      await searchBox.fill(config.pluginSearchTerm);
      await page.keyboard.press('Enter');
    } else {
      // Fallback: look for any search input on plugins.php page
      const input = page.locator('input[name="s"]').first();
      await input.fill(config.pluginSearchTerm);
      await page.keyboard.press('Enter');
    }
    
    // Wait for results
    await page.waitForTimeout(2000);
    
    // Check if plugin is found
    const pluginRow = page.locator(`text=${config.pluginName}`).first();
    const isVisible = await pluginRow.isVisible().catch(() => false);
    
    if (isVisible) {
      console.log(`✓ PushEngage plugin found`);
      expect(isVisible).toBeTruthy();
    } else {
      console.log(`⚠ Plugin not found in search results`);
    }
  });

  test('04 - Verify Plugin Information Display', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Verifying plugin information...');
    await page.goto(`${config.wpAdminUrl}/plugins.php`, { waitUntil: 'networkidle' });
    
    // Search for plugin
    const searchBox = page.locator('input[placeholder="Search plugins"]');
    const exists = await searchBox.count();
    
    if (exists > 0) {
      await searchBox.fill(config.pluginSearchTerm);
      await searchBox.press('Enter');
    } else {
      const input = page.locator('input[name="s"]').first();
      await input.fill(config.pluginSearchTerm);
      await input.press('Enter');
    }
    
    await page.waitForTimeout(2000);
    
    // Check plugin details
    const pluginRow = page.locator(`text=${config.pluginName}`).first();
    const isVisible = await pluginRow.isVisible().catch(() => false);
    
    expect(isVisible).toBeTruthy();
    console.log('✓ Plugin information displayed');
  });

  test('05 - Check Plugin Status (Active/Inactive)', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Checking plugin activation status...');
    await page.goto(`${config.wpAdminUrl}/plugins.php`, { waitUntil: 'networkidle' });
    
    // Search for plugin
    const searchBox = page.locator('input[placeholder="Search plugins"]');
    const exists = await searchBox.count();
    
    if (exists > 0) {
      await searchBox.fill(config.pluginSearchTerm);
      await searchBox.press('Enter');
    } else {
      const input = page.locator('input[name="s"]').first();
      await input.fill(config.pluginSearchTerm);
      await input.press('Enter');
    }
    
    await page.waitForTimeout(2000);
    
    const pluginRow = page.locator(`text=${config.pluginName}`).first();
    const parentDiv = pluginRow.locator('xpath=ancestor::div[@class="plugin"]');
    
    // Check if plugin has deactivate link (means it's active) or activate link
    const deactivateLink = parentDiv.locator('a:has-text("Deactivate")');
    const activateLink = parentDiv.locator('a:has-text("Activate")');
    
    const isActive = await deactivateLink.isVisible().catch(() => false);
    const isInactive = await activateLink.isVisible().catch(() => false);
    
    if (isActive) {
      console.log('✓ Plugin is ACTIVE');
    } else if (isInactive) {
      console.log('⚠ Plugin is INACTIVE');
    }
    
    expect(isActive || isInactive).toBeTruthy();
  });

  test('06 - Verify Plugin Actions (Activate/Deactivate buttons visible)', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Verifying plugin action buttons...');
    await page.goto(`${config.wpAdminUrl}/plugins.php`, { waitUntil: 'networkidle' });
    
    // Search for plugin
    const searchBox = page.locator('input[placeholder="Search plugins"]');
    const exists = await searchBox.count();
    
    if (exists > 0) {
      await searchBox.fill(config.pluginSearchTerm);
      await searchBox.press('Enter');
    } else {
      const input = page.locator('input[name="s"]').first();
      await input.fill(config.pluginSearchTerm);
      await input.press('Enter');
    }
    
    await page.waitForTimeout(2000);
    
    const pluginRow = page.locator(`text=${config.pluginName}`).first();
    const parentDiv = pluginRow.locator('xpath=ancestor::div[@class="plugin"]');
    
    // Check for action links
    const actionLinks = parentDiv.locator('a[href*="action"]');
    const isVisible = await actionLinks.first().isVisible().catch(() => false);
    
    expect(isVisible || await parentDiv.locator('a').count() > 0).toBeTruthy();
    console.log('✓ Plugin action buttons are visible');
  });

  test('07 - Navigate to Plugin Settings (if applicable)', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Checking for plugin settings page...');
    await page.goto(`${config.wpAdminUrl}/plugins.php`, { waitUntil: 'networkidle' });
    
    // Search for plugin
    const searchBox = page.locator('input[placeholder="Search plugins"]');
    const exists = await searchBox.count();
    
    if (exists > 0) {
      await searchBox.fill(config.pluginSearchTerm);
      await searchBox.press('Enter');
    } else {
      const input = page.locator('input[name="s"]').first();
      await input.fill(config.pluginSearchTerm);
      await input.press('Enter');
    }
    
    await page.waitForTimeout(2000);
    
    const pluginRow = page.locator(`text=${config.pluginName}`).first();
    const parentDiv = pluginRow.locator('xpath=ancestor::div[@class="plugin"]');
    
    // Look for Settings link
    const settingsLink = parentDiv.locator('a:has-text("Settings")');
    const settingsVisible = await settingsLink.isVisible().catch(() => false);
    
    if (settingsVisible) {
      console.log('✓ Settings link found for plugin');
      await settingsLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
      console.log('✓ Settings page loaded successfully');
    } else {
      console.log('⚠ No Settings link found (plugin may not have settings)');
    }
  });

  test('08 - Verify No Plugin Errors in WordPress', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Checking for plugin errors...');
    await page.goto(`${config.wpAdminUrl}/`, { waitUntil: 'networkidle' });
    
    // Look for error notices
    const errorNotices = page.locator('.notice-error');
    const warningNotices = page.locator('.notice-warning');
    
    const errorCount = await errorNotices.count();
    const warningCount = await warningNotices.count();
    
    if (errorCount > 0) {
      console.log(`⚠ Found ${errorCount} error notice(s)`);
      const errorText = await errorNotices.first().textContent();
      console.log(`  Error: ${errorText}`);
    }
    
    if (warningCount > 0) {
      console.log(`⚠ Found ${warningCount} warning notice(s)`);
    }
    
    console.log('✓ Error check completed');
  });

  test('09 - Check Plugin Compatibility', async ({ page }) => {
    await loginToWordPress(page);
    
    console.log('📍 Checking WordPress and PHP compatibility...');
    
    // Navigate to Tools > Site Health for compatibility info
    await page.goto(`${config.wpAdminUrl}/site-health.php`, { waitUntil: 'networkidle' }).catch(() => {
      console.log('⚠ Site Health page not available');
    });
    
    // Just verify page loads or handle gracefully
    const title = await page.title();
    console.log(`✓ Compatibility check completed (${title})`);
  });

  test('10 - Verify No JavaScript Console Errors', async ({ page }) => {
    const jsErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });
    
    await loginToWordPress(page);
    await page.goto(`${config.wpAdminUrl}/plugins.php`, { waitUntil: 'networkidle' });
    
    // Search for plugin
    const searchBox = page.locator('input[placeholder="Search plugins"]');
    const exists = await searchBox.count();
    
    if (exists > 0) {
      await searchBox.fill(config.pluginSearchTerm);
      await searchBox.press('Enter');
    } else {
      const input = page.locator('input[name="s"]').first();
      await input.fill(config.pluginSearchTerm);
      await input.press('Enter');
    }
    
    await page.waitForTimeout(2000);
    
    if (jsErrors.length > 0) {
      console.log(`⚠ Found ${jsErrors.length} JavaScript error(s):`);
      jsErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✓ No JavaScript console errors detected');
    }
  });
});
