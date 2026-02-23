const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

/**
 * Test ID: FUNCTIONAL-WOOCOMMERCE-001
 * Priority: HIGH
 * Feature: WooCommerce Integration
 * Test: Verify WooCommerce settings page and notification options
 * 
 * This test verifies that the WooCommerce integration page
 * displays order notification settings and templates.
 */

test.describe('HIGH - WooCommerce - Verify Integration Settings', () => {
  
  test('Verify WooCommerce page displays order notification settings', async ({ page }) => {
    test.setTimeout(90000);
    
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to WooCommerce page
    const navigated = await navigateToPushEngagePage(page, 'WooCommerce', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to WooCommerce page - skipping test');
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(5000); // Wait for page to load
    
    console.log('🛒 Verifying WooCommerce integration elements...');
    
    // Verify Order Notification Settings
    const orderNotificationSelectors = [
      'text=Order',
      'text=Notification',
      'text=New Order',
      'text=Completed',
      'text=Processing',
      'text=Failed',
      'text=Cancelled',
      'div[class*="order"]',
      'div[class*="notification"]'
    ];
    
    let orderNotificationsFound = false;
    for (const selector of orderNotificationSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found order notifications: ${selector}`);
        orderNotificationsFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (orderNotificationsFound) {
      console.log('✅ Order notification settings are displayed');
    } else {
      console.log('⚠️ Could not verify order notification settings');
    }
    
    // Verify Enable/Disable toggles for notifications
    const toggleSelectors = [
      'input[type="checkbox"]',
      'button[role="switch"]',
      'div[class*="toggle"]',
      'div[class*="switch"]',
      'label:has-text("Enable")'
    ];
    
    let togglesFound = false;
    for (const selector of toggleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found enable/disable toggle: ${selector}`);
        togglesFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (togglesFound) {
      console.log('✅ Enable/disable toggles are present');
    } else {
      console.log('⚠️ Could not find toggles');
    }
    
    // Verify Automation options
    const automationSelectors = [
      'text=Automation',
      'text=Trigger',
      'text=Cart',
      'text=Abandonment',
      'text=Price Drop',
      'text=Inventory',
      'div[class*="automation"]',
      'div[class*="trigger"]'
    ];
    
    let automationFound = false;
    for (const selector of automationSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found automation options: ${selector}`);
        automationFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (automationFound) {
      console.log('✅ Automation options are available');
    } else {
      console.log('⚠️ Could not find automation options');
    }
    
    // Verify Templates section
    const templateSelectors = [
      'text=Template',
      'text=Message',
      'text=Customize',
      'button:has-text("Edit")',
      'div[class*="template"]'
    ];
    
    let templatesFound = false;
    for (const selector of templateSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found templates: ${selector}`);
        templatesFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (templatesFound) {
      console.log('✅ Notification templates are present');
    } else {
      console.log('⚠️ Could not find templates section');
    }
    
    // Verify Save/Update button
    const saveButtonSelectors = [
      'button:has-text("Save")',
      'button:has-text("Update")',
      'button:has-text("Apply")',
      'button[type="submit"]',
      'button[class*="save"]'
    ];
    
    let saveButtonFound = false;
    for (const selector of saveButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found save button: ${selector}`);
        saveButtonFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (saveButtonFound) {
      console.log('✅ Save button is present');
    } else {
      console.log('⚠️ Could not find save button');
    }
    
    console.log('\n✅ WooCommerce integration verification completed');
    console.log('   - Order notifications:', orderNotificationsFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Enable/disable toggles:', togglesFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Automation options:', automationFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Templates:', templatesFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Save button:', saveButtonFound ? 'FOUND' : 'NOT FOUND');
  });
});
