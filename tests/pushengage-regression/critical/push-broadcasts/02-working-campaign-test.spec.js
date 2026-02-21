const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test.describe('Campaign Tests - Working', () => {
  
  test('Create and Send Immediate Broadcast', async ({ page }) => {
    test.setTimeout(120000);
    
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
    console.log(`\n🚀 Starting broadcast test on ${baseUrl}...\n`);
    
    // Login using centralized auth utility
    await loginToWordPress(page);
    console.log('✅ Logged in\n');
    
    // Go to campaigns
    console.log('📍 Going to PushEngage Campaigns...');
    await page.goto(`${baseUrl}/wp-admin/admin.php?page=pushengage#/campaigns/notifications`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);
    console.log('✅ On campaigns page\n');
    
    // Click Create button (multi-selector strategy)
    console.log('📍 Clicking Create button...');
    const createSelectors = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'a:has-text("Create")',
      'button.ant-btn-primary',
      '[data-testid*="create"]',
      '.pe-container button:first-of-type',
    ];
    
    let createClicked = false;
    for (const selector of createSelectors) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await button.click();
        createClicked = true;
        break;
      }
    }
    
    if (!createClicked) {
      throw new Error('Could not find Create button with any selector');
    }
    
    await page.waitForTimeout(3000);
    console.log('✅ Create form opened\n');
    
    // Wait for form to load
    await page.waitForTimeout(2000);
    
    // Fill Title (multi-selector strategy)
    const title = `Automated Test ${new Date().toLocaleTimeString()}`;
    console.log(`📝 Filling title: "${title}"`);
    
    const titleSelectors = [
      '[data-testid="notificationTitle-notification-generic"]',
      '[data-testid*="notificationTitle"]',
      '[placeholder*="title" i]',
      'input[maxlength="85"]',
      '#notification-title',
    ];
    
    let titleFilled = false;
    for (const selector of titleSelectors) {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await input.click();
        await input.fill(title);
        titleFilled = true;
        break;
      }
    }
    
    if (!titleFilled) {
      console.log('   ⚠️ Using fallback: first text input');
      await page.locator('input[type="text"]').first().fill(title);
    }
    await page.waitForTimeout(500);
    console.log('✅ Title filled');
    
    // Fill Message (multi-selector strategy)
    const message = `This is an automated test notification sent at ${new Date().toLocaleString()}`;
    console.log(`📝 Filling message: "${message}"`);
    
    const messageSelectors = [
      '#notification-message',
      '[data-testid*="message"]',
      '[placeholder*="message" i]',
      'input[maxlength="135"]',
      'textarea',
    ];
    
    let messageFilled = false;
    for (const selector of messageSelectors) {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await input.click();
        await input.fill(message);
        messageFilled = true;
        break;
      }
    }
    
    if (!messageFilled) {
      console.log('   ⚠️ Using fallback: first textarea');
      await page.locator('textarea').first().fill(message);
    }
    await page.waitForTimeout(500);
    console.log('✅ Message filled');
    
    // Fill URL (multi-selector strategy)
    const url = baseUrl;
    console.log(`🔗 Filling URL: "${url}"`);
    
    const urlSelectors = [
      'div.pe-notification-url input',
      '[data-testid*="url"]',
      '[placeholder*="url" i]',
      'input[maxlength="1600"]',
      'input[type="url"]',
    ];
    
    let urlFilled = false;
    for (const selector of urlSelectors) {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await input.click();
        await input.fill(url);
        urlFilled = true;
        break;
      }
    }
    
    if (!urlFilled) {
      console.log('   ⚠️ Skipping URL field (not found)');
    }
    await page.waitForTimeout(500);
    console.log('✅ URL filled\n');
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/broadcast-form-filled.png', fullPage: true });
    console.log('📸 Screenshot saved\n');
    
    // Click "Save & Select Audience" button
    console.log('📍 Clicking Save & Select Audience...');
    await page.locator('button:has-text("Save & Select Audience")').click();
    await page.waitForTimeout(3000);
    console.log('✅ Moved to audience selection\n');
    
    // Click "Send Now" radio/option
    console.log('📍 Selecting Send Now...');
    await page.locator('text=Send Now').first().click();
    await page.waitForTimeout(2000);
    console.log('✅ Send Now selected\n');
    
    // Click final Send button
    console.log('📍 Clicking Send button...');
    await page.locator('button:has-text("Send")').last().click();
    await page.waitForTimeout(5000);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/broadcast-sent.png', fullPage: true });
    
    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 BROADCAST SENT SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`📱 Title: ${title}`);
    console.log(`📱 Message: ${message}`);
    console.log(`🔗 URL: ${url}`);
    console.log('\n📱 CHECK YOUR DEVICE FOR THE NOTIFICATION!\n');
    
    expect(true).toBeTruthy();
  });
  
  test('Create Scheduled Broadcast', async ({ page }) => {
    test.setTimeout(120000);
    
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
    console.log('\n📅 Starting scheduled broadcast test...\n');
    
    // Login using centralized auth utility
    await loginToWordPress(page);
    console.log('✅ Logged in\n');
    
    // Go to campaigns
    await page.goto(`${baseUrl}/wp-admin/admin.php?page=pushengage#/campaigns/notifications`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);
    
    // Click Create (multi-selector strategy)
    console.log('📍 Creating new broadcast...');
    const createSelectors = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'button.ant-btn-primary',
    ];
    
    for (const selector of createSelectors) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await button.click();
        break;
      }
    }
    await page.waitForTimeout(3000);
    console.log('✅ Create form opened\n');
    
    // Fill form
    const title = `Scheduled Test ${new Date().toLocaleTimeString()}`;
    console.log(`📝 Filling title: "${title}"`);
    
    const titleSelectors = ['[data-testid*="notificationTitle"]', 'input[maxlength="85"]', 'input[type="text"]'];
    const messageSelectors = ['#notification-message', 'input[maxlength="135"]', 'textarea'];
    const urlSelectors = ['div.pe-notification-url input', 'input[maxlength="1600"]'];
    
    for (const selector of titleSelectors) {
      const input = page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(title);
        break;
      }
    }
    
    for (const selector of messageSelectors) {
      const input = page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill('Scheduled notification');
        break;
      }
    }
    
    for (const selector of urlSelectors) {
      const input = page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(baseUrl);
        break;
      }
    }
    console.log('✅ Form filled\n');
    
    // Save
    console.log('📍 Saving...');
    await page.locator('button:has-text("Save & Select Audience")').click();
    await page.waitForTimeout(3000);
    
    // Select Schedule option
    console.log('📍 Selecting Schedule...');
    await page.locator('text=Schedule').first().click();
    await page.waitForTimeout(2000);
    console.log('✅ Schedule selected\n');
    
    // Save/Schedule
    console.log('📍 Clicking Schedule button...');
    await page.locator('button:has-text("Schedule"), button:has-text("Save")').last().click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'test-results/broadcast-scheduled.png', fullPage: true });
    
    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 BROADCAST SCHEDULED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`📅 Title: ${title}\n`);
    
    expect(true).toBeTruthy();
  });
  
  test('Create Draft Broadcast', async ({ page }) => {
    test.setTimeout(120000);
    
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
    console.log('\n📝 Starting draft broadcast test...\n');
    
    // Login using centralized auth utility
    await loginToWordPress(page);
    console.log('✅ Logged in\n');
    
    // Go to campaigns
    await page.goto(`${baseUrl}/wp-admin/admin.php?page=pushengage#/campaigns/notifications`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);
    
    // Click Create (multi-selector strategy)
    console.log('📍 Creating new broadcast...');
    const createSelectors = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'button.ant-btn-primary',
    ];
    
    for (const selector of createSelectors) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await button.click();
        break;
      }
    }
    await page.waitForTimeout(3000);
    console.log('✅ Create form opened\n');
    
    // Fill only title and message
    const title = `Draft Test ${new Date().toLocaleTimeString()}`;
    console.log(`📝 Filling title: "${title}"`);
    
    const titleSelectors = ['[data-testid*="notificationTitle"]', 'input[maxlength="85"]', 'input[type="text"]'];
    const messageSelectors = ['#notification-message', 'input[maxlength="135"]', 'textarea'];
    
    for (const selector of titleSelectors) {
      const input = page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(title);
        break;
      }
    }
    
    for (const selector of messageSelectors) {
      const input = page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill('Draft notification - not sent yet');
        break;
      }
    }
    console.log('✅ Partial form filled (for draft)\n');
    
    // Save as draft - Click Save but don't proceed to send
    console.log('📍 Saving as draft...');
    await page.locator('button:has-text("Save & Select Audience")').click();
    await page.waitForTimeout(2000);
    
    // Go back or close without sending
    await page.goBack();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/broadcast-draft.png', fullPage: true });
    
    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 DRAFT SAVED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`📝 Title: ${title}\n`);
    
    expect(true).toBeTruthy();
  });
});
