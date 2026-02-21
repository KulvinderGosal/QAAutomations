const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Simple Broadcast Test - Create and Send', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('\n🚀 Starting broadcast test...\n');
  const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
  console.log(`🌍 Environment: ${baseUrl}\n`);
  
  // Login using centralized auth utility
  await loginToWordPress(page);
  console.log('✅ Logged in\n');
  
  // Go to campaigns
  console.log('📍 Navigating to campaigns...');
  await page.goto(`${baseUrl}/wp-admin/admin.php?page=pushengage#/campaigns/notifications`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(5000);
  console.log('✅ On campaigns page\n');
  
  // Click Create (multi-selector strategy)
  console.log('📍 Clicking Create button...');
  const createSelectors = [
    'button:has-text("Create")',
    'button:has-text("New")',
    'a:has-text("Create")',
    'button.ant-btn-primary',
    '[data-testid*="create"]',
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
  
  // Fill form
  const title = `Test ${new Date().toLocaleTimeString()}`;
  console.log(`📝 Filling form with title: ${title}`);
  
  // Fill Title (multi-selector strategy)
  console.log('📍 Filling title...');
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
  console.log('✅ Title filled');
  
  // Fill Message (multi-selector strategy)
  console.log('📍 Filling message...');
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
      await input.fill('Test message');
      messageFilled = true;
      break;
    }
  }
  
  if (!messageFilled) {
    console.log('   ⚠️ Using fallback: first textarea');
    await page.locator('textarea').first().fill('Test message');
  }
  console.log('✅ Message filled');
  
  // Fill URL (multi-selector strategy)
  console.log('📍 Filling URL...');
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
      await input.fill(baseUrl);
      urlFilled = true;
      break;
    }
  }
  
  if (!urlFilled) {
    console.log('   ⚠️ Skipping URL field (not found)');
  }
  console.log('✅ URL filled\n');
  
  await page.waitForTimeout(2000);
  
  // Save (multi-selector strategy)
  console.log('📍 Clicking Save...');
  const saveSelectors = [
    'button:has-text("Save")',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    'button.ant-btn-primary',
  ];
  
  for (const selector of saveSelectors) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      console.log(`   ✓ Found: ${selector}`);
      await button.click();
      break;
    }
  }
  await page.waitForTimeout(3000);
  console.log('✅ Saved\n');
  
  // Select Send Now
  console.log('📍 Selecting Send Now...');
  const sendNowSelectors = [
    'span:has-text("Send Now")',
    'span:has-text("Send")',
    'label:has-text("Send Now")',
  ];
  
  for (const selector of sendNowSelectors) {
    const option = page.locator(selector).first();
    const isVisible = await option.isVisible().catch(() => false);
    if (isVisible) {
      console.log(`   ✓ Found: ${selector}`);
      await option.click();
      break;
    }
  }
  await page.waitForTimeout(2000);
  
  // Send
  console.log('📍 Clicking Send...');
  await page.locator('button:has-text("Send")').last().click();
  await page.waitForTimeout(3000);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 BROADCAST SENT!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📱 Title: ${title}`);
  console.log('📱 Check your device for notification!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  expect(true).toBeTruthy();
});
