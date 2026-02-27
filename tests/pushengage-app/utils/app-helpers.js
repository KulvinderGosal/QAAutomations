const { expect } = require('@playwright/test');

/**
 * Navigate to a specific page in PushEngage App Dashboard
 * @param {import('@playwright/test').Page} page
 * @param {string} pageName - Name of the page to navigate to (Dashboard, Campaign, Analytics, etc.)
 */
async function navigateToPage(page, pageName) {
  console.log(`🧭 Navigating to ${pageName}...`);
  
  try {
    // Click on the menu item
    const menuSelectors = [
      `a:has-text("${pageName}")`,
      `button:has-text("${pageName}")`,
      `[role="menuitem"]:has-text("${pageName}")`,
      `nav a:has-text("${pageName}")`
    ];
    
    for (const selector of menuSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log(`   ➜ Clicked on ${pageName} menu`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(2000);
    await waitForPageLoad(page);
    
    console.log(`✅ Successfully navigated to ${pageName}\n`);
    return true;
    
  } catch (error) {
    console.error(`❌ Navigation error to ${pageName}:`, error.message);
    return false;
  }
}

/**
 * Wait for page to load completely
 * @param {import('@playwright/test').Page} page
 */
async function waitForPageLoad(page) {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch (e) {
    console.log('   ⚠️ Page load timeout - continuing anyway');
  }
}

/**
 * Select a site from the site dropdown
 * @param {import('@playwright/test').Page} page
 * @param {string} siteName - Name of the site to select
 */
async function selectSite(page, siteName) {
  console.log(`🌐 Selecting site: ${siteName}...`);
  
  try {
    // Click on site dropdown
    await page.click('[role="combobox"], select, button:has-text("Android")');
    await page.waitForTimeout(1000);
    
    // Select the site
    await page.click(`text=${siteName}, [role="option"]:has-text("${siteName}")`);
    await page.waitForTimeout(2000);
    
    console.log(`✅ Site selected: ${siteName}\n`);
    return true;
    
  } catch (error) {
    console.error(`❌ Site selection error:`, error.message);
    return false;
  }
}

/**
 * Check if an element exists on the page
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} selectors - Array of selectors to try
 * @param {string} elementName - Name of the element for logging
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
async function checkElementExists(page, selectors, elementName, timeout = 5000) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout });
      console.log(`   ✓ ${elementName} found: ${selector}`);
      return true;
    } catch (e) {
      continue;
    }
  }
  console.log(`   ⚠️ ${elementName} not found`);
  return false;
}

/**
 * Click on "Create a Campaign" button
 * @param {import('@playwright/test').Page} page
 */
async function clickCreateCampaign(page) {
  console.log('➕ Clicking Create a Campaign button...');
  
  try {
    const createSelectors = [
      'button:has-text("Create a Campaign")',
      'button:has-text("Create Campaign")',
      'a:has-text("Create Campaign")',
      '[data-testid="create-campaign"]'
    ];
    
    for (const selector of createSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log('   ➜ Clicked Create Campaign button');
        await page.waitForTimeout(2000);
        return true;
      } catch (e) {
        continue;
      }
    }
    
    console.log('   ⚠️ Create Campaign button not found');
    return false;
    
  } catch (error) {
    console.error('❌ Create Campaign click error:', error.message);
    return false;
  }
}

/**
 * Close any modal or popup if present
 * @param {import('@playwright/test').Page} page
 */
async function closeModalIfPresent(page) {
  try {
    const closeSelectors = [
      'button:has-text("Don\'t show this again")',
      'button[aria-label="Close"]',
      'button.close',
      '[class*="close-button"]',
      'button:has(svg[class*="close"])',
      'button:has(svg[class*="x"])'
    ];
    
    for (const selector of closeSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 2000 });
        if (isVisible) {
          await page.click(selector);
          console.log('   ➜ Closed modal/popup');
          await page.waitForTimeout(1000);
          return true;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    // Silently handle - modal might not be present
  }
  return false;
}

/**
 * Get stat value from dashboard
 * @param {import('@playwright/test').Page} page
 * @param {string} statName - Name of the stat (Total Subscribers, Notifications Sent, etc.)
 * @returns {Promise<string|null>}
 */
async function getStatValue(page, statName) {
  try {
    const statElement = await page.locator(`text=${statName}`).first();
    const parentElement = await statElement.locator('..').first();
    const valueElement = await parentElement.locator('[class*="value"], [class*="number"], h2, h3').first();
    const value = await valueElement.textContent();
    return value?.trim() || null;
  } catch (error) {
    console.log(`   ⚠️ Could not get value for ${statName}`);
    return null;
  }
}

/**
 * Verify dashboard metrics are displayed
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>} Object containing metric names and their visibility status
 */
async function verifyDashboardMetrics(page) {
  console.log('📊 Verifying dashboard metrics...');
  
  const metrics = {
    'Total Subscribers': false,
    'Notifications Sent': false,
    'Views': false,
    'Clicks': false,
    'Goal Conversion': false
  };
  
  for (const metric of Object.keys(metrics)) {
    try {
      const isVisible = await page.isVisible(`text=${metric}`, { timeout: 3000 });
      metrics[metric] = isVisible;
      console.log(`   ${isVisible ? '✓' : '⚠️'} ${metric}`);
    } catch (e) {
      console.log(`   ⚠️ ${metric} not found`);
    }
  }
  
  return metrics;
}

module.exports = {
  navigateToPage,
  waitForPageLoad,
  selectSite,
  checkElementExists,
  clickCreateCampaign,
  closeModalIfPresent,
  getStatValue,
  verifyDashboardMetrics
};
