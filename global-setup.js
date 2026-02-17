// global-setup.js
const { chromium } = require('@playwright/test');
const config = require('./tests/utils/config');

module.exports = async () => {
  console.log('🔐 Setting up authentication...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Login to WordPress
  await page.goto('http://productionautomation.local/wp-login.php');
  await page.fill('input[name="log"]', 'admin');
  await page.fill('input[name="pwd"]', 'admin@123=');
  await page.click('input[type="submit"]');
  await page.waitForLoadState('networkidle');
  
  // Save authentication state
  await page.context().storageState({ path: 'auth.json' });
  
  await browser.close();
  console.log('✅ Authentication saved!');
};
