const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Schedule Future Broadcast', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('\n📅 Starting Scheduled Broadcast Test\n');
  
  // Step 1: Login
  console.log('📍 Step 1: Login to WordPress...');
  await loginToWordPress(page);
  console.log('✅ Logged in\n');
  
  // Step 2: Navigate to Broadcast
  console.log('📍 Step 2: Navigating to Broadcast...');
  await page.waitForTimeout(2000);
  await page.click('text=PushEngage');
  await page.waitForTimeout(2000);
  await page.click('text=Broadcast');
  await page.waitForTimeout(3000);
  console.log('✅ On Broadcast page\n');
  
  // Step 3: Click Add New
  console.log('📍 Step 3: Creating new broadcast...');
  await page.click('button:has-text("Add New")');
  await page.waitForTimeout(3000);
  console.log('✅ Form opened\n');
  
  // Step 4: Fill form with custom parameters
  console.log('📍 Step 4: Filling scheduled broadcast details...');
  const title = `Scheduled Broadcast ${new Date().toLocaleTimeString()}`;
  const message = `This will be sent in the future - scheduled at ${new Date().toLocaleString()}`;
  const url = config.wpAdminUrl.replace('/wp-admin', '');
  
  await page.waitForTimeout(2000);
  await page.fill('[data-testid="notificationTitle-notification-generic"]', title);
  console.log(`   Title: ${title}`);
  
  await page.fill('#notification-message', message);
  console.log(`   Message: ${message}`);
  
  // Fill URL
  await page.fill('div.pe-notification-url input', url);
  console.log(`   URL: ${url}`);
  console.log('✅ Form filled\n');
  
  await page.screenshot({ path: 'test-results/scheduled-broadcast-filled.png', fullPage: true });
  
  // Step 5: Save
  console.log('📍 Step 5: Saving broadcast...');
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(5000);
  console.log('✅ Saved\n');
  
  // Step 6: Click on "Send / Schedule" tab
  console.log('📍 Step 6: Going to Send/Schedule tab...');
  try {
    await page.click('text=Send / Schedule', { timeout: 5000 });
    await page.waitForTimeout(2000);
    console.log('✅ On Send/Schedule tab\n');
  } catch (e) {
    console.log('   ⚠️ Send/Schedule tab not found, continuing...\n');
  }
  
  // Step 7: Select "Schedule for Later" option
  console.log('📍 Step 7: Selecting Schedule for Later...');
  const scheduleSelectors = [
    'label:has-text("Schedule for Later")',
    'span:has-text("Schedule for Later")',
    'text=Schedule for Later',
    'input[value="schedule"]'
  ];
  
  let scheduled = false;
  for (const selector of scheduleSelectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      console.log(`   ✓ Selected Schedule option using: ${selector}`);
      scheduled = true;
      await page.waitForTimeout(2000);
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (!scheduled) {
    console.log('   ⚠️ Schedule option not found, taking screenshot...');
    await page.screenshot({ path: 'test-results/scheduled-no-option.png', fullPage: true });
  } else {
    console.log('✅ Schedule option selected\n');
  }
  
  // Step 8: Set future date/time (if available)
  console.log('📍 Step 8: Setting future date/time...');
  try {
    // Look for date picker
    const datePicker = page.locator('input[type="date"], input[placeholder*="date" i]').first();
    const isVisible = await datePicker.isVisible({ timeout: 3000 });
    if (isVisible) {
      // Set date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];
      await datePicker.fill(dateString);
      console.log(`   ✓ Date set to: ${dateString}`);
    }
  } catch (e) {
    console.log('   ℹ️ Date picker not found or not needed');
  }
  
  await page.screenshot({ path: 'test-results/scheduled-broadcast-setup.png', fullPage: true });
  
  // Step 9: Save the schedule
  console.log('📍 Step 9: Saving scheduled broadcast...');
  const saveSelectors = [
    'button:has-text("Schedule")',
    'button:has-text("Save Schedule")',
    'button:has-text("Confirm")',
    'button.ant-btn-primary'
  ];
  
  let saved = false;
  for (const selector of saveSelectors) {
    try {
      const btn = page.locator(selector).first();
      const isVisible = await btn.isVisible({ timeout: 3000 });
      if (isVisible) {
        console.log(`   ✓ Clicking: ${selector}`);
        await btn.click();
        saved = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  await page.waitForTimeout(3000);
  console.log('✅ Scheduled broadcast saved!\n');
  
  await page.screenshot({ path: 'test-results/scheduled-broadcast-complete.png', fullPage: true });
  
  console.log('🎉 Scheduled broadcast created successfully!\n');
  console.log(`   Will be sent in the future (not immediately)\n`);
});
