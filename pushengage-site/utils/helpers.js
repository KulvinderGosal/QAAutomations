const { expect } = require('@playwright/test');

/**
 * Wait for the page to be fully loaded (no spinner, no skeleton screens).
 */
async function waitForPageLoad(page, timeout = 15000) {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

/**
 * Assert that a list of selectors are all visible on the page.
 * Returns an object with found/missing arrays for detailed reporting.
 */
async function assertElementsVisible(page, selectors, timeoutMs = 8000) {
  const found = [];
  const missing = [];

  for (const { selector, label } of selectors) {
    const loc = page.locator(selector).first();
    const visible = await loc.isVisible({ timeout: timeoutMs }).catch(() => false);
    if (visible) {
      found.push(label || selector);
    } else {
      missing.push(label || selector);
    }
  }

  return { found, missing };
}

/**
 * Find the first visible element from a list of candidate selectors.
 */
async function findFirstVisible(page, selectors, timeout = 5000) {
  // Scan EVERY match of each selector for the first VISIBLE one — not just
  // .first(). The old .first()-only check returned early on hidden mega-menu /
  // duplicate nodes and reported real, visible nav links as missing. Each
  // selector gets a slice of the budget so late-rendered elements can attach.
  const perSelector = Math.max(1000, Math.floor(timeout / Math.max(1, selectors.length)));
  for (const selector of selectors) {
    const loc = page.locator(selector);
    try {
      await loc.first().waitFor({ state: 'attached', timeout: perSelector });
    } catch {
      continue;
    }
    const count = await loc.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const nth = loc.nth(i);
      if (await nth.isVisible().catch(() => false)) return nth;
    }
  }
  return null;
}

/**
 * Scroll to element and click it, with retry logic.
 */
async function scrollAndClick(page, selector, timeout = 10000) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded({ timeout });
  await loc.click({ timeout });
}

/**
 * Check if a URL navigates successfully (status 200-399).
 * Used for link validation tests.
 */
async function checkLinkStatus(page, url) {
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    return {
      url,
      status: response ? response.status() : 0,
      ok: response ? response.ok() : false,
    };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

/**
 * Dismiss cookie consent banners if present.
 */
async function dismissCookieBanner(page) {
  const bannerSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("I Accept")',
    'button:has-text("Got it")',
    'button:has-text("OK")',
    '[id*="cookie"] button',
    '[class*="cookie"] button',
    '[class*="consent"] button',
  ];

  for (const selector of bannerSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click().catch(() => {});
      return true;
    }
  }
  return false;
}

/**
 * Take a named screenshot for reporting.
 */
async function screenshot(page, name) {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  });
}

module.exports = {
  waitForPageLoad,
  assertElementsVisible,
  findFirstVisible,
  scrollAndClick,
  checkLinkStatus,
  dismissCookieBanner,
  screenshot,
};
