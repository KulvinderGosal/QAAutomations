/**
 * Shared Playwright helpers for PushEngage WordPress Plugin E2E tests
 * Converted from Cypress helpers for consistency
 */

const SELECTORS = {
  pushEngageMenu: "#toplevel_page_pushengage",
  pushEngageMenuName: "#toplevel_page_pushengage div.wp-menu-name",
  woocommerceMenu: "#toplevel_page_woocommerce",
  woocommerceMenuName: "#toplevel_page_woocommerce div.wp-menu-name",
  pePageContainer: "div.pe-page-container",
  peAntTabsNavWrap: "div.pe-ant-tabs-nav-wrap",
  peAntTabsContentHolder: "div.pe-ant-tabs-content-holder",
  campaignsBreadcrumbRight: "div.campaigns-breadcrumb-navbar > div.campaigns-breadcrumb-right",
  peContainer: "div.pe-container",
};

/**
 * Base login helper
 */
async function loginToWordPress(page, config) {
  console.log('Logging in to WordPress...');
  await page.goto(`${config.wpAdminUrl.replace('/wp-admin', '')}/wp-login.php`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  await page.waitForTimeout(2000);
  
  const currentUrl = page.url();
  if (currentUrl.includes('wp-login.php')) {
    console.log('Filling login credentials...');
    await page.fill('input[name="log"]', config.wpUsername);
    await page.fill('input[name="pwd"]', config.wpPassword);
    await page.click('input[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('✓ Logged in\n');
  } else {
    console.log('✓ Already logged in\n');
  }
}

/**
 * Navigate to WordPress dashboard
 */
async function visitDashboard(page, config) {
  const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
  await page.goto(`${baseUrl}/wp-admin/index.php`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(2000);
  await page.locator(SELECTORS.pushEngageMenu).waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Click PushEngage menu to open
 */
async function openPushEngageMenu(page) {
  const menu = page.locator(SELECTORS.pushEngageMenuName);
  await menu.waitFor({ state: 'visible', timeout: 15000 });
  await menu.click();
  await page.waitForTimeout(1000);
}

/**
 * Click PushEngage submenu by text
 */
async function openPushEngageMenuItem(page, menuText) {
  const menuItem = page.locator(`${SELECTORS.pushEngageMenu} a:has-text("${menuText}")`);
  await menuItem.click();
  await page.waitForTimeout(1500);
}

/**
 * Click PushEngage submenu by index
 */
async function openPushEngageMenuItemByIndex(page, index) {
  const submenu = page.locator(`${SELECTORS.pushEngageMenu} .wp-submenu`);
  const isVisible = await submenu.isVisible().catch(() => false);
  
  if (!isVisible) {
    await page.locator(SELECTORS.pushEngageMenuName).click();
    await page.waitForTimeout(500);
  }
  
  await page.locator(`${SELECTORS.pushEngageMenu} .wp-submenu li:nth-of-type(${index}) > a`).click();
  await page.waitForTimeout(1500);
}

/**
 * Click create notification button
 */
async function clickCreateNotification(page) {
  await page.locator(SELECTORS.peContainer).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  
  const createButton = page.locator('div.pe-container span, div.pe-container button').first();
  await createButton.click();
  await page.waitForTimeout(2000);
}

/**
 * Click tab by index
 */
async function clickTab(page, index) {
  await page.locator(`${SELECTORS.peAntTabsNavWrap} div:nth-of-type(${index})`).click();
  await page.waitForTimeout(500);
}

/**
 * Click save button in settings
 */
async function saveSettings(page) {
  const saveButton = page.locator(`${SELECTORS.peAntTabsContentHolder} button`).first();
  await saveButton.click();
  await page.waitForTimeout(2000);
}

/**
 * Toggle pe-ant-switch
 */
async function toggleSwitch(page, selector, enable = true) {
  const toggle = page.locator(selector);
  const classes = await toggle.getAttribute('class');
  const isChecked = classes.includes('pe-ant-switch-checked');
  
  if ((enable && !isChecked) || (!enable && isChecked)) {
    await toggle.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Navigate to WooCommerce PE Notifications settings
 */
async function goToWooOrderNotifications(page, config) {
  await visitDashboard(page, config);
  await page.locator(SELECTORS.woocommerceMenuName).click();
  await page.waitForTimeout(500);
  await page.locator(`${SELECTORS.woocommerceMenu} li:nth-of-type(6) > a`).click();
  await page.waitForTimeout(1500);
  await page.locator('a[href*="pe_notifications"]').first().click();
  await page.waitForTimeout(1500);
}

/**
 * Toggle WooCommerce notification setting
 */
async function toggleWooNotification(page, settingId, enable = true) {
  const checkbox = page.locator(`#pe_notifications_row_setting\\[${settingId}\\]`);
  const isChecked = await checkbox.isChecked();
  
  if ((enable && !isChecked) || (!enable && isChecked)) {
    await checkbox.check({ force: true });
  }
  
  await page.locator('.woocommerce-save-button').click();
  await page.waitForTimeout(2000);
}

/**
 * Assert page loaded by checking container
 */
async function assertPageLoaded(page, containerSelector = null) {
  const selector = containerSelector || 'div.pe-page-container, div.pe-container';
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Assert URL contains pattern
 */
async function assertUrlContains(page, pattern) {
  const url = page.url();
  if (!url.includes(pattern)) {
    throw new Error(`Expected URL to contain "${pattern}", but got "${url}"`);
  }
}

module.exports = {
  SELECTORS,
  loginToWordPress,
  visitDashboard,
  openPushEngageMenu,
  openPushEngageMenuItem,
  openPushEngageMenuItemByIndex,
  clickCreateNotification,
  clickTab,
  saveSettings,
  toggleSwitch,
  goToWooOrderNotifications,
  toggleWooNotification,
  assertPageLoaded,
  assertUrlContains,
};
