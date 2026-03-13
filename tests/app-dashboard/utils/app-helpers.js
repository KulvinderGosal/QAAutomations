const { expect } = require('@playwright/test');

/**
 * Navigate to a specific page in PushEngage App Dashboard
 * @param {import('@playwright/test').Page} page
 * @param {string} pageName - Name of the page to navigate to
 */
async function navigateToPage(page, pageName) {
  console.log(`🧭 Navigating to ${pageName}...`);
  
  try {
    // Open hamburger menu if needed
    const hamburgerSelectors = [
      'button[aria-label="Menu"]',
      'button[class*="menu-button"]',
      'button[class*="hamburger"]',
      '[class*="sidebar-toggle"]'
    ];
    
    let menuOpened = false;
    for (const selector of hamburgerSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 2000 });
        if (isVisible) {
          await page.click(selector);
          await page.waitForTimeout(1000);
          menuOpened = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Click on the menu item
    const menuSelectors = [
      `a:has-text("${pageName}")`,
      `button:has-text("${pageName}")`,
      `[role="menuitem"]:has-text("${pageName}")`,
      `nav a:has-text("${pageName}")`,
      `[role="link"]:has-text("${pageName}")`
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
    const dropdownSelectors = [
      '[role="combobox"]',
      'select',
      'button:has-text("Android")',
      '[class*="site-select"]',
      '[class*="site-dropdown"]'
    ];
    
    for (const selector of dropdownSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        await page.waitForTimeout(1000);
        break;
      } catch (e) {
        continue;
      }
    }
    
    // Select the site
    const siteSelectors = [
      `text=${siteName}`,
      `[role="option"]:has-text("${siteName}")`,
      `li:has-text("${siteName}")`,
      `a:has-text("${siteName}")`
    ];
    
    for (const selector of siteSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log(`✅ Site selected: ${siteName}\n`);
        await page.waitForTimeout(2000);
        return true;
      } catch (e) {
        continue;
      }
    }
    
    console.log(`⚠️ Could not select site: ${siteName}`);
    return false;
    
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
 * Check if element is visible
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} selectors - Array of selectors to try
 * @param {string} elementName - Name of the element for logging
 * @returns {Promise<boolean>}
 */
async function checkElementVisible(page, selectors, elementName) {
  for (const selector of selectors) {
    try {
      const isVisible = await page.isVisible(selector, { timeout: 3000 });
      if (isVisible) {
        console.log(`   ✓ ${elementName} is visible: ${selector}`);
        return true;
      }
    } catch (e) {
      continue;
    }
  }
  console.log(`   ⚠️ ${elementName} is not visible`);
  return false;
}

/**
 * Click on an element
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} selectors - Array of selectors to try
 * @param {string} elementName - Name of the element for logging
 * @returns {Promise<boolean>}
 */
async function clickElement(page, selectors, elementName) {
  for (const selector of selectors) {
    try {
      await page.click(selector, { timeout: 5000 });
      console.log(`   ✓ Clicked ${elementName}`);
      await page.waitForTimeout(1000);
      return true;
    } catch (e) {
      continue;
    }
  }
  console.log(`   ⚠️ Could not click ${elementName}`);
  return false;
}

/**
 * Close any modal or popup if present
 * @param {import('@playwright/test').Page} page
 */
async function closeModalIfPresent(page) {
  try {
    const closeSelectors = [
      'button:has-text("Don\'t show this again")',
      'button:has-text("Close")',
      'button[aria-label="Close"]',
      'button.close',
      '[class*="close-button"]',
      'button:has(svg[class*="close"])',
      'button:has(svg[class*="x"])',
      '[data-testid="close-modal"]'
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
 * @param {string} statName - Name of the stat
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
 * @returns {Promise<Object>}
 */
async function verifyDashboardMetrics(page) {
  console.log('📊 Verifying dashboard metrics...');
  
  const metrics = {
    'Total Subscribers': false,
    'New Subscribers': false,
    'Unsubscribers': false,
    'Notifications Sent': false,
    'Net Subscribers Sent': false,
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

/**
 * Open hamburger menu
 * @param {import('@playwright/test').Page} page
 */
async function openHamburgerMenu(page) {
  try {
    const hamburgerSelectors = [
      'button[aria-label="Menu"]',
      'button[class*="menu-button"]',
      'button[class*="hamburger"]',
      '[class*="sidebar-toggle"]',
      'button:has(svg[class*="menu"])'
    ];
    
    for (const selector of hamburgerSelectors) {
      try {
        const isVisible = await page.isVisible(selector, { timeout: 2000 });
        if (isVisible) {
          await page.click(selector);
          console.log('   ➜ Hamburger menu opened');
          await page.waitForTimeout(1000);
          return true;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.log('   ⚠️ Could not open hamburger menu');
  }
  return false;
}

/**
 * Verify navigation menu items
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} menuItems - Array of menu items to verify
 * @returns {Promise<Object>}
 */
async function verifyMenuItems(page, menuItems) {
  console.log('📋 Verifying menu items...');
  
  const results = {};
  
  for (const item of menuItems) {
    try {
      const isVisible = await page.isVisible(`text=${item}`, { timeout: 3000 });
      results[item] = isVisible;
      console.log(`   ${isVisible ? '✓' : '⚠️'} ${item}`);
    } catch (e) {
      results[item] = false;
      console.log(`   ⚠️ ${item} not found`);
    }
  }
  
  return results;
}

/**
 * Fill form field
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} selectors - Array of selectors to try
 * @param {string} value - Value to fill
 * @param {string} fieldName - Name of the field for logging
 * @returns {Promise<boolean>}
 */
async function fillFormField(page, selectors, value, fieldName) {
  for (const selector of selectors) {
    try {
      await page.fill(selector, value, { timeout: 5000 });
      console.log(`   ✓ Filled ${fieldName} with: ${value}`);
      return true;
    } catch (e) {
      continue;
    }
  }
  console.log(`   ⚠️ Could not fill ${fieldName}`);
  return false;
}

/**
 * Get text content
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} selectors - Array of selectors to try
 * @returns {Promise<string|null>}
 */
async function getTextContent(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.locator(selector).first();
      const text = await element.textContent();
      return text?.trim() || null;
    } catch (e) {
      continue;
    }
  }
  return null;
}

/**
 * Wait for element to be visible
 * @param {import('@playwright/test').Page} page
 * @param {string} selector - Selector to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Take screenshot with timestamp
 * @param {import('@playwright/test').Page} page
 * @param {string} name - Screenshot name
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshots/${name}-${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`   📸 Screenshot saved: ${filename}`);
  return filename;
}

module.exports = {
  navigateToPage,
  waitForPageLoad,
  selectSite,
  checkElementExists,
  checkElementVisible,
  clickElement,
  closeModalIfPresent,
  getStatValue,
  verifyDashboardMetrics,
  openHamburgerMenu,
  verifyMenuItems,
  fillFormField,
  getTextContent,
  waitForElement,
  takeScreenshot
};
