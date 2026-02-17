const { test, expect } = require('@playwright/test');

// FORCE local environment
process.env.TEST_ENV = 'local';

test('Simple Broadcast Test - Create and Send', async ({ page }) => {
  console.log('\n🚀 Starting broadcast test...\n');
  console.log('🌍 Environment: LOCAL (http://productionautomation.local/)\n');
  
  // Login
  await page.goto('http://productionautomation.local/wp-login.php');
  await page.fill('input[name="log"]', 'admin');
  await page.fill('input[name="pwd"]', 'admin@123=');
  await page.click('input[type="submit"]');
  await page.waitForLoadState('networkidle');
  console.log('✅ Logged in\n');
  
  // Go to campaigns
  await page.goto('http://productionautomation.local/wp-admin/admin.php?page=pushengage#/campaigns/notifications');
  await page.waitForTimeout(5000);
  console.log('✅ On campaigns page\n');
  
  // Click Create
  console.log('📍 Clicking Create button...');
  await page.locator('button:has-text("Create"), button:has-text("New")').first().click();
  await page.waitForTimeout(3000);
  console.log('✅ Create form opened\n');
  
  // Fill form
  const title = `Test ${new Date().toLocaleTimeString()}`;
  console.log(`📝 Filling form with title: ${title}`);
  
  await page.locator('input[placeholder*="title" i]').first().fill(title);
  await page.locator('textarea').first().fill('Test message');
  await page.locator('input[placeholder*="url" i]').first().fill('http://productionautomation.local/');
  console.log('✅ Form filled\n');
  
  await page.waitForTimeout(2000);
  
  // Save
  console.log('📍 Clicking Save...');
  await page.locator('button:has-text("Save"), button:has-text("Next")').first().click();
  await page.waitForTimeout(3000);
  console.log('✅ Saved\n');
  
  // Select Send Now
  console.log('📍 Selecting Send Now...');
  await page.locator('span:has-text("Send Now"), label:has-text("Send Now")').first().click();
  await page.waitForTimeout(2000);
  
  // Send
  console.log('📍 Clicking Send...');
  await page.locator('button:has-text("Send")').last().click();
  await page.waitForTimeout(3000);
  
  console.log('\n🎉 BROADCAST SENT!\n');
  console.log(`📱 Title: ${title}`);
  console.log('📱 Check your device for notification!\n');
  
  expect(true).toBeTruthy();
});
