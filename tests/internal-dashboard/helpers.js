// Helpers for the internal dashboard refresh-token suite
// (API PR awesomemotive/pushengage-adonis-node-api#461, dashboard PR awesomemotive/pushengage-app-dashboard-internal#43)
const crypto = require('crypto');
const { expect, request: pwRequest } = require('@playwright/test');

const BASE_URL = (process.env.INTERNAL_DASHBOARD_URL || 'https://staging-internal-dashboard.pushengage.com').replace(/\/$/, '');
const DASHBOARD_ORIGIN = new URL(BASE_URL).origin;
const MAIN_DASHBOARD_ORIGIN = new URL(process.env.MAIN_DASHBOARD_URL || 'https://staging-app-dashboard.pushengage.com').origin;

const ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };

// Values fixed by the PRs
const RT_COOKIE = 'pushengage_admin_rt';
const RT_COOKIE_PATH = '/admin/v1/auth';
const ACCESS_TOKEN_KEY = '__PE__admin__access_token__';
const LEGACY_TOKEN_KEY = '__PE__admin__token__';
const USER_KEY = '__PE__admin__user__';
const CLIENT_HEADER = { 'X-PE-Client': 'internal-dashboard' };
const ROTATION_GRACE_MS = 10000;
// The dashboard refreshes this long before expiry (tokenStore EXPIRY_MARGIN_MS)
const EXPIRY_MARGIN_MS = 30000;

const SELECTORS = {
  email: 'input[name="userEmail"]',
  password: 'input[name="password"]',
  mfa: 'input[name="mfaToken"]',
  submit: 'button[type="submit"]',
  profileButton: '.app-layout__header button.ant-btn-circle',
  profileMenu: '.app-layout__header__profile-menu',
};

/** RFC 6238 TOTP from a base32 secret, for the MFA admin */
function totp(base32Secret, now = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (const char of base32Secret.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }

  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));

  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;

  return String(code).padStart(6, '0');
}

/**
 * Records the API traffic of a page: every /auth/refresh call and every authenticated API call
 */
function trackApi(page) {
  const log = { refreshes: [], authed: [], errors401: [] };

  page.on('response', async (response) => {
    const url = response.url();
    const req = response.request();

    if (url.includes('/auth/refresh')) {
      log.refreshes.push({ status: response.status(), at: Date.now() });
    } else if (req.headers().authorization) {
      log.authed.push({ url, method: req.method(), status: response.status() });

      if (response.status() === 401) {
        const body = await response.json().catch(() => ({}));

        log.errors401.push({ url, name: body?.error?.name });
      }
    }
  });

  return log;
}

/**
 * Log in through the UI. Returns the API base URL (e.g. https://api.host/admin/v1) and the login
 * response body
 */
async function uiLogin(page, { email = ADMIN.email, password = ADMIN.password, mfaToken } = {}) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill(SELECTORS.email, email);
  await page.fill(SELECTORS.password, password);

  if (mfaToken) {
    await page.fill(SELECTORS.mfa, mfaToken);
  }

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login') && r.request().method() === 'POST'),
    page.click(SELECTORS.submit),
  ]);
  const body = await response.json().catch(() => ({}));
  const apiBase = response.url().replace(/\/auth\/login.*$/, '');

  return { response, body, apiBase };
}

async function loginOk(page, options) {
  const result = await uiLogin(page, options);

  expect(result.response.status(), JSON.stringify(result.body)).toBe(200);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator(SELECTORS.profileButton)).toBeVisible();

  return result;
}

async function getRefreshCookie(context, apiBase) {
  const cookies = await context.cookies(`${apiBase}/auth/refresh`);

  return cookies.find((c) => c.name === RT_COOKIE) || null;
}

async function getStoredToken(page) {
  return page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return 'unparseable';
    }
  }, ACCESS_TOKEN_KEY);
}

/** Client-side route change, the same as clicking a NavLink: no reload, the token stays in memory */
async function spaNavigate(page, path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Move between two dashboard pages so the app fires authenticated API calls */
async function doSomeWork(page) {
  await spaNavigate(page, '/dashboard/profile-settings');
  await spaNavigate(page, '/dashboard/users');
}

async function expectStillLoggedIn(page) {
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator(SELECTORS.profileButton)).toBeVisible();
}

async function expectOnLogin(page) {
  await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/(login)?(\\?.*)?$`), { timeout: 15000 });
  await expect(page.locator(SELECTORS.email)).toBeVisible();
}

/** No server-error modal is showing (the logout modal is the only expected one) */
async function expectNoErrorModal(page) {
  await expect(page.locator('.ant-modal:visible').filter({ hasNot: page.locator('.user-logout-modal') })).toHaveCount(0);
}

async function uiLogout(page) {
  await page.click(SELECTORS.profileButton);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/logout')),
    page.locator(SELECTORS.profileMenu).getByText('Sign Out').click(),
  ]);
}

/** A request context with no cookie jar, like Postman */
async function apiClient() {
  return pwRequest.newContext({ ignoreHTTPSErrors: false });
}

/** Call /auth/refresh outside the browser with an explicit cookie and headers */
async function rawRefresh(api, apiBase, { cookieValue, headers = {} }) {
  const response = await api.post(`${apiBase}/auth/refresh`, {
    headers: { 'Content-Type': 'application/json', ...(cookieValue ? { Cookie: `${RT_COOKIE}=${cookieValue}` } : {}), ...headers },
    data: {},
  });
  const body = await response.json().catch(() => ({}));

  return { status: response.status(), body, headers: response.headers() };
}

/**
 * Remember the first authenticated GET the dashboard makes, so a token can be replayed against it
 * outside the browser
 */
function captureAuthedGet(page) {
  return page.waitForRequest((r) => r.method() === 'GET' && Boolean(r.headers().authorization), { timeout: 30000 });
}

async function replayGet(api, url, authorization) {
  const response = await api.get(url, { headers: { Authorization: authorization } });
  const body = await response.json().catch(() => ({}));

  return { status: response.status(), name: body?.error?.name };
}

module.exports = {
  ACCESS_TOKEN_KEY,
  ADMIN,
  BASE_URL,
  CLIENT_HEADER,
  DASHBOARD_ORIGIN,
  EXPIRY_MARGIN_MS,
  LEGACY_TOKEN_KEY,
  MAIN_DASHBOARD_ORIGIN,
  ROTATION_GRACE_MS,
  RT_COOKIE,
  RT_COOKIE_PATH,
  SELECTORS,
  USER_KEY,
  apiClient,
  captureAuthedGet,
  doSomeWork,
  expectNoErrorModal,
  expectOnLogin,
  expectStillLoggedIn,
  getRefreshCookie,
  getStoredToken,
  loginOk,
  rawRefresh,
  replayGet,
  spaNavigate,
  totp,
  trackApi,
  uiLogin,
  uiLogout,
};
