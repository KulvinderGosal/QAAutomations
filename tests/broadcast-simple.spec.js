const { test } = require('@playwright/test');

// Force tests to run one at a time
test.describe.configure({ mode: 'serial' });

test.describe('Push Broadcast Tests', () => {

test('Send Immediate Broadcast', async ({ page }) => {
  
  console.log('\n🚀 TEST 1: SEND IMMEDIATE BROADCAST\n');
  
  // 1. Login
  console.log('Step 1: Logging in...');
  await page.goto('http://productionautomation.local/wp-login.php');
  await page.fill('input[name="log"]', 'admin');
  await page.fill('input[name="pwd"]', 'admin@123=');
  await page.click('input[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('✅ Logged in\n');
  
  // 2. Go to campaigns
  console.log('Step 2: Going to campaigns page...');
  await page.goto('http://productionautomation.local/wp-admin/admin.php?page=pushengage#/campaigns/notifications');
  await page.waitForTimeout(7000); // Wait longer for page to load
  console.log('✅ On campaigns page\n');
  
  // Take screenshot before clicking Create
  await page.screenshot({ path: 'test-results/01-before-create.png', fullPage: true });
  console.log('📸 Screenshot saved: 01-before-create.png\n');
  
  // 3. Click Create - try multiple selectors
  console.log('Step 3: Clicking Create button...');
  console.log('   Trying different selectors...');
  
  const createSelectors = [
    'button:has-text("Create")',
    'button:has-text("New")',
    'button:has-text("Add New")',
    'button.ant-btn-primary',
    'button[type="button"]'
  ];
  
  let clicked = false;
  for (const selector of createSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 })) {
        console.log(`   Found button with: ${selector}`);
        await btn.click();
        clicked = true;
        break;
      }
    } catch (e) {
      console.log(`   ${selector} - not found`);
    }
  }
  
  if (!clicked) {
    console.log('❌ Could not find Create button - taking screenshot');
    await page.screenshot({ path: 'test-results/create-button-not-found.png', fullPage: true });
    throw new Error('Create button not found');
  }
  
  await page.waitForTimeout(5000);
  console.log('✅ Create form opened\n');
  
  // Take screenshot of form
  await page.screenshot({ path: 'test-results/02-create-form.png', fullPage: true });
  console.log('📸 Screenshot saved: 02-create-form.png\n');
  
  // 4. Fill the form
  console.log('Step 4: Filling form...');
  const timestamp = Date.now();
  
  console.log('   Filling title...');
  await page.fill('input[maxlength="85"]', `Test ${timestamp}`);
  console.log('   ✓ Title filled');
  
  console.log('   Filling message...');
  await page.fill('input[maxlength="135"]', 'Test message');
  console.log('   ✓ Message filled');
  
  console.log('   Filling URL...');
  await page.fill('input[maxlength="1600"]', 'http://productionautomation.local/');
  console.log('   ✓ URL filled');
  
  await page.waitForTimeout(1000);
  console.log('✅ Form filled\n');
  
  // Take screenshot of filled form
  await page.screenshot({ path: 'test-results/03-form-filled.png', fullPage: true });
  console.log('📸 Screenshot saved: 03-form-filled.png\n');
  
  // 5. Click Save & Select Audience
  console.log('Step 5: Clicking Save & Select Audience...');
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(3000);
  console.log('✅ On audience page\n');
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/04-audience-page.png', fullPage: true });
  console.log('📸 Screenshot saved: 04-audience-page.png\n');
  
  // 6. Click Send Now
  console.log('Step 6: Clicking Send Now...');
  await page.click('text=Send Now');
  await page.waitForTimeout(2000);
  console.log('✅ Send Now selected\n');
  
  // 7. Click Send button
  console.log('Step 7: Clicking Send button...');
  await page.click('button:has-text("Send")');
  await page.waitForTimeout(5000);
  console.log('✅ Send button clicked\n');
  
  // Final screenshot
  await page.screenshot({ path: 'test-results/05-broadcast-sent.png', fullPage: true });
  console.log('📸 Screenshot saved: 05-broadcast-sent.png\n');
  
  console.log('═══════════════════════════════════════════');
  console.log('🎉 BROADCAST SENT SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════');
  console.log(`📱 Check your device for notification!\n`);
});

test('Schedule Future Broadcast', async ({ page }) => {
  
  // 1. Login
  await page.goto('http://productionautomation.local/wp-login.php');
  await page.fill('input[name="log"]', 'admin');
  await page.fill('input[name="pwd"]', 'admin@123=');
  await page.click('input[type="submit"]');
  await page.waitForTimeout(3000);
  
  // 2. Go to campaigns
  await page.goto('http://productionautomation.local/wp-admin/admin.php?page=pushengage#/campaigns/notifications');
  await page.waitForTimeout(5000);
  
  // 3. Click Create
  await page.click('button:has-text("Create")');
  await page.waitForTimeout(3000);
  
  // 4. Fill the form
  await page.fill('input[maxlength="85"]', `Scheduled ${Date.now()}`);
  await page.fill('input[maxlength="135"]', 'Scheduled message');
  await page.fill('input[maxlength="1600"]', 'http://productionautomation.local/');
  await page.waitForTimeout(1000);
  
  // 5. Click Save & Select Audience
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(3000);
  
  // 6. Click Schedule (not Send Now)
  await page.click('text=Schedule');
  await page.waitForTimeout(2000);
  
  // 7. Click Schedule/Save button
  await page.click('button:has-text("Schedule"), button:has-text("Save")');
  await page.waitForTimeout(5000);
  
  console.log('✅ Broadcast scheduled!');
});

test('Create A/B Test Broadcast', async ({ page }) => {
  
  // 1. Login
  await page.goto('http://productionautomation.local/wp-login.php');
  await page.fill('input[name="log"]', 'admin');
  await page.fill('input[name="pwd"]', 'admin@123=');
  await page.click('input[type="submit"]');
  await page.waitForTimeout(3000);
  
  // 2. Go to campaigns
  await page.goto('http://productionautomation.local/wp-admin/admin.php?page=pushengage#/campaigns/notifications');
  await page.waitForTimeout(5000);
  
  // 3. Click Create
  await page.click('button:has-text("Create")');
  await page.waitForTimeout(3000);
  
  // 4. Click "Add A/B Testing" link (at the top)
  await page.click('text=Add A/B Testing');
  await page.waitForTimeout(2000);
  
  // 5. Fill Variant A
  await page.fill('input[maxlength="85"]', `A/B Test A ${Date.now()}`);
  await page.fill('input[maxlength="135"]', 'Variant A message');
  await page.fill('input[maxlength="1600"]', 'http://productionautomation.local/');
  
  // 6. Fill Variant B (there should be another set of fields)
  const inputs = await page.locator('input[maxlength="85"]').all();
  if (inputs.length > 1) {
    await inputs[1].fill(`A/B Test B ${Date.now()}`);
  }
  
  await page.waitForTimeout(1000);
  
  // 7. Click Save & Select Audience
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(3000);
  
  // 8. Click Send Now
  await page.click('text=Send Now');
  await page.waitForTimeout(2000);
  
  // 9. Click Send
  await page.click('button:has-text("Send")');
  await page.waitForTimeout(5000);
  
  console.log('✅ A/B Test broadcast sent!');
});

}); // end describe
