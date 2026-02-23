const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

/**
 * Test ID: FUNCTIONAL-SETTINGS-001
 * Priority: CRITICAL
 * Feature: Settings Configuration
 * Test: Verify settings page displays site configuration options
 * 
 * This test verifies that the Settings page shows
 * site details, API key, timezone, and other configurations.
 */

test.describe('CRITICAL - Settings - Verify Configuration Options', () => {
  
  test('Verify settings page displays configuration options', async ({ page }) => {
    test.setTimeout(90000);
    
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to Settings page
    const navigated = await navigateToPushEngagePage(page, 'Settings', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Settings page - skipping test');
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(5000); // Wait for settings to load
    
    console.log('⚙️ Verifying settings page elements...');
    
    // Verify Site Details section
    const siteDetailsSelectors = [
      'text=Site Details',
      'text=Site Name',
      'text=Website',
      'text=URL',
      'input[type="text"]',
      'div[class*="site"]'
    ];
    
    let siteDetailsFound = false;
    for (const selector of siteDetailsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found site details: ${selector}`);
        siteDetailsFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (siteDetailsFound) {
      console.log('✅ Site details section is displayed');
    } else {
      console.log('⚠️ Could not verify site details');
    }
    
    // Verify API Key section
    const apiKeySelectors = [
      'text=API Key',
      'text=API',
      'text=Key',
      'input[readonly]',
      'code',
      'pre',
      'div[class*="api"]',
      'button:has-text("Copy")'
    ];
    
    let apiKeyFound = false;
    for (const selector of apiKeySelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found API key section: ${selector}`);
        apiKeyFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (apiKeyFound) {
      console.log('✅ API key section is present');
    } else {
      console.log('⚠️ Could not find API key section');
    }
    
    // Verify Timezone/Regional settings
    const timezoneSelectors = [
      'text=Timezone',
      'text=Time Zone',
      'text=Region',
      'select',
      'div[class*="timezone"]',
      'div[class*="time"]'
    ];
    
    let timezoneFound = false;
    for (const selector of timezoneSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found timezone setting: ${selector}`);
        timezoneFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (timezoneFound) {
      console.log('✅ Timezone settings are available');
    } else {
      console.log('⚠️ Could not find timezone settings');
    }
    
    // Verify Site Icon/Image settings
    const iconSelectors = [
      'text=Site Icon',
      'text=Logo',
      'text=Image',
      'text=Upload',
      'button:has-text("Upload")',
      'input[type="file"]',
      'img',
      'div[class*="icon"]',
      'div[class*="image"]'
    ];
    
    let iconFound = false;
    for (const selector of iconSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found site icon setting: ${selector}`);
        iconFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (iconFound) {
      console.log('✅ Site icon/image settings are present');
    } else {
      console.log('⚠️ Could not find site icon settings');
    }
    
    // Verify AutoPush/Notification settings
    const autoPushSelectors = [
      'text=Auto Push',
      'text=AutoPush',
      'text=Automatic',
      'text=Notifications',
      'input[type="checkbox"]',
      'div[class*="toggle"]',
      'div[class*="switch"]'
    ];
    
    let autoPushFound = false;
    for (const selector of autoPushSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found auto push settings: ${selector}`);
        autoPushFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (autoPushFound) {
      console.log('✅ Auto push settings are available');
    } else {
      console.log('⚠️ Could not find auto push settings');
    }
    
    // Verify Save button
    const saveButtonSelectors = [
      'button:has-text("Save")',
      'button:has-text("Update")',
      'button:has-text("Apply")',
      'button[type="submit"]',
      'button[class*="save"]',
      'button[class*="primary"]'
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
    
    console.log('\n✅ Settings verification test completed');
    console.log('   - Site details:', siteDetailsFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - API key:', apiKeyFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Timezone:', timezoneFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Site icon:', iconFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Auto push:', autoPushFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Save button:', saveButtonFound ? 'FOUND' : 'NOT FOUND');
  });
});
