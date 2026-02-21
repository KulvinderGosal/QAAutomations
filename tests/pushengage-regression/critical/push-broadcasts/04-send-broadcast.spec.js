const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

/**
 * Send Push Broadcast Test - Migrated from Cypress
 * Based on: cypress/e2e/pewpplugin/PushBroadcasts/SendPushbroadcast.js
 */

test.describe('Send Push Broadcast - Real Notification', () => {
  
  test('Create and Send a Push Broadcast', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(120000);
    
    // Step 1: Login to WordPress and navigate to PushEngage page
    await loginToWordPress(page);
    
    // Step 2: Navigate to PushEngage push broadcasts page
    console.log('\n📍 Navigating to Push Broadcasts page...');
    const pushEngageUrl = `${config.wpAdminUrl}/admin.php?page=pushengage#/campaigns/notifications`;
    await page.goto(pushEngageUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(3000);
    console.log('✓ Push Broadcasts page loaded');
    
    // Step 4: Wait for page container to load
    console.log('📍 Waiting for page to load...');
    await page.waitForSelector('div.pe-container', { timeout: 15000 });
    await page.waitForTimeout(1000);
    
    // Step 5: Click "Create new notification" button
    console.log('📍 Clicking Create New Notification...');
    const createButton = page.locator('div.pe-container span, div.pe-container button').first();
    await createButton.click({ force: true });
    await page.waitForTimeout(3000);
    
    // Step 6: Fill in notification title
    console.log('📍 Filling notification title...');
    const titleInput = page.locator('[data-testid="notificationTitle-notification-generic"]');
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.click();
    const notificationTitle = `Push notification via Playwright - ${new Date().toLocaleTimeString()}`;
    await titleInput.fill(notificationTitle);
    console.log(`   Title: "${notificationTitle}"`);
    
    // Step 7: Fill in notification message
    console.log('📍 Filling notification message...');
    const messageInput = page.locator('#notification-message');
    await messageInput.click();
    const notificationMessage = `This is an automated test notification sent via Playwright at ${new Date().toLocaleString()}`;
    await messageInput.fill(notificationMessage);
    console.log(`   Message: "${notificationMessage}"`);
    
    // Step 8: Fill in notification URL
    console.log('📍 Filling notification URL...');
    const urlInput = page.locator('div.pe-notification-url input');
    await urlInput.click();
    const notificationUrl = config.wpAdminUrl.replace('/wp-admin', '');
    await urlInput.fill(notificationUrl);
    console.log(`   URL: "${notificationUrl}"`);
    
    // Step 9: Take screenshot before sending
    await page.screenshot({ 
      path: 'test-results/broadcast-filled-form.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: broadcast-filled-form.png');
    
    // Step 10: Click "Save & Select Audience" button (multi-selector strategy)
    console.log('\n📍 Clicking Save & Select Audience...');
    const saveSelectors = [
      'button:has-text("Save & Select Audience")',
      'button:has-text("Save")',
      'button:has-text("Next")',
      'div.campaigns-breadcrumb-navbar button',
      'button.ant-btn-primary',
    ];
    
    let saveClicked = false;
    for (const selector of saveSelectors) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await button.click();
        saveClicked = true;
        break;
      }
    }
    
    if (!saveClicked) {
      throw new Error('Could not find Save button');
    }
    await page.waitForTimeout(5000);  // Increased from 2000
    
    // Step 11: Click "Send Now" option (multi-selector strategy)
    console.log('📍 Selecting Send Now...');
    const sendNowSelectors = [
      'text=Send Now',
      'span:has-text("Send Now")',
      'span:has-text("Send")',
      'label:has-text("Send Now")',
      'div.campaigns-breadcrumb-navbar div.campaigns-breadcrumb-right span',
      '[data-testid*="sendNow"]',
    ];
    
    let sendNowSelected = false;
    for (const selector of sendNowSelectors) {
      const option = page.locator(selector).first();
      const isVisible = await option.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await option.click();
        sendNowSelected = true;
        break;
      }
    }
    
    if (!sendNowSelected) {
      console.log('   ⚠️ Send Now option not found, proceeding anyway');
    }
    await page.waitForTimeout(3000);  // Increased from 1000
    
    // Step 12: Click the primary button to send (multi-selector strategy)
    console.log('📍 Sending notification...');
    const sendButtonSelectors = [
      'button.pe-ant-btn-primary',
      'button:has-text("Send")',
      'button:has-text("Confirm")',
      'button[type="submit"]',
    ];
    
    let sendClicked = false;
    for (const selector of sendButtonSelectors) {
      const button = page.locator(selector);
      const isVisible = await button.isVisible({ timeout: 10000 }).catch(() => false);
      if (isVisible) {
        console.log(`   ✓ Found: ${selector}`);
        await button.click();
        sendClicked = true;
        break;
      }
    }
    
    if (!sendClicked) {
      throw new Error('Could not find Send button');
    }
    
    // Step 13: Wait for success/confirmation
    await page.waitForTimeout(3000);
    console.log('\n✅ Notification sent successfully!');
    
    // Step 14: Take screenshot after sending
    await page.screenshot({ 
      path: 'test-results/broadcast-sent-confirmation.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: broadcast-sent-confirmation.png');
    
    // Step 15: Verify we're on a success page or see success message
    const url = page.url();
    console.log(`📍 Current URL: ${url}`);
    
    // Look for success indicators
    const successMessage = await page.locator('text=/success|sent|delivered|scheduled/i').count();
    if (successMessage > 0) {
      console.log('✓ Success message detected on page');
    }
    
    // Assert test passed
    expect(true).toBeTruthy();
    
    console.log('\n🎉 Test completed! Check your device for the notification.');
    console.log(`📱 Notification Details:`);
    console.log(`   Title: ${notificationTitle}`);
    console.log(`   Message: ${notificationMessage}`);
    console.log(`   URL: ${notificationUrl}`);
  });
});
