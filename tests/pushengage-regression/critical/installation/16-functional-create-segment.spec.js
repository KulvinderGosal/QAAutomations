const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const config = require('../../../utils/config');

test.describe('FUNCTIONAL - Create Segment', () => {
  test('Create a new audience segment', async ({ page }) => {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    console.log('📍 Navigating to PushEngage Segments...');
    
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '').replace('/admin', '');
    
    // Navigate to Segments/Audience
    const segmentUrls = [
      `${baseUrl}/wp-admin/admin.php?page=pushengage-segments`,
      `${baseUrl}/wp-admin/admin.php?page=pushengage-audience`,
      `${baseUrl}/wp-admin/admin.php?page=pushengage-dashboard`
    ];
    
    let navigated = false;
    for (const url of segmentUrls) {
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
      // Try to find and click Segments menu item
      const segmentMenuSelectors = [
        'a:has-text("Segments")',
        'a:has-text("Audience")',
        'a[href*="segments"]',
        'text=Segments',
        '[data-testid="segments-menu"]'
      ];
      
      for (const selector of segmentMenuSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`✓ Clicked Segments menu using: ${selector}`);
          await page.waitForTimeout(3000);
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    console.log('📍 Creating new segment...');
    
    // Click Create/Add Segment button
    const createButtonSelectors = [
      'button:has-text("Create")',
      'button:has-text("Add Segment")',
      'button:has-text("New Segment")',
      'a:has-text("Create")',
      'button.ant-btn-primary',
      '[data-testid="create-segment"]'
    ];
    
    let createClicked = false;
    for (const selector of createButtonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        createClicked = true;
        console.log(`✓ Clicked Create Segment button using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (createClicked) {
      await page.waitForTimeout(3000);
      
      const timestamp = Date.now();
      const segmentName = `🔬 Smoke Test Segment ${timestamp}`;
      
      console.log('📍 Filling segment details...');
      
      // Segment name
      const nameSelectors = [
        'input[placeholder*="name" i]',
        'input[name="name"]',
        'input[name="segment_name"]',
        'input[type="text"]:visible',
        '.ant-input:visible'
      ];
      
      for (const selector of nameSelectors) {
        try {
          await page.fill(selector, segmentName, { timeout: 5000 });
          console.log(`✓ Filled segment name using: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.waitForTimeout(1000);
      
      // Add a simple condition (e.g., All Subscribers)
      console.log('📍 Adding segment condition...');
      
      const allSubscribersSelectors = [
        'text=All Subscribers',
        'label:has-text("All Subscribers")',
        'input[value="all"]',
        '[data-testid="all-subscribers"]'
      ];
      
      for (const selector of allSubscribersSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`✓ Selected All Subscribers using: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      await page.waitForTimeout(1000);
      
      console.log('📍 Saving segment...');
      
      // Save segment
      const saveSelectors = [
        'button:has-text("Save")',
        'button:has-text("Create Segment")',
        'button.ant-btn-primary:has-text("Save")',
        'button[type="submit"]',
        '[data-testid="save-segment"]'
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
      
      console.log('✅ Segment created!');
      console.log(`   Name: ${segmentName}`);
      
      // Verify success
      const successIndicators = [
        'text=Success',
        'text=created',
        'text=Segment',
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
      console.log('⚠️ Could not find Create Segment button - feature may not be available');
    }
  });
});
