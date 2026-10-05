// Responsive + design QA for the pricing page across phone/tablet/desktop.
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const OUT = '/home/user/QAAutomations/test-results/prod-qa';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-se', w: 375, h: 667, mobile: true },
  { name: 'iphone-13', w: 390, h: 844, mobile: true },
  { name: 'iphone-14-promax', w: 430, h: 932, mobile: true },
  { name: 'ipad-portrait', w: 768, h: 1024, mobile: true },
  { name: 'ipad-pro-portrait', w: 1024, h: 1366, mobile: true },
  { name: 'ipad-landscape', w: 1024, h: 768, mobile: true },
  { name: 'desktop-1440', w: 1440, h: 900, mobile: false },
];

async function dismissCookie(page) {
  for (const sel of ['button:has-text("Accept")', 'button:has-text("Reject")']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1500 })) { await b.click(); await page.waitForTimeout(400); return; } } catch (e) {}
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' }, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1, userAgent: vp.mobile ? devices['iPhone 13'].userAgent : undefined });
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(String(e).split('\n')[0].slice(0, 120)));
    await page.goto('https://www.pushengage.com/pricing/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    await dismissCookie(page);
    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      // find elements overflowing viewport horizontally
      const overflowers = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 2 && r.width > 40 && r.width < window.innerWidth * 3) {
          const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : '');
          overflowers.push(tag + ` (right=${Math.round(r.right)})`);
        }
      });
      // hamburger / mobile menu toggle presence
      const navToggle = !!document.querySelector('button[aria-controls="primary-menu"], .menu-toggle, button[aria-label*="menu" i], .hamburger');
      // CTAs visible
      const planCtas = Array.from(document.querySelectorAll('a[href*="/signup/"]')).filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
      return { docW, winW, hasHScroll: docW > winW + 2, overflowers: [...new Set(overflowers)].slice(0, 8), navToggle, planCtasVisible: planCtas };
    });
    await page.screenshot({ path: `${OUT}/pricing-${vp.name}.png`, fullPage: true });
    const row = { viewport: vp.name, size: `${vp.w}x${vp.h}`, ...metrics, jsErrors: jsErrors.length };
    rows.push(row);
    console.log(`[${vp.name} ${vp.w}x${vp.h}] hScroll:${metrics.hasHScroll} (doc=${metrics.docW}/win=${metrics.winW}) navToggle:${metrics.navToggle} planCTAsVisible:${metrics.planCtasVisible} jsErr:${jsErrors.length}`);
    if (metrics.overflowers.length) console.log('   overflow:', metrics.overflowers.join(' | '));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/responsive.json`, JSON.stringify(rows, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
