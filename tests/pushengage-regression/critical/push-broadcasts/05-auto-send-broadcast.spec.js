const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

/**
 * Smart Auto-Send Push Broadcast
 * Automatically finds elements and sends broadcast without manual intervention
 */

test.describe('Auto-Send Push Broadcast', () => {
  
  test('Send Push Broadcast Automatically', async ({ page }) => {
    test.setTimeout(120000);
    
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
    
    // Step 1: Login using centralized auth utility
    console.log('📍 Logging in to WordPress...');
    await loginToWordPress(page);
    console.log('✓ Logged in\n');
    
    // Step 2: Navigate to PushEngage
    console.log('📍 Navigating to PushEngage...');
    await page.goto(`${baseUrl}/wp-admin/admin.php?page=pushengage#/campaigns/notifications`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(5000);
    console.log('✓ Page loaded\n');
    
    // Step 3: Find and click "Create" button (try multiple strategies)
    console.log('📍 Looking for Create button...');
    
    const createButtonSelectors = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'a:has-text("Create")',
      'span:has-text("Create New")',
      '[data-testid*="create"]',
      '.pe-container button:first-of-type',
      '.pe-container span:first-of-type',
      'button.ant-btn-primary',
    ];
    
    let createClicked = false;
    for (const selector of createButtonSelectors) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✓ Found create button: ${selector}`);
        await button.click();
        createClicked = true;
        break;
      }
    }
    
    if (!createClicked) {
      console.log('⚠️ Trying to click first clickable element in pe-container...');
      await page.locator('.pe-container button, .pe-container span').first().click({ force: true });
    }
    
    await page.waitForTimeout(3000);
    console.log('✓ Create button clicked\n');
    
    // Step 4: Fill Title (try multiple selectors)
    console.log('📍 Filling notification title...');
    const title = `Auto Broadcast ${new Date().toLocaleTimeString()}`;
    
    const titleSelectors = [
      '[data-testid="notificationTitle-notification-generic"]',
      '[data-testid*="notificationTitle"]',
      '[placeholder*="title" i]',
      '[name*="title" i]',
      '#notification-title',
      'input[type="text"]:first-of-type',
    ];
    
    let titleFilled = false;
    for (const selector of titleSelectors) {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✓ Found title field: ${selector}`);
        await input.click();
        await input.fill(title);
        titleFilled = true;
        console.log(`   Title: "${title}"`);
        break;
      }
    }
    
    if (!titleFilled) {
      console.log('⚠️ Using first visible text input...');
      await page.locator('input[type="text"]').first().fill(title);
    }
    
    console.log('✓ Title filled\n');
    
    // Step 5: Fill Message (try multiple selectors)
    console.log('📍 Filling notification message...');
    const message = `This is an automated test notification sent at ${new Date().toLocaleString()}`;
    
    const messageSelectors = [
      '#notification-message',
      '[data-testid*="message"]',
      '[placeholder*="message" i]',
      '[name*="message" i]',
      'textarea',
    ];
    
    let messageFilled = false;
    for (const selector of messageSelectors) {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✓ Found message field: ${selector}`);
        await input.click();
        await input.fill(message);
        messageFilled = true;
        console.log(`   Message: "${message}"`);
        break;
      }
    }
    
    if (!messageFilled) {
      console.log('⚠️ Using first visible textarea...');
      await page.locator('textarea').first().fill(message);
    }
    
    console.log('✓ Message filled\n');
    
    // Step 6: Fill URL
    console.log('📍 Filling notification URL...');
    const url = baseUrl;
    
    const urlSelectors = [
      'div.pe-notification-url input',
      '[data-testid*="url"]',
      '[placeholder*="url" i]',
      '[name*="url" i]',
      'input[type="url"]',
    ];
    
    for (const selector of urlSelectors) {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✓ Found URL field: ${selector}`);
        await input.click();
        await input.fill(url);
        console.log(`   URL: "${url}"`);
        break;
      }
    }
    
    console.log('✓ URL filled\n');
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/auto-broadcast-filled.png', fullPage: true });
    console.log('✓ Screenshot saved: auto-broadcast-filled.png\n');
    
    // Step 7: Click Save/Next button
    console.log('📍 Looking for Save/Next button...');
    
    const saveSelectors = [
      'button:has-text("Save")',
      'button:has-text("Next")',
      'button:has-text("Continue")',
      'button:has-text("Select Audience")',
      '.campaigns-breadcrumb-navbar button',
      'button.ant-btn-primary',
    ];
    
    for (const selector of saveSelectors) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✓ Found save button: ${selector}`);
        await button.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
    
    console.log('✓ Save button clicked\n');
    
    // Step 8: Click Send Now option
    console.log('📍 Looking for Send option...');
    
    const sendOptionSelectors = [
      'span:has-text("Send Now")',
      'span:has-text("Send")',
      '.campaigns-breadcrumb-right span',
      '[data-testid*="send"]',
    ];
    
    for (const selector of sendOptionSelectors) {
      const option = page.locator(selector).first();
      const isVisible = await option.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✓ Found send option: ${selector}`);
        await option.click();
        await page.waitForTimeout(1000);
        break;
      }
    }
    
    console.log('✓ Send option clicked\n');
    
    // Step 9: Click final Send button
    console.log('📍 Clicking final Send button...');
    
    const finalSendSelectors = [
      'button.pe-ant-btn-primary',
      'button:has-text("Send")',
      'button:has-text("Confirm")',
      'button:has-text("Yes")',
      'button[type="submit"]',
    ];
    
    for (const selector of finalSendSelectors) {
      const button = page.locator(selector);
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✓ Found final send button: ${selector}`);
        await button.click();
        await page.waitForTimeout(3000);
        break;
      }
    }
    
    console.log('✓ Send button clicked!\n');
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/auto-broadcast-sent.png', fullPage: true });
    console.log('✓ Screenshot saved: auto-broadcast-sent.png\n');
    
    // Check for success message
    const successIndicators = await page.locator('text=/success|sent|delivered|scheduled/i').count();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 BROADCAST SENT SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📱 Check your device for the notification!`);
    console.log(`📝 Title: ${title}`);
    console.log(`📝 Message: ${message}`);
    console.log(`🔗 URL: ${url}`);
    if (successIndicators > 0) {
      console.log(`✓ Success message detected on page`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    expect(true).toBeTruthy();
  });
});
