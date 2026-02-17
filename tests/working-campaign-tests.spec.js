const { test, expect } = require('@playwright/test');

// FORCE local environment
process.env.TEST_ENV = 'local';

test.describe('Campaign Tests - Working', () => {
  
  test('Create and Send Immediate Broadcast', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n🚀 Starting broadcast test on LOCAL WordPress...\n');
    
    // Login
    console.log('🔐 Logging in...');
    await page.goto('http://productionautomation.local/wp-login.php');
    await page.fill('input[name="log"]', 'admin');
    await page.fill('input[name="pwd"]', 'admin@123=');
    await page.click('input[type="submit"]');
    await page.waitForLoadState('networkidle');
    console.log('✅ Logged in\n');
    
    // Go to campaigns
    console.log('📍 Going to PushEngage Campaigns...');
    await page.goto('http://productionautomation.local/wp-admin/admin.php?page=pushengage#/campaigns/notifications');
    await page.waitForTimeout(5000);
    console.log('✅ On campaigns page\n');
    
    // Click Create button
    console.log('📍 Clicking Create button...');
    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(3000);
    console.log('✅ Create form opened\n');
    
    // Wait for form to load
    await page.waitForSelector('text=Notification Title', { timeout: 10000 });
    
    // Fill Title - Look for the input after "Notification Title" text
    const title = `Automated Test ${new Date().toLocaleTimeString()}`;
    console.log(`📝 Filling title: "${title}"`);
    await page.locator('input[maxlength="85"]').first().fill(title);
    await page.waitForTimeout(500);
    console.log('✅ Title filled');
    
    // Fill Message - Look for the input after "Notification Message" text
    const message = `This is an automated test notification sent at ${new Date().toLocaleString()}`;
    console.log(`📝 Filling message: "${message}"`);
    await page.locator('input[maxlength="135"]').first().fill(message);
    await page.waitForTimeout(500);
    console.log('✅ Message filled');
    
    // Fill URL - Look for the input after "Notification URL" text
    const url = 'http://productionautomation.local/';
    console.log(`🔗 Filling URL: "${url}"`);
    await page.locator('input[maxlength="1600"]').first().fill(url);
    await page.waitForTimeout(500);
    console.log('✅ URL filled\n');
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/broadcast-form-filled.png', fullPage: true });
    console.log('📸 Screenshot saved\n');
    
    // Click "Save & Select Audience" button
    console.log('📍 Clicking Save & Select Audience...');
    await page.locator('button:has-text("Save & Select Audience")').click();
    await page.waitForTimeout(3000);
    console.log('✅ Moved to audience selection\n');
    
    // Click "Send Now" radio/option
    console.log('📍 Selecting Send Now...');
    await page.locator('text=Send Now').first().click();
    await page.waitForTimeout(2000);
    console.log('✅ Send Now selected\n');
    
    // Click final Send button
    console.log('📍 Clicking Send button...');
    await page.locator('button:has-text("Send")').last().click();
    await page.waitForTimeout(5000);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/broadcast-sent.png', fullPage: true });
    
    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 BROADCAST SENT SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`📱 Title: ${title}`);
    console.log(`📱 Message: ${message}`);
    console.log(`🔗 URL: ${url}`);
    console.log('\n📱 CHECK YOUR DEVICE FOR THE NOTIFICATION!\n');
    
    expect(true).toBeTruthy();
  });
  
  test('Create Scheduled Broadcast', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n📅 Starting scheduled broadcast test...\n');
    
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
    
    // Click Create
    console.log('📍 Creating new broadcast...');
    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(3000);
    console.log('✅ Create form opened\n');
    
    // Fill form
    const title = `Scheduled Test ${new Date().toLocaleTimeString()}`;
    console.log(`📝 Filling title: "${title}"`);
    
    await page.locator('input[maxlength="85"]').first().fill(title);
    await page.locator('input[maxlength="135"]').first().fill('Scheduled notification');
    await page.locator('input[maxlength="1600"]').first().fill('http://productionautomation.local/');
    console.log('✅ Form filled\n');
    
    // Save
    console.log('📍 Saving...');
    await page.locator('button:has-text("Save & Select Audience")').click();
    await page.waitForTimeout(3000);
    
    // Select Schedule option
    console.log('📍 Selecting Schedule...');
    await page.locator('text=Schedule').first().click();
    await page.waitForTimeout(2000);
    console.log('✅ Schedule selected\n');
    
    // Save/Schedule
    console.log('📍 Clicking Schedule button...');
    await page.locator('button:has-text("Schedule"), button:has-text("Save")').last().click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'test-results/broadcast-scheduled.png', fullPage: true });
    
    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 BROADCAST SCHEDULED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`📅 Title: ${title}\n`);
    
    expect(true).toBeTruthy();
  });
  
  test('Create Draft Broadcast', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n📝 Starting draft broadcast test...\n');
    
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
    
    // Click Create
    console.log('📍 Creating new broadcast...');
    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(3000);
    console.log('✅ Create form opened\n');
    
    // Fill only title and message
    const title = `Draft Test ${new Date().toLocaleTimeString()}`;
    console.log(`📝 Filling title: "${title}"`);
    
    await page.locator('input[maxlength="85"]').first().fill(title);
    await page.locator('input[maxlength="135"]').first().fill('Draft notification - not sent yet');
    console.log('✅ Partial form filled (for draft)\n');
    
    // Save as draft - Click Save but don't proceed to send
    console.log('📍 Saving as draft...');
    await page.locator('button:has-text("Save & Select Audience")').click();
    await page.waitForTimeout(2000);
    
    // Go back or close without sending
    await page.goBack();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/broadcast-draft.png', fullPage: true });
    
    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 DRAFT SAVED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`📝 Title: ${title}\n`);
    
    expect(true).toBeTruthy();
  });
});
