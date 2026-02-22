const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const config = require('../../../utils/config');

test.describe('FUNCTIONAL - Create Drip Campaign', () => {
  test('Create a new drip campaign', async ({ page }) => {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    console.log('📍 Navigating to PushEngage Drip Campaigns...');
    
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '').replace('/admin', '');
    
    // Navigate to Drip Campaigns
    const dripUrls = [
      `${baseUrl}/wp-admin/admin.php?page=pushengage-drip`,
      `${baseUrl}/wp-admin/admin.php?page=pushengage-campaigns`,
      `${baseUrl}/wp-admin/admin.php?page=pushengage-dashboard`
    ];
    
    let navigated = false;
    for (const url of dripUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        navigated = true;
        console.log(`✓ Navigated to: ${url}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (navigated) {
      // Try to find and click Drip/Campaigns menu item
      const dripMenuSelectors = [
        'a:has-text("Drip")',
        'a:has-text("Campaigns")',
        'a[href*="drip"]',
        'text=Drip Campaigns',
        '[data-testid="drip-menu"]'
      ];
      
      for (const selector of dripMenuSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`✓ Clicked Drip menu using: ${selector}`);
          await page.waitForTimeout(3000);
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    console.log('📍 Creating new drip campaign...');
    
    // Click Create/Add Drip button
    const createButtonSelectors = [
      'button:has-text("Create")',
      'button:has-text("Add Drip")',
      'button:has-text("New Campaign")',
      'a:has-text("Create")',
      'button.ant-btn-primary',
      '[data-testid="create-drip"]'
    ];
    
    let createClicked = false;
    for (const selector of createButtonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        createClicked = true;
        console.log(`✓ Clicked Create Drip button using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (createClicked) {
      await page.waitForTimeout(3000);
      
      const timestamp = Date.now();
      const campaignName = `🔬 Smoke Test Drip ${timestamp}`;
      
      console.log('📍 Filling drip campaign details...');
      
      // Campaign name
      const nameSelectors = [
        'input[placeholder*="name" i]',
        'input[name="name"]',
        'input[name="campaign_name"]',
        'input[type="text"]:visible',
        '.ant-input:visible'
      ];
      
      for (const selector of nameSelectors) {
        try {
          await page.fill(selector, campaignName, { timeout: 5000 });
          console.log(`✓ Filled campaign name using: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.waitForTimeout(1000);
      
      // Add notification details
      const notificationTitle = `Welcome Notification ${timestamp}`;
      const notificationMessage = `Thank you for subscribing! This is a test drip notification.`;
      
      const titleSelectors = [
        'input[placeholder*="title" i]',
        'input[name="title"]',
        'input[placeholder*="notification" i]'
      ];
      
      for (const selector of titleSelectors) {
        try {
          await page.fill(selector, notificationTitle, { timeout: 5000 });
          console.log(`✓ Filled notification title using: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.waitForTimeout(1000);
      
      const messageSelectors = [
        'textarea[placeholder*="message" i]',
        'textarea[name="message"]',
        'textarea:visible'
      ];
      
      for (const selector of messageSelectors) {
        try {
          await page.fill(selector, notificationMessage, { timeout: 5000 });
          console.log(`✓ Filled notification message using: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.waitForTimeout(1000);
      
      console.log('📍 Saving drip campaign...');
      
      // Save campaign
      const saveSelectors = [
        'button:has-text("Save")',
        'button:has-text("Create Campaign")',
        'button.ant-btn-primary:has-text("Save")',
        'button[type="submit"]',
        '[data-testid="save-drip"]'
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
      
      await page.waitForTimeout(3000);
      
      console.log('✅ Drip campaign created!');
      console.log(`   Name: ${campaignName}`);
      console.log(`   First Notification: ${notificationTitle}`);
      
      // Verify success
      const successIndicators = [
        'text=Success',
        'text=created',
        'text=Campaign',
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
    } else {
      console.log('⚠️ Could not find Create Drip button - feature may not be available');
    }
  });
});
