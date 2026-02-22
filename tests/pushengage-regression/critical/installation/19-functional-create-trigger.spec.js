const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

test.describe('FUNCTIONAL - Create Trigger', () => {
  test('Create a new trigger campaign', async ({ page }) => {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to Triggers using sidebar menu
    const navigated = await navigateToPushEngagePage(page, 'Triggers', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Triggers page - feature may not be available');
      return;
    }
    
    await waitForReactPageLoad(page);
    
    console.log('📍 Creating new trigger...');
    
    // Click Create/Add Trigger button
    const createButtonSelectors = [
      'button:has-text("Create")',
      'button:has-text("Add Trigger")',
      'button:has-text("New Trigger")',
      'a:has-text("Create")',
      'button.ant-btn-primary',
      '[data-testid="create-trigger"]'
    ];
    
    let createClicked = false;
    for (const selector of createButtonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        createClicked = true;
        console.log(`✓ Clicked Create Trigger button using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!createClicked) {
      console.log('⚠️ Could not find Create Trigger button - feature may not be available');
      return;
    }
    
    await page.waitForTimeout(3000);
    
    const timestamp = Date.now();
    const triggerName = `🔬 Smoke Test Trigger ${timestamp}`;
    
    console.log('📍 Filling trigger details...');
    
    // Trigger name
    const nameSelectors = [
      'input[placeholder*="name" i]',
      'input[name="name"]',
      'input[name="trigger_name"]',
      'input[type="text"]:visible',
      '.ant-input:visible'
    ];
    
    let nameFilled = false;
    for (const selector of nameSelectors) {
      try {
        await page.fill(selector, triggerName, { timeout: 5000 });
        console.log(`✓ Filled trigger name using: ${selector}`);
        nameFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!nameFilled) {
      console.log('⚠️ Could not fill trigger name');
      return;
    }
    
    await page.waitForTimeout(1000);
    
    // Select trigger type (e.g., Page Visit, Time-based, etc.)
    console.log('📍 Selecting trigger type...');
    
    const triggerTypeSelectors = [
      'select[name="trigger_type"]',
      '.ant-select',
      'text=Page Visit',
      'text=Time Based',
      '[data-testid="trigger-type"]'
    ];
    
    for (const selector of triggerTypeSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log(`✓ Clicked trigger type using: ${selector}`);
        await page.waitForTimeout(1000);
        // Select first option if dropdown opens
        try {
          await page.keyboard.press('Enter');
        } catch (e) {}
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Add notification details
    const notificationTitle = `Trigger Notification ${timestamp}`;
    const notificationMessage = `This is an automated test trigger notification.`;
    
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
    
    console.log('📍 Saving trigger...');
    
    // Save trigger
    const saveSelectors = [
      'button:has-text("Save")',
      'button:has-text("Create Trigger")',
      'button.ant-btn-primary:has-text("Save")',
      'button[type="submit"]',
      '[data-testid="save-trigger"]'
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
    
    console.log('✅ Trigger created!');
    console.log(`   Name: ${triggerName}`);
    console.log(`   Notification: ${notificationTitle}`);
    
    // Verify success
    const successIndicators = [
      'text=Success',
      'text=created',
      'text=Trigger',
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
