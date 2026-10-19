// QA: Internal dashboard refresh tokens (silent login renewal)
// Asana: https://app.asana.com/1/14748072439266/project/1218533145991058/task/1219546918194690
//
// Env: ADMIN_EMAIL, ADMIN_PASSWORD (required)
//      INTERNAL_DASHBOARD_URL (default staging), MAIN_DASHBOARD_URL (default staging app dashboard)
//      MFA_ADMIN_EMAIL, MFA_ADMIN_PASSWORD, MFA_ADMIN_SECRET (base32) - MFA cases
//      INACTIVE_ADMIN_EMAIL, INACTIVE_ADMIN_PASSWORD - inactive admin case
//      RUN_SLOW=1 - cases that wait out the real token lifetime (on by default when TTL <= 2 min)
//
// Fast cases move the browser clock forward to reach "token about to expire" without waiting; the
// API clock is untouched, so they exercise the dashboard's proactive refresh. The slow cases wait the
// real lifetime so the API itself rejects the token (reactive refresh).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.skip(!h.ADMIN.email || !h.ADMIN.password, 'Set ADMIN_EMAIL and ADMIN_PASSWORD');

const slowEnabled = (ttlSec) => process.env.RUN_SLOW === '1' || (process.env.RUN_SLOW !== '0' && ttlSec <= 120);

/** Jump the browser clock so the stored access token is inside the refresh margin */
async function expireTokenInBrowser(page) {
  const stored = await h.getStoredToken(page);

  await page.clock.setSystemTime(new Date(stored.expiresAt - h.EXPIRY_MARGIN_MS + 1000));
}

test.describe('A. Login', () => {
  test('A1 valid login sets the refresh cookie and stores { token, expiresAt }', async ({ page, context }) => {
    const before = Date.now();
    const { body, apiBase, response } = await h.loginOk(page);

    expect(response.headers()['cache-control']).toContain('no-store');
    expect(body.data).toMatchObject({ type: 'bearer' });
    expect(typeof body.data.expires_in).toBe('number');
    test.info().annotations.push({ type: 'access token TTL (s)', description: String(body.data.expires_in) });
    test.info().annotations.push({ type: 'API base', description: apiBase });

    const cookie = await h.getRefreshCookie(context, apiBase);

    expect(cookie, 'pushengage_admin_rt cookie').not.toBeNull();
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    expect(cookie.path).toBe(h.RT_COOKIE_PATH);
    // About 24h from now
    const hoursLeft = (cookie.expires * 1000 - before) / 3600000;

    expect(hoursLeft).toBeGreaterThan(23.9);
    expect(hoursLeft).toBeLessThan(24.1);

    const stored = await h.getStoredToken(page);

    expect(stored).toMatchObject({ token: `bearer ${body.data.token}` });
    expect(stored.expiresAt).toBeGreaterThanOrEqual(before + body.data.expires_in * 1000 - 1000);
    expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + body.data.expires_in * 1000 + 1000);
  });

  test('A2 MFA admin: missing or wrong code fails, correct code logs in', async ({ page }) => {
    const { MFA_ADMIN_EMAIL: email, MFA_ADMIN_PASSWORD: password, MFA_ADMIN_SECRET: secret } = process.env;

    test.skip(!email || !password, 'Set MFA_ADMIN_EMAIL / MFA_ADMIN_PASSWORD (and MFA_ADMIN_SECRET)');

    const missing = await h.uiLogin(page, { email, password });

    expect(missing.response.status()).not.toBe(200);
    await expect(page).not.toHaveURL(/\/dashboard/);

    const wrong = await h.uiLogin(page, { email, password, mfaToken: '000000' });

    expect(wrong.response.status()).not.toBe(200);

    test.skip(!secret, 'Set MFA_ADMIN_SECRET for the correct-code step');
    await h.loginOk(page, { email, password, mfaToken: h.totp(secret) });
  });

  test('A3 wrong password shows an error and sets no cookie', async ({ page, context }) => {
    const { response, apiBase } = await h.uiLogin(page, { password: `${h.ADMIN.password}-wrong` });

    expect(response.status()).not.toBe(200);
    await expect(page).not.toHaveURL(/\/dashboard/);
    expect(await h.getRefreshCookie(context, apiBase)).toBeNull();
    expect(await h.getStoredToken(page)).toBeNull();
  });

  test('A4 inactive admin cannot log in', async ({ page }) => {
    const { INACTIVE_ADMIN_EMAIL: email, INACTIVE_ADMIN_PASSWORD: password } = process.env;

    test.skip(!email || !password, 'Set INACTIVE_ADMIN_EMAIL / INACTIVE_ADMIN_PASSWORD');

    const { response } = await h.uiLogin(page, { email, password });

    expect(response.status()).not.toBe(200);
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('A5 an admin with only the pre-release token is sent to login and the old key is removed', async ({ page }) => {
    await page.goto(`${h.BASE_URL}/login`);
    await page.evaluate(([legacy, userKey]) => {
      localStorage.clear();
      localStorage.setItem(legacy, 'bearer pre-release-token');
      localStorage.setItem(userKey, JSON.stringify({ user_email: 'qa@example.com' }));
    }, [h.LEGACY_TOKEN_KEY, h.USER_KEY]);

    await page.goto(`${h.BASE_URL}/dashboard/users`);
    await h.expectOnLogin(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), h.LEGACY_TOKEN_KEY)).toBeNull();
  });
});

test.describe('B. Silent refresh', () => {
  test('B1 (fast) token near expiry: one POST /auth/refresh 200, pages keep working', async ({ page, context }) => {
    await page.clock.install();
    const { apiBase } = await h.loginOk(page);
    const log = h.trackApi(page);
    const cookieBefore = await h.getRefreshCookie(context, apiBase);
    const tokenBefore = await h.getStoredToken(page);

    await expireTokenInBrowser(page);
    await h.doSomeWork(page);

    expect(log.refreshes.map((r) => r.status)).toEqual([200]);
    expect(log.authed.filter((r) => r.status === 401)).toEqual([]);
    await h.expectStillLoggedIn(page);
    await h.expectNoErrorModal(page);

    const tokenAfter = await h.getStoredToken(page);
    const cookieAfter = await h.getRefreshCookie(context, apiBase);

    expect(tokenAfter.token).not.toBe(tokenBefore.token);
    expect(cookieAfter.value, 'refresh cookie is rotated').not.toBe(cookieBefore.value);
    // Rotation never extends the 24h deadline
    expect(Math.abs(cookieAfter.expires - cookieBefore.expires)).toBeLessThan(5);
  });

  test('B4 clock off by +10 / -10 min: no refresh before every request', async ({ browser }) => {
    for (const skewMin of [10, -10]) {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.clock.install({ time: new Date(Date.now() + skewMin * 60000) });
      await h.loginOk(page);
      const log = h.trackApi(page);

      for (let i = 0; i < 3; i += 1) {
        await h.doSomeWork(page);
      }

      expect(log.refreshes, `skew ${skewMin} min`).toEqual([]);
      expect(log.authed.length).toBeGreaterThan(0);
      expect(log.authed.filter((r) => r.status === 401)).toEqual([]);
      await h.expectStillLoggedIn(page);
      await context.close();
    }
  });

  test('B5 refresh fails on the network: normal error, no logout, next action works', async ({ page }) => {
    await page.clock.install();
    await h.loginOk(page);
    await expireTokenInBrowser(page);

    await page.route('**/auth/refresh', (route) => route.abort('internetdisconnected'));
    await h.doSomeWork(page);
    await h.expectStillLoggedIn(page);
    expect(await h.getStoredToken(page)).not.toBeNull();

    await page.unroute('**/auth/refresh');
    // Dismiss whatever error the failed request showed
    await page.keyboard.press('Escape');
    const log = h.trackApi(page);

    await h.doSomeWork(page);
    expect(log.refreshes.map((r) => r.status)).toContain(200);
    await h.expectStillLoggedIn(page);
  });

  test('B5b refresh answers 500: no logout', async ({ page }) => {
    await page.clock.install();
    await h.loginOk(page);
    await expireTokenInBrowser(page);
    await page.route('**/auth/refresh', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: 500, error: { name: 'Error', message: 'boom' } }) }));
    await h.doSomeWork(page);
    await h.expectStillLoggedIn(page);
  });

  test('B1/B2 (slow) idle past the real lifetime, then click: works without logging in', async ({ page }) => {
    const { body } = await h.loginOk(page);
    const ttl = body.data.expires_in;

    test.skip(!slowEnabled(ttl), `TTL is ${ttl}s; set RUN_SLOW=1 to wait it out`);
    test.setTimeout((ttl + 120) * 1000);

    const log = h.trackApi(page);

    await page.waitForTimeout((ttl + 10) * 1000);
    await h.doSomeWork(page);

    expect(log.refreshes.map((r) => r.status)).toContain(200);
    expect(log.refreshes.filter((r) => r.status !== 200)).toEqual([]);
    await h.expectStillLoggedIn(page);
    await h.expectNoErrorModal(page);
  });

  test('B3 (slow) API rejects an expired token (sleep / clock): refresh + replay, no error', async ({ page }) => {
    const { body } = await h.loginOk(page);
    const ttl = body.data.expires_in;

    test.skip(!slowEnabled(ttl), `TTL is ${ttl}s; set RUN_SLOW=1 to wait it out`);
    test.setTimeout((ttl + 120) * 1000);

    // The browser believes the token is still fresh, as after a laptop sleep with a wrong clock
    await page.evaluate((key) => {
      const stored = JSON.parse(localStorage.getItem(key));

      localStorage.setItem(key, JSON.stringify({ ...stored, expiresAt: Date.now() + 3600000 }));
    }, h.ACCESS_TOKEN_KEY);
    await page.waitForTimeout((ttl + 10) * 1000);

    const log = h.trackApi(page);

    await h.doSomeWork(page);

    expect(log.errors401.map((e) => e.name)).toContain('ExpiredJwtToken');
    expect(log.refreshes.map((r) => r.status)).toContain(200);
    await h.expectStillLoggedIn(page);
    await h.expectNoErrorModal(page);
  });
});

test.describe('C. Multiple tabs', () => {
  test('C2 logout in one tab sends the other tabs to login by themselves', async ({ context }) => {
    const tab1 = await context.newPage();

    await h.loginOk(tab1);
    const tab2 = await context.newPage();
    const tab3 = await context.newPage();

    for (const tab of [tab2, tab3]) {
      await tab.goto(`${h.BASE_URL}/dashboard/users`);
      await h.expectStillLoggedIn(tab);
    }

    await h.uiLogout(tab1);
    await h.expectOnLogin(tab1);
    // No action in these tabs
    await h.expectOnLogin(tab2);
    await h.expectOnLogin(tab3);
  });

  test('C3 (fast) many requests at expiry share one refresh', async ({ page }) => {
    await page.clock.install();
    await h.loginOk(page);
    const log = h.trackApi(page);

    await expireTokenInBrowser(page);
    // A page with several lists fires its requests together, all at expiry
    await h.spaNavigate(page, '/dashboard/accounts');
    await h.spaNavigate(page, '/dashboard/users');

    expect(log.refreshes.length).toBe(1);
    expect(log.refreshes[0].status).toBe(200);
    expect(log.authed.filter((r) => r.status === 401)).toEqual([]);
    await h.expectStillLoggedIn(page);
  });

  test('C1 (slow) 3 tabs past the lifetime: all stay logged in', async ({ context }) => {
    const tab1 = await context.newPage();
    const { body } = await h.loginOk(tab1);
    const ttl = body.data.expires_in;

    test.skip(!slowEnabled(ttl), `TTL is ${ttl}s; set RUN_SLOW=1 to wait it out`);
    test.setTimeout((ttl * 2 + 180) * 1000);

    const tabs = [tab1, await context.newPage(), await context.newPage()];

    await tabs[1].goto(`${h.BASE_URL}/dashboard/users`);
    await tabs[2].goto(`${h.BASE_URL}/dashboard/profile-settings`);
    const logs = tabs.map(h.trackApi);

    // Two lifetimes, working in every tab
    for (let round = 0; round < 2; round += 1) {
      await tabs[0].waitForTimeout((ttl + 5) * 1000);
      await Promise.all(tabs.map(h.doSomeWork));
    }

    for (const [i, tab] of tabs.entries()) {
      await h.expectStillLoggedIn(tab);
      expect(logs[i].refreshes.filter((r) => r.status !== 200), `tab ${i + 1}`).toEqual([]);
      expect(logs[i].errors401.filter((e) => e.name !== 'ExpiredJwtToken'), `tab ${i + 1}`).toEqual([]);
    }
  });
});

test.describe('D. Logout', () => {
  test('D1-D3 logout clears cookie + storage, Back shows nothing, old token gets 401 SessionRevoked', async ({ page, context }) => {
    const authedGet = h.captureAuthedGet(page);
    const { apiBase } = await h.loginOk(page);
    const replay = await authedGet;
    const token = (await h.getStoredToken(page)).token;
    const api = await h.apiClient();

    expect((await h.replayGet(api, replay.url(), token)).status).toBe(200);

    await h.uiLogout(page);
    await h.expectOnLogin(page);
    expect(await h.getRefreshCookie(context, apiBase)).toBeNull();
    expect(await h.getStoredToken(page)).toBeNull();

    // D2 Back button
    await page.goBack();
    await page.waitForLoadState('networkidle').catch(() => {});
    if (/\/dashboard/.test(page.url())) {
      await h.doSomeWork(page);
    }
    await h.expectOnLogin(page);

    // D3 token copied before logout, used like Postman
    expect(await h.replayGet(api, replay.url(), token)).toEqual({ status: 401, name: 'SessionRevoked' });
    await api.dispose();
  });
});

test.describe('E. Session end', () => {
  test('E3 logging in again in the same browser revokes the old session', async ({ page }) => {
    const authedGet = h.captureAuthedGet(page);

    await h.loginOk(page);
    const replay = await authedGet;
    const oldToken = (await h.getStoredToken(page)).token;

    // Same browser, cookie kept: only the dashboard state is gone
    await page.evaluate(() => localStorage.clear());
    await h.loginOk(page);
    const newToken = (await h.getStoredToken(page)).token;
    const api = await h.apiClient();

    expect(await h.replayGet(api, replay.url(), oldToken)).toEqual({ status: 401, name: 'SessionRevoked' });
    expect((await h.replayGet(api, replay.url(), newToken)).status).toBe(200);
    await h.doSomeWork(page);
    await h.expectStillLoggedIn(page);
    await api.dispose();
  });
});

test.describe('F. Security', () => {
  test('F1 document.cookie does not expose pushengage_admin_rt', async ({ page }) => {
    await h.loginOk(page);
    expect(await page.evaluate(() => document.cookie)).not.toContain(h.RT_COOKIE);
  });

  test('F2 /auth/refresh without X-PE-Client or the dashboard Origin returns 403', async ({ page, context }) => {
    const { apiBase } = await h.loginOk(page);
    const cookieValue = (await h.getRefreshCookie(context, apiBase)).value;
    const api = await h.apiClient();

    const cases = {
      'no header, no Origin': {},
      'header, no Origin': { ...h.CLIENT_HEADER },
      'Origin, no header': { Origin: h.DASHBOARD_ORIGIN },
      'header + main dashboard Origin': { ...h.CLIENT_HEADER, Origin: h.MAIN_DASHBOARD_ORIGIN },
      'header + evil Origin': { ...h.CLIENT_HEADER, Origin: 'https://evil.example.com' },
      'wrong header value': { 'X-PE-Client': 'postman', Origin: h.DASHBOARD_ORIGIN },
    };

    for (const [label, headers] of Object.entries(cases)) {
      const result = await h.rawRefresh(api, apiBase, { cookieValue, headers });

      expect(result.status, label).toBe(403);
    }

    // Logout is behind the same guard
    const logout = await api.post(`${apiBase}/auth/logout`, { headers: { Cookie: `${h.RT_COOKIE}=${cookieValue}` } });

    expect(logout.status(), 'logout without guard headers').toBe(403);

    // The browser session survived all of that
    await h.doSomeWork(page);
    await h.expectStillLoggedIn(page);
    await api.dispose();
  });

  test('F3a reusing the old cookie within 10s is a race (RefreshTokenRotated), session kept', async ({ page, context }) => {
    await page.clock.install();
    const { apiBase } = await h.loginOk(page);
    const oldValue = (await h.getRefreshCookie(context, apiBase)).value;
    const log = h.trackApi(page);

    await expireTokenInBrowser(page);
    await h.doSomeWork(page);
    expect(log.refreshes.map((r) => r.status)).toEqual([200]);

    const api = await h.apiClient();
    const result = await h.rawRefresh(api, apiBase, { cookieValue: oldValue, headers: { ...h.CLIENT_HEADER, Origin: h.DASHBOARD_ORIGIN } });

    expect(Date.now() - log.refreshes[0].at).toBeLessThan(h.ROTATION_GRACE_MS);
    expect(result.status).toBe(401);
    expect(result.body?.error?.name).toBe('RefreshTokenRotated');

    await h.doSomeWork(page);
    await h.expectStillLoggedIn(page);
    await api.dispose();
  });

  test('F3b reusing the old cookie after 10s revokes the whole session', async ({ page, context }) => {
    await page.clock.install();
    const { apiBase } = await h.loginOk(page);
    const oldValue = (await h.getRefreshCookie(context, apiBase)).value;
    const log = h.trackApi(page);

    await expireTokenInBrowser(page);
    await h.doSomeWork(page);
    expect(log.refreshes.map((r) => r.status)).toEqual([200]);

    await new Promise((r) => setTimeout(r, h.ROTATION_GRACE_MS + 2000));

    const api = await h.apiClient();
    const result = await h.rawRefresh(api, apiBase, { cookieValue: oldValue, headers: { ...h.CLIENT_HEADER, Origin: h.DASHBOARD_ORIGIN } });

    expect(result.status).toBe(401);
    expect(result.body?.error?.name).toBe('RefreshTokenInvalid');

    // The browser's own (newer) session is gone too
    await h.doSomeWork(page);
    await h.expectOnLogin(page);
    await h.expectNoErrorModal(page);
    await api.dispose();
  });
});

test.describe('G. CORS on the shared staging API', () => {
  const preflight = (api, url, origin) => api.fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization,x-pe-client',
    },
  });

  test('G1 internal dashboard origin gets credentials; main dashboard and others keep *', async ({ page }) => {
    const { apiBase } = await h.loginOk(page);
    const api = await h.apiClient();
    const url = `${apiBase}/auth/refresh`;

    const internal = (await preflight(api, url, h.DASHBOARD_ORIGIN)).headers();

    expect(internal['access-control-allow-origin']).toBe(h.DASHBOARD_ORIGIN);
    expect(internal['access-control-allow-credentials']).toBe('true');
    expect((internal['access-control-allow-headers'] || '').toLowerCase()).toContain('x-pe-client');
    expect((internal.vary || '').toLowerCase()).toContain('origin');

    for (const origin of [h.MAIN_DASHBOARD_ORIGIN, 'https://evil.example.com']) {
      const other = (await preflight(api, url, origin)).headers();

      expect(other['access-control-allow-origin'], origin).toBe('*');
      expect(other['access-control-allow-credentials'], origin).toBeUndefined();
    }

    // A plain GET from the main dashboard origin (how the main dashboard calls the API)
    const mainGet = await api.get(apiBase.replace(/\/admin\/v1$/, '/'), { headers: { Origin: h.MAIN_DASHBOARD_ORIGIN } });

    expect(mainGet.headers()['access-control-allow-origin']).toBe('*');
    expect(mainGet.headers()['access-control-allow-credentials']).toBeUndefined();
    await api.dispose();
  });

  test('G3 internal dashboard smoke: users, accounts, subscriber exports, profile', async ({ page }) => {
    await page.clock.install();
    await h.loginOk(page);
    const log = h.trackApi(page);
    const errors = [];

    page.on('pageerror', (e) => errors.push(e.message));

    for (const path of ['/dashboard/users', '/dashboard/accounts', '/dashboard/subscriber-exports', '/dashboard/profile-settings', '/dashboard/fup-usages']) {
      await page.goto(`${h.BASE_URL}${path}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await h.expectStillLoggedIn(page);
    }

    // And once more across a refresh
    await expireTokenInBrowser(page);
    await h.doSomeWork(page);

    expect(log.authed.filter((r) => r.status === 401 || r.status >= 500)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
