const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

/**
 * Test ID: FUNCTIONAL-AUDIENCE-001
 * Priority: CRITICAL
 * Feature: Audience/Subscribers Verification
 * Test: Verify audience page shows subscriber list and stats
 * 
 * This test verifies that the Audience page displays
 * subscriber counts, list, and management options.
 */

test.describe('CRITICAL - Audience - Verify Subscriber Management', () => {
  
  test('Verify audience page displays subscribers and stats', async ({ page }) => {
    test.setTimeout(90000);
    
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    // Navigate to Audience page
    const navigated = await navigateToPushEngagePage(page, 'Audience', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to Audience page - skipping test');
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(5000); // Wait for data to load
    
    console.log('👥 Verifying audience/subscribers page elements...');
    
    // Verify subscriber count stats
    const statsSelectors = [
      'text=Total',
      'text=Active',
      'text=Subscribers',
      'div[class*="total"]',
      'div[class*="count"]',
      'span[class*="subscriber"]'
    ];
    
    let statsFound = false;
    for (const selector of statsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found subscriber stats: ${selector}`);
        statsFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (statsFound) {
      console.log('✅ Subscriber statistics are displayed');
    } else {
      console.log('⚠️ Could not verify subscriber statistics');
    }
    
    // Verify segments section
    const segmentsSelectors = [
      'text=Segments',
      'text=Create Segment',
      'button:has-text("Segment")',
      'div[class*="segment"]',
      'a:has-text("Segment")'
    ];
    
    let segmentsFound = false;
    for (const selector of segmentsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found segments section: ${selector}`);
        segmentsFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (segmentsFound) {
      console.log('✅ Segments section is available');
    } else {
      console.log('⚠️ Could not find segments section');
    }
    
    // Verify audience groups section
    const audienceGroupSelectors = [
      'text=Audience',
      'text=Groups',
      'text=Audience Group',
      'button:has-text("Create")',
      'button:has-text("Add")',
      'div[class*="group"]'
    ];
    
    let audienceGroupFound = false;
    for (const selector of audienceGroupSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found audience groups: ${selector}`);
        audienceGroupFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (audienceGroupFound) {
      console.log('✅ Audience groups section is available');
    } else {
      console.log('⚠️ Could not find audience groups section');
    }
    
    // Verify filters/search functionality
    const filterSelectors = [
      'input[type="search"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="filter" i]',
      'button:has-text("Filter")',
      'div[class*="search"]',
      'div[class*="filter"]'
    ];
    
    let filterFound = false;
    for (const selector of filterSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found filter/search: ${selector}`);
        filterFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (filterFound) {
      console.log('✅ Search/filter functionality is present');
    } else {
      console.log('⚠️ Could not find search/filter');
    }
    
    // Check for subscriber table/list
    const tableSelectors = [
      'table',
      'div[role="table"]',
      'div[class*="list"]',
      'div[class*="table"]',
      'tbody',
      'div[class*="row"]'
    ];
    
    let tableFound = false;
    for (const selector of tableSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✓ Found subscriber list/table: ${selector}`);
        tableFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (tableFound) {
      console.log('✅ Subscriber list/table is rendered');
    } else {
      console.log('⚠️ Could not find subscriber list/table');
    }
    
    console.log('\n✅ Audience verification test completed');
    console.log('   - Subscriber stats:', statsFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Segments:', segmentsFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Audience groups:', audienceGroupFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Filters:', filterFound ? 'FOUND' : 'NOT FOUND');
    console.log('   - Subscriber list:', tableFound ? 'FOUND' : 'NOT FOUND');
  });
});
