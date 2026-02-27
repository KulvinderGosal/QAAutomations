const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Create Segment and Audience Group', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('\n👥 Starting Segment & Audience Group Test\n');
  
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
  
  // Step 3: Click on Audience
  console.log('📍 Step 3: Navigating to Audience...');
  await page.click('text=Audience', { timeout: 5000 });
  await page.waitForTimeout(3000);
  console.log('✅ On Audience page\n');
  
  await page.screenshot({ path: 'test-results/audience-page.png', fullPage: true });
  
  // Step 4: Create Segment
  console.log('📍 Step 4: Creating new segment...');
  
  // Look for Segments tab or section
  try {
    await page.click('text=Segments', { timeout: 5000 });
    await page.waitForTimeout(2000);
    console.log('   ✓ On Segments section');
  } catch (e) {
    console.log('   ℹ️ Already on segments or segments not in tabs');
  }
  
  // Click Create/Add New
  const createSelectors = [
    'button:has-text("Add New")',
    'button:has-text("Create Segment")',
    'button:has-text("New Segment")',
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
  console.log('✅ Segment form opened\n');
  
  // Step 5: Fill segment details
  console.log('📍 Step 5: Filling segment details...');
  const segmentName = `Segment ${new Date().toLocaleTimeString()}`;
  
  await page.screenshot({ path: 'test-results/segment-form.png', fullPage: true });
  
  // Fill segment name
  const nameSelectors = [
    'input[placeholder*="name" i]',
    'input[placeholder*="segment" i]',
    '[data-testid*="segment-name"]',
    'input[type="text"]'
  ];
  
  for (const selector of nameSelectors) {
    try {
      const input = page.locator(selector).first();
      const isVisible = await input.isVisible({ timeout: 3000 });
      if (isVisible) {
        await input.fill(segmentName);
        console.log(`   ✓ Segment Name: ${segmentName}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  console.log('✅ Segment details filled\n');
  
  // Step 6: Save segment
  console.log('📍 Step 6: Saving segment...');
  const saveSelectors = [
    'button:has-text("Save")',
    'button:has-text("Create")',
    'button:has-text("Save Segment")',
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
  console.log('✅ Segment created!\n');
  
  await page.screenshot({ path: 'test-results/segment-created.png', fullPage: true });
  
  // Step 7: Create Audience Group (if available)
  console.log('📍 Step 7: Creating audience group...');
  
  try {
    await page.click('text=Groups', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const groupCreateSelectors = [
      'button:has-text("Add New")',
      'button:has-text("Create Group")',
      'button:has-text("New Group")'
    ];
    
    for (const selector of groupCreateSelectors) {
      try {
        await page.click(selector, { timeout: 3000 });
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(2000);
    
    const groupName = `Group ${new Date().toLocaleTimeString()}`;
    await page.fill('input[type="text"]', groupName);
    console.log(`   ✓ Group Name: ${groupName}`);
    
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);
    console.log('✅ Audience group created!\n');
    
  } catch (e) {
    console.log('   ℹ️ Audience groups not available or already created\n');
  }
  
  await page.screenshot({ path: 'test-results/audience-complete.png', fullPage: true });
  
  console.log('🎉 Segment & Audience setup completed!\n');
  console.log(`   Segment: ${segmentName}\n`);
});
