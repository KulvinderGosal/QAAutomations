/**
 * qa-core — WordPress REST client (wpRest) for the PushEngage WP / LedgerPort WP plugin suites.
 *
 * Two auth modes (chosen in this order when mode = 'auto'):
 *   1. Application Password from env WP_APP_USER / WP_APP_PASSWORD (Basic auth, in-process only)
 *   2. Cookie session: the `request` context MUST be created with the wp-admin
 *      storageState (e.g. .auth/wp-admin.json). The REST nonce is fetched once via
 *      admin-ajax.php?action=rest-nonce, falling back to parsing wpApiSettings /
 *      createNonceMiddleware("…") out of /wp-admin/. Sent as X-WP-Nonce.
 *
 * A redirect to wp-login.php → BlockedSessionError{code:'logged-out'}.
 * A Cloudflare challenge (qaprod.pushengage.com) → BlockedSessionError{code:'waf'} — never a pass.
 */
import { BlockedSessionError } from '../errors';
import { createApiClient, detectWafChallenge, type ApiClient, type ApiRequestLike } from './base';

export const WP_APP_USER_ENV = 'WP_APP_USER';
export const WP_APP_PASSWORD_ENV = 'WP_APP_PASSWORD';

export type WpAuthMode = 'auto' | 'cookie' | 'app-password';

export const WP_SESSION_HUMAN_ACTION =
  "Refresh the wp-admin storageState (the framework's global-setup re-login uses WP_ADMIN_USER/WP_ADMIN_PASS from your env), or set WP_APP_USER/WP_APP_PASSWORD to a WordPress Application Password.";

export interface WpRestOptions {
  request: ApiRequestLike;
  /** Site root, e.g. https://qastaging.pushengage.com or http://localhost:8888 (wp-env). */
  siteUrl: string;
  mode?: WpAuthMode;
  /** REST root path. Default '/wp-json'. */
  restPrefix?: string;
  persona?: string;
  runId?: string;
  humanAction?: string;
  timeoutMs?: number;
}

export interface WpRest extends ApiClient {
  readonly siteUrl: string;
  /** Resolved auth mode ('cookie' | 'app-password'). */
  readonly mode: Exclude<WpAuthMode, 'auto'>;
  /** Fetch (and cache) the REST nonce for cookie mode. Never log the result. */
  nonce(): Promise<string>;
}

function envVar(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function basic(user: string, pass: string): string {
  const raw = `${user}:${pass}`;
  return typeof Buffer !== 'undefined' ? Buffer.from(raw, 'utf8').toString('base64') : btoa(raw);
}

export function extractWpNonce(html: string): string | null {
  const m1 = /wpApiSettings\s*=\s*(\{[^;]*?\})\s*;/.exec(html);
  if (m1) {
    try {
      const v = JSON.parse(m1[1]) as { nonce?: string };
      if (v.nonce) return v.nonce;
    } catch {
      /* fallthrough */
    }
  }
  const m2 = /createNonceMiddleware\(\s*["']([A-Za-z0-9]+)["']\s*\)/.exec(html);
  return m2 ? m2[1] : null;
}

export function createWpRest(o: WpRestOptions): WpRest {
  const siteUrl = o.siteUrl.replace(/\/+$/, '');
  const humanAction = o.humanAction || WP_SESSION_HUMAN_ACTION;
  const appUser = envVar(WP_APP_USER_ENV);
  const appPass = envVar(WP_APP_PASSWORD_ENV);
  const requested = o.mode || 'auto';
  if (requested === 'app-password' && !(appUser && appPass)) {
    throw new BlockedSessionError({
      code: 'no-app-password',
      persona: o.persona,
      reason: `wpRest: mode 'app-password' needs ${WP_APP_USER_ENV} and ${WP_APP_PASSWORD_ENV} in the environment`,
      humanAction: `Create an Application Password for the QA admin on ${siteUrl} and export ${WP_APP_USER_ENV}/${WP_APP_PASSWORD_ENV} in your shell (never commit it).`,
    });
  }
  const mode: 'cookie' | 'app-password' = requested === 'cookie' ? 'cookie' : appUser && appPass ? 'app-password' : 'cookie';

  // Anonymous helper client on the site root (for nonce discovery); cookies come from the context.
  const site = createApiClient({ request: o.request, baseURL: siteUrl, name: 'wpSite', runId: o.runId, persona: o.persona, timeoutMs: o.timeoutMs });

  let nonceCache: string | null = null;
  const blocked = (code: string, reason: string) =>
    new BlockedSessionError({ code, persona: o.persona, reason: `wpRest ${siteUrl}: ${reason}`, humanAction });

  async function nonce(): Promise<string> {
    if (nonceCache) return nonceCache;
    const ajax = await site.get('/wp-admin/admin-ajax.php', { params: { action: 'rest-nonce' }, headers: { Accept: 'text/plain, */*' } });
    const ajaxBody = await ajax.text().catch(() => '');
    if (detectWafChallenge(ajax.status(), ajax.headers(), ajaxBody)) throw blocked('waf', 'Cloudflare challenge in front of wp-admin (interactive challenge — a human must load the site)');
    if (ajax.status() === 200 && /^[A-Za-z0-9]{6,}$/.test(ajaxBody.trim())) return (nonceCache = ajaxBody.trim());

    const admin = await site.get('/wp-admin/', { headers: { Accept: 'text/html' } });
    const html = await admin.text().catch(() => '');
    if (detectWafChallenge(admin.status(), admin.headers(), html)) throw blocked('waf', 'Cloudflare challenge in front of wp-admin');
    if (/wp-login\.php/.test(admin.url()) || /id=["']loginform["']/.test(html)) throw blocked('logged-out', 'the saved wp-admin cookies are logged out (redirected to wp-login.php)');
    const n = extractWpNonce(html);
    if (!n) throw blocked('no-nonce', 'could not find the REST nonce (wpApiSettings) on /wp-admin/');
    return (nonceCache = n);
  }

  const authHeaders = async (): Promise<Record<string, string>> =>
    mode === 'app-password' ? { Authorization: `Basic ${basic(appUser as string, appPass as string)}` } : { 'X-WP-Nonce': await nonce() };

  const client = createApiClient({
    request: o.request,
    baseURL: `${siteUrl}${o.restPrefix || '/wp-json'}`,
    name: 'wpRest',
    runId: o.runId,
    persona: o.persona,
    authHeaders,
    sessionHumanAction: humanAction,
    timeoutMs: o.timeoutMs,
  });
  return Object.assign(client, { siteUrl, mode, nonce });
}
