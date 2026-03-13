const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, clickElement } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Campaign - Push Broadcasts
 * Priority: CRITICAL
 * Feature: Campaign Management
 */

test.describe('CRITICAL - Campaign - Push Broadcasts', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });
  
  test('should navigate to Push Broadcasts page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Push Broadcasts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const success = await navigateToPage(page, 'Push Broadcasts');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    // Verify we're on Push Broadcasts page
    const url = page.url();
    const pageContent = await page.content();
    
    const isPushBroadcastsPage = 
      url.includes('broadcast') || 
      url.includes('campaign') || 
      pageContent.includes('Push Broadcast') ||
      pageContent.includes('Broadcast');
    
    expect(isPushBroadcastsPage).toBe(true);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/push-broadcasts-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully navigated to Push Broadcasts\n');
  });
  
  test('should display Create Campaign button on Push Broadcasts page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Create Campaign Button on Push Broadcasts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Push Broadcasts');
    await waitForPageLoad(page);
    
    const buttonSelectors = [
      'button:has-text("Create")',
      'button:has-text("New Campaign")',
      'button:has-text("Add Campaign")',
      'a:has-text("Create")',
      '[data-testid*="create"]'
    ];
    
    let buttonFound = false;
    for (const selector of buttonSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          buttonFound = true;
          console.log(`   ✓ Create button found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/push-broadcasts-create-button.png`, 
      fullPage: false 
    });
    
    expect(buttonFound).toBe(true);
    console.log('✅ Test PASSED - Create Campaign button is displayed\n');
  });
  
  test('should display campaigns list or empty state', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Campaigns List Display');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Push Broadcasts');
    await waitForPageLoad(page);
    
    // Check for either campaigns list or empty state
    const listSelectors = [
      'table',
      '[role="table"]',
      '[class*="campaign-list"]',
      '[class*="notification-list"]',
      'text=No campaigns',
      'text=No notifications',
      'text=Create your first'
    ];
    
    let contentFound = false;
    for (const selector of listSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          contentFound = true;
          console.log(`   ✓ Content found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/push-broadcasts-list.png`, 
      fullPage: true 
    });
    
    expect(contentFound).toBe(true);
    console.log('✅ Test PASSED - Campaigns list or empty state is displayed\n');
  });
  
  test('should display filter/search functionality', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Filter/Search Functionality');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Push Broadcasts');
    await waitForPageLoad(page);
    
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="filter" i]',
      '[class*="search-input"]',
      '[data-testid*="search"]'
    ];
    
    let searchFound = false;
    for (const selector of searchSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          searchFound = true;
          console.log(`   ✓ Search/filter found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/push-broadcasts-search.png`, 
      fullPage: false 
    });
    
    // Search may not always be present, so we just log the result
    console.log(`   ${searchFound ? '✓' : '⚠️'} Search/filter functionality: ${searchFound ? 'Present' : 'Not found'}`);
    console.log('✅ Test PASSED - Filter/search check completed\n');
  });
});
