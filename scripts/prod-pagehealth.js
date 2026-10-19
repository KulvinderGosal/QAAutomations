// Rendered health + SEO snapshot for the curated key marketing pages.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = '/home/user/QAAutomations/test-results/prod-qa';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
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

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' }, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const rows = [];
  for (const path of PAGES) {
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(String(e).slice(0, 120)));
    let status = null, finalUrl = null;
    try {
      const r = await page.goto('https://www.pushengage.com' + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      status = r ? r.status() : null; finalUrl = page.url();
      await page.waitForTimeout(2500);
    } catch (e) { status = 'ERR:' + String(e.message).split('\n')[0]; }
    let meta = {};
    try {
      meta = await page.evaluate(() => ({
        title: document.title || '',
        h1Count: document.querySelectorAll('h1').length,
        h1: (document.querySelector('h1')?.innerText || '').trim().slice(0, 70),
        metaDesc: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
        imgNoAlt: Array.from(document.querySelectorAll('img')).filter((i) => !i.getAttribute('alt')).length,
        imgTotal: document.querySelectorAll('img').length,
      }));
    } catch (e) {}
    const row = { path, status, finalUrl, jsErrors, ...meta };
    rows.push(row);
    console.log(`[${status}] ${path} | h1:${meta.h1Count} title:${(meta.title || '').length}ch desc:${(meta.metaDesc || '').length}ch canon:${meta.canonical ? 'Y' : 'N'} jsErr:${jsErrors.length} imgNoAlt:${meta.imgNoAlt}/${meta.imgTotal}`);
    if (jsErrors.length) jsErrors.forEach((e) => console.log('     JS-ERR:', e));
    await page.close();
  }
  fs.writeFileSync(OUT + '/pagehealth.json', JSON.stringify(rows, null, 2));

  console.log('\n===== ISSUES =====');
  rows.forEach((r) => {
    const problems = [];
    if (r.status !== 200) problems.push(`status=${r.status}`);
    if (!r.title || r.title.length < 10) problems.push('weak/empty title');
    if (!r.h1Count) problems.push('no h1');
    if (r.h1Count > 1) problems.push(`${r.h1Count} h1s`);
    if (!r.metaDesc) problems.push('no meta description');
    if (!r.canonical) problems.push('no canonical');
    if (!r.viewport) problems.push('no viewport meta');
    if (r.jsErrors && r.jsErrors.length) problems.push(`${r.jsErrors.length} JS errors`);
    if (problems.length) console.log(`  ${r.path}: ${problems.join(', ')}`);
  });
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
