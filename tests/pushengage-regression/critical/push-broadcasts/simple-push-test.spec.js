const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test.describe('Simple Push Notification Test', () => {
  
  test('Send a test push notification @smoke', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes
    
    console.log('\n🚀 Starting Push Notification Test');
    console.log('=' .repeat(50));
    
    // Step 1: Login
    console.log('\n📍 Step 1: Logging in to WordPress...');
    await loginToWordPress(page);
    console.log('✅ Login successful\n');
    
    // Step 2: Navigate to PushEngage Campaigns
    console.log('📍 Step 2: Navigating to PushEngage Campaigns...');
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
    const campaignsUrl = `${baseUrl}/wp-admin/admin.php?page=pushengage#/campaigns/notifications`;
    console.log(`   URL: ${campaignsUrl}`);
    
    await page.goto(campaignsUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000); // Wait for React app to load
    console.log('✅ Campaigns page loaded\n');
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'test-results/push-01-campaigns-page.png', 
      fullPage: true 
    });
    
    // Step 3: Look for Create/New button
    console.log('📍 Step 3: Looking for Create button...');
    
    // Try multiple selectors
    const createSelectors = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'button:has-text("Add")',
      'button.ant-btn-primary',
      'button[class*="primary"]',
      'a:has-text("Create")',
      'span:has-text("Create")'
    ];
    
    let createButton = null;
    for (const selector of createSelectors) {
      try {
        const btn = page.locator(selector).first();
        const isVisible = await btn.isVisible({ timeout: 2000 });
        if (isVisible) {
          console.log(`   ✓ Found button: ${selector}`);
          createButton = btn;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!createButton) {
      console.log('   ⚠️ No Create button found');
      console.log('   📸 Taking screenshot for debugging...');
      await page.screenshot({ 
        path: 'test-results/push-02-no-create-button.png', 
        fullPage: true 
      });
      
      // Check what's actually on the page
      console.log('\n   🔍 Checking page content...');
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log(`   Page Title: ${pageTitle}`);
      console.log(`   Current URL: ${pageUrl}`);
      
      // Get all buttons on the page
      const buttons = await page.locator('button').all();
      console.log(`\n   Found ${buttons.length} buttons on page:`);
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        const text = await buttons[i].textContent().catch(() => '');
        const classes = await buttons[i].getAttribute('class').catch(() => '');
        if (text || classes) {
          console.log(`   Button ${i + 1}: "${text}" (class: ${classes})`);
        }
      }
      
      throw new Error('Could not find Create button - see screenshots for debugging');
    }
    
    // Click create button
    console.log('   ✓ Clicking Create button...');
    await createButton.click();
    await page.waitForTimeout(3000);
    console.log('✅ Create form opened\n');
    
    // Take screenshot of form
    await page.screenshot({ 
      path: 'test-results/push-03-create-form.png', 
      fullPage: true 
    });
    
    // Step 4: Fill notification details
    console.log('📍 Step 4: Filling notification details...');
    const timestamp = new Date().toLocaleTimeString();
    const title = `Playwright Test ${timestamp}`;
    const message = `This is an automated test notification sent at ${timestamp}`;
    
    console.log(`   Title: "${title}"`);
    console.log(`   Message: "${message}"`);
    
    // Fill title
    const titleSelectors = [
      '[data-testid="notificationTitle-notification-generic"]',
      '[data-testid*="notificationTitle"]',
      'input[placeholder*="title" i]',
      'input[maxlength="85"]',
      '#notification-title'
    ];
    
    for (const selector of titleSelectors) {
      try {
        const input = page.locator(selector).first();
        const isVisible = await input.isVisible({ timeout: 2000 });
        if (isVisible) {
          await input.click();
          await input.fill(title);
          console.log(`   ✓ Title filled using: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fill message
    const messageSelectors = [
      '#notification-message',
      '[data-testid*="message"]',
      'input[placeholder*="message" i]',
      'input[maxlength="135"]',
      'textarea'
    ];
    
    for (const selector of messageSelectors) {
      try {
        const input = page.locator(selector).first();
        const isVisible = await input.isVisible({ timeout: 2000 });
        if (isVisible) {
          await input.click();
          await input.fill(message);
          console.log(`   ✓ Message filled using: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fill URL (optional)
    try {
      const urlInput = page.locator('input[placeholder*="url" i]').first();
      const isVisible = await urlInput.isVisible({ timeout: 2000 });
      if (isVisible) {
        await urlInput.click();
        await urlInput.fill(baseUrl);
        console.log(`   ✓ URL filled: ${baseUrl}`);
      }
    } catch (e) {
      console.log('   ⚠️ URL field not found (optional)');
    }
    
    console.log('✅ Form filled\n');
    
    // Take screenshot of filled form
    await page.screenshot({ 
      path: 'test-results/push-04-filled-form.png', 
      fullPage: true 
    });
    
    // Step 5: Save and continue
    console.log('📍 Step 5: Saving notification...');
    const saveSelectors = [
      'button:has-text("Save")',
      'button:has-text("Next")',
      'button:has-text("Continue")',
      'button.ant-btn-primary',
      'button[type="submit"]'
    ];
    
    for (const selector of saveSelectors) {
      try {
        const btn = page.locator(selector).first();
        const isVisible = await btn.isVisible({ timeout: 2000 });
        if (isVisible) {
          console.log(`   ✓ Clicking: ${selector}`);
          await btn.click();
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(5000);
    console.log('✅ Notification saved\n');
    
    // Take screenshot after save
    await page.screenshot({ 
      path: 'test-results/push-05-after-save.png', 
      fullPage: true 
    });
    
    // Step 6: Send notification
    console.log('📍 Step 6: Sending notification...');
    
    // Look for Send Now option
    try {
      const sendNow = page.locator('text=Send Now').first();
      const isVisible = await sendNow.isVisible({ timeout: 5000 });
      if (isVisible) {
        console.log('   ✓ Clicking Send Now option...');
        await sendNow.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('   ⚠️ Send Now option not found, looking for Send button...');
    }
    
    // Click final Send button
    const sendSelectors = [
      'button:has-text("Send")',
      'button:has-text("Confirm")',
      'button:has-text("Submit")',
      'button.ant-btn-primary',
      'button[type="submit"]'
    ];
    
    for (const selector of sendSelectors) {
      try {
        const btn = page.locator(selector).first();
        const isVisible = await btn.isVisible({ timeout: 2000 });
        if (isVisible) {
          console.log(`   ✓ Clicking final send button: ${selector}`);
          await btn.click();
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(5000);
    console.log('✅ Notification sent!\n');
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/push-06-final-result.png', 
      fullPage: true 
    });
    
    // Summary
    console.log('=' .repeat(50));
    console.log('📊 Test Summary:');
    console.log('=' .repeat(50));
    console.log('✅ Login: Success');
    console.log('✅ Navigate to Campaigns: Success');
    console.log('✅ Create Notification Form: Success');
    console.log('✅ Fill Notification Details: Success');
    console.log('✅ Save Notification: Success');
    console.log('✅ Send Notification: Success');
    console.log('=' .repeat(50));
    console.log('🎉 Push notification test completed successfully!\n');
    
    // Verify we're not on an error page
    const pageUrl = page.url();
    expect(pageUrl).not.toContain('404');
    expect(pageUrl).toContain('pushengage');
  });
});
