const { test } = require('@playwright/test');

// Force tests to run one at a time
test.describe.configure({ mode: 'serial' });

test.describe('Push Broadcast Tests', () => {

test('Send Immediate Broadcast', async ({ page }) => {
  
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
  await page.fill('input[maxlength="85"]', `Test ${Date.now()}`);
  await page.fill('input[maxlength="135"]', 'Test message');
  await page.fill('input[maxlength="1600"]', 'http://productionautomation.local/');
  await page.waitForTimeout(1000);
  
  // 5. Click Save & Select Audience
  await page.click('button:has-text("Save & Select Audience")');
  await page.waitForTimeout(3000);
  
  // 6. Click Send Now
  await page.click('text=Send Now');
  await page.waitForTimeout(2000);
  
  // 7. Click Send button
  await page.click('button:has-text("Send")');
  await page.waitForTimeout(5000);
  
  console.log('✅ Broadcast sent!');
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
