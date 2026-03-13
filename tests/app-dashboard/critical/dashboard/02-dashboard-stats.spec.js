const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, verifyDashboardMetrics } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Dashboard - Stats Display
 * Priority: CRITICAL
 * Feature: Dashboard
 * 
 * This test validates that dashboard statistics are displayed correctly.
 */

test.describe('CRITICAL - Dashboard - Stats Display', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await navigateToPage(page, 'Dashboard');
    await waitForPageLoad(page);
    await closeModalIfPresent(page);
  });
  
  test('should display Total Subscribers stat', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Total Subscribers Stat');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const statVisible = await page.isVisible('text=Total Subscribers', { timeout: 10000 });
    expect(statVisible).toBe(true);
    
    console.log('   ✓ Total Subscribers stat is visible');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-total-subscribers-stat.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Total Subscribers stat is displayed\n');
  });
  
  test('should display Notifications Sent stat', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Notifications Sent Stat');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const statVisible = await page.isVisible('text=Notifications Sent', { timeout: 10000 });
    expect(statVisible).toBe(true);
    
    console.log('   ✓ Notifications Sent stat is visible');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-notifications-sent-stat.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Notifications Sent stat is displayed\n');
  });
  
  test('should display Views stat', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Views Stat');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const statVisible = await page.isVisible('text=Views', { timeout: 10000 });
    expect(statVisible).toBe(true);
    
    console.log('   ✓ Views stat is visible');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-views-stat.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Views stat is displayed\n');
  });
  
  test('should display Clicks stat', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Clicks Stat');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const statVisible = await page.isVisible('text=Clicks', { timeout: 10000 });
    expect(statVisible).toBe(true);
    
    console.log('   ✓ Clicks stat is visible');
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-clicks-stat.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Clicks stat is displayed\n');
  });
  
  test('should display all dashboard metrics', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate All Dashboard Metrics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const metrics = await verifyDashboardMetrics(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-all-metrics.png`, 
      fullPage: true 
    });
    
    // Count visible metrics
    const visibleCount = Object.values(metrics).filter(Boolean).length;
    console.log(`\n📊 ${visibleCount}/${Object.keys(metrics).length} metrics are visible`);
    
    // At least 5 metrics should be visible
    expect(visibleCount).toBeGreaterThanOrEqual(5);
    console.log('✅ Test PASSED - Dashboard metrics are displayed\n');
  });
  
  test('should display recent notifications section', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Recent Notifications Section');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const sectionSelectors = [
      'h2:has-text("Recent Notifications")',
      'h3:has-text("Recent Notifications")',
      '[role="heading"]:has-text("Recent Notifications")'
    ];
    
    let sectionFound = false;
    for (const selector of sectionSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          sectionFound = true;
          console.log(`   ✓ Recent Notifications section found`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-recent-notifications.png`, 
      fullPage: true 
    });
    
    expect(sectionFound).toBe(true);
    console.log('✅ Test PASSED - Recent Notifications section is displayed\n');
  });
  
  test('should display demographic overview section', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Demographic Overview Section');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const sectionSelectors = [
      'h2:has-text("Demographic Overview")',
      'h3:has-text("Demographic Overview")',
      '[role="heading"]:has-text("Demographic Overview")'
    ];
    
    let sectionFound = false;
    for (const selector of sectionSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          sectionFound = true;
          console.log(`   ✓ Demographic Overview section found`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-demographic-overview.png`, 
      fullPage: true 
    });
    
    expect(sectionFound).toBe(true);
    console.log('✅ Test PASSED - Demographic Overview section is displayed\n');
  });
});
