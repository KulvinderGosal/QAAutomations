const { test, expect, request } = require('@playwright/test');

/**
 * Suite: MARKETING SITE — FULL LINK / PAGE-AVAILABILITY REGRESSION (PRODUCTION)
 *
 * Crawls EVERY URL in the AIOSEO sitemap index (posts, pages, docs, categories,
 * tags) and asserts each first-party page returns HTTP < 400.
 *
 * `/recommends/*` URLs are ThirstyAffiliates cloaked affiliate redirects that
 * intentionally 3xx/403 off-site to external merchants — they are reported for
 * visibility but excluded from the pass/fail assertion (not PushEngage defects).
 *
 * One test per child sitemap so failures localize. Read-only / non-destructive.
 */

const BASE = 'https://www.pushengage.com';
const CONCURRENCY = 12;

function locs(xml) {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim());
}
async function pool(items, worker, size) {
  let i = 0; const out = new Array(items.length);
  const run = async () => { while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx]); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, run));
  return out;
}
const isAffiliate = (u) => /\/recommends\//.test(u);

let api;
let childMaps = [];

test.beforeAll(async () => {
  api = await request.newContext({
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
    extraHTTPHeaders: { 'User-Agent': 'PushEngage-QA-Regression/1.0' },
    timeout: 45000,
  });
  const idx = await api.get(`${BASE}/sitemap.xml`);
  expect(idx.status(), 'sitemap index should be reachable').toBe(200);
  childMaps = locs(await idx.text()).filter((u) => u.endsWith('.xml'));
  expect(childMaps.length, 'sitemap index should list child sitemaps').toBeGreaterThan(0);
});

test.afterAll(async () => { if (api) await api.dispose(); });

test('PE-MKT-LINK-000: sitemap index lists the expected child sitemaps', async () => {
  const names = childMaps.map((u) => u.replace(BASE, ''));
  expect(names).toEqual(expect.arrayContaining(['/post-sitemap.xml', '/page-sitemap.xml', '/documentation-sitemap.xml']));
});

// Build a test per child sitemap. Because beforeAll populates childMaps, we
// enumerate the known child sitemaps up front and skip any not present.
const CHILD_SITEMAPS = [
  'post-sitemap', 'page-sitemap', 'documentation-sitemap',
  'category-sitemap', 'post_tag-sitemap', 'post-archive-sitemap', 'docs_cat-sitemap',
];

for (const child of CHILD_SITEMAPS) {
  test(`PE-MKT-LINK: all URLs in ${child}.xml return < 400`, async () => {
    test.setTimeout(240000);
    const mapUrl = `${BASE}/${child}.xml`;
    if (!childMaps.includes(mapUrl)) test.skip(true, `${child}.xml not in sitemap index`);

    const r = await api.get(mapUrl);
    expect(r.status()).toBe(200);
    const urls = locs(await r.text()).filter((u) => !u.endsWith('.xml'));
    expect(urls.length, `${child} should contain URLs`).toBeGreaterThan(0);

    const rows = await pool(urls, async (u) => {
      try { const res = await api.get(u, { maxRedirects: 5 }); return { u, status: res.status() }; }
      catch (e) { return { u, status: null, err: String(e.message).split('\n')[0] }; }
    }, CONCURRENCY);

    const firstParty = rows.filter((x) => !isAffiliate(x.u));
    const affiliate = rows.filter((x) => isAffiliate(x.u));
    const broken = firstParty.filter((x) => x.status == null || x.status >= 400);
    const affiliateBad = affiliate.filter((x) => x.status == null || x.status >= 400);

    if (affiliateBad.length) {
      console.log(`  [info] ${affiliateBad.length} affiliate /recommends/ links non-200 (expected, excluded):`);
      affiliateBad.slice(0, 30).forEach((x) => console.log(`    [${x.err || x.status}] ${x.u}`));
    }
    if (broken.length) {
      console.log(`  [FAIL] ${broken.length} broken first-party URLs in ${child}:`);
      broken.forEach((x) => console.log(`    [${x.err || x.status}] ${x.u}`));
    }
    expect(broken, `broken first-party URLs in ${child}: ${broken.map((b) => `${b.status} ${b.u}`).join(' | ')}`).toHaveLength(0);
  });
}
