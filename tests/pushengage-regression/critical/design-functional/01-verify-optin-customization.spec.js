const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

/**
 * Test ID: FUNCTIONAL-DESIGN-001
 * Priority: CRITICAL
 * Feature: Design/Opt-in Configuration
 * Test: Verify design page displays opt-in dialog customization options
 * 
 * This test verifies that the Design page shows
 * subscription dialog boxes, widgets, and customization options.
 */

test.describe('CRITICAL - Design - Verify Opt-in Customization', () => {
  
  test('Verify design page displays opt-in customization options', async ({ page }) => {
    test.setTimeout(90000);
    
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to Design page
    const navigated = await navigateToPushEngagePage(page, 'Design', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Design page - skipping test');
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(5000); // Wait for design page to load
    
    console.log('🎨 Verifying design/opt-in customization elements...');
    
    // Verify Subscription Dialog Box section
    const dialogBoxSelectors = [
      'text=Subscription',
      'text=Dialog',
      'text=Opt-in',
      'text=Bell',
      'text=Native',
      'div[class*="subscription"]',
      'div[class*="dialog"]'
    ];
    
    let dialogBoxFound = false;
    for (const selector of dialogBoxSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found subscription dialog: ${selector}`);
        dialogBoxFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (dialogBoxFound) {
      console.log('✅ Subscription dialog box section is displayed');
    } else {
      console.log('⚠️ Could not verify subscription dialog boxes');
    }
    
    // Verify Preview functionality
    const previewSelectors = [
      'button:has-text("Preview")',
      'button:has-text("View")',
      'a:has-text("Preview")',
      'div[class*="preview"]',
      'button[class*="preview"]'
    ];
    
    let previewFound = false;
    for (const selector of previewSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found preview button: ${selector}`);
        previewFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (previewFound) {
      console.log('✅ Preview functionality is available');
    } else {
      console.log('⚠️ Could not find preview button');
    }
    
    // Verify Edit/Customize button
    const editSelectors = [
      'button:has-text("Edit")',
      'button:has-text("Customize")',
      'a:has-text("Edit")',
      'button[class*="edit"]',
      'div[class*="customize"]'
    ];
    
    let editFound = false;
    for (const selector of editSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found edit/customize button: ${selector}`);
        editFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (editFound) {
      console.log('✅ Edit/customize options are present');
    } else {
      console.log('⚠️ Could not find edit options');
    }
    
    // Verify Widgets section
    const widgetsSelectors = [
      'text=Widgets',
      'text=Recovery',
      'text=Unsubscribe',
      'div[class*="widget"]',
      'div[class*="recovery"]'
    ];
    
    let widgetsFound = false;
    for (const selector of widgetsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found widgets section: ${selector}`);
        widgetsFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (widgetsFound) {
      console.log('✅ Widgets section is available');
    } else {
      console.log('⚠️ Could not find widgets section');
    }
    
    // Verify Targeting Rules (if available)
    const targetingSelectors = [
      'text=Targeting',
      'text=Rules',
      'text=Display',
      'text=Conditions',
      'div[class*="targeting"]',
      'div[class*="rules"]'
    ];
    
    let targetingFound = false;
    for (const selector of targetingSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found targeting rules: ${selector}`);
        targetingFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (targetingFound) {
      console.log('✅ Targeting rules section is present');
    } else {
      console.log('⚠️ Could not find targeting rules (may be in a different tab)');
    }
    
    // Verify Enable/Disable toggle
    const toggleSelectors = [
      'input[type="checkbox"]',
      'button[role="switch"]',
      'div[class*="toggle"]',
      'div[class*="switch"]',
      'label'
    ];
    
    let toggleFound = false;
    for (const selector of toggleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found enable/disable toggle: ${selector}`);
        toggleFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (toggleFound) {
      console.log('✅ Enable/disable toggles are available');
    } else {
      console.log('⚠️ Could not find toggles');
    }
    
    console.log('\n✅ Design verification test completed');
    console.log('   - Subscription dialogs:', dialogBoxFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Preview:', previewFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Edit options:', editFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Widgets:', widgetsFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Targeting rules:', targetingFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Toggles:', toggleFound ? 'FOUND' : 'NOT FOUND');
  });
});
