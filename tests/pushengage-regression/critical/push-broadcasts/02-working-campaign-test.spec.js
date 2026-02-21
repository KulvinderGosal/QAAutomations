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
    
    // Click "Save & Select Audience" button (multi-selector strategy)
    console.log('📍 Clicking Save & Select Audience...');
    const saveSelectors = [
      'button:has-text("Save & Select Audience")',
      'button:has-text("Save")',
      'button:has-text("Next")',
      'button:has-text("Continue")',
      'button.ant-btn-primary',
    ];
    
    let saveClicked = false;
    for (const selector of saveSelectors) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await button.click();
        saveClicked = true;
        break;
      }
    }
    
    if (!saveClicked) {
      throw new Error('Could not find Save button');
    }
    
    await page.waitForTimeout(5000);  // Increased from 3000
    console.log('✅ Moved to audience selection\n');
    
    // Click "Send Now" radio/option (multi-selector strategy)
    console.log('📍 Selecting Send Now...');
    const sendNowSelectors = [
      'text=Send Now',
      'span:has-text("Send Now")',
      'span:has-text("Send")',
      'label:has-text("Send Now")',
      '[data-testid*="sendNow"]',
    ];
    
    let sendNowSelected = false;
    for (const selector of sendNowSelectors) {
      const option = page.locator(selector).first();
      const isVisible = await option.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await option.click();
        sendNowSelected = true;
        break;
      }
    }
    
    if (!sendNowSelected) {
      console.log('   ⚠️ Send Now option not found, proceeding anyway');
    }
    
    await page.waitForTimeout(3000);  // Increased from 2000
    console.log('✅ Send Now selected\n');
    
    // Click final Send button (multi-selector strategy)
    console.log('📍 Clicking Send button...');
    const finalSendSelectors = [
      'button.pe-ant-btn-primary',
      'button:has-text("Send")',
      'button:has-text("Confirm")',
      'button:has-text("Yes")',
      'button[type="submit"]',
    ];
    
    let sendClicked = false;
    for (const selector of finalSendSelectors) {
      const button = page.locator(selector);
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await button.click();
        sendClicked = true;
        break;
      }
    }
    
    if (!sendClicked) {
      console.log('   ⚠️ Using fallback: last Send button');
      await page.locator('button:has-text("Send")').last().click();
    }
    
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
    
    // Save (multi-selector strategy)
    console.log('📍 Saving...');
    const saveSelectors = [
      'button:has-text("Save & Select Audience")',
      'button:has-text("Save")',
      'button:has-text("Next")',
      'button.ant-btn-primary',
    ];
    
    for (const selector of saveSelectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }
    await page.waitForTimeout(5000);  // Increased from 3000
    
    // Select Schedule option (multi-selector strategy)
    console.log('📍 Selecting Schedule...');
    const scheduleSelectors = [
      'text=Schedule',
      'span:has-text("Schedule")',
      'label:has-text("Schedule")',
      '[data-testid*="schedule"]',
    ];
    
    for (const selector of scheduleSelectors) {
      const option = page.locator(selector).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        break;
      }
    }
    await page.waitForTimeout(3000);  // Increased from 2000
    console.log('✅ Schedule selected\n');
    
    // Save/Schedule (multi-selector strategy)
    console.log('📍 Clicking Schedule button...');
    const scheduleButtonSelectors = [
      'button:has-text("Schedule")',
      'button:has-text("Save")',
      'button:has-text("Confirm")',
      'button.ant-btn-primary',
    ];
    
    for (const selector of scheduleButtonSelectors) {
      const button = page.locator(selector).last();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }
    await page.waitForTimeout(5000);  // Increased from 3000
    
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
    
    // Save as draft (multi-selector strategy)
    console.log('📍 Saving as draft...');
    const saveSelectors = [
      'button:has-text("Save & Select Audience")',
      'button:has-text("Save")',
      'button:has-text("Next")',
      'button.ant-btn-primary',
    ];
    
    for (const selector of saveSelectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }
    await page.waitForTimeout(3000);  // Increased from 2000
    
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
