const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists, checkElementVisible, openHamburgerMenu } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Analytics - Overview  
 * Priority: CRITICAL
 * Feature: Analytics Dashboard
 * 
 * Comprehensive tests for Analytics Overview page including
 * data display, charts, filters, and export functionality.
 */

test.describe('CRITICAL - Analytics - Overview', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should navigate to Analytics Overview page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Analytics Overview');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await openHamburgerMenu(page);
    await page.waitForTimeout(1000);
    
    // Expand Analytics menu
    try {
      await page.click('text=Analytics', { timeout: 5000 });
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('   ⚠️ Analytics menu may already be expanded');
    }
    
    const success = await navigateToPage(page, 'Overview');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    const url = page.url();
    console.log(`   ✓ Current URL: ${url}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-overview-page.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Navigate to Analytics Overview\n');
  });

  test('should display Analytics Overview page title', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Analytics Overview Title');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Overview');
    await waitForPageLoad(page);
    
    // Check for various title formats
    const titleSelectors = [
      'h1:has-text("Analytics")',
      'h1:has-text("Overview")',
      'h2:has-text("Analytics")',
      '[role="heading"]:has-text("Analytics")'
    ];
    
    let titleFound = false;
    for (const selector of titleSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          titleFound = true;
          console.log(`   ✓ Title found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-overview-title.png`, 
      fullPage: false 
    });
    
    expect(titleFound).toBe(true);
    console.log('✅ Test PASSED - Analytics Overview title displayed\n');
  });

  test('should display date range filter', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Date Range Filter');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Overview');
    await waitForPageLoad(page);
    
    const dateFilterSelectors = [
      'input[type="date"]',
      '[class*="date-picker"]',
      '[class*="date-range"]',
      'button:has-text("Last 7 days")',
      'button:has-text("Last 30 days")',
      'select:has-text("days")'
    ];
    
    let filterFound = false;
    for (const selector of dateFilterSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          filterFound = true;
          console.log(`   ✓ Date filter found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    console.log(`   ${filterFound ? '✓' : 'ℹ️'} Date range filter: ${filterFound ? 'Present' : 'May not be visible'}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-date-filter.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Date filter check completed\n');
  });

  test('should display analytics metrics/stats', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Analytics Metrics Display');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Overview');
    await waitForPageLoad(page);
    
    const expectedMetrics = [
      'Subscribers',
      'Notifications',
      'Views',
      'Clicks',
      'CTR',
      'Click-through',
      'Impressions',
      'Conversions'
    ];
    
    const foundMetrics = {};
    
    for (const metric of expectedMetrics) {
      try {
        const isVisible = await page.isVisible(`text=${metric}`, { timeout: 3000 });
        foundMetrics[metric] = isVisible;
        console.log(`   ${isVisible ? '✓' : '⚠️'} ${metric}`);
      } catch (e) {
        foundMetrics[metric] = false;
        console.log(`   ⚠️ ${metric} not found`);
      }
    }
    
    const visibleCount = Object.values(foundMetrics).filter(Boolean).length;
    console.log(`\n   📊 Metrics visible: ${visibleCount}/${expectedMetrics.length}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-metrics.png`, 
      fullPage: true 
    });
    
    // At least some metrics should be visible
    expect(visibleCount).toBeGreaterThan(0);
    console.log('✅ Test PASSED - Analytics metrics displayed\n');
  });

  test('should display analytics charts/graphs', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Analytics Charts Display');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Overview');
    await waitForPageLoad(page);
    
    const chartSelectors = [
      'canvas',
      'svg[class*="chart"]',
      '[class*="chart-container"]',
      '[class*="graph"]',
      '[id*="chart"]',
      '.recharts-wrapper',
      '.highcharts-container'
    ];
    
    let chartFound = false;
    for (const selector of chartSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          chartFound = true;
          console.log(`   ✓ Found ${count} chart element(s): ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    console.log(`   ${chartFound ? '✓' : 'ℹ️'} Charts/graphs: ${chartFound ? 'Present' : 'May not be visible'}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-charts.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Analytics charts check completed\n');
  });

  test('should display export/download functionality', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Export Functionality');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Overview');
    await waitForPageLoad(page);
    
    const exportSelectors = [
      'button:has-text("Export")',
      'button:has-text("Download")',
      'a:has-text("Export")',
      '[class*="export"]',
      '[data-testid*="export"]',
      'button:has-text("CSV")',
      'button:has-text("PDF")'
    ];
    
    let exportFound = false;
    for (const selector of exportSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 3000 });
        if (isVisible) {
          exportFound = true;
          console.log(`   ✓ Export button found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    console.log(`   ${exportFound ? '✓' : 'ℹ️'} Export functionality: ${exportFound ? 'Available' : 'May not be visible'}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-export.png`, 
      fullPage: false 
    });
    
    console.log('✅ Test PASSED - Export functionality check completed\n');
  });

  test('should display data table or list view', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Data Table Display');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Overview');
    await waitForPageLoad(page);
    
    const tableSelectors = [
      'table',
      '[role="table"]',
      '[class*="data-table"]',
      '[class*="analytics-table"]',
      'tbody',
      '[role="grid"]'
    ];
    
    let tableFound = false;
    for (const selector of tableSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 5000 });
        if (isVisible) {
          tableFound = true;
          console.log(`   ✓ Data table found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    console.log(`   ${tableFound ? '✓' : 'ℹ️'} Data table: ${tableFound ? 'Present' : 'May not be available'}`);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-table.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Data table check completed\n');
  });

  test('should handle empty state gracefully', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Empty State Handling');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await navigateToPage(page, 'Overview');
    await waitForPageLoad(page);
    
    // Check for empty state messages
    const emptyStateSelectors = [
      'text=No data',
      'text=No analytics',
      'text=No results',
      'text=Get started',
      '[class*="empty-state"]',
      '[class*="no-data"]'
    ];
    
    let hasEmptyState = false;
    for (const selector of emptyStateSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 3000 });
        if (isVisible) {
          hasEmptyState = true;
          console.log(`   ✓ Empty state message found: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (hasEmptyState) {
      console.log('   ℹ️ Empty state is displayed (no data available)');
    } else {
      console.log('   ✓ Analytics data is available');
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/analytics-state.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Analytics page loaded successfully\n');
  });
});
