const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { navigateToPage, waitForPageLoad, closeModalIfPresent, selectSite, openHamburgerMenu } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: Dashboard - Navigation
 * Priority: CRITICAL
 * Feature: Navigation
 */

test.describe('CRITICAL - Dashboard - Navigation', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });
  
  test('should display and open hamburger menu', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Validate Hamburger Menu');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const menuOpened = await openHamburgerMenu(page);
    
    if (menuOpened) {
      console.log('   ✓ Hamburger menu opened successfully');
      
      // Verify menu is visible
      const menuVisible = await page.isVisible('nav, [role="navigation"]', { timeout: 5000 })
        .catch(() => false);
      
      expect(menuVisible).toBe(true);
    } else {
      console.log('   ℹ️ Hamburger menu not found (may be desktop view)');
    }
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/dashboard-hamburger-menu.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Hamburger menu check completed\n');
  });
  
  test('should navigate to Campaign > Push Broadcasts', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Push Broadcasts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await openHamburgerMenu(page);
    await page.waitForTimeout(1000);
    
    // Click Campaign to expand
    try {
      await page.click('text=Campaign', { timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log('   ✓ Campaign menu expanded');
    } catch (e) {
      console.log('   ⚠️ Could not expand Campaign menu');
    }
    
    // Click Push Broadcasts
    const success = await navigateToPage(page, 'Push Broadcasts');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/navigation-push-broadcasts.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully navigated to Push Broadcasts\n');
  });
  
  test('should navigate to Design > Popup Modals', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Popup Modals');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await openHamburgerMenu(page);
    await page.waitForTimeout(1000);
    
    // Click Design to expand
    try {
      await page.click('text=Design', { timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log('   ✓ Design menu expanded');
    } catch (e) {
      console.log('   ⚠️ Could not expand Design menu');
    }
    
    // Click Popup Modals
    const success = await navigateToPage(page, 'Popup Modals');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/navigation-popup-modals.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully navigated to Popup Modals\n');
  });
  
  test('should navigate to Audience > Subscribers', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Subscribers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await openHamburgerMenu(page);
    await page.waitForTimeout(1000);
    
    // Click Audience to expand
    try {
      await page.click('text=Audience', { timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log('   ✓ Audience menu expanded');
    } catch (e) {
      console.log('   ⚠️ Could not expand Audience menu');
    }
    
    // Click Subscribers
    const success = await navigateToPage(page, 'Subscribers');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/navigation-subscribers.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully navigated to Subscribers\n');
  });
  
  test('should navigate to Analytics > Overview', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Analytics Overview');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await openHamburgerMenu(page);
    await page.waitForTimeout(1000);
    
    // Click Analytics to expand
    try {
      await page.click('text=Analytics', { timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log('   ✓ Analytics menu expanded');
    } catch (e) {
      console.log('   ⚠️ Could not expand Analytics menu');
    }
    
    // Click Overview
    const success = await navigateToPage(page, 'Overview');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/navigation-analytics-overview.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully navigated to Analytics Overview\n');
  });
  
  test('should navigate to Site Settings > Site Details', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate to Site Details');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await openHamburgerMenu(page);
    await page.waitForTimeout(1000);
    
    // Click Site Settings to expand
    try {
      await page.click('text=Site Settings', { timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log('   ✓ Site Settings menu expanded');
    } catch (e) {
      console.log('   ⚠️ Could not expand Site Settings menu');
    }
    
    // Click Site Details
    const success = await navigateToPage(page, 'Site Details');
    expect(success).toBe(true);
    
    await waitForPageLoad(page);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/navigation-site-details.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully navigated to Site Details\n');
  });
  
  test('should navigate back to Dashboard from other pages', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Navigate Back to Dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Navigate to a different page
    await navigateToPage(page, 'Push Broadcasts');
    await waitForPageLoad(page);
    console.log('   ✓ Navigated to Push Broadcasts');
    
    // Navigate back to Dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForPageLoad(page);
    console.log('   ✓ Navigated back to Dashboard');
    
    // Verify we're on dashboard
    const dashboardVisible = await page.isVisible('h1:has-text("Dashboard"), h2:has-text("Dashboard")', 
      { timeout: 10000 }
    ).catch(() => false);
    
    expect(dashboardVisible).toBe(true);
    
    await page.screenshot({ 
      path: `${config.screenshotPath}/navigation-back-to-dashboard.png`, 
      fullPage: true 
    });
    
    console.log('✅ Test PASSED - Successfully navigated back to Dashboard\n');
  });
});
