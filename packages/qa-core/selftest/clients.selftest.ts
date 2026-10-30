import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createApiClient, redact, RUN_ID_HEADER, type ApiRequestLike, type ApiResponseLike, type RequestOptionsLike } from '../api/base';
import { createLpApi, inspectLpSession, LP_AUTH_STATE_KEY } from '../api/lpApi';
import { createPeApi, inspectPeSession, PE_TOKEN_KEY, PE_USER_KEY, PE_CURRENT_SITE_KEY } from '../api/peApi';
import { createWpRest, extractWpNonce } from '../api/wpRest';
import { isBlockedError, isBlockedSessionError, BlockedSessionError, parseBlockedMessage } from '../errors';
import { check, eq, fakeJwt, throwsAsync, truthy } from './harness';

type Reply = { status?: number; body?: string; headers?: Record<string, string>; url?: string };

/** Fake APIRequestContext that records calls and replies from a router. No network. */
function fakeRequest(router: (url: string, o: RequestOptionsLike) => Reply) {
  const calls: { url: string; opts: RequestOptionsLike }[] = [];
  const request: ApiRequestLike = {
    async fetch(url, opts = {}) {
      calls.push({ url, opts });
      const r = router(url, opts);
      const res: ApiResponseLike = {
        status: () => r.status ?? 200,
        ok: () => (r.status ?? 200) < 400,
        url: () => r.url ?? url,
        headers: () => r.headers ?? {},
        text: async () => r.body ?? '',
        json: async () => JSON.parse(r.body ?? 'null'),
      };
      return res;
    },
  };
  return { request, calls };
}

const now = Math.floor(Date.now() / 1000);

function lpState(accessExp: number, refreshExp: number) {
  return {
    cookies: [],
    origins: [
      {
        origin: 'https://app-staging.ledgerport.com',
        localStorage: [
          {
            name: LP_AUTH_STATE_KEY,
            value: JSON.stringify({
              state: {
                tokens: { accessToken: fakeJwt({ exp: accessExp, sub: 'u1' }), refreshToken: fakeJwt({ exp: refreshExp }) },
                user: { email: 'qa+lp@example.test' },
                account: { id: '202', planCode: 'free' },
                businesses: [{ id: '210' }],
              },
              version: 0,
            }),
          },
        ],
      },
    ],
  };
}

function peState(exp: number) {
  return {
    cookies: [],
    origins: [
      {
        origin: 'https://staging-app-dashboard.pushengage.com',
        localStorage: [
          { name: PE_TOKEN_KEY, value: fakeJwt({ exp, uid: 1 }) },
          { name: PE_USER_KEY, value: JSON.stringify({ user_id: 10355, user_email: 'qa+pe@example.test', owner_id: 6569 }) },
          { name: PE_CURRENT_SITE_KEY, value: '51041' },
        ],
      },
    ],
  };
}

export async function runClientTests(): Promise<void> {
  await check('base: UA + run-id on staging, guard refuses production write before any network call', async () => {
    const { request, calls } = fakeRequest(() => ({ body: '{"ok":true}' }));
    const api = createApiClient({ request, baseURL: 'https://api-staging.ledgerport.com/api/v1', runId: 'qa-selftest' });
    const out = await api.getJson<{ ok: boolean }>('/plans');
    eq(out, { ok: true });
    eq(calls[0].url, 'https://api-staging.ledgerport.com/api/v1/plans', 'base path kept');
    truthy(/Mozilla\/5\.0/.test(calls[0].opts.headers!['User-Agent']), 'browser UA');
    eq(calls[0].opts.headers![RUN_ID_HEADER], 'qa-selftest', 'run id');
    eq(calls[0].opts.maxRedirects, 0, 'manual redirects');
    const prod = createApiClient({ request, baseURL: 'https://dashboard-public-api.pushengage.com/d/v1' });
    await throwsAsync(() => prod.post('/sites/76524/in-app-campaigns', { a: 1 }), (e) => isBlockedError(e) && e.cls === 'TARGET');
    eq(calls.length, 1, 'refused call never reached the network');
    await prod.get('/users/me');
    eq(calls[1].opts.headers![RUN_ID_HEADER], undefined, 'no run-id on production');
  });

  await check('base: redirect to an unknown host is refused; auth never forwarded cross-origin', async () => {
    const { request, calls } = fakeRequest((url) =>
      url.includes('/hop') ? { status: 302, headers: { location: 'https://qastaging.pushengage.com/landing' } }
        : url.includes('/evil') ? { status: 302, headers: { location: 'https://example.com/steal' } }
        : { body: '{}' },
    );
    const api = createApiClient({ request, baseURL: 'https://staging-app.pushengage.com/d/v1', authHeaders: () => ({ Authorization: 'Bearer abcdefghijkl' }) });
    await api.get('/hop');
    eq(calls[1].url, 'https://qastaging.pushengage.com/landing');
    eq(calls[1].opts.headers!['Authorization'], undefined, 'auth stripped on cross-origin hop');
    await throwsAsync(() => api.get('/evil'), (e) => isBlockedError(e) && e.cls === 'TARGET');
  });

  await check('base: WAF challenge → BLOCKED{ENV/waf}; 401 → BlockedSessionError; marker parses', async () => {
    const { request } = fakeRequest((url) =>
      url.endsWith('/waf') ? { status: 403, body: '<title>Just a moment...</title>' } : { status: 401, body: '{"message":"Unauthorized"}' },
    );
    const api = createApiClient({ request, baseURL: 'https://api-staging.ledgerport.com/api/v1', authHeaders: () => ({}) , sessionHumanAction: 'do X' });
    await throwsAsync(() => api.getJson('/waf'), (e) => isBlockedError(e) && e.cls === 'ENV' && e.code === 'waf');
    let msg = '';
    await throwsAsync(() => api.getJson('/me'), (e) => { msg = (e as Error).message; return isBlockedSessionError(e) && e.humanAction === 'do X'; });
    eq(parseBlockedMessage(msg)?.cls, 'SESSION');
    eq(parseBlockedMessage(msg)?.humanAction, 'do X');
  });

  await check('lpApi: valid token → Bearer; summary carries no token', async () => {
    const { request, calls } = fakeRequest(() => ({ body: '{"id":"u1"}' }));
    const st = lpState(now + 900, now + 7 * 86400);
    const lp = createLpApi({ request, env: 'staging', storageState: st });
    await lp.getJson('/auth/me');
    truthy(/^Bearer eyJ/.test(calls[0].opts.headers!['Authorization']), 'bearer set');
    const s = lp.inspect();
    eq([s.state, s.identity.email, s.identity.account], ['ok', 'qa+lp@example.test', '202']);
    truthy(!JSON.stringify(s).includes('eyJ'), 'no token in summary');
  });

  await check('lpApi: access expired + refresh valid → refreshable BlockedSessionError; refresh hook used once', async () => {
    const { request } = fakeRequest(() => ({ body: '{}' }));
    const lp = createLpApi({ request, env: 'staging', storageState: lpState(now - 10, now + 86400), persona: 'ledgerport-saas-automation:staging' });
    await throwsAsync(() => lp.getJson('/x'), (e) => e instanceof BlockedSessionError && e.refreshable && e.humanAction === 'LP_ENV=staging npm run auth:capture in ledgerport-saas-automation');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-core-'));
    const file = path.join(dir, 'staging.json');
    fs.writeFileSync(file, JSON.stringify(lpState(now - 10, now + 86400)));
    let refreshed = 0;
    const lp2 = createLpApi({
      request, env: 'staging', storageState: file,
      refresh: async () => { refreshed++; fs.writeFileSync(file, JSON.stringify(lpState(now + 900, now + 86400))); const t = new Date(Date.now() + 5000); fs.utimesSync(file, t, t); },
    });
    await lp2.getJson('/x');
    eq(refreshed, 1, 'refresh hook called once');
    fs.rmSync(dir, { recursive: true, force: true });
    eq(inspectLpSession(lpState(now - 10, now - 5), 'staging').code, 'refresh-expired');
    eq(inspectLpSession('/nonexistent/file.json', 'staging').code, 'no-file');
  });

  await check('peApi: token from dashboard origin, identity from __PE__user__, expired → human-needed', async () => {
    const { request, calls } = fakeRequest(() => ({ body: '{}' }));
    const pe = createPeApi({ request, env: 'staging', storageState: peState(now + 3600) });
    eq(pe.baseURL, 'https://staging-app.pushengage.com/d/v1');
    await pe.getJson('/users/me');
    truthy(/^Bearer eyJ/.test(calls[0].opts.headers!['Authorization']));
    const s = inspectPeSession(peState(now + 3600));
    eq([s.state, s.identity.email, s.identity.account, s.identity.site], ['ok', 'qa+pe@example.test', '6569', '51041']);
    const expired = createPeApi({ request, storageState: peState(now - 1) });
    await throwsAsync(() => expired.get('/users/me'), (e) => isBlockedSessionError(e) && e.code === 'expired');
  });

  await check('wpRest: nonce from admin-ajax, X-WP-Nonce sent; logged-out → BlockedSessionError', async () => {
    const { request, calls } = fakeRequest((url) =>
      url.includes('admin-ajax.php') ? { body: 'a1b2c3d4e5' } : { body: '[]' },
    );
    const wp = createWpRest({ request, siteUrl: 'http://localhost:8888', mode: 'cookie' });
    await wp.getJson('/wp/v2/posts');
    eq(calls.at(-1)!.url, 'http://localhost:8888/wp-json/wp/v2/posts');
    eq(calls.at(-1)!.opts.headers!['X-WP-Nonce'], 'a1b2c3d4e5');
    const out = fakeRequest((url) =>
      url.includes('admin-ajax.php') ? { status: 400, body: '0' } : { body: '<form id="loginform">', url: 'https://qastaging.pushengage.com/wp-login.php?redirect_to=x' },
    );
    const wp2 = createWpRest({ request: out.request, siteUrl: 'https://qastaging.pushengage.com', mode: 'cookie' });
    await throwsAsync(() => wp2.getJson('/wp/v2/users/me'), (e) => isBlockedSessionError(e) && e.code === 'logged-out');
    eq(extractWpNonce('<script>var wpApiSettings = {"root":"x","nonce":"abc123def"};</script>'), 'abc123def');
    eq(extractWpNonce('wp.apiFetch.use( wp.apiFetch.createNonceMiddleware( "f00ba4" ) );'), 'f00ba4');
  });

  await check('redact: masks JWTs, Bearer, cookies, JSON token keys, storageState entries', () => {
    const jwt = fakeJwt({ exp: now });
    const text = [
      `Authorization: Bearer ${jwt}`,
      `{"accessToken":"${jwt}","refreshToken":"zzzzzzzzzz","email":"qa@example.test"}`,
      'Cookie: wordpress_logged_in_abc123=admin%7C123%7Csecretvalue; cf_clearance=CLEARANCEVALUE',
      `{"name":"__PE__token__","value":"${jwt}"}`,
      'GET /x?access_token=TOKENVALUE123&b=1',
      'Basic dXNlcjpwYXNzd29yZA==',
    ].join('\n');
    const r = redact(text);
    for (const leak of [jwt, 'zzzzzzzzzz', 'secretvalue', 'CLEARANCEVALUE', 'TOKENVALUE123', 'dXNlcjpwYXNzd29yZA']) {
      truthy(!r.includes(leak), `leaked: ${leak.slice(0, 6)}…`);
    }
    truthy(r.includes('qa@example.test'), 'identity labels kept');
  });
}
