// Inventory the marketing site from its AIOSEO sitemap index + homepage nav/footer.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = '/home/user/QAAutomations/test-results/prod-qa';
fs.mkdirSync(OUT, { recursive: true });

function locs(xml) {
  // Handles both <loc>url</loc> and <loc><![CDATA[url]]></loc>
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim());
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' }, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const get = async (url) => { try { const r = await ctx.request.get(url, { timeout: 30000 }); return { status: r.status(), text: await r.text() }; } catch (e) { return { status: 'ERR', text: String(e) }; } };

  const idx = await get('https://www.pushengage.com/sitemap.xml');
  const childMaps = locs(idx.text).filter((u) => u.endsWith('.xml'));
  console.log('sitemap.xml status', idx.status, '| child sitemaps:', childMaps.length);

  const sm = {};
  const allUrls = new Map();
  for (const cm of childMaps) {
    const r = await get(cm);
    const urls = locs(r.text).filter((u) => !u.endsWith('.xml'));
    sm[cm] = urls.length;
    urls.forEach((u) => { if (!allUrls.has(u)) allUrls.set(u, cm); });
  }
  console.log('\nPer-sitemap counts:');
  Object.entries(sm).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k.replace('https://www.pushengage.com', '')}`));
  console.log('\nTotal unique URLs:', allUrls.size);

  await page.goto('https://www.pushengage.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  const navLinks = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('header a[href], nav a[href], footer a[href]'));
    const out = [];
    for (const el of a) { const href = el.getAttribute('href'); const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40); if (href) out.push({ text, href }); }
    const seen = new Set();
    return out.filter((o) => { if (seen.has(o.href)) return false; seen.add(o.href); return true; });
  });
  console.log('\nHeader/nav/footer links:', navLinks.length);

  const core = [...allUrls.keys()].filter((u) => !/\/blog\//.test(u));
  console.log('Non-blog (core) URL count:', core.length);

  fs.writeFileSync(OUT + '/inventory.json', JSON.stringify({ childMaps, perSitemap: sm, totalUrls: allUrls.size, coreCount: core.length, core, urls: [...allUrls.keys()], navLinks }, null, 2));
  console.log('\n--- CORE (non-blog) PAGES ---');
  core.forEach((u) => console.log('  ', u.replace('https://www.pushengage.com', '') || '/'));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
