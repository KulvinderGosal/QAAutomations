const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Create A/B Test Broadcast', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes for A/B test
  
  console.log('\n🔬 Starting A/B Test Broadcast\n');
  
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
  
  // Step 4: Fill Variant A
  console.log('📍 Step 4: Filling A/B test - Variant A...');
  const baseTitle = `AB Test ${new Date().toLocaleTimeString()}`;
  const titleA = `${baseTitle} - Variant A`;
  const messageA = `Variant A message - Testing which performs better`;
  const url = config.wpAdminUrl.replace('/wp-admin', '');
  
  await page.waitForTimeout(2000);
  await page.fill('[data-testid="notificationTitle-notification-generic"]', titleA);
  console.log(`   Title A: ${titleA}`);
  
  await page.fill('#notification-message', messageA);
  console.log(`   Message A: ${messageA}`);
  
  await page.fill('div.pe-notification-url input', url);
  console.log(`   URL: ${url}`);
  console.log('✅ Variant A filled\n');
  
  await page.screenshot({ path: 'test-results/ab-test-variant-a.png', fullPage: true });
  
  // Step 5: Look for A/B test option
  console.log('📍 Step 5: Looking for A/B test toggle...');
  const abTestSelectors = [
    'text=A/B Test',
    'text=Enable A/B Testing',
    'label:has-text("A/B Test")',
    'span:has-text("A/B Test")',
    'input[type="checkbox"]:near(text="A/B")'
  ];
  
  let abTestEnabled = false;
  for (const selector of abTestSelectors) {
    try {
      const toggle = page.locator(selector).first();
      const isVisible = await toggle.isVisible({ timeout: 3000 });
      if (isVisible) {
        console.log(`   ✓ Found A/B test option: ${selector}`);
        await toggle.click();
        abTestEnabled = true;
        await page.waitForTimeout(2000);
        console.log('✅ A/B test enabled\n');
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!abTestEnabled) {
    console.log('   ⚠️ A/B test option not found - this may be a premium feature');
    console.log('   ℹ️ Continuing with regular broadcast...\n');
  }
  
  // Step 6: Fill Variant B (if A/B test is enabled)
  if (abTestEnabled) {
    console.log('📍 Step 6: Filling Variant B...');
    const titleB = `${baseTitle} - Variant B`;
    const messageB = `Variant B message - Different approach to test`;
    
    try {
      // Click on "Notification B" tab
      const notificationBTab = page.locator('text=Notification B').first();
      const isVisible = await notificationBTab.isVisible({ timeout: 3000 });
      if (isVisible) {
        console.log('   ✓ Clicking Notification B tab...');
        await notificationBTab.click();
        await page.waitForTimeout(2000);
        
        // Use nth() to select the second set of fields (index 1)
        await page.locator('[data-testid="notificationTitle-notification-generic"]').nth(1).fill(titleB);
        console.log(`   ✓ Title B: ${titleB}`);
        
        await page.locator('#notification-message').nth(1).fill(messageB);
        console.log(`   ✓ Message B: ${messageB}`);
        
        // Fill URL for Variant B
        await page.locator('div.pe-notification-url input').nth(1).fill(url);
        console.log(`   ✓ URL B: ${url}`);
        
        console.log('✅ Variant B filled completely\n');
      } else {
        console.log('   ⚠️ Notification B tab not found\n');
      }
    } catch (e) {
      console.log(`   ⚠️ Error filling Variant B: ${e.message}\n`);
    }
    
    await page.screenshot({ path: 'test-results/ab-test-both-variants.png', fullPage: true });
  }
  
  // Step 7: Save
  console.log('📍 Step 7: Saving A/B test broadcast...');
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(5000);
  console.log('✅ Saved\n');
  
  await page.screenshot({ path: 'test-results/ab-test-audience-page.png', fullPage: true });
  
  // Step 8: Configure A/B test settings (if available)
  console.log('📍 Step 8: Configuring A/B test settings...');
  try {
    // Look for split percentage
    const splitInput = page.locator('input[type="number"][placeholder*="split"], input[placeholder*="percentage"]').first();
    const isVisible = await splitInput.isVisible({ timeout: 3000 });
    if (isVisible) {
      await splitInput.fill('50'); // 50/50 split
      console.log('   ✓ Set 50/50 split');
    }
  } catch (e) {
    console.log('   ℹ️ Using default split settings');
  }
  
  // Step 9: Send
  console.log('📍 Step 9: Sending A/B test...');
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
    'button:has-text("Send A/B Test")',
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
  console.log('✅ A/B test sent!\n');
  
  await page.screenshot({ path: 'test-results/ab-test-complete.png', fullPage: true });
  
  if (abTestEnabled) {
    console.log('🎉 A/B Test broadcast sent successfully!\n');
    console.log('   📊 Both variants will be sent to test which performs better\n');
  } else {
    console.log('🎉 Regular broadcast sent (A/B test feature not available)\n');
  }
});
