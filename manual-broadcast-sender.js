const { chromium } = require('playwright');

/**
 * Manual PushEngage Broadcast Sender
 * 
 * This script opens a browser and logs you into WordPress.
 * You can then manually navigate and send a broadcast while
 * the script records your actions.
 */

async function sendBroadcast() {
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('🌐 Opening WordPress admin...');
  await page.goto('http://productionautomation.local/wp-admin/', { 
    waitUntil: 'networkidle' 
  });
  
  await page.waitForTimeout(2000);
  
  // Check if we need to login
  const isLoginPage = page.url().includes('wp-login');
  
  if (isLoginPage) {
    console.log('🔐 Logging in...');
    await page.fill('input[name="log"]', 'admin');
    await page.fill('input[name="pwd"]', 'admin@123=');
    await page.click('input[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('✓ Logged in successfully');
  } else {
    console.log('✓ Already logged in');
  }
  
  console.log('\n📍 Navigating to PushEngage...');
  await page.goto('http://productionautomation.local/wp-admin/admin.php?page=pushengage', {
    waitUntil: 'networkidle'
  });
  
  await page.waitForTimeout(2000);
  
  console.log('\n✅ Browser is ready!');
  console.log('');
  console.log('📝 MANUAL STEPS:');
  console.log('   1. Navigate to the Broadcast/Campaign section');
  console.log('   2. Fill in the notification details:');
  console.log('      - Title: "Test Notification"');
  console.log('      - Message: "This is a test from automation"');
  console.log('   3. Click Send/Submit');
  console.log('');
  console.log('🔍 While you do this, right-click and Inspect each field to find:');
  console.log('   - Input field selectors (id, class, name)');
  console.log('   - Button selectors');
  console.log('');
  console.log('⏸️  Browser will stay open until you close it manually.');
  console.log('');
  
  // Keep the browser open
  await page.waitForTimeout(300000); // 5 minutes
  
  await browser.close();
}

sendBroadcast().catch(console.error);
