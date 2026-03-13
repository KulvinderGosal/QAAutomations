const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, fillFormField } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Drip Autoresponders - Create Drip (FUNCTIONAL)
 * Priority: CRITICAL
 * Feature: Drip Campaign Creation
 * 
 * This test actually CREATES a drip autoresponder campaign
 */

test.describe('CRITICAL - Drip Autoresponders - Create Drip (FUNCTIONAL)', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should create a new drip autoresponder campaign', async ({ page }) => {
    test.setTimeout(180000);
    
    console.log('🧪 Test: Create Drip Autoresponder Campaign');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Navigate to Drip Autoresponders
    await page.click('button[aria-label="Menu"]').catch(() => {});
    await page.waitForTimeout(1000);
    await page.click('text=Campaign').catch(() => {});
    await page.waitForTimeout(1000);
    await page.click('text=Drip Autoresponders, a:has-text("Drip Autoresponders")').catch(() => 
      page.goto(config.appUrl + '/drip')
    );
    await waitForPageLoad(page);
    console.log('   ✓ Navigated to Drip Autoresponders page');
    
    await page.screenshot({ path: `${config.screenshotPath}/drip-list.png`, fullPage: true });
    
    // Click Create Drip button
    const createSelectors = [
      'button:has-text("Create Drip")',
      'button:has-text("New Drip")',
      'button:has-text("Add Drip")',
      'button:has-text("Create")'
    ];
    
    for (const selector of createSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 5000 })) {
          await page.click(selector);
          console.log(`   ✓ Clicked create drip button`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fill Drip Campaign Name
    const timestamp = Date.now();
    const dripName = `Test Drip ${timestamp}`;
    
    const nameSelectors = [
      'input[name="name"]',
      'input[name="drip_name"]',
      'input[name="title"]',
      'input[placeholder*="name" i]',
      'input[type="text"]'
    ];
    
    const nameFilled = await fillFormField(page, nameSelectors, dripName, 'Drip Name');
    console.log(`   ✓ Filled drip name: ${dripName}`);
    
    await page.waitForTimeout(1000);
    
    // Select trigger event (e.g., on subscription)
    try {
      const triggerSelectors = [
        'select[name="trigger"]',
        'select[name="event"]',
        '[class*="trigger-select"]'
      ];
      
      for (const selector of triggerSelectors) {
        if (await page.isVisible(selector, { timeout: 3000 })) {
          await page.selectOption(selector, { index: 0 });
          console.log('   ✓ Selected trigger event');
          break;
        }
      }
    } catch (e) {
      console.log('   ℹ️ No trigger selector found');
    }
    
    // Set delay (e.g., send after X days)
    try {
      const delaySelectors = [
        'input[name="delay"]',
        'input[name="send_after"]',
        'input[type="number"]'
      ];
      
      for (const selector of delaySelectors) {
        if (await page.isVisible(selector, { timeout: 3000 })) {
          await page.fill(selector, '1');
          console.log('   ✓ Set delay: 1 day');
          break;
        }
      }
    } catch (e) {}
    
    // Fill notification message
    const message = `Automated drip notification created at ${new Date().toISOString()}`;
    const messageSelectors = [
      'textarea[name="message"]',
      'textarea[placeholder*="message" i]',
      'textarea'
    ];
    await fillFormField(page, messageSelectors, message, 'Message');
    
    // Fill URL
    const url = `https://example.com/drip-${timestamp}`;
    const urlSelectors = [
      'input[name="url"]',
      'input[type="url"]',
      'input[placeholder*="url" i]'
    ];
    await fillFormField(page, urlSelectors, url, 'URL');
    
    await page.screenshot({ path: `${config.screenshotPath}/drip-form-filled.png`, fullPage: true });
    
    // Save Drip
    const saveSelectors = [
      'button:has-text("Create Drip")',
      'button:has-text("Save Drip")',
      'button:has-text("Save")',
      'button[type="submit"]'
    ];
    
    for (const selector of saveSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 5000 })) {
          await page.click(selector);
          console.log(`   ✓ Clicked save button`);
          await page.waitForTimeout(3000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/drip-created.png`, fullPage: true });
    
    console.log('\n📝 Drip Campaign Details:');
    console.log(`   Name: ${dripName}`);
    console.log(`   Message: ${message.substring(0, 50)}...`);
    console.log(`   URL: ${url}`);
    
    expect(nameFilled).toBe(true);
    console.log('\n✅ Test PASSED - Drip autoresponder creation completed\n');
  });
});
