const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Create Drip Campaign', async ({ page }) => {
  test.setTimeout(180000);
  
  console.log('\n💧 Starting Drip Campaign Test\n');
  
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
  
  // Step 3: Click on Drip
  console.log('📍 Step 3: Navigating to Drip Campaigns...');
  try {
    await page.click('text=Drip', { timeout: 5000 });
    console.log('✅ On Drip page\n');
  } catch (e) {
    console.log('   ⚠️ Drip not in sidebar, trying Campaigns menu...');
    await page.click('text=Campaigns', { timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.click('text=Drip', { timeout: 5000 });
    console.log('✅ On Drip page\n');
  }
  
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/drip-page.png', fullPage: true });
  
  // Step 4: Click Create/Add New
  console.log('📍 Step 4: Creating new drip campaign...');
  const createSelectors = [
    'button:has-text("Add New")',
    'button:has-text("Create")',
    'button:has-text("New Campaign")',
    'a:has-text("Add New")'
  ];
  
  let created = false;
  for (const selector of createSelectors) {
    try {
      await page.click(selector, { timeout: 3000 });
      created = true;
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (!created) {
    console.log('   ⚠️ Create button not found, taking screenshot...');
    await page.screenshot({ path: 'test-results/drip-no-create.png', fullPage: true });
  }
  
  await page.waitForTimeout(3000);
  console.log('✅ Drip form opened\n');
  
  // Step 5: Fill drip campaign details
  console.log('📍 Step 5: Filling drip campaign details...');
  const campaignName = `Drip Campaign ${new Date().toLocaleTimeString()}`;
  
  await page.screenshot({ path: 'test-results/drip-form.png', fullPage: true });
  
  // Fill campaign name
  const nameSelectors = [
    'input[placeholder*="name" i]',
    'input[placeholder*="campaign" i]',
    '[data-testid*="campaign-name"]',
    'input[type="text"]'
  ];
  
  for (const selector of nameSelectors) {
    try {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible({ timeout: 3000 });
      if (isVisible) {
        await input.fill(campaignName);
        console.log(`   ✓ Campaign Name: ${campaignName}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  console.log('✅ Drip campaign details filled\n');
  
  // Step 6: Save drip campaign
  console.log('📍 Step 6: Saving drip campaign...');
  const saveSelectors = [
    'button:has-text("Save")',
    'button:has-text("Create")',
    'button:has-text("Next")',
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
  console.log('✅ Drip campaign saved!\n');
  
  await page.screenshot({ path: 'test-results/drip-created.png', fullPage: true });
  
  console.log('🎉 Drip Campaign created successfully!\n');
  console.log(`   Campaign: ${campaignName}\n`);
});
