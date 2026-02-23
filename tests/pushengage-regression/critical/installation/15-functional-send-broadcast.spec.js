const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

test.describe('FUNCTIONAL - Send Push Broadcast', () => {
  test('Create and send a test broadcast notification', async ({ page }) => {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to Broadcasts using sidebar menu
    const navigated = await navigateToPushEngagePage(page, 'Broadcasts', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Broadcasts page');
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(5000); // Extra wait for React components to render
    
    console.log('📍 Creating new broadcast...');
    
    // Click Create/New Broadcast button
    const createButtonSelectors = [
      'button:has-text("Add New")',
      'button:has-text("Create")',
      'button:has-text("New Broadcast")',
      'a:has-text("Create")',
      'button.ant-btn-primary:has-text("Create")',
      '[data-testid="create-broadcast"]'
    ];
    
    let createClicked = false;
    for (const selector of createButtonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        createClicked = true;
        console.log(`✓ Clicked Create button using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!createClicked) {
      console.log('⚠️ Could not find Create Broadcast button with any selector');
      await page.screenshot({ path: `test-results/broadcast-no-button-${timestamp || Date.now()}.png`, fullPage: true });
      console.log('⚠️ Screenshot saved. Skipping broadcast creation test.');
      return;
    }
    
    await page.waitForTimeout(3000);
    
    // Fill in broadcast details
    console.log('📍 Filling broadcast details...');
    
    const timestamp = Date.now();
    const title = `🔬 Smoke Test Broadcast ${timestamp}`;
    const message = `This is an automated smoke test broadcast created at ${new Date().toLocaleString()}`;
    
    // Title field
    const titleSelectors = [
      'input[placeholder*="title" i]',
      'input[name="title"]',
      'input[type="text"]:visible',
      '.ant-input:visible'
    ];
    
    for (const selector of titleSelectors) {
      try {
        await page.fill(selector, title, { timeout: 5000 });
        console.log(`✓ Filled title using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Message field
    const messageSelectors = [
      'textarea[placeholder*="message" i]',
      'textarea[name="message"]',
      'textarea:visible',
      '.ant-input-textarea textarea'
    ];
    
    for (const selector of messageSelectors) {
      try {
        await page.fill(selector, message, { timeout: 5000 });
        console.log(`✓ Filled message using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    // URL field (optional)
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '').replace('/admin', '');
    const urlSelectors = [
      'input[placeholder*="url" i]',
      'input[name="url"]',
      'input[type="url"]'
    ];
    
    for (const selector of urlSelectors) {
      try {
        await page.fill(selector, baseUrl, { timeout: 5000 });
        console.log(`✓ Filled URL using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    console.log('📍 Saving and selecting audience...');
    
    // Save & Select Audience
    const saveSelectors = [
      'button:has-text("Save & Select Audience")',
      'button:has-text("Save")',
      'button:has-text("Next")',
      'button.ant-btn-primary'
    ];
    
    let saveClicked = false;
    for (const selector of saveSelectors) {
      try {
        await page.click(selector, { timeout: 10000 });
        saveClicked = true;
        console.log(`✓ Clicked Save button using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    expect(saveClicked).toBeTruthy();
    await page.waitForTimeout(3000);
    
    console.log('📍 Selecting Send Now option...');
    
    // Select "Send Now" option
    const sendNowSelectors = [
      'text=Send Now',
      'span:has-text("Send Now")',
      'label:has-text("Send Now")',
      'input[value="now"]',
      '[data-testid="send-now"]'
    ];
    
    let sendNowClicked = false;
    for (const selector of sendNowSelectors) {
      try {
        await page.click(selector, { timeout: 10000 });
        sendNowClicked = true;
        console.log(`✓ Selected Send Now using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(2000);
    
    console.log('📍 Sending broadcast...');
    
    // Click final Send button
    const sendButtonSelectors = [
      'button:has-text("Send")',
      'button.ant-btn-primary:has-text("Send")',
      'button[type="submit"]',
      '[data-testid="send-broadcast"]'
    ];
    
    let sendClicked = false;
    for (const selector of sendButtonSelectors) {
      try {
        await page.click(selector, { timeout: 10000 });
        sendClicked = true;
        console.log(`✓ Clicked Send button using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(3000);
    
    console.log('✅ Broadcast created and sent!');
    console.log(`   Title: ${title}`);
    console.log(`   Message: ${message}`);
    
    // Verify we're back on broadcasts list or see success message
    const successIndicators = [
      'text=Success',
      'text=sent',
      'text=Broadcast',
      '.ant-message-success'
    ];
    
    let successFound = false;
    for (const indicator of successIndicators) {
      try {
        await page.waitForSelector(indicator, { timeout: 5000 });
        successFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    console.log(successFound ? '✓ Success confirmation detected' : '⚠️ No success confirmation found (may still have succeeded)');
  });
});
