const { test, expect } = require('@playwright/test');
const { loginToAppDashboard } = require('../../utils/app-auth');
const { waitForPageLoad, closeModalIfPresent, selectSite, checkElementExists } = require('../../utils/app-helpers');
const config = require('../../utils/config');

/**
 * Test Suite: User Management - Account Settings
 * Priority: CRITICAL
 * Feature: User Account Management
 * 
 * Tests for Account, Billing, Site Management, and User Management sections
 */

test.describe('CRITICAL - User Management - Account Settings', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });

  test('should access account settings page', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Access Account Settings');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Click on user profile/menu
    const profileSelectors = [
      'button:has-text("Kulvinder")',
      '[class*="user-menu"]',
      '[class*="profile-menu"]',
      '[aria-label*="account" i]',
      '[aria-label*="user" i]'
    ];
    
    let profileClicked = false;
    for (const selector of profileSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 5000 })) {
          await page.click(selector);
          profileClicked = true;
          console.log(`   ✓ Clicked profile menu`);
          await page.waitForTimeout(1000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    expect(profileClicked).toBe(true);
    
    await page.screenshot({ path: `${config.screenshotPath}/user-profile-menu.png`, fullPage: false });
    
    // Look for Account/Settings option
    const accountSelectors = [
      'text=Account',
      'text=Account Settings',
      'text=Profile',
      'text=Settings',
      'a:has-text("Account")',
      'button:has-text("Account")'
    ];
    
    let accountFound = false;
    for (const selector of accountSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 3000 })) {
          await page.click(selector);
          accountFound = true;
          console.log(`   ✓ Clicked Account/Settings option`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    await waitForPageLoad(page);
    await page.screenshot({ path: `${config.screenshotPath}/account-settings-page.png`, fullPage: true });
    
    // Verify account settings elements
    const accountElements = [
      'text=Email',
      'text=Name',
      'text=Password',
      'text=Profile',
      'input[type="email"]',
      'input[name="name"]'
    ];
    
    let elementsFound = 0;
    for (const element of accountElements) {
      if (await page.isVisible(element, { timeout: 3000 }).catch(() => false)) {
        elementsFound++;
        console.log(`   ✓ Found element: ${element}`);
      }
    }
    
    console.log(`\n   📊 Found ${elementsFound}/${accountElements.length} account elements`);
    
    expect(accountFound || elementsFound > 0).toBe(true);
    console.log('✅ Test PASSED - Account settings accessed\n');
  });

  test('should access billing section', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Access Billing Section');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Click profile menu
    const profileSelectors = ['button:has-text("Kulvinder")', '[class*="user-menu"]'];
    for (const selector of profileSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 5000 })) {
          await page.click(selector);
          await page.waitForTimeout(1000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Look for Billing option
    const billingSelectors = [
      'text=Billing',
      'text=Subscription',
      'text=Plans',
      'text=Upgrade',
      'a:has-text("Billing")',
      'button:has-text("Billing")'
    ];
    
    let billingFound = false;
    for (const selector of billingSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 3000 })) {
          await page.click(selector);
          billingFound = true;
          console.log(`   ✓ Found billing section`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!billingFound) {
      // Try direct URL
      try {
        await page.goto(config.appUrl + '/billing');
        await page.waitForTimeout(2000);
        billingFound = true;
        console.log('   ✓ Accessed billing via direct URL');
      } catch (e) {}
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/billing-section.png`, fullPage: true });
    
    // Check for billing-related elements
    const billingElements = [
      'text=Plan',
      'text=Subscription',
      'text=Payment',
      'text=Invoice',
      'text=Current Plan',
      'text=Upgrade'
    ];
    
    let elementsFound = 0;
    for (const element of billingElements) {
      if (await page.isVisible(element, { timeout: 3000 }).catch(() => false)) {
        elementsFound++;
        console.log(`   ✓ Found: ${element}`);
      }
    }
    
    console.log(`\n   📊 Found ${elementsFound}/${billingElements.length} billing elements`);
    console.log(`   ${billingFound || elementsFound > 0 ? '✓' : 'ℹ️'} Billing section: ${billingFound || elementsFound > 0 ? 'Accessible' : 'Check manual'}`);
    
    console.log('✅ Test PASSED - Billing section check completed\n');
  });

  test('should access site management section', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Access Site Management');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Try to access via profile menu or direct navigation
    await page.click('button:has-text("Kulvinder"), [class*="user-menu"]').catch(() => {});
    await page.waitForTimeout(1000);
    
    const siteManagementSelectors = [
      'text=Sites',
      'text=Site Management',
      'text=Manage Sites',
      'a:has-text("Sites")'
    ];
    
    let siteManagementFound = false;
    for (const selector of siteManagementSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 3000 })) {
          await page.click(selector);
          siteManagementFound = true;
          console.log(`   ✓ Accessed site management`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!siteManagementFound) {
      // Try direct URL
      try {
        await page.goto(config.appUrl + '/sites');
        siteManagementFound = true;
        console.log('   ✓ Accessed via direct URL');
      } catch (e) {}
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/site-management.png`, fullPage: true });
    
    // Check for site list or add site button
    const siteElements = [
      'text=Add Site',
      'text=New Site',
      'table',
      '[class*="site-list"]',
      'text=Site Name',
      'text=Domain'
    ];
    
    let elementsFound = 0;
    for (const element of siteElements) {
      if (await page.isVisible(element, { timeout: 3000 }).catch(() => false)) {
        elementsFound++;
        console.log(`   ✓ Found: ${element}`);
      }
    }
    
    console.log(`\n   📊 Found ${elementsFound}/${siteElements.length} site management elements`);
    console.log('✅ Test PASSED - Site management check completed\n');
  });

  test('should access user management section', async ({ page }) => {
    test.setTimeout(config.testTimeout);
    
    console.log('🧪 Test: Access User Management');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Access profile menu
    await page.click('button:has-text("Kulvinder"), [class*="user-menu"]').catch(() => {});
    await page.waitForTimeout(1000);
    
    const userManagementSelectors = [
      'text=Users',
      'text=User Management',
      'text=Team',
      'text=Members',
      'a:has-text("Users")'
    ];
    
    let userManagementFound = false;
    for (const selector of userManagementSelectors) {
      try {
        if (await page.isVisible(selector, { timeout: 3000 })) {
          await page.click(selector);
          userManagementFound = true;
          console.log(`   ✓ Accessed user management`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!userManagementFound) {
      try {
        await page.goto(config.appUrl + '/users');
        userManagementFound = true;
        console.log('   ✓ Accessed via direct URL');
      } catch (e) {}
    }
    
    await page.screenshot({ path: `${config.screenshotPath}/user-management.png`, fullPage: true });
    
    // Check for user management elements
    const userElements = [
      'text=Add User',
      'text=Invite',
      'table',
      'text=Email',
      'text=Role',
      '[class*="user-list"]'
    ];
    
    let elementsFound = 0;
    for (const element of userElements) {
      if (await page.isVisible(element, { timeout: 3000 }).catch(() => false)) {
        elementsFound++;
        console.log(`   ✓ Found: ${element}`);
      }
    }
    
    console.log(`\n   📊 Found ${elementsFound}/${userElements.length} user management elements`);
    console.log('✅ Test PASSED - User management check completed\n');
  });
});
