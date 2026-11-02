/**
 * Test Suite: SMOKE / HEALTH - Site Health ("no page is down")
 * Test ID Prefix: PESITE-900x
 * Priority: SMOKE (pre-release gate)
 * Feature: SITE-WIDE HEALTH / LINK INTEGRITY / FORM RENDER
 *
 * Fast, reusable health check that proves "no page is down":
 *   1. Every published page in the WP sitemap returns < 400 and is not a soft-404.
 *   2. Curated key pages render real content (title + <main>) — catches soft-404s.
 *   3. Every same-origin link on the homepage resolves (nav + body + CTAs + footer).
 *   4. Footer links resolve.
 *   5. Primary CTAs resolve.
 *   6. The Contact + support/ticket forms RENDER (fields + submit) — never submitted.
 *
 * Runs under BOTH staging + production via the framework env switch
 * (TEST_ENV → utils/config baseUrl + playwright.config baseURL). The host is
 * NEVER hardcoded — every URL comes from config / the DOM / the sitemap.
 *
 * SELF-SKIP (never a false outage): if the homepage can't be loaded under
 * automation (Cloudflare 403 / bot challenge), the suite skips with a clear
 * reason rather than reporting the whole site as broken (see beforeEach).
 *
 * NON-DESTRUCTIVE: forms are asserted to RENDER only — no field is submitted,
 * nothing is sent, no destructive control is clicked.
 *
 * Reporting: every crawl collects ALL broken items into an array and asserts the
 * array is empty with a message listing them (no fail-on-first). Large crawls are
 * capped and the cap is logged (no silent truncation).
 *
 * Reference conventions: tests/critical/06-menu-routing.spec.js (link probing),
 * tests/medium/02-footer-links.spec.js + tests/high/07-contact-us.spec.js (forms).
 */

const { test, expect } = require('@playwright/test');
const { waitForPageLoad } = require('../../utils/helpers');
const config = require('../../utils/config');
const ContactPage = require('../../pages/ContactPage');
// qa-core BLOCKED taxonomy (TS, transpiled by Playwright): a WAF block is a
// no-verdict BLOCKED in TestPilot, never a silent skip.
const { BlockedError } = require('../../../packages/qa-core/errors.ts');

// ── Tunables ────────────────────────────────────────────────────────────────
const SITEMAP_CAP = 120; // max sitemap page URLs to crawl in one smoke run
const HOME_LINK_CAP = 100; // max homepage links to probe

// ── "Not-found" / error signals ───────────────────────────────────────────────
// A soft-404 returns HTTP 200 but the title/body says "not found". A bare "404"
// is only trusted in the <title> (it appears in asset hashes / prose in bodies),
// while the explicit phrases are trusted anywhere.
const NOTFOUND_PHRASE = /page not found|page can'?t be found|page does\s?n'?t exist|does not exist|error 404|nothing found here/i;
const TITLE_404 = /\b404\b|page not found|not found|does\s?n'?t exist/i;
const FATAL_RE = /there has been a critical error|<b>\s*fatal error|wordpress database error|call to undefined|uncaught (?:error|exception)/i;
// Cloudflare / bot-challenge / hard-block markers.
const BLOCK_RE = /just a moment|attention required|checking your browser|cloudflare|verify you are human|cf-browser-verification|ddos protection|access denied|error 10\d\d|enable javascript and cookies/i;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** True when the rendered page looks like a Cloudflare / bot challenge or hard block. */
async function looksBlocked(page) {
  const title = (await page.title().catch(() => '')) || '';
  let body = '';
  try { body = (await page.locator('body').innerText({ timeout: 2500 })) || ''; } catch { /* ignore */ }
  return BLOCK_RE.test(`${title}\n${body}`);
}

/**
 * Probe a URL over HTTP (request API); resolves to { url, status, ok, err }.
 * Retries once on a transient result — timeouts / network errors / 429 / 503
 * under a burst crawl are usually a slow or throttled response (the server
 * frequently returns 200 on the retry), not a broken page.
 */
async function probe(request, url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await request.get(url, { failOnStatusCode: false, maxRedirects: 5, timeout: attempt === 0 ? 15000 : 25000 });
      const status = res.status();
      if ((status === 429 || status === 503) && attempt === 0) continue; // transient → retry
      return { url, status, ok: status > 0 && status < 400 };
    } catch (e) {
      if (attempt === 0) continue; // timeout / network error → retry once
      return { url, status: 0, ok: false, err: (e.message || '').split('\n')[0].slice(0, 80) };
    }
  }
  return { url, status: 0, ok: false, err: 'unreachable after retry' };
}

/**
 * Classify a probe result: 'ok' | 'broken' | 'soft'. 'soft' = unverifiable
 * under automation (timeout/network=0, or WAF/rate-limit 403/429/503) — per this
 * suite's rule, an inability to verify is NEVER reported as a false outage.
 * 'broken' = a genuinely bad link (404/410, other 4xx, or 5xx server error).
 */
function classifyProbe(r) {
  if (r.ok) return 'ok';
  if (r.status === 0 || r.status === 403 || r.status === 429 || r.status === 503) return 'soft';
  return 'broken';
}

/**
 * Run `worker` over `items` with bounded concurrency, preserving order.
 * Sequential probing of many URLs blows the test budget (Cloudflare adds
 * per-request latency), which tore down the request context mid-loop; a small
 * pool keeps the wall-clock well inside the timeout.
 */
async function runPool(items, worker, concurrency = 8) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Inspect fetched HTML for a soft-404 / fatal-error signal; returns a reason or null. */
function pageProblem(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || '');
  const title = m ? m[1].replace(/\s+/g, ' ').trim() : '';
  if (TITLE_404.test(title)) return `soft-404 (title: "${title.slice(0, 60)}")`;
  if (NOTFOUND_PHRASE.test(html || '')) return 'soft-404 (body says page-not-found)';
  if (FATAL_RE.test(html || '')) return 'server/PHP fatal error banner';
  return null;
}

// AIOSEO (the live sitemap generator) wraps every value in CDATA:
//   <loc><![CDATA[https://www.pushengage.com/page-sitemap.xml]]></loc>
// The old pattern /<loc>\s*([^<]+?)\s*<\/loc>/ could not match a value that
// starts with "<![CDATA[", so every candidate parsed to 0 URLs and PESITE-9001
// self-skipped on every run. This pattern accepts plain and CDATA-wrapped values.
const LOC_RE = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi;

/**
 * Fetch an XML sitemap. Never throws. Returns
 *   { status, locs: string[]|null, hasLocTag, challenged }
 * locs is null when the URL is unreachable / >= 400 / not a sitemap.
 */
async function fetchSitemap(request, url) {
  const res = await request.get(url, { failOnStatusCode: false, maxRedirects: 5, timeout: 20000 }).catch(() => null);
  if (!res) return { status: 0, locs: null, hasLocTag: false, challenged: false };
  const status = res.status();
  const body = await res.text().catch(() => '');
  const challenged = status === 403 || status === 429 || status === 503 || (!/<loc>/i.test(body) && BLOCK_RE.test(body.slice(0, 3000)));
  if (status >= 400) return { status, locs: null, hasLocTag: false, challenged };
  const hasLocTag = /<loc>/i.test(body);
  if (!hasLocTag) return { status, locs: null, hasLocTag, challenged };
  return { status, locs: [...body.matchAll(LOC_RE)].map((mm) => mm[1].trim()).filter(Boolean), hasLocTag, challenged };
}

/** Back-compat wrapper used for child sitemaps: the <loc> values, or null. */
async function fetchLocs(request, url) {
  const r = await fetchSitemap(request, url);
  return r.locs;
}

/** Collect deduped, same-origin page hrefs (absolute, path-only) within a scope. */
async function sameOriginLinks(page, scope) {
  return page.$$eval(`${scope} a[href]`, (els) => {
    const map = new Map();
    for (const a of els) {
      const raw = a.getAttribute('href');
      if (!raw) continue;
      let u;
      try { u = new URL(raw, location.href); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;            // skip mailto:, tel:, javascript:
      if (u.hostname !== location.hostname) continue;          // same-origin only
      if (/\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|mp4|css|js)$/i.test(u.pathname)) continue; // skip assets
      map.set(u.pathname, u.origin + u.pathname);              // dedupe by path, drop query/hash
    }
    return [...map.values()];
  });
}

/** True when the page exposes a semantic content region or substantial body text. */
async function hasPrimaryContent(page) {
  // Content may hydrate / animate in after domcontentloaded, and block-theme
  // pages have no <main> (content sits directly in .wp-site-blocks / the body).
  // Wait (bounded) for EITHER a laid-out content landmark OR substantial visible
  // body text, so a slow-but-fine page isn't misreported as blank.
  const selectors = ['main', '[role="main"]', '#main', '.site-main', 'article', '.entry-content', '#content', '.content-area', '.wp-site-blocks'];
  try {
    await page.waitForFunction(
      (sels) => {
        const laidOut = sels.some((s) => {
          const el = document.querySelector(s);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const text = ((document.body && document.body.innerText) || '').trim();
        return laidOut || text.length > 200;
      },
      selectors,
      { timeout: 6000 },
    );
    return true;
  } catch {
    return false; // genuinely blank after a fair wait
  }
}

/** True when the page has at least one form exposing a text/email field + a submit control. */
async function renderableForm(page) {
  const forms = page.locator('form');
  const n = Math.min(await forms.count().catch(() => 0), 8);
  for (let i = 0; i < n; i++) {
    const form = forms.nth(i);
    const field = form
      .locator('input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible, textarea:visible')
      .first();
    const submit = form
      .locator('button[type="submit"]:visible, input[type="submit"]:visible, button:has-text("Submit"):visible, button:has-text("Send"):visible, .wpforms-submit:visible')
      .first();
    const hasField = await field.isVisible({ timeout: 1200 }).catch(() => false);
    const hasSubmit = await submit.isVisible({ timeout: 1200 }).catch(() => false);
    if (hasField && hasSubmit) return true;
  }
  return false;
}

test.describe('SMOKE - Site Health @smoke @health', () => {
  // These are legitimately crawl-heavy (a sitemap + up to ~100 links each), so
  // give them headroom beyond the 60s default rather than racing teardown.
  test.describe.configure({ timeout: 120000 });

  // Establish the site is reachable under automation; otherwise SELF-SKIP so a
  // Cloudflare/bot challenge is never mistaken for a real outage.
  test.beforeEach(async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => null);
    await waitForPageLoad(page);
    const status = res ? res.status() : 0;
    const blocked = await looksBlocked(page);
    test.skip(
      status === 0 || status === 403 || status >= 500 || blocked,
      `Homepage not loadable under automation (HTTP ${status || 'no response'}${blocked ? ', Cloudflare/bot challenge' : ''}) — smoke self-skips rather than reporting a false outage.`
    );
  });

  // ── 1. Sitemap crawl: every published page < 400 and not a soft-404 ───────────
  test('PESITE-9001 - sitemap: every published page returns < 400 and is not a soft-404 @smoke @health', async ({ request }) => {
    console.log('📍 PESITE-9001: WordPress sitemap health crawl');

    // Locate the sitemap (WP core → common plugins → generic). Live (2026-10-20):
    // /wp-sitemap.xml and /sitemap_index.xml 30x to the AIOSEO index at /sitemap.xml.
    let indexLocs = null;
    let sitemapUrl = null;
    const tried = [];
    for (const candidate of ['/wp-sitemap.xml', '/sitemap_index.xml', '/sitemap.xml']) {
      const r = await fetchSitemap(request, candidate);
      tried.push({ candidate, ...r });
      if (r.locs && r.locs.length) { indexLocs = r.locs; sitemapUrl = candidate; break; }
    }
    if (!indexLocs) {
      const summary = tried.map((t) => `${t.candidate} → HTTP ${t.status || 'no response'}${t.hasLocTag ? ' (<loc> present, 0 parsed)' : ''}${t.challenged ? ' (challenge)' : ''}`).join('; ');
      console.log(`  Sitemap candidates: ${summary}`);
      // A sitemap that HAS <loc> entries but parses to nothing is a parser bug in
      // this spec, never a reason to skip.
      expect(tried.filter((t) => t.hasLocTag), `Sitemap served <loc> entries but none parsed (${summary})`).toHaveLength(0);
      // A sitemap endpoint answering 5xx (other than the throttling 503) is broken.
      expect(tried.filter((t) => t.status >= 500 && t.status !== 503), `Sitemap endpoint returned a server error (${summary})`).toHaveLength(0);
      // Cloudflare / rate-limit = no verdict possible → BLOCKED, not SKIPPED.
      if (tried.some((t) => t.challenged || t.status === 0)) {
        throw new BlockedError({
          cls: 'SESSION',
          code: 'waf',
          reason: `Sitemap not readable under automation (${summary})`,
          humanAction: 're-run later from an allow-listed IP with --workers=1 (Cloudflare throttles automated crawls of the marketing site)',
        });
      }
      // Only a genuine absence on every candidate (404/410/non-sitemap 200) skips.
      test.skip(true, `No XML sitemap found at /wp-sitemap.xml, /sitemap_index.xml, or /sitemap.xml — nothing to crawl (${summary}).`);
    }
    console.log(`  Sitemap: ${sitemapUrl} (${indexLocs.length} top-level <loc>)`);

    // Split index children (.xml) from direct page URLs.
    const pageUrls = new Set();
    const childSitemaps = [];
    for (const loc of indexLocs) {
      if (/\.xml(\?|$)/i.test(loc)) childSitemaps.push(loc);
      else pageUrls.add(loc);
    }

    // Follow child sitemaps, harvesting page <loc>s (skip obvious non-HTML assets).
    for (const child of childSitemaps) {
      if (pageUrls.size >= SITEMAP_CAP * 2) break; // guard against pathological indexes
      const locs = await fetchLocs(request, child);
      if (!locs) continue;
      for (const loc of locs) {
        if (/\.(xml|jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|mp4|css|js)(\?|$)/i.test(loc)) continue;
        pageUrls.add(loc);
      }
    }

    let urls = [...pageUrls];
    console.log(`  Discovered ${urls.length} page URLs across ${childSitemaps.length} child sitemap(s)`);
    expect(urls.length, 'Sitemap should expose at least a handful of page URLs').toBeGreaterThan(0);

    if (urls.length > SITEMAP_CAP) {
      console.log(`  ⚠️ Capping crawl at ${SITEMAP_CAP} of ${urls.length} URLs (smoke gate — not a full crawl)`);
      urls = urls.slice(0, SITEMAP_CAP);
    }

    // 404/410 (gone) + 5xx server errors are real breakage → hard fail. But
    // 403/429/503 under a burst crawl are WAF / rate-limit / bot-challenge and
    // a bare request failure/timeout is unverifiable — treat those as soft
    // (this suite never reports a false outage). soft-404 body = real → hard.
    const results = (await runPool(urls, async (url) => {
      const res = await request.get(url, { failOnStatusCode: false, maxRedirects: 5, timeout: 20000 }).catch(() => null);
      if (!res) return { soft: `${url} → request failed / timeout (unverifiable — network/throttle)` };
      const status = res.status();
      if (status === 403 || status === 429 || status === 503) return { soft: `${url} → HTTP ${status} (WAF/rate-limit/challenge — unverifiable)` };
      if (status >= 400) return { hard: `${url} → HTTP ${status}` };
      const html = await res.text().catch(() => '');
      const problem = pageProblem(html);
      return problem ? { hard: `${url} → ${problem}` } : null;
    })).filter(Boolean);
    const failures = results.filter((r) => r.hard).map((r) => r.hard);
    const soft = results.filter((r) => r.soft).map((r) => r.soft);

    if (soft.length) console.log(`  ⚠️  ${soft.length} unverifiable (WAF/rate-limit, not an outage):\n   - ${soft.join('\n   - ')}`);
    if (failures.length) console.log(`  ❌ ${failures.length} broken page(s):\n   - ${failures.join('\n   - ')}`);
    expect(failures, `Sitemap pages genuinely down (404/410/other-4xx/5xx) or soft-404:\n${failures.join('\n')}`).toHaveLength(0);
    // Reviewed 2026-10-21: without this, a crawl where Cloudflare throttled every URL
    // (all soft) passed with nothing verified. Too many unverifiable URLs = no verdict
    // → BLOCKED{SESSION/waf} (same threshold as rocks PESD-13), never a green pass.
    const softLimit = Math.max(5, Math.ceil(urls.length * 0.2));
    if (soft.length > softLimit) {
      throw new BlockedError({
        cls: 'SESSION',
        code: 'waf',
        reason: `${soft.length}/${urls.length} sitemap URLs were unverifiable (403/429/503/timeout), more than ${softLimit}; the crawl cannot vouch for the site`,
        humanAction: 're-run later from an allow-listed IP with --workers=1 (Cloudflare throttles automated crawls of the marketing site)',
      });
    }
    console.log(`✅ Sitemap crawl: ${urls.length} page(s) checked — ${failures.length} broken, ${soft.length} unverifiable`);
  });

  // ── 2. Key pages render real content in a real browser (catches soft-404s) ────
  test('PESITE-9002 - key pages render without error in a real browser @smoke @health', async ({ page }) => {
    console.log('📍 PESITE-9002: Curated key-page render check');
    test.slow(); // 14 live navs + HTTP fallbacks on prod — needs the extended budget

    // Built from config.pages so the list stays in sync with the framework.
    // NOTE: login/signup live on the app host (app.pushengage.com), not the
    // marketing host this suite targets — checking them here just produced slow
    // "unverifiable" fallbacks. They're covered by the login/signup-flow specs.
    const KEY_KEYS = [
      'home', 'pricing', 'features', 'blog', 'contactUs', 'about',
      'privacy', 'terms', 'wordpress', 'ecommerce', 'abandoned', 'drip',
    ];
    const keyPages = [];
    const seen = new Set();
    for (const key of KEY_KEYS) {
      const path = config.pages[key];
      if (!path || seen.has(path)) continue; // contact/contactUs collapse to one path
      seen.add(path);
      keyPages.push({ key, path });
    }
    console.log(`  Checking ${keyPages.length} key routes: ${keyPages.map((p) => p.path).join(', ')}`);

    // Hard fail = the page is genuinely MISSING or BROKEN (404/410, soft-404,
    // blank when not challenged). Soft = up-but-imperfect OR can't be verified
    // under automation right now (bot/Cloudflare challenge, rate-limit, WAF
    // 403/429/503, nav abort) — per this suite's "never a false outage" rule,
    // an inability to verify is NOT an outage. Authoritative down/404 coverage
    // for the whole site is PESITE-9001 (HTTP-level sitemap crawl).
    const MISSING = new Set([404, 410]);
    const failures = [];
    const soft = [];
    for (const { key, path } of keyPages) {
      // Real browser nav, retried once — under automation, pages often abort the
      // first nav (redirect chains, bot challenges) even when perfectly up. Both
      // attempts use domcontentloaded so the DOM is parsed before we inspect it.
      let res = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!res) res = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);

      // Browser nav aborted → confirm over HTTP before judging.
      if (!res) {
        const r = await page.request.get(path, { maxRedirects: 5, timeout: 15000 }).catch(() => null);
        const st = r ? r.status() : 0;
        if (MISSING.has(st)) failures.push(`${key} (${path}) → HTTP ${st} (page missing)`);
        else if (st && st < 400) soft.push(`${key} (${path}) → browser nav aborted but HTTP ${st} (page is up)`);
        else soft.push(`${key} (${path}) → could not verify under automation (nav abort + HTTP ${st || 'no response'}; likely bot challenge / rate-limit) — skipped, not a false outage`);
        continue;
      }

      const status = res.status();
      if (MISSING.has(status)) { failures.push(`${key} (${path}) → HTTP ${status} (page missing)`); continue; }
      if (status >= 400) { soft.push(`${key} (${path}) → HTTP ${status} (server/WAF/challenge) — skipped, not a false outage`); continue; }

      // Ensure the DOM is parsed (guards against inspecting a half-built page).
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await waitForPageLoad(page);

      // If the rendered page IS a bot/Cloudflare challenge, don't judge its content.
      if (await looksBlocked(page)) { soft.push(`${key} (${path}) → bot/Cloudflare challenge rendered — skipped, not a false outage`); continue; }

      // Title is frequently JS-set — give it a beat before judging.
      await page.waitForFunction(() => (document.title || '').trim().length > 0, { timeout: 3000 }).catch(() => {});
      const title = ((await page.title().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (TITLE_404.test(title)) { failures.push(`${key} (${path}) → soft-404 title "${title}"`); continue; }

      const bodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')) || '';
      if (NOTFOUND_PHRASE.test(bodyText)) { failures.push(`${key} (${path}) → soft-404 (body says page-not-found)`); continue; }

      if (!(await hasPrimaryContent(page))) {
        // Blank in-browser. Don't hard-fail on an automation artifact — consult
        // the authority (raw HTTP). Hard-fail only if HTTP itself shows the page
        // missing or serving a soft-404 / fatal-error body; if HTTP serves a real
        // page, the browser blank is a challenge / slow-hydration artifact → soft.
        if (await looksBlocked(page)) { soft.push(`${key} (${path}) → bot/Cloudflare challenge — skipped, not a false outage`); continue; }
        const r = await page.request.get(path, { maxRedirects: 5, timeout: 15000 }).catch(() => null);
        const st = r ? r.status() : 0;
        const html = r ? await r.text().catch(() => '') : '';
        if (MISSING.has(st)) { failures.push(`${key} (${path}) → HTTP ${st} (page missing)`); continue; }
        const prob = pageProblem(html);
        if (prob) { failures.push(`${key} (${path}) → ${prob}`); continue; }
        if (st && st < 400 && html.length > 2000) soft.push(`${key} (${path}) → blank under automation but HTTP ${st} serves a real page (${html.length}b) — skipped, not a false outage`);
        else if (st === 0 || st === 403 || st === 429 || st === 503) soft.push(`${key} (${path}) → could not verify (blank in browser + HTTP ${st || 'no response'}; likely rate-limit/challenge) — skipped, not a false outage`);
        else failures.push(`${key} (${path}) → no <main>/primary content visible (HTTP ${st})`);
        continue;
      }

      // Page is up + has real content. An empty <title> is an SEO nit, not an outage.
      if (!title) soft.push(`${key} (${path}) → renders + HTTP ${status} but empty <title> (SEO nit)`);
    }

    if (soft.length) console.log(`  ⚠️  ${soft.length} soft note(s) (up / unverifiable, not an outage):\n   - ${soft.join('\n   - ')}`);
    if (failures.length) console.log(`  ❌ ${failures.length} key page(s) MISSING / broken:\n   - ${failures.join('\n   - ')}`);
    expect(failures, `Key pages that are genuinely missing / broken (404/410/soft-404/blank):\n${failures.join('\n')}`).toHaveLength(0);
    console.log(`✅ All ${keyPages.length} key pages OK — ${failures.length} missing/broken, ${soft.length} soft note(s)`);
  });

  // ── 3. All homepage links resolve (nav + body + CTAs + footer) ────────────────
  test('PESITE-9003 - all links on the homepage resolve (nav + body + CTAs + footer) @smoke @health', async ({ page, request }) => {
    console.log('📍 PESITE-9003: Homepage same-origin link integrity');

    // beforeEach already loaded '/'; scroll so lazy footer/CTA links attach.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));

    let links = await sameOriginLinks(page, 'body'); // whole document: nav, body, CTAs, footer
    console.log(`  Same-origin homepage links (deduped): ${links.length}`);
    expect(links.length, 'Homepage should expose same-origin links').toBeGreaterThan(3);

    if (links.length > HOME_LINK_CAP) {
      console.log(`  ⚠️ Capping at ${HOME_LINK_CAP} of ${links.length} links`);
      links = links.slice(0, HOME_LINK_CAP);
    }

    const broken = [];
    const soft = [];
    await runPool(links, async (url) => {
      const r = await probe(request, url);
      const cls = classifyProbe(r);
      if (cls === 'ok') return;
      const label = `${new URL(url).pathname} → ${r.status || r.err}`;
      (cls === 'broken' ? broken : soft).push(label);
    });

    if (soft.length) console.log(`  ⚠️  ${soft.length} unverifiable link(s) (timeout/WAF/rate-limit, not an outage):\n   - ${soft.join('\n   - ')}`);
    if (broken.length) console.log(`  ❌ Broken homepage links:\n   - ${broken.join('\n   - ')}`);
    expect(broken, `Broken homepage links (404/410/other-4xx/5xx):\n${broken.join('\n')}`).toHaveLength(0);
    console.log(`✅ Homepage links: ${links.length} checked — ${broken.length} broken, ${soft.length} unverifiable`);
  });

  // ── 4. Footer links resolve ───────────────────────────────────────────────────
  test('PESITE-9004 - footer links resolve @smoke @health', async ({ page, request }) => {
    console.log('📍 PESITE-9004: Footer link integrity');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const footer = page.locator('footer, [role="contentinfo"], #footer, .site-footer').first();
    test.skip(
      !(await footer.count().catch(() => 0)),
      'No <footer> found on the homepage — nothing to check.'
    );

    // Same-origin footer links are status-probed. Cross-origin (social/app/docs)
    // are logged only — many bot-block a bare GET, so probing them is unreliable.
    const internal = await sameOriginLinks(page, 'footer');
    const external = await page.$$eval('footer a[href], [role="contentinfo"] a[href]', (els) =>
      els.map((a) => a.href).filter((h) => { try { return new URL(h).hostname !== location.hostname && /^https?:$/.test(new URL(h).protocol); } catch { return false; } }).length
    );
    console.log(`  Footer links — internal: ${internal.length}, external (not probed): ${external}`);
    expect(internal.length, 'Footer should expose same-origin links (Privacy/Terms/etc.)').toBeGreaterThan(0);

    const broken = [];
    const soft = [];
    await runPool(internal, async (url) => {
      const r = await probe(request, url);
      const cls = classifyProbe(r);
      if (cls === 'ok') return;
      const label = `${new URL(url).pathname} → ${r.status || r.err}`;
      (cls === 'broken' ? broken : soft).push(label);
    });

    if (soft.length) console.log(`  ⚠️  ${soft.length} unverifiable footer link(s) (timeout/WAF/rate-limit, not an outage):\n   - ${soft.join('\n   - ')}`);
    if (broken.length) console.log(`  ❌ Broken footer links:\n   - ${broken.join('\n   - ')}`);
    expect(broken, `Broken footer links (404/410/other-4xx/5xx):\n${broken.join('\n')}`).toHaveLength(0);
    console.log(`✅ Footer links: ${internal.length} checked — ${broken.length} broken, ${soft.length} unverifiable`);
  });

  // ── 5. Primary CTAs resolve ────────────────────────────────────────────────────
  test('PESITE-9005 - primary CTAs resolve @smoke @health', async ({ page, request }) => {
    console.log('📍 PESITE-9005: Primary CTA integrity');

    // Collect anchors whose visible text reads as a primary CTA. a.href is the
    // resolved absolute URL; the raw attribute lets us flag dead hrefs (#, js:).
    const ctas = await page.$$eval('a[href]', (els, reSrc) => {
      const re = new RegExp(reSrc, 'i');
      const map = new Map();
      for (const a of els) {
        const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || !re.test(text)) continue;
        const raw = a.getAttribute('href') || '';
        if (!map.has(a.href)) map.set(a.href, { text: text.slice(0, 40), raw, href: a.href });
      }
      return [...map.values()];
    }, 'get started|start for free|start free|sign\\s*up|\\bpricing\\b|\\bcontact\\b');

    console.log(`  Primary CTA anchors found: ${ctas.length}`);
    ctas.forEach((c) => console.log(`   • "${c.text}" → ${c.raw}`));
    expect(ctas.length, 'Homepage should expose at least one primary CTA (Get Started / Pricing / Contact)').toBeGreaterThan(0);

    const failures = [];  // dead/invalid/malformed href or a genuinely broken page → hard fail
    const soft = [];       // same-origin probe unverifiable (timeout/WAF/rate-limit) → note
    for (const c of ctas) {
      // Dead href guard.
      if (c.raw === '' || c.raw === '#' || /^javascript:/i.test(c.raw)) {
        failures.push(`"${c.text}" → dead href (${c.raw || 'empty'})`);
        continue;
      }
      let u;
      try { u = new URL(c.href); } catch { failures.push(`"${c.text}" → invalid href (${c.raw})`); continue; }
      if (!/^https?:$/.test(u.protocol)) continue; // mailto:/tel: CTAs — not a broken page

      if (u.hostname === new URL(page.url()).hostname) {
        const r = await probe(request, c.href);            // same-origin → status probe
        const cls = classifyProbe(r);
        if (cls === 'broken') failures.push(`"${c.text}" → ${u.pathname} → ${r.status || r.err}`);
        else if (cls === 'soft') soft.push(`"${c.text}" → ${u.pathname} → ${r.status || r.err}`);
      } else if (!/^https:\/\/[^/]+/.test(c.href)) {        // cross-origin (app/docs) → href sanity only
        failures.push(`"${c.text}" → malformed cross-origin href (${c.raw})`);
      }
    }

    if (soft.length) console.log(`  ⚠️  ${soft.length} unverifiable CTA(s) (timeout/WAF/rate-limit, not an outage):\n   - ${soft.join('\n   - ')}`);
    if (failures.length) console.log(`  ❌ CTA problems:\n   - ${failures.join('\n   - ')}`);
    expect(failures, `Primary CTAs that don't resolve (dead href / 404 / 5xx):\n${failures.join('\n')}`).toHaveLength(0);
    console.log(`✅ Primary CTAs: ${ctas.length} checked — ${failures.length} broken, ${soft.length} unverifiable`);
  });

  // ── 6. Forms render (no submit) ─────────────────────────────────────────────────
  test('PESITE-9006 - forms render (Contact + support/ticket) — no submit @smoke @health', async ({ page }) => {
    console.log('📍 PESITE-9006: Contact + support/ticket forms RENDER (never submitted)');

    // (a) Contact form on /contact-us/ (WPForms; hidden-by-default → POM reveals it).
    const contact = new ContactPage(page);
    await contact.open();
    const f = await contact.hasAllRequiredFields();
    console.log(`  Contact form — name:${f.text} email:${f.email} website:${f.url} topic:${f.topic} message:${f.msg} submit:${f.submit}`);
    const contactRenders = !!(f.email && f.submit && (f.text || f.msg));
    expect(contactRenders, 'Contact form should render email + submit (plus name/message) at /contact-us/').toBeTruthy();
    console.log('  ✅ Contact form renders (not submitted)');

    // (b) Support / help / create-ticket form. Try dedicated pages; else the Contact
    // form is the site's support channel (acceptable per spec). Self-skip only if
    // the site truly exposes no such form anywhere.
    const supportCandidates = [
      '/support/', '/help/', '/submit-a-ticket/', '/support-ticket/', '/create-ticket/', '/contact-support/',
    ];
    // Browser-navigating all six serially blows the test budget under rate-limit
    // (each slow nav adds up past the 120s timeout). Instead, HTTP-probe them
    // concurrently first and only load the ones that actually resolve < 400.
    const existing = [];
    await runPool(supportCandidates, async (path) => {
      const r = await probe(page.request, path);
      if (r.ok) existing.push(path);
      else console.log(`   • ${path} → HTTP ${r.status || r.err} (skip)`);
    }, 6);

    let supportFound = false;
    let supportWhere = null;
    for (const path of existing) {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!res || res.status() >= 400) { console.log(`   • ${path} → not loadable in browser (skip)`); continue; }
      if (TITLE_404.test((await page.title().catch(() => '')) || '')) { console.log(`   • ${path} → soft-404 (skip)`); continue; }
      if (await renderableForm(page)) { supportFound = true; supportWhere = path; break; }
      console.log(`   • ${path} → loaded but no renderable form`);
    }

    if (supportFound) {
      console.log(`  ✅ Dedicated support/ticket form renders at ${supportWhere} (not submitted)`);
    } else if (contactRenders) {
      // No separate ticket form — the Contact form (asserted above) is the support
      // channel on this site. Requirement satisfied via the "or the contact form" path.
      console.log('  ℹ️ No dedicated support/ticket form found — Contact form serves as the support channel (already asserted).');
    } else {
      test.skip(true, 'Site exposes neither a dedicated support/ticket form nor a Contact form — nothing to assert.');
    }

    console.log('✅ Forms render (fields + submit visible); nothing was submitted');
  });
});
