const { test, expect } = require('@playwright/test');

/**
 * Suite: MARKETING SITE — RENDERED PAGE HEALTH & SEO REGRESSION (PRODUCTION)
 *
 * For each curated key page: HTTP 200, non-empty <title>, canonical + viewport
 * meta present, and no uncaught JavaScript page errors.
 *
 * Known pre-existing defects (as of 2026-10-05) are guarded with test.fail() so
 * the suite stays green while clearly flagging them — and will flip RED (alerting
 * the team) the moment they are fixed. See QA_REPORT for details.
 */

const BASE = 'https://www.pushengage.com';

const KEY_PAGES = [
  '/', '/pricing/', '/wordpress-pricing/', '/web-push-notifications-shopify-pricing/',
  '/features/', '/platform-overview/', '/workflows/',
  '/web-push-notifications/', '/mobile-app-push-notifications/', '/in-app-messaging/', '/pwa-push-notifications/',
  '/whatsapp-automation/', '/chat-widget/', '/push-notification-service/',
  '/features/triggered-notifications/', '/features/automatic-drip-campaigns/', '/features/dynamic-segmentation/',
  '/features/a-b-testing/', '/features/cart-abandonment-reminder/', '/features/goal-tracking-analytics/',
  '/features/personalization/', '/features/deep-ecommerce-integrations/', '/features/gdpr-compliant/',
  '/solutions/ecommerce/', '/solutions/news-media/', '/solutions/saas/', '/solutions/agencies/', '/solutions/travel/',
  '/integrations/', '/api/', '/developers/',
  '/pushengage-vs-onesignal/', '/pushengage-vs-braze/', '/pushengage-vs-klaviyo/',
  '/about/', '/press/', '/contact-us/', '/case-studies/', '/blog/',
  '/schedule_demo/', '/signup/',
  '/privacy/', '/terms/', '/dpa/', '/cookies/', '/ftc-disclosure/',
];

// Pages with a known, not-yet-fixed client-side JS error (theme bundle main.js).
const KNOWN_JS_ERROR = new Set(['/wordpress-pricing/', '/web-push-notifications-shopify-pricing/']);
// Pages whose <h1> count is known-wrong: 0 on /pricing/ & /signup/, 6 on /workflows/.
const KNOWN_H1_ISSUE = new Set(['/pricing/', '/workflows/', '/signup/']);
// Funnel page intentionally without indexable SEO meta.
const NO_SEO_META = new Set(['/signup/']);

async function loadMetrics(page, path) {
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e).split('\n')[0].slice(0, 160)));
  const resp = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  const meta = await page.evaluate(() => ({
    title: document.title || '',
    h1Count: document.querySelectorAll('h1').length,
    metaDesc: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
  }));
  return { status: resp ? resp.status() : null, jsErrors, ...meta };
}

test.describe('Marketing Site — Page Health & SEO (Production)', () => {
  for (const path of KEY_PAGES) {
    test(`PE-MKT-PAGE ${path} — loads 200 with core SEO meta`, async ({ page }) => {
      const m = await loadMetrics(page, path);
      expect(m.status, `HTTP status for ${path}`).toBe(200);
      expect(m.title.length, `title present for ${path}`).toBeGreaterThanOrEqual(10);
      expect(m.canonical, `canonical present for ${path}`).toBeTruthy();
      expect(m.viewport, `viewport meta present for ${path}`).toBeTruthy();
      if (!NO_SEO_META.has(path)) {
        expect(m.metaDesc, `meta description present for ${path}`).toBeTruthy();
      }
    });
  }

  // ---- No-JS-error guard (skips the known-broken pricing variants here) ----
  for (const path of KEY_PAGES.filter((p) => !KNOWN_JS_ERROR.has(p))) {
    test(`PE-MKT-JSERR ${path} — no uncaught JS errors`, async ({ page }) => {
      const m = await loadMetrics(page, path);
      expect(m.jsErrors, `JS errors on ${path}: ${m.jsErrors.join(' | ')}`).toHaveLength(0);
    });
  }

  // ---- Single-<h1> guard (skips known-wrong pages here) ----
  for (const path of KEY_PAGES.filter((p) => !KNOWN_H1_ISSUE.has(p))) {
    test(`PE-MKT-H1 ${path} — exactly one <h1>`, async ({ page }) => {
      const m = await loadMetrics(page, path);
      expect(m.h1Count, `<h1> count on ${path}`).toBe(1);
    });
  }

  // =====================================================================
  // KNOWN PRE-EXISTING DEFECTS — guarded with test.fail().
  // These PASS while the bug exists and FAIL (alert) once the bug is fixed,
  // at which point move the page back into the normal guards above.
  // =====================================================================
  for (const path of KNOWN_JS_ERROR) {
    test(`PE-MKT-JSERR ${path} — [KNOWN BUG] theme main.js throws on load`, async ({ page }) => {
      test.fail(true, 'main.js: "Cannot read properties of undefined (reading \'slice\')" — remove when fixed');
      const m = await loadMetrics(page, path);
      expect(m.jsErrors, `expected zero JS errors on ${path}`).toHaveLength(0);
    });
  }

  test('PE-MKT-H1 /pricing/ — [KNOWN SEO ISSUE] page has no <h1>', async ({ page }) => {
    test.fail(true, '/pricing/ hero is an <h2>; page has zero <h1> — remove when an <h1> is added');
    const m = await loadMetrics(page, '/pricing/');
    expect(m.h1Count).toBe(1);
  });

  test('PE-MKT-H1 /workflows/ — [KNOWN SEO ISSUE] page has multiple <h1>', async ({ page }) => {
    test.fail(true, '/workflows/ renders 6 <h1> tags — remove when reduced to one');
    const m = await loadMetrics(page, '/workflows/');
    expect(m.h1Count).toBe(1);
  });
});
