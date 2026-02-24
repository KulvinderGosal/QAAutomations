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
  
  // Normalize the admin URL - remove /admin or /wp-admin suffix
  const baseUrl = config.wpAdminUrl
    .replace('/wp-admin', '')
    .replace('/admin', '');
  
  const loginUrl = `${baseUrl}/wp-login.php`;
  
  await page.goto(loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  await page.waitForTimeout(3000);
  
  const currentUrl = page.url();
  if (currentUrl.includes('wp-login.php')) {
    console.log('Filling login credentials...');
    
    // Wait for login form to be visible
    await page.waitForSelector('input[name="log"]', { timeout: 15000 });
    
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
  // Normalize the admin URL - remove /admin or /wp-admin suffix, then add /wp-admin
  const baseUrl = config.wpAdminUrl
    .replace('/wp-admin', '')
    .replace('/admin', '');
  
  await page.goto(`${baseUrl}/wp-admin/index.php`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(3000);
  
  // Wait for PushEngage menu with error handling
  try {
    await page.locator(SELECTORS.pushEngageMenu).waitFor({ state: 'visible', timeout: 20000 });
  } catch (error) {
    console.log('⚠️ PushEngage menu not immediately visible, checking if page loaded...');
    // Check if we're at least on the dashboard
    const url = page.url();
    if (!url.includes('wp-admin')) {
      throw new Error(`Not on WordPress admin. Current URL: ${url}`);
    }
  }
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

/**
 * Fill credit card form
 * Supports various credit card form layouts (Stripe, custom forms, etc.)
 * 
 * @param {Page} page - Playwright page object
 * @param {Object} config - Config object containing testCreditCard data
 * @param {Object} options - Optional selectors for custom form fields
 */
async function fillCreditCardForm(page, config, options = {}) {
  console.log('💳 Filling credit card information...');
  
  const cardData = config.testCreditCard;
  
  // Default selectors (can be overridden via options)
  const selectors = {
    cardholderName: options.cardholderName || 'input[name*="cardholder" i], input[placeholder*="name on card" i], input[id*="cardname" i]',
    cardNumber: options.cardNumber || 'input[name*="cardnumber" i], input[name*="card_number" i], input[placeholder*="card number" i], input[id*="cardnumber" i]',
    expiryDate: options.expiryDate || 'input[name*="expiry" i], input[placeholder*="mm/yy" i], input[placeholder*="expiration" i]',
    expiryMonth: options.expiryMonth || 'input[name*="exp_month" i], input[name*="month" i], select[name*="month" i]',
    expiryYear: options.expiryYear || 'input[name*="exp_year" i], input[name*="year" i], select[name*="year" i]',
    cvv: options.cvv || 'input[name*="cvv" i], input[name*="cvc" i], input[name*="security" i], input[placeholder*="cvv" i]'
  };
  
  try {
    // Fill cardholder name
    const nameField = page.locator(selectors.cardholderName).first();
    if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameField.fill(cardData.cardholderName);
      console.log(`✓ Filled cardholder name: ${cardData.cardholderName}`);
    }
  } catch (e) {
    console.log('  ⚠️ Cardholder name field not found');
  }
  
  try {
    // Fill card number
    const cardNumberField = page.locator(selectors.cardNumber).first();
    if (await cardNumberField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardNumberField.fill(cardData.cardNumber);
      console.log(`✓ Filled card number: ${cardData.cardNumber}`);
    }
  } catch (e) {
    console.log('  ⚠️ Card number field not found');
  }
  
  try {
    // Try combined expiry date field first
    const expiryField = page.locator(selectors.expiryDate).first();
    if (await expiryField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expiryField.fill(cardData.expiryDate);
      console.log(`✓ Filled expiry date: ${cardData.expiryDate}`);
    } else {
      // Try separate month/year fields
      const monthField = page.locator(selectors.expiryMonth).first();
      const yearField = page.locator(selectors.expiryYear).first();
      
      if (await monthField.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Check if it's a select or input
        const tagName = await monthField.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await monthField.selectOption(cardData.expiryMonth);
        } else {
          await monthField.fill(cardData.expiryMonth);
        }
        console.log(`✓ Filled expiry month: ${cardData.expiryMonth}`);
      }
      
      if (await yearField.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Check if it's a select or input
        const tagName = await yearField.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          // Try 4-digit year first, then 2-digit
          const hasOption = await yearField.locator(`option[value="${cardData.expiryYear4Digit}"]`).count() > 0;
          await yearField.selectOption(hasOption ? cardData.expiryYear4Digit : cardData.expiryYear);
        } else {
          await yearField.fill(cardData.expiryYear);
        }
        console.log(`✓ Filled expiry year: ${cardData.expiryYear}`);
      }
    }
  } catch (e) {
    console.log('  ⚠️ Expiry date field(s) not found');
  }
  
  try {
    // Fill CVV
    const cvvField = page.locator(selectors.cvv).first();
    if (await cvvField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cvvField.fill(cardData.cvv);
      console.log(`✓ Filled CVV: ${cardData.cvv}`);
    }
  } catch (e) {
    console.log('  ⚠️ CVV field not found');
  }
  
  await page.waitForTimeout(500);
  console.log('✓ Credit card form filled\n');
}

/**
 * Fill credit card form in Stripe iframe
 * Special handler for Stripe Elements which use iframes
 */
async function fillStripeCardForm(page, config) {
  console.log('💳 Filling Stripe card information...');
  
  const cardData = config.testCreditCard;
  
  try {
    // Wait for Stripe iframe to load
    await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 10000 });
    
    // Card number iframe
    const cardNumberFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await cardNumberFrame.locator('input[name="cardnumber"]').fill(cardData.cardNumber);
    console.log(`✓ Filled card number: ${cardData.cardNumber}`);
    
    // Expiry iframe
    const expiryFrame = page.frameLocator('iframe[title*="Secure expiration date"]').first();
    await expiryFrame.locator('input[name="exp-date"]').fill(cardData.expiryDate);
    console.log(`✓ Filled expiry: ${cardData.expiryDate}`);
    
    // CVC iframe
    const cvcFrame = page.frameLocator('iframe[title*="Secure CVC"]').first();
    await cvcFrame.locator('input[name="cvc"]').fill(cardData.cvv);
    console.log(`✓ Filled CVV: ${cardData.cvv}`);
    
    await page.waitForTimeout(500);
    console.log('✓ Stripe card form filled\n');
  } catch (e) {
    console.log(`⚠️ Error filling Stripe form: ${e.message}`);
    console.log('Falling back to standard form fill...\n');
    await fillCreditCardForm(page, config);
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
  fillCreditCardForm,
  fillStripeCardForm,
};
