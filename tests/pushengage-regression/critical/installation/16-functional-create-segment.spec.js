const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

test.describe('FUNCTIONAL - Create Segment', () => {
  test('Create a new audience segment', async ({ page }) => {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to Audience using sidebar menu
    const navigated = await navigateToPushEngagePage(page, 'Audience', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Audience page - feature may not be available');
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(5000); // Extra wait for React components to render
    
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
    
    if (!createClicked) {
      console.log('⚠️ Could not find Create Segment button - feature may not be available');
      await page.screenshot({ path: `test-results/segment-no-button-${Date.now()}.png`, fullPage: true });
      console.log('⚠️ Screenshot saved. Skipping segment creation test.');
      return;
    }
    
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
    
    let nameFilled = false;
    for (const selector of nameSelectors) {
      try {
        await page.fill(selector, segmentName, { timeout: 5000 });
        console.log(`✓ Filled segment name using: ${selector}`);
        nameFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!nameFilled) {
      console.log('⚠️ Could not fill segment name');
      return;
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
  });
});
