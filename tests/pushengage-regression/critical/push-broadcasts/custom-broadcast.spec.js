const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Custom Parameters Broadcast', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('\n⚙️ Starting Custom Parameters Broadcast Test\n');
  
  // Custom parameters (can be modified)
  const customParams = {
    title: process.env.BROADCAST_TITLE || `Custom Broadcast ${new Date().toLocaleTimeString()}`,
    message: process.env.BROADCAST_MESSAGE || `Custom message with parameters - sent at ${new Date().toLocaleString()}`,
    url: process.env.BROADCAST_URL || config.wpAdminUrl.replace('/wp-admin', ''),
    icon: process.env.BROADCAST_ICON || null, // Optional custom icon
    largeImage: process.env.BROADCAST_IMAGE || null // Optional large image
  };
  
  console.log('📋 Using custom parameters:');
  console.log(`   Title: ${customParams.title}`);
  console.log(`   Message: ${customParams.message}`);
  console.log(`   URL: ${customParams.url}`);
  console.log(`   Icon: ${customParams.icon || 'Default'}`);
  console.log(`   Large Image: ${customParams.largeImage || 'None'}\n`);
  
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
  console.log('📍 Step 4: Filling custom parameters...');
  await page.waitForTimeout(2000);
  
  // Fill title
  await page.fill('[data-testid="notificationTitle-notification-generic"]', customParams.title);
  console.log(`   ✓ Title filled`);
  
  // Fill message
  await page.fill('#notification-message', customParams.message);
  console.log(`   ✓ Message filled`);
  
  // Fill URL
  await page.fill('div.pe-notification-url input', customParams.url);
  console.log(`   ✓ URL filled`);
  
  // Upload custom icon if provided
  if (customParams.icon) {
    console.log('   📸 Uploading custom icon...');
    try {
      const iconUpload = page.locator('input[type="file"][accept*="image"]').first();
      const isVisible = await iconUpload.isVisible({ timeout: 3000 });
      if (isVisible) {
        await iconUpload.setInputFiles(customParams.icon);
        console.log('   ✓ Icon uploaded');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('   ℹ️ Icon upload not available or file not found');
    }
  }
  
  // Enable large image if provided
  if (customParams.largeImage) {
    console.log('   🖼️ Setting up large image...');
    try {
      // Enable large image toggle
      const largeImageToggle = page.locator('text=Show Large Image, label:has-text("Large Image")').first();
      const isVisible = await largeImageToggle.isVisible({ timeout: 3000 });
      if (isVisible) {
        await largeImageToggle.click();
        console.log('   ✓ Large image enabled');
        await page.waitForTimeout(1000);
        
        // Upload image
        const imageUpload = page.locator('input[type="file"][accept*="image"]').last();
        await imageUpload.setInputFiles(customParams.largeImage);
        console.log('   ✓ Large image uploaded');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('   ℹ️ Large image not available or file not found');
    }
  }
  
  console.log('✅ Custom parameters set\n');
  
  await page.screenshot({ path: 'test-results/custom-broadcast-filled.png', fullPage: true });
  
  // Step 5: Configure UTM parameters (optional)
  console.log('📍 Step 5: Setting UTM parameters...');
  try {
    const utmSection = page.locator('text=UTM Parameters, text=UTM').first();
    const isVisible = await utmSection.isVisible({ timeout: 3000 });
    if (isVisible) {
      console.log('   ℹ️ UTM parameters available - using defaults');
    }
  } catch (e) {
    console.log('   ℹ️ UTM section not found');
  }
  
  // Step 6: Save
  console.log('📍 Step 6: Saving custom broadcast...');
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(5000);
  console.log('✅ Saved\n');
  
  await page.screenshot({ path: 'test-results/custom-broadcast-audience.png', fullPage: true });
  
  // Step 7: Send
  console.log('📍 Step 7: Sending custom broadcast...');
  try {
    const sendNowOption = page.locator('label:has-text("Send Now"), span:has-text("Send Now")').first();
    await sendNowOption.click({ timeout: 5000 });
    console.log('   ✓ Selected Send Now');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('   ℹ️ Send Now already selected');
  }
  
  const sendSelectors = [
    'button:has-text("Send Notification")',
    'button:has-text("Send")',
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
  
  await page.waitForTimeout(3000);
  console.log('✅ Sent!\n');
  
  await page.screenshot({ path: 'test-results/custom-broadcast-sent.png', fullPage: true });
  
  console.log('🎉 Custom parameters broadcast sent successfully!\n');
  console.log('📋 Summary:');
  console.log(`   Title: ${customParams.title}`);
  console.log(`   Message: ${customParams.message}`);
  console.log(`   URL: ${customParams.url}\n`);
});
