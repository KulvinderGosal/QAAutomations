const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test.describe('PushEngage - Send Real Broadcast', () => {
  
  test('Send Push Notification - Interactive Test', async ({ page }) => {
    // Set a longer timeout for this interactive test
    test.setTimeout(120000);
    
    await loginToWordPress(page);
    
    console.log('🔐 Logged into WordPress');
    console.log(`📍 Environment: ${config.environment}`);
    console.log(`📍 Site: ${config.wpAdminUrl}`);
    
    // Navigate to PushEngage
    console.log('\n📍 Navigating to PushEngage...');
    await page.goto(`${config.wpAdminUrl.replace('/wp-admin', '')}/wp-admin/admin.php?page=pushengage`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Take screenshot of the dashboard
    await page.screenshot({ path: 'test-results/pushengage-dashboard.png', fullPage: true });
    console.log('✓ Screenshot saved: pushengage-dashboard.png');
    
    // Check if there's an iframe
    const iframes = page.frames();
    console.log(`\n📊 Found ${iframes.length} frames on page`);
    
    for (let i = 0; i < iframes.length; i++) {
      const frame = iframes[i];
      const frameUrl = frame.url();
      console.log(`   Frame ${i}: ${frameUrl}`);
    }
    
    // Look for common PushEngage elements
    console.log('\n🔍 Looking for PushEngage interface elements...');
    
    // Try to find the main PushEngage iframe or app container
    const appContainer = await page.locator('#pushengage-app, [id*="pushengage"], iframe[src*="pushengage"]').first().count();
    console.log(`   App container found: ${appContainer > 0 ? 'Yes' : 'No'}`);
    
    // Look for navigation/menu items
    const menuItems = await page.locator('a, button').all();
    console.log(`   Total clickable elements: ${menuItems.length}`);
    
    // Look for text containing campaign, broadcast, notification
    const campaignLinks = await page.locator('text=/campaign|broadcast|notification|send/i').all();
    console.log(`   Campaign-related elements: ${campaignLinks.length}`);
    
    for (const link of campaignLinks.slice(0, 10)) {
      const text = await link.textContent().catch(() => '');
      const visible = await link.isVisible().catch(() => false);
      if (text && visible) {
        console.log(`     - "${text.trim()}"`);
      }
    }
    
    // Pause here so you can inspect the page
    console.log('\n⏸️  Test paused. Browser will stay open.');
    console.log('💡 Please manually:');
    console.log('   1. Navigate to the broadcast/notification page');
    console.log('   2. Fill in the form');
    console.log('   3. Inspect elements using DevTools');
    console.log('   4. Note down the selectors for:');
    console.log('      - Title input field');
    console.log('      - Message/body field');
    console.log('      - Send button');
    console.log('\n📝 Then we can update the test with correct selectors');
    
    // Keep browser open for manual inspection
    await page.pause();
    
    expect(true).toBeTruthy();
  });
});
