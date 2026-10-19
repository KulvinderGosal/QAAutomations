// Full-site page-availability crawl over every URL in the AIOSEO sitemap.
// Uses Playwright's APIRequestContext (fast, no browser) with a concurrency pool.
// Reports every URL whose status is >= 400 (or that errors / redirects to an error).
const { request } = require('@playwright/test');
const fs = require('fs');
const OUT = '/home/user/QAAutomations/test-results/prod-qa';
fs.mkdirSync(OUT, { recursive: true });

const CONCURRENCY = 12;

function locs(xml) {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim());
}

async function pool(items, worker, size) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: size }, run));
  return results;
}

(async () => {
  const ctx = await request.newContext({
    proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' },
    ignoreHTTPSErrors: false,
    extraHTTPHeaders: { 'User-Agent': 'PushEngage-QA-Regression/1.0' },
    timeout: 45000,
  });

  const idx = await ctx.get('https://www.pushengage.com/sitemap.xml');
  const childMaps = locs(await idx.text()).filter((u) => u.endsWith('.xml'));

  const urlToMap = new Map();
  for (const cm of childMaps) {
    const r = await ctx.get(cm);
    locs(await r.text()).filter((u) => !u.endsWith('.xml')).forEach((u) => { if (!urlToMap.has(u)) urlToMap.set(u, cm.replace('https://www.pushengage.com', '')); });
  }
  const urls = [...urlToMap.keys()];
  console.log(`Crawling ${urls.length} URLs @ concurrency ${CONCURRENCY}...`);

  let done = 0;
  const rows = await pool(urls, async (u) => {
    let status = null, finalUrl = u, err = null;
    try {
      const r = await ctx.get(u, { maxRedirects: 5 });
      status = r.status();
      finalUrl = r.url();
    } catch (e) {
      err = String(e.message || e).split('\n')[0];
    }
    done++;
    if (done % 100 === 0) console.log(`  ...${done}/${urls.length}`);
    return { url: u, sitemap: urlToMap.get(u), status, finalUrl, err };
  }, CONCURRENCY);

  const bad = rows.filter((r) => r.err || r.status == null || r.status >= 400);
  const redirects = rows.filter((r) => !r.err && r.status >= 300 && r.status < 400);
  const byStatus = {};
  rows.forEach((r) => { const k = r.err ? 'ERR' : String(r.status); byStatus[k] = (byStatus[k] || 0) + 1; });

  fs.writeFileSync(OUT + '/linkcrawl.json', JSON.stringify({ total: rows.length, byStatus, bad, redirects: redirects.slice(0, 50) }, null, 2));

  console.log('\n===== LINK HEALTH SUMMARY =====');
  console.log('Total URLs crawled:', rows.length);
  console.log('Status distribution:', JSON.stringify(byStatus));
  console.log(`\nBROKEN (>=400 or error): ${bad.length}`);
  bad.forEach((r) => console.log(`  [${r.err ? 'ERR' : r.status}] ${r.url}  (${r.sitemap})${r.err ? ' :: ' + r.err : ''}`));
  await ctx.dispose();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
