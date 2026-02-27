const { chromium } = require('@playwright/test');
const { getStorageStatePath } = require('./utils/app-auth');
const config = require('./utils/config');

/**
 * This script helps capture and save the authenticated session
 * from your already logged-in browser.
 * 
 * Usage:
 * 1. Make sure you're logged in to app.pushengage.com in your browser
 * 2. Run: node tests/pushengage-app/save-session.js
 * 3. The script will open a browser and wait for you to login
 * 4. After login, close the browser window
 * 5. The session will be saved and can be reused by tests
 */

(async () => {
  console.log('🔐 PushEngage App Dashboard - Session Capture\n');
  console.log('This script will help you save an authenticated session');
  console.log('that can be reused by all tests to bypass the login captcha.\n');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('📍 Step 1: Opening PushEngage App Dashboard...\n');
  await page.goto(config.appUrl);
  
  console.log('📍 Step 2: Please login manually in the opened browser');
  console.log('   - Enter your email: ' + config.appUsername);
  console.log('   - Enter your password');
  console.log('   - Complete the captcha');
  console.log('   - Wait until you see the dashboard\n');
  
  console.log('📍 Step 3: Once logged in and on the dashboard, press ENTER here...');
  
  // Wait for user input
  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });
  
  // Check if logged in
  const currentUrl = page.url();
  if (currentUrl.includes('app.pushengage.com') && !currentUrl.includes('login')) {
    console.log('\n✅ Login detected! Saving session...');
    
    // Save the storage state
    const statePath = getStorageStatePath();
    await context.storageState({ path: statePath });
    
    console.log(`✅ Session saved to: ${statePath}\n`);
    console.log('🎉 Success! You can now run tests without manually logging in.');
    console.log('   The tests will use this saved session.\n');
    console.log('Run your tests with:');
    console.log('   npm run test:app:dashboard\n');
  } else {
    console.log('\n⚠️ You don\'t appear to be logged in yet.');
    console.log('   Please run this script again and make sure to login completely.\n');
  }
  
  await browser.close();
})();
