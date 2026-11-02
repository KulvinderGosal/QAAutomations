/**
 * Test Suite: CRITICAL - Menu Routing, Footer Links & CTAs
 * Test ID Prefix: PESITE-006x
 * Priority: CRITICAL
 * Feature: NAVIGATION ROUTING / LINK INTEGRITY
 *
 * Exhaustive, data-driven coverage:
 *  - Top-level nav items are present
 *  - EVERY header / mega-menu internal link routes without 4xx/5xx
 *  - EVERY footer internal link routes without 4xx/5xx
 *  - Get Started + Log In CTAs resolve to the app/signup
 *  - No primary nav/CTA uses a dead href (#, javascript:void, empty)
 *  - Mega-menu dropdowns reveal their links on interaction
 *
 * Same-origin links are status-probed over HTTP (request API). Cross-origin
 * targets (app.pushengage.com, docs, social) are asserted by href only —
 * many bot-block HEAD/GET, so a status probe would be unreliable.
 */

const { test, expect } = require('@playwright/test');
const { waitForPageLoad, findFirstVisible } = require('../../utils/helpers');

const TOP_NAV_LABELS = ['Platform', 'Channels', 'Automation', 'Solutions', 'Resources', 'Pricing'];

/** Collect absolute hrefs from a scope ('header' | 'footer'), split into internal/external. */
async function collectLinks(page, scope) {
  return page.$$eval(`${scope} a[href]`, (els, origin) => {
    const internal = new Map();
    const external = new Set();
    for (const a of els) {
      const raw = a.getAttribute('href');
      if (!raw) continue;
      let u;
      try { u = new URL(raw, location.href); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;            // skip mailto:, tel:, javascript:
      if (u.hostname === location.hostname) {
        internal.set(u.pathname, u.origin + u.pathname);       // dedupe by path, drop query/hash
      } else {
        external.add(u.origin + u.pathname);
      }
    }
    return { internal: [...internal.values()], external: [...external] };
  }, undefined);
}

test.describe('CRITICAL - Menu Routing, Footer & CTAs', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);
  });

  test('PESITE-0601 - Top-level nav items are present @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0601: Top nav items');
    const missing = [];
    for (const label of TOP_NAV_LABELS) {
      const el = page.locator(`header >> text="${label}"`).first();
      const visible = await el.isVisible({ timeout: 4000 }).catch(() => false);
      console.log(`  ${visible ? '✓' : '✗'} ${label}`);
      if (!visible) missing.push(label);
    }
    expect(missing, `Missing top-nav items: ${missing.join(', ')}`).toHaveLength(0);
    console.log('✅ All top-level nav items present');
  });

  test('PESITE-0602 - Every header / mega-menu link routes OK @smoke @critical', async ({ page, request }) => {
    console.log('📍 PESITE-0602: Header + mega-menu link routing');
    const { internal, external } = await collectLinks(page, 'header');
    console.log(`  Header links — internal: ${internal.length}, external: ${external.length}`);
    expect(internal.length, 'Header should expose internal links').toBeGreaterThan(3);

    const failures = [];
    for (const url of internal) {
      const res = await request.get(url, { failOnStatusCode: false, maxRedirects: 5 }).catch((e) => ({ status: () => 0, _err: e.message }));
      const status = res.status();
      if (status >= 400 || status === 0) failures.push(`${new URL(url).pathname} → ${status || res._err}`);
    }
    if (failures.length) console.log('  ❌ Broken header links:\n   - ' + failures.join('\n   - '));
    expect(failures, `Broken header/mega-menu links:\n${failures.join('\n')}`).toHaveLength(0);
    console.log(`✅ All ${internal.length} header links route OK`);
  });

  test('PESITE-0603 - Every footer link routes OK @smoke @critical', async ({ page, request }) => {
    console.log('📍 PESITE-0603: Footer link routing');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const { internal, external } = await collectLinks(page, 'footer');
    console.log(`  Footer links — internal: ${internal.length}, external: ${external.length}`);
    expect(internal.length, 'Footer should expose internal links').toBeGreaterThan(3);

    const failures = [];
    for (const url of internal) {
      const res = await request.get(url, { failOnStatusCode: false, maxRedirects: 5 }).catch((e) => ({ status: () => 0, _err: e.message }));
      const status = res.status();
      if (status >= 400 || status === 0) failures.push(`${new URL(url).pathname} → ${status || res._err}`);
    }
    if (failures.length) console.log('  ❌ Broken footer links:\n   - ' + failures.join('\n   - '));
    expect(failures, `Broken footer links:\n${failures.join('\n')}`).toHaveLength(0);
    console.log(`✅ All ${internal.length} footer links route OK`);
  });

  test('PESITE-0604 - Get Started + Log In CTAs resolve correctly @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0604: Primary CTAs');
    // Find the first VISIBLE CTA (not .first(), which can be the hidden mobile
    // sticky-nav CTA). Not scoped to <header> — the theme's CTA sits in the nav
    // bar, and "Get Started" now routes to /pricing/.
    const getStarted = await findFirstVisible(page, ['a:has-text("Get Started")', 'a:has-text("Start For Free")']);
    const login = await findFirstVisible(page, ['a:has-text("Log In")', 'a:has-text("Login")', 'a[href*="app.pushengage.com"]']);

    expect(getStarted, '"Get Started" CTA should be present').toBeTruthy();
    const gsHref = await getStarted.getAttribute('href');
    console.log(`  Get Started → ${gsHref}`);
    expect(gsHref, 'Get Started should point to pricing/signup/app').toMatch(/signup|register|get-started|start|pricing|app\.pushengage|\/\//i);

    expect(login, '"Log In" CTA should be present').toBeTruthy();
    const liHref = await login.getAttribute('href');
    console.log(`  Log In → ${liHref}`);
    expect(liHref, 'Log In should point to login/app').toMatch(/login|signin|app\.pushengage/i);
    console.log('✅ Get Started + Log In CTAs resolve');
  });

  test('PESITE-0605 - No dead hrefs (#, javascript:void) in nav/CTAs @critical', async ({ page }) => {
    console.log('📍 PESITE-0605: Dead-href guard');
    const dead = await page.$$eval('header a[href], a.button, a[class*="cta" i]', (els) =>
      els.map((a) => {
        const li = a.closest('li');
        // A dropdown-parent nav item uses href="#" to toggle a submenu (not a dead
        // link). Detect via ARIA, role, a nested submenu, or a caret/chevron icon.
        const isDropdownToggle =
          a.hasAttribute('aria-haspopup') ||
          a.getAttribute('aria-expanded') !== null ||
          a.getAttribute('role') === 'button' ||
          !!(li && li.querySelector('ul, .sub-menu, [class*="submenu" i], [class*="dropdown" i], [class*="mega" i]')) ||
          !!a.querySelector('svg, [class*="caret" i], [class*="chevron" i], [class*="arrow" i]');
        return { text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), href: a.getAttribute('href'), isDropdownToggle };
      })
        .filter((l) => (l.href === '#' || /^javascript:/i.test(l.href || '') || l.href === '') && !l.isDropdownToggle)
        .map(({ text, href }) => ({ text, href }))
    );
    if (dead.length) console.log('  ❌ Dead hrefs: ' + JSON.stringify(dead));
    expect(dead, `Nav/CTA links with dead hrefs: ${JSON.stringify(dead)}`).toHaveLength(0);
    console.log('✅ No dead hrefs in nav/CTAs');
  });

  test('PESITE-0606 - Mega-menu dropdowns reveal links on interaction @critical', async ({ page }) => {
    console.log('📍 PESITE-0606: Mega-menu interaction');
    let opened = 0;
    for (const label of ['Platform', 'Channels', 'Automation', 'Solutions', 'Resources']) {
      const trigger = page.locator(`header >> text="${label}"`).first();
      if (!(await trigger.isVisible({ timeout: 3000 }).catch(() => false))) continue;
      const before = await page.locator('header a:visible').count();
      await trigger.hover().catch(() => {});
      await page.waitForTimeout(600);
      const after = await page.locator('header a:visible').count();
      const revealed = after > before;
      console.log(`  ${label}: visible links ${before} → ${after} ${revealed ? '(revealed ✓)' : ''}`);
      if (revealed) opened++;
    }
    expect(opened, 'At least one mega-menu should reveal links on hover').toBeGreaterThan(0);
    console.log(`✅ ${opened} mega-menu(s) reveal links on interaction`);
  });
});
