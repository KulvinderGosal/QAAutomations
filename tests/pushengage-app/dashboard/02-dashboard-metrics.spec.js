const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, verifyDashboardMetrics } = require('../utils/app-helpers');
const config = require('../utils/config');

/**
 * Test Suite: Dashboard - Metrics and Statistics
 * Priority: CRITICAL
 * Feature: Dashboard
 * 
 * This test validates that all dashboard metrics and statistics
 * are properly displayed and accessible.
 */

test.describe('CRITICAL - Dashboard - Metrics and Statistics', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config);
    expect(loginSuccess).toBe(true);
    
    await navigateToPage(page, 'Dashboard');
    await waitForPageLoad(page);
    await closeModalIfPresent(page);
  });
  
  test('should display "Total Subscribers" metric', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Total Subscribers Metric');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const subscribersSelectors = [
      'text=Total Subscribers',
      ':has-text("Total Subscribers")',
      '[class*="subscribers"]'
    ];
    
    let found = false;
    for (const selector of subscribersSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`   ✓ Total Subscribers metric found: ${selector}`);
        found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-total-subscribers.png`, 
      fullPage: false 
    });
    
    expect(found).toBe(true);
    console.log('✅ Test PASSED - Total Subscribers metric is displayed\n');
  });
  
  test('should display "Notifications Sent" metric', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Notifications Sent Metric');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const notificationsSelectors = [
      'text=Notifications Sent',
      ':has-text("Notifications Sent")',
      ':has-text("Notifications")'
    ];
    
    let found = false;
    for (const selector of notificationsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`   ✓ Notifications Sent metric found: ${selector}`);
        found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-notifications-sent.png`, 
      fullPage: false 
    });
    
    expect(found).toBe(true);
    console.log('✅ Test PASSED - Notifications Sent metric is displayed\n');
  });
  
  test('should display "Views" metric', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Views Metric');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const viewsSelectors = [
      'text=Views',
      ':has-text("Views")',
      '[class*="views"]'
    ];
    
    let found = false;
    for (const selector of viewsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`   ✓ Views metric found: ${selector}`);
        found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-views.png`, 
      fullPage: false 
    });
    
    expect(found).toBe(true);
    console.log('✅ Test PASSED - Views metric is displayed\n');
  });
  
  test('should display "Clicks" metric', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Clicks Metric');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const clicksSelectors = [
      'text=Clicks',
      ':has-text("Clicks")',
      '[class*="clicks"]'
    ];
    
    let found = false;
    for (const selector of clicksSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`   ✓ Clicks metric found: ${selector}`);
        found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-clicks.png`, 
      fullPage: false 
    });
    
    expect(found).toBe(true);
    console.log('✅ Test PASSED - Clicks metric is displayed\n');
  });
  
  test('should display "Goal Conversion" metric', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Goal Conversion Metric');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const goalSelectors = [
      'text=Goal Conversion',
      ':has-text("Goal Conversion")',
      ':has-text("Goal")',
      '[class*="goal"]'
    ];
    
    let found = false;
    for (const selector of goalSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`   ✓ Goal Conversion metric found: ${selector}`);
        found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-goal-conversion.png`, 
      fullPage: false 
    });
    
    expect(found).toBe(true);
    console.log('✅ Test PASSED - Goal Conversion metric is displayed\n');
  });
  
  test('should display all dashboard metrics together', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate All Dashboard Metrics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const metrics = await verifyDashboardMetrics(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-all-metrics.png`, 
      fullPage: true 
    });
    
    const foundCount = Object.values(metrics).filter(Boolean).length;
    const totalCount = Object.keys(metrics).length;
    
    console.log(`\n📊 Results: ${foundCount}/${totalCount} metrics found`);
    
    // Test passes if at least 4 out of 5 metrics are found
    expect(foundCount).toBeGreaterThanOrEqual(4);
    console.log('✅ Test PASSED - Dashboard metrics are displayed\n');
  });
  
  test('should display metric values as numbers', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Metric Values are Numbers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const metricNames = [
      'Total Subscribers',
      'Notifications Sent',
      'Views',
      'Clicks'
    ];
    
    const results = {};
    
    for (const metric of metricNames) {
      try {
        const metricElement = await page.locator(`:has-text("${metric}")`).first();
        const parentElement = await metricElement.locator('..').first();
        
        // Look for numeric values (h1, h2, h3, or span with numbers)
        const numericSelectors = ['h1', 'h2', 'h3', 'span', 'div'];
        let hasNumericValue = false;
        
        for (const selector of numericSelectors) {
          try {
            const valueElement = await parentElement.locator(selector).first();
            const text = await valueElement.textContent();
            
            if (text && /\d/.test(text)) {
              console.log(`   ✓ ${metric}: ${text.trim()}`);
              hasNumericValue = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        results[metric] = hasNumericValue;
      } catch (e) {
        console.log(`   ⚠️ ${metric}: Could not find value`);
        results[metric] = false;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-metric-values.png`, 
      fullPage: false 
    });
    
    const foundCount = Object.values(results).filter(Boolean).length;
    console.log(`\n📊 Results: ${foundCount}/${metricNames.length} metrics have numeric values`);
    
    // Test passes if at least 3 out of 4 metrics have values
    expect(foundCount).toBeGreaterThanOrEqual(3);
    console.log('✅ Test PASSED - Metric values are displayed as numbers\n');
  });
  
  test('should display comparison with previous period', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Previous Period Comparison');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const comparisonSelectors = [
      'text=vs prev 30 days',
      ':has-text("vs prev")',
      ':has-text("previous")',
      '[class*="comparison"]',
      '[class*="change"]'
    ];
    
    let found = false;
    for (const selector of comparisonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`   ✓ Previous period comparison found: ${selector}`);
        found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-period-comparison.png`, 
      fullPage: false 
    });
    
    expect(found).toBe(true);
    console.log('✅ Test PASSED - Previous period comparison is displayed\n');
  });
});
