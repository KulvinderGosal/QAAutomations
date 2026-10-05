const { test, expect, devices } = require('@playwright/test');

/**
 * Suite: PRICING PAGE — RESPONSIVE / LAYOUT REGRESSION (PRODUCTION)
 *
 * Verifies the pricing page has no page-level horizontal overflow and keeps the
 * plan CTAs usable across phone, tablet, and desktop breakpoints.
 *
 * Note: the plan-comparison table is intentionally wider than small viewports and
 * scrolls inside its own `overflow-x:auto` wrapper — that is not a page-overflow bug.
 */

const BREAKPOINTS = [
  { name: 'iPhone SE (375x667)', w: 375, h: 667, mobile: true },
  { name: 'iPhone 13 (390x844)', w: 390, h: 844, mobile: true },
  { name: 'iPhone 14 Pro Max (430x932)', w: 430, h: 932, mobile: true },
  { name: 'iPad portrait (768x1024)', w: 768, h: 1024, mobile: true },
  { name: 'iPad Pro portrait (1024x1366)', w: 1024, h: 1366, mobile: true },
  { name: 'iPad landscape (1024x768)', w: 1024, h: 768, mobile: true },
  { name: 'Desktop (1440x900)', w: 1440, h: 900, mobile: false },
];

for (const bp of BREAKPOINTS) {
  test(`PE-MKT-RESP ${bp.name}: pricing has no horizontal page scroll and shows plan CTAs`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: bp.w, height: bp.h },
      isMobile: bp.mobile,
      hasTouch: bp.mobile,
      deviceScaleFactor: bp.mobile ? 2 : 1,
      userAgent: bp.mobile ? devices['iPhone 13'].userAgent : undefined,
    });
    const page = await context.newPage();
    await page.goto('https://www.pushengage.com/pricing/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    for (const sel of ['button:has-text("Accept")']) {
      try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1200 })) { await b.click(); await page.waitForTimeout(400); } } catch (e) { /* no-op */ }
    }

    const m = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      planCtas: Array.from(document.querySelectorAll('a[href*="/signup/"]')).filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length,
    }));

    expect(m.docW, `no horizontal page overflow at ${bp.name} (doc=${m.docW} win=${m.winW})`).toBeLessThanOrEqual(m.winW + 2);
    expect(m.planCtas, `plan CTAs visible at ${bp.name}`).toBeGreaterThan(0);
    await context.close();
  });
}
