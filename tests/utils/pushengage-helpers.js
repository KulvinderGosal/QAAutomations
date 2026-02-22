/**
 * Navigate to a PushEngage page via WordPress sidebar menu
 * This avoids direct URL access which may have permission issues
 */
async function navigateToPushEngagePage(page, pageName, config) {
  console.log(`📍 Navigating to PushEngage ${pageName}...`);
  
  const baseUrl = config.wpAdminUrl.replace('/wp-admin', '').replace('/admin', '');
  
  // Go to WordPress dashboard first
  await page.goto(`${baseUrl}/wp-admin/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(2000);
  
  // Look for and hover over PushEngage menu to reveal submenu
  const pushEngageMenuSelectors = [
    '#toplevel_page_pushengage-dashboard',
    'li[id*="pushengage"]',
    'a:has-text("PushEngage")',
    '[class*="pushengage"]'
  ];
  
  let menuFound = false;
  for (const selector of pushEngageMenuSelectors) {
    try {
      await page.hover(selector, { timeout: 3000 });
      menuFound = true;
      console.log(`✓ Found PushEngage menu: ${selector}`);
      await page.waitForTimeout(500);
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (!menuFound) {
    console.log('⚠️ Could not find PushEngage menu in sidebar');
    return false;
  }
  
  // Click on the specific submenu item
  const submenuSelectors = {
    'Broadcasts': [
      'a:has-text("Push Broadcasts")',
      'li.wp-submenu a:has-text("Broadcasts")',
      'a[href*="pushengage-broadcasts"]'
    ],
    'Drip': [
      'li.wp-submenu a:has-text("Drip")',
      'a[href*="pushengage-drip"]',
      'a:has-text("Drip Campaigns")'
    ],
    'Triggers': [
      'li.wp-submenu a:has-text("Triggers")',
      'a[href*="pushengage-triggers"]'
    ],
    'Audience': [
      'li.wp-submenu a:has-text("Audience")',
      'a[href*="pushengage-audience"]',
      'a:has-text("Segments")'
    ]
  };
  
  const selectors = submenuSelectors[pageName] || [];
  
  for (const selector of selectors) {
    try {
      await page.click(selector, { timeout: 5000 });
      console.log(`✓ Clicked ${pageName} menu using: ${selector}`);
      await page.waitForTimeout(3000);
      return true;
    } catch (e) {
      continue;
    }
  }
  
  console.log(`⚠️ Could not click ${pageName} menu item`);
  return false;
}

/**
 * Wait for a React/SPA page to load by checking for common indicators
 */
async function waitForReactPageLoad(page, timeout = 10000) {
  try {
    // Wait for common React loading indicators to disappear
    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll('.ant-spin, .loading, .spinner, [class*="loading"]');
        return spinners.length === 0 || Array.from(spinners).every(s => s.style.display === 'none');
      },
      { timeout }
    );
    return true;
  } catch (e) {
    // Continue anyway if we can't detect loading state
    return false;
  }
}

module.exports = {
  navigateToPushEngagePage,
  waitForReactPageLoad
};
