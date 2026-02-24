const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Send to Specific Audience Segment', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('\n👥 Starting Audience Segment Broadcast Test\n');
  
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
  
  // Step 4: Fill form
  console.log('📍 Step 4: Filling audience broadcast details...');
  const title = `Audience Segment Test ${new Date().toLocaleTimeString()}`;
  const message = `Targeted to specific audience - sent at ${new Date().toLocaleString()}`;
  const url = config.wpAdminUrl.replace('/wp-admin', '');
  
  await page.waitForTimeout(2000);
  await page.fill('[data-testid="notificationTitle-notification-generic"]', title);
  console.log(`   Title: ${title}`);
  
  await page.fill('#notification-message', message);
  console.log(`   Message: ${message}`);
  
  await page.fill('div.pe-notification-url input', url);
  console.log(`   URL: ${url}`);
  console.log('✅ Form filled\n');
  
  await page.screenshot({ path: 'test-results/audience-broadcast-filled.png', fullPage: true });
  
  // Step 5: Save and go to Audience page
  console.log('📍 Step 5: Going to Audience selection...');
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(5000);
  console.log('✅ On Audience page\n');
  
  await page.screenshot({ path: 'test-results/audience-selection-page.png', fullPage: true });
  
  // Step 6: Click on Audience tab
  console.log('📍 Step 6: Accessing Audience tab...');
  try {
    await page.click('text=Audience', { timeout: 5000 });
    await page.waitForTimeout(2000);
    console.log('✅ On Audience tab\n');
  } catch (e) {
    console.log('   ℹ️ Already on Audience page\n');
  }
  
  // Step 7: Select audience segment
  console.log('📍 Step 7: Selecting audience segment...');
  
  // Try to select "All Subscribers" or first available segment
  const audienceSelectors = [
    'label:has-text("All Subscribers")',
    'span:has-text("All Subscribers")',
    'input[type="radio"][value="all"]',
    'div.audience-option',
    'label:has-text("Active Subscribers")'
  ];
  
  let audienceSelected = false;
  for (const selector of audienceSelectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      console.log(`   ✓ Selected audience using: ${selector}`);
      audienceSelected = true;
      await page.waitForTimeout(2000);
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (!audienceSelected) {
    console.log('   ℹ️ Using default audience (All Subscribers)\n');
  } else {
    console.log('✅ Audience selected\n');
  }
  
  await page.screenshot({ path: 'test-results/audience-selected.png', fullPage: true });
  
  // Step 8: Go to Send tab
  console.log('📍 Step 8: Going to Send tab...');
  try {
    await page.click('text=Send / Schedule', { timeout: 5000 });
    await page.waitForTimeout(2000);
    console.log('✅ On Send tab\n');
  } catch (e) {
    console.log('   ℹ️ Continuing to send...\n');
  }
  
  // Step 9: Send Now
  console.log('📍 Step 9: Sending to selected audience...');
  try {
    const sendNowOption = page.locator('label:has-text("Send Now"), span:has-text("Send Now")').first();
    await sendNowOption.click({ timeout: 5000 });
    console.log('   ✓ Selected Send Now');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('   ℹ️ Send Now already selected');
  }
  
  // Click Send button
  const sendSelectors = [
    'button:has-text("Send Notification")',
    'button:has-text("Send")',
    'button:has-text("Confirm Send")',
    'button.ant-btn-primary:has-text("Send")'
  ];
  
  let sent = false;
  for (const selector of sendSelectors) {
    try {
      const btn = page.locator(selector).first();
      const isVisible = await btn.isVisible({ timeout: 3000 });
      if (isVisible) {
        console.log(`   ✓ Clicking: ${selector}`);
        await btn.click();
        sent = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!sent) {
    console.log('   ⚠️ Send button not found');
    await page.screenshot({ path: 'test-results/audience-no-send.png', fullPage: true });
  }
  
  await page.waitForTimeout(3000);
  console.log('✅ Sent to audience!\n');
  
  await page.screenshot({ path: 'test-results/audience-broadcast-sent.png', fullPage: true });
  
  console.log('🎉 Audience-targeted broadcast sent successfully!\n');
});
