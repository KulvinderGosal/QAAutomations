/**
 * Group M — Backend API contracts (direct calls)
 * Plan cases M1–M13. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * DIRECT API SPEC — these hit the Adonis backend straight through Playwright's
 * `request` fixture (APIRequestContext); there is no browser here. They are the
 * automated form of the "curl / Postman with an admin dashboard token" cases.
 *
 * Conventions (mirrors web-track/01-web-install.spec.js):
 *   - one test per plan case; the case id + priority live in the title so you
 *     can `--grep @P0` / `--grep M5`; traceability back to cases.json.
 *   - a describe-level test.skip() guards the whole group when the backend URL
 *     or the admin token is not configured (so a partial .env still runs).
 *   - individual cases test.skip() when the site fixture they need is empty.
 *
 * API reference (from each case's `expected` in cases.json):
 *   - validation failures are 400 `Invalid request data.` (NOT 422).
 *   - a `fallback:true` response is HTTP 200 with usable content — model
 *     failure, the busy lock and the hourly/daily cap all return 200.
 *
 * Extra env var (optional, not yet in onboarding-config): PE_SUBUSER_TOKEN —
 * a NON-admin sub-user's dashboard bearer token, needed for M8. Skips when unset.
 *
 * The onboarding-ai routes are the ONLY backend paths the plan pins down, so
 * only group M could be automated as live calls; groups N and O are manual.
 */
const { test, expect, request } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');

const SITE = cfg.sites.site1;
const SUBUSER_TOKEN = process.env.PE_SUBUSER_TOKEN || '';

/** Path (relative to backendUrl) for an onboarding-ai endpoint on a given site. */
function aiPath(siteId, endpoint) {
  return `${cfg.onboardingAiPath(siteId)}/${endpoint}`;
}

/** Bare host of the registered site (no scheme, no path, no trailing slash). */
function siteHost() {
  return (SITE.url || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

/** Parse a JSON body defensively (some error bodies may not be JSON). */
async function body(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

const HEX = /^#?[0-9a-fA-F]{3,8}$/;

test.describe('M · Backend API contracts (direct calls)', () => {
  test.skip(!cfg.backendUrl || !cfg.adminToken, 'PE_BACKEND_URL / PE_ADMIN_TOKEN not configured');

  let api;

  test.beforeAll(async () => {
    api = await request.newContext({
      baseURL: cfg.backendUrl,
      extraHTTPHeaders: {
        Authorization: `Bearer ${cfg.adminToken}`,
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    if (api) await api.dispose();
  });

  test('M1 @P0 site-analysis happy path and refresh', async () => {
    test.skip(!SITE.id || !SITE.url, 'Site 1 id/url not configured');

    const res = await api.post(aiPath(SITE.id, 'site-analysis'), { data: { url: SITE.url } });
    expect(res.status()).toBe(200);
    const b = await body(res);
    expect(b).toBeTruthy();
    // Contract keys from the plan's API reference.
    expect(b).toHaveProperty('checks');
    expect(b).toHaveProperty('platform');
    expect(b.platform).toHaveProperty('name');
    expect(b.platform).toHaveProperty('confidence');
    expect(Array.isArray(b.palette)).toBeTruthy();
    expect(b.palette.length).toBeLessThanOrEqual(5);
    b.palette.forEach((c) => expect(String(c)).toMatch(HEX));
    expect(b).toHaveProperty('signals');
    expect(b).toHaveProperty('popup_copy');
    expect(b).toHaveProperty('suggested_colors');
    expect(typeof b.fallback).toBe('boolean');

    // Second call is a fast cache hit with the same body.
    const res2 = await api.post(aiPath(SITE.id, 'site-analysis'), { data: { url: SITE.url } });
    expect(res2.status()).toBe(200);
    expect(await body(res2)).toEqual(b);

    // refresh:true re-inspects (still 200 + boolean fallback).
    const res3 = await api.post(aiPath(SITE.id, 'site-analysis'), { data: { url: SITE.url, refresh: true } });
    expect(res3.status()).toBe(200);
    const b3 = await body(res3);
    expect(typeof b3.fallback).toBe('boolean');
    // Site 1 is installed correctly.
    if (b3.sdk_status !== undefined) expect(b3.sdk_status).toBe('installed');
  });

  test('M2 @P0 site-analysis domain binding', async () => {
    test.skip(!SITE.id || !SITE.url, 'Site 1 id/url not configured');
    const host = siteHost();

    const offDomain = [
      'https://example.com',
      'http://localhost',
      'http://127.0.0.1',
      'http://intranet',
      'http://169.254.169.254',
      `http://${host}.`, // trailing-dot variant of the registered host
    ];
    for (const url of offDomain) {
      const res = await api.post(aiPath(SITE.id, 'site-analysis'), { data: { url } });
      expect(res.status(), `off-domain/internal URL should be 400: ${url}`).toBe(400);
      const b = await body(res);
      if (b) {
        const msg = JSON.stringify(b);
        expect(msg).toMatch(/URL must belong to your registered site domain/i);
      }
    }

    // A www. variant of the registered host is accepted.
    const wwwHost = host.startsWith('www.') ? host : `www.${host}`;
    const wwwRes = await api.post(aiPath(SITE.id, 'site-analysis'), { data: { url: `https://${wwwHost}` } });
    expect(wwwRes.status(), 'www. variant of the registered host should be accepted').toBe(200);
  });

  test('M3 @P1 validation shapes', async () => {
    test.skip(!SITE.id, 'Site 1 id not configured');

    // No `url` → 400 Invalid request data.
    const noUrl = await api.post(aiPath(SITE.id, 'site-analysis'), { data: {} });
    expect(noUrl.status()).toBe(400);
    const b1 = await body(noUrl);
    if (b1) expect(JSON.stringify(b1)).toMatch(/Invalid request data/i);

    // Content-Type: text/plain → 400 unparsable JSON.
    const badCt = await api.post(aiPath(SITE.id, 'site-analysis'), {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not-json',
    });
    expect(badCt.status()).toBe(400);
    const b2 = await body(badCt);
    if (b2) expect(JSON.stringify(b2)).toMatch(/JSON\.parse|parsable by JSON/i);

    // :siteId = "abc" → 404 route-param type error.
    const badParam = await api.post(aiPath('abc', 'site-analysis'), { data: { url: SITE.url || 'https://example.com' } });
    expect(badParam.status()).toBe(404);
  });

  test('M4 @P1 popup-copy contract', async () => {
    test.skip(!SITE.id, 'Site 1 id not configured');
    const path = aiPath(SITE.id, 'popup-copy');

    // Valid directions + current_copy → 200 popup_copy + fallback.
    const ok = await api.post(path, {
      data: { directions: ['urgent', 'concise'], current_copy: { message: 'Subscribe for updates' } },
    });
    expect(ok.status()).toBe(200);
    const okB = await body(ok);
    expect(okB).toHaveProperty('popup_copy');
    expect(typeof okB.fallback).toBe('boolean');

    // 7 directions → 400.
    const seven = await api.post(path, {
      data: { directions: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], current_copy: { message: 'x' } },
    });
    expect(seven.status()).toBe(400);

    // Unknown direction "loud" → 400.
    const loud = await api.post(path, { data: { directions: ['loud'], current_copy: { message: 'x' } } });
    expect(loud.status()).toBe(400);

    // 151-char message → 400.
    const long = await api.post(path, {
      data: { directions: ['urgent'], current_copy: { message: 'x'.repeat(151) } },
    });
    expect(long.status()).toBe(400);

    // Without current_copy → 400.
    const noCopy = await api.post(path, { data: { directions: ['urgent'] } });
    expect(noCopy.status()).toBe(400);

    // Legacy headline + body → 200, folded into one message ≤150.
    const legacy = await api.post(path, {
      data: { directions: ['urgent'], current_copy: { headline: 'Big news', body: 'Subscribe now for offers' } },
    });
    expect(legacy.status()).toBe(200);
    const legacyB = await body(legacy);
    expect(legacyB).toHaveProperty('popup_copy');
    if (legacyB.popup_copy && typeof legacyB.popup_copy.message === 'string') {
      expect(legacyB.popup_copy.message.length).toBeLessThanOrEqual(150);
    }
  });

  test('M5 @P1 recommendations contract per track', async () => {
    test.skip(!SITE.id, 'Site 1 id not configured');
    const path = aiPath(SITE.id, 'recommendations');

    for (const track of ['web', 'app']) {
      const res = await api.get(`${path}?track=${track}`);
      expect(res.status(), `${track} recommendations should be 200`).toBe(200);
      const b = await body(res);
      expect(b).toHaveProperty('locked_counts');
      expect(typeof b.fallback).toBe('boolean');
      // segments / groups / workflows arrays with the item contract.
      const buckets = ['segments', 'groups', 'workflows'].filter((k) => Array.isArray(b[k]));
      expect(buckets.length, 'expected at least one recommendation array').toBeGreaterThan(0);
      buckets.forEach((k) => {
        (b[k] || []).forEach((item) => {
          expect(item).toHaveProperty('payload');
          expect(item).toHaveProperty('allowed_plan_types');
          expect(item).toHaveProperty('source');
          expect(['ai', 'catalog']).toContain(item.source);
        });
      });
    }

    // chat track shape.
    const chat = await api.get(`${path}?track=chat`);
    expect(chat.status()).toBe(200);
    const c = await body(chat);
    expect(c).toHaveProperty('greeting');
    expect(c).toHaveProperty('subheading');
    expect(c).toHaveProperty('channel_prefills');
    expect(Array.isArray(c.suggested_pages)).toBeTruthy();
    expect(c.suggested_pages.length).toBeLessThanOrEqual(6);
    expect(Array.isArray(c.suggested_channels)).toBeTruthy();
    expect(c.suggested_channels.length).toBeLessThanOrEqual(8);
    const enabled = c.suggested_channels.filter((ch) => ch && ch.enabled);
    expect(enabled.length).toBeLessThanOrEqual(4);

    // Unknown track → 400.
    const bad = await api.get(`${path}?track=x`);
    expect(bad.status()).toBe(400);
  });

  test('M6 @P1 adjust-workflow contract and plan gate', async () => {
    test.skip(!SITE.id, 'Site 1 id not configured');
    const path = aiPath(SITE.id, 'adjust-workflow');

    // Missing prompt → 400 Invalid request data. (deterministic validation).
    const noPrompt = await api.post(path, { data: { workflow: {} } });
    expect(noPrompt.status()).toBe(400);
    const npB = await body(noPrompt);
    if (npB) expect(JSON.stringify(npB)).toMatch(/Invalid request data/i);

    // Happy path: reuse a real catalog workflow payload from recommendations so
    // we never invent the workflow shape.
    const rec = await api.get(`${aiPath(SITE.id, 'recommendations')}?track=web`);
    const recB = await body(rec);
    const wf = recB && Array.isArray(recB.workflows) ? recB.workflows.find((w) => w && w.payload) : null;
    test.skip(!wf, 'No catalog workflow payload available from recommendations to adjust');

    const res = await api.post(path, { data: { workflow: wf.payload, prompt: 'make it shorter' } });
    expect(res.status()).toBe(200);
    const b = await body(res);
    expect(b).toHaveProperty('workflow');
    expect(b).toHaveProperty('note');
    expect(b).toHaveProperty('allowed_plan_types');
    expect(typeof b.fallback).toBe('boolean');

    // NOTE: the Free + "add an A/B test" sub-case (→ 200, original workflow,
    // fallback:true, note "This tweak adds A/B split testing…") needs the FREE
    // owner's token (account A). Re-run with PE_ADMIN_TOKEN pointed at account A.
  });

  test('M7 @P1 app-analysis contract', async () => {
    test.skip(!SITE.id, 'Site 1 id not configured');
    const path = aiPath(SITE.id, 'app-analysis');

    // Empty body → 200 fallback:true, store.found:false.
    const empty = await api.post(path, { data: {} });
    expect(empty.status()).toBe(200);
    const eB = await body(empty);
    expect(eB.fallback).toBe(true);
    if (eB.store) expect(eB.store.found).toBe(false);

    // Invalid platform → 400.
    const badPlatform = await api.post(path, { data: { platform: 'windows' } });
    expect(badPlatform.status()).toBe(400);

    // Oversized store_url (301 chars) → 400.
    const bigUrl = await api.post(path, { data: { store_url: `https://example.com/${'a'.repeat(301)}` } });
    expect(bigUrl.status()).toBe(400);

    // Play package → 200, found:true, source: play.
    if (cfg.mobile.playPackage) {
      const play = await api.post(path, { data: { app_name: 'WhatsApp', store_url: cfg.mobile.playPackage } });
      expect(play.status()).toBe(200);
      const pB = await body(play);
      if (pB.store) {
        expect(pB.store.found).toBe(true);
        expect(pB.store.source).toBe('play');
      }
    }

    // Apple App Store URL with /id… → source: itunes.
    if (cfg.mobile.appStoreUrl && /\/id\d+/.test(cfg.mobile.appStoreUrl)) {
      const itunes = await api.post(path, { data: { store_url: cfg.mobile.appStoreUrl } });
      expect(itunes.status()).toBe(200);
      const iB = await body(itunes);
      if (iB.store && iB.store.found) expect(iB.store.source).toBe('itunes');
    }
  });

  test('M8 @P0 admin-only and verified-only', async () => {
    test.skip(!SITE.id, 'Site 1 id not configured');
    test.skip(!SUBUSER_TOKEN, 'PE_SUBUSER_TOKEN (non-admin sub-user) not configured');

    const sub = await request.newContext({
      baseURL: cfg.backendUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${SUBUSER_TOKEN}`, 'Content-Type': 'application/json' },
    });
    try {
      const calls = [
        () => sub.post(aiPath(SITE.id, 'site-analysis'), { data: { url: SITE.url || 'https://example.com' } }),
        () => sub.post(aiPath(SITE.id, 'app-analysis'), { data: {} }),
        () => sub.post(aiPath(SITE.id, 'popup-copy'), { data: { directions: ['urgent'], current_copy: { message: 'x' } } }),
        () => sub.get(`${aiPath(SITE.id, 'recommendations')}?track=web`),
        () => sub.post(aiPath(SITE.id, 'adjust-workflow'), { data: { workflow: {}, prompt: 'make it shorter' } }),
      ];
      for (const call of calls) {
        const res = await call();
        expect(res.status(), 'sub-user must be forbidden on every onboarding-ai route').toBe(403);
        const b = await body(res);
        if (b) expect(JSON.stringify(b)).toMatch(/don't have permission|contact your account administrator/i);
      }
    } finally {
      await sub.dispose();
    }

    // NOTE: the "unverified admin → 403 Email is not verified…" sub-case needs an
    // unverified admin token (no env var yet). Add one and assert the same way.
  });

  test('M9 @P1 hourly and daily caps return 200 + fallback', async () => {
    test.slow();
    // Stateful and time-boxed: the hourly cap is per-site (20/h) and per-owner
    // (50/24h Free, 150 otherwise) in Redis, and cannot be made deterministic
    // from a spec without first clearing those keys. Preserved as a manual run.
    test.fixme(
      true,
      [
        'MANUAL (needs a clean Redis attempt window):',
        '1. On one site POST onboarding-ai/popup-copy 21 times within an hour.',
        '   Calls 1-20 may be fallback:false; call 21 MUST be HTTP 200 with',
        '   fallback:true and the current copy echoed.',
        '2. POST site-analysis {refresh:true} 11 times → the 11th serves the cached analysis.',
        '3. Confirm via Redis keys `onboarding_ai_attempt_site` and',
        '   `onboarding_ai_attempt_owner` (owner counter increments across sites;',
        '   Free cap 50/24h, others 150) and the log line',
        '   "OnboardingAi: attempt cap reached, serving the fallback".',
        '4. With Redis stopped, calls still succeed (fail-open).',
      ].join('\n')
    );

    // Reference implementation of the loop (runs only if the fixme is lifted):
    const path = aiPath(SITE.id, 'popup-copy');
    let last;
    for (let i = 1; i <= 21; i++) {
      last = await api.post(path, { data: { directions: ['urgent'], current_copy: { message: 'Subscribe' } } });
      expect(last.status()).toBe(200);
    }
    const b = await body(last);
    expect(b.fallback).toBe(true);
  });

  test('M10 @P1 cache keys', async () => {
    test.skip(!SITE.id || !SITE.url, 'Site 1 id/url not configured');
    const path = aiPath(SITE.id, 'site-analysis');

    // A utm variant is a cache hit (analysis is keyed on origin, not query).
    const plain = await api.post(path, { data: { url: SITE.url } });
    expect(plain.status()).toBe(200);
    const plainB = await body(plain);

    const sep = SITE.url.includes('?') ? '&' : '?';
    const utm = await api.post(path, { data: { url: `${SITE.url}${sep}utm_source=x` } });
    expect(utm.status()).toBe(200);
    expect(await body(utm)).toEqual(plainB);

    // NOTE: "web recommendations differ per plan type (separate cache entries)"
    // needs both account A (free) and account B (paid) tokens; re-run with each
    // as PE_ADMIN_TOKEN and diff the two web recommendation bodies.
  });

  test('M11 @P1 lock contention across tracks', async () => {
    test.skip(!SITE.id, 'Site 1 id not configured');
    const path = aiPath(SITE.id, 'recommendations');

    // Fire web + app for one site at the same instant; both must 200 (one may
    // wait ~12 s then return the static catalog with fallback:true — never errors).
    const [web, app] = await Promise.all([
      api.get(`${path}?track=web`),
      api.get(`${path}?track=app`),
    ]);
    expect(web.status()).toBe(200);
    expect(app.status()).toBe(200);
    const wb = await body(web);
    const ab = await body(app);
    expect(typeof wb.fallback).toBe('boolean');
    expect(typeof ab.fallback).toBe('boolean');
  });

  test('M12 @P2 redirect and size guards', async () => {
    // Needs purpose-built fixtures the API context cannot synthesize: a site
    // whose URL 302s to another domain, and a homepage over 3 MB.
    test.fixme(
      true,
      [
        'MANUAL (needs special site fixtures):',
        '1. Point a test site at a URL that 302s to another domain; POST',
        '   onboarding-ai/site-analysis → reported unreachable / fallback',
        '   (the redirect is NOT followed), no 500.',
        '2. Serve a >3 MB homepage and POST site-analysis → fallback rather than',
        '   a hang or 500.',
      ].join('\n')
    );
  });

  test('M13 @P1 adjust-workflow note is rendered as text', async () => {
    // This asserts on FRONTEND rendering (the Automations step must show literal
    // <b> tags, never bold text). It cannot be proven from a direct API call —
    // the backend may legitimately return a note containing markup.
    test.fixme(
      true,
      [
        'MANUAL / FRONTEND (no HTML injection):',
        '1. Stub or observe an adjust-workflow `note` containing `<b>bold</b>`.',
        '2. On the Automations step the note must display the literal tags, never',
        '   rendered bold text.',
      ].join('\n')
    );
  });
});
