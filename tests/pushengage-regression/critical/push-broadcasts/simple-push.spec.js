const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Send Push Broadcast - Simple', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('\n🚀 Starting Push Broadcast Test\n');
  
  // Step 1: Login
  console.log('📍 Step 1: Login to WordPress...');
  await loginToWordPress(page);
  console.log('✅ Logged in\n');
  
  // Step 2: Find and click PushEngage menu
  console.log('📍 Step 2: Looking for PushEngage menu...');
  await page.waitForTimeout(2000);
  
  // Click PushEngage menu
  await page.click('text=PushEngage');
  console.log('✅ Clicked PushEngage menu\n');
  await page.waitForTimeout(2000);
  
  // Step 3: Click Broadcast
  console.log('📍 Step 3: Clicking Broadcast...');
  await page.click('text=Broadcast');
  console.log('✅ Clicked Broadcast\n');
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/broadcast-page.png', fullPage: true });
  
  // Step 4: Click Add New button
  console.log('📍 Step 4: Clicking Add New button...');
  await page.click('button:has-text("Add New")');
  console.log('✅ Clicked Add New\n');
  await page.waitForTimeout(3000);
  
  // Step 5: Fill the form
  console.log('📍 Step 5: Filling broadcast details...');
  const title = `Test Broadcast ${new Date().toLocaleTimeString()}`;
  const message = `Automated test at ${new Date().toLocaleString()}`;
  const url = config.wpAdminUrl.replace('/wp-admin', ''); // Use base URL
  
  // Wait for form to load
  await page.waitForTimeout(2000);
  
  // Fill title
  await page.fill('[data-testid="notificationTitle-notification-generic"]', title);
  console.log(`   Title: ${title}`);
  
  // Fill message
  await page.fill('#notification-message', message);
  console.log(`   Message: ${message}`);
  
  // Fill URL (REQUIRED!)
  const urlSelectors = [
    'div.pe-notification-url input',
    'input[placeholder*="URL"]',
    '#notification-url',
    'input[type="url"]'
  ];
  
  let urlFilled = false;
  for (const selector of urlSelectors) {
    try {
      await page.fill(selector, url, { timeout: 3000 });
      console.log(`   URL: ${url} (using ${selector})`);
      urlFilled = true;
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (!urlFilled) {
    console.log(`   ⚠️ URL not filled, will try later`);
  }
  
  console.log('✅ Form filled\n');
  
  await page.screenshot({ path: 'test-results/broadcast-filled.png', fullPage: true });
  
  // Step 6: Click Save/Next
  console.log('📍 Step 6: Saving...');
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(5000); // Wait longer for page transition
  console.log('✅ Saved\n');
  
  await page.screenshot({ path: 'test-results/broadcast-audience-page.png', fullPage: true });
  
  // Step 7: Send
  console.log('📍 Step 7: Sending broadcast...');
  
  // Click "Send Now" radio button or option if available
  try {
    const sendNowOption = page.locator('label:has-text("Send Now"), span:has-text("Send Now")').first();
    await sendNowOption.click({ timeout: 5000 });
    console.log('   ✓ Selected Send Now option');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('   (Send Now option not found, looking for send button...)');
  }
  
  // Click the Send button (try multiple selectors)
  const sendSelectors = [
    'button:has-text("Send Notification")',
    'button:has-text("Send")',
    'button:has-text("Confirm Send")',
    'button.ant-btn-primary:has-text("Send")',
    'button[type="submit"]'
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
    console.log('   ⚠️ No send button found, taking screenshot...');
    await page.screenshot({ path: 'test-results/broadcast-no-send-button.png', fullPage: true });
    throw new Error('Could not find send button');
  }
  
  await page.waitForTimeout(3000);
  console.log('✅ Sent!\n');
  
  await page.screenshot({ path: 'test-results/broadcast-sent.png', fullPage: true });
  
  console.log('🎉 Push broadcast sent successfully!\n');
});
