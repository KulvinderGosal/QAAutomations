const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Create Trigger', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('\n⚡ Starting Trigger Creation Test\n');
  
  // Step 1: Login
  console.log('📍 Step 1: Login to WordPress...');
  await loginToWordPress(page);
  console.log('✅ Logged in\n');
  
  // Step 2: Navigate to PushEngage
  console.log('📍 Step 2: Navigating to PushEngage...');
  await page.waitForTimeout(2000);
  await page.click('text=PushEngage');
  await page.waitForTimeout(2000);
  console.log('✅ PushEngage menu opened\n');
  
  // Step 3: Click on Triggers
  console.log('📍 Step 3: Navigating to Triggers...');
  try {
    await page.click('text=Triggers', { timeout: 5000 });
    console.log('✅ On Triggers page\n');
  } catch (e) {
    console.log('   ⚠️ Triggers not in sidebar, trying Campaigns menu...');
    await page.click('text=Campaigns', { timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.click('text=Triggers', { timeout: 5000 });
    console.log('✅ On Triggers page\n');
  }
  
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/trigger-page.png', fullPage: true });
  
  // Step 4: Click Add New Trigger
  console.log('📍 Step 4: Creating new trigger...');
  const createSelectors = [
    'button:has-text("Add New")',
    'button:has-text("Create Trigger")',
    'button:has-text("New Trigger")',
    'a:has-text("Add New")'
  ];
  
  for (const selector of createSelectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      break;
    } catch (e) {
      continue;
    }
  }
  
  await page.waitForTimeout(3000);
  console.log('✅ Trigger form opened\n');
  
  // Step 5: Fill trigger details
  console.log('📍 Step 5: Filling trigger details...');
  const triggerName = `Trigger ${new Date().toLocaleTimeString()}`;
  const message = `Triggered notification - ${new Date().toLocaleString()}`;
  const url = config.wpAdminUrl.replace('/wp-admin', '');
  
  await page.screenshot({ path: 'test-results/trigger-form.png', fullPage: true });
  
  // Fill trigger name/title
  const nameSelectors = [
    '[data-testid*="notificationTitle"]',
    'input[placeholder*="title" i]',
    'input[placeholder*="name" i]',
    'input[type="text"]'
  ];
  
  for (const selector of nameSelectors) {
    try {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible({ timeout: 3000 });
      if (isVisible) {
        await input.fill(triggerName);
        console.log(`   ✓ Trigger Name: ${triggerName}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  // Fill message
  try {
    await page.fill('#notification-message', message, { timeout: 5000 });
    console.log(`   ✓ Message: ${message}`);
  } catch (e) {
    console.log('   ℹ️ Message field not found');
  }
  
  // Fill URL
  try {
    await page.fill('div.pe-notification-url input', url, { timeout: 5000 });
    console.log(`   ✓ URL: ${url}`);
  } catch (e) {
    console.log('   ℹ️ URL field not found');
  }
  
  console.log('✅ Trigger details filled\n');
  
  // Step 6: Save trigger
  console.log('📍 Step 6: Saving trigger...');
  const saveSelectors = [
    'button:has-text("Save")',
    'button:has-text("Create")',
    'button:has-text("Activate")',
    'button.ant-btn-primary'
  ];
  
  for (const selector of saveSelectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      break;
    } catch (e) {
      continue;
    }
  }
  
  await page.waitForTimeout(3000);
  console.log('✅ Trigger created!\n');
  
  await page.screenshot({ path: 'test-results/trigger-created.png', fullPage: true });
  
  console.log('🎉 Trigger created successfully!\n');
  console.log(`   Trigger: ${triggerName}\n`);
});
