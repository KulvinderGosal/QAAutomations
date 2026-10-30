/**
 * qa-core — base API client (I3), generalised from
 * ledgerport-sites/pushengage-ledgerport-site/tests/api/fixtures/api-client.ts.
 *
 *   • Browser-like User-Agent: the staging/prod APIs sit behind a Cloudflare WAF
 *     that 403s a bare agent. We clear it HONESTLY with a normal browser UA only —
 *     no automation-hiding flags, no fingerprint tricks, no challenge solving.
 *   • X-QA-Run-Id on every non-production request (so devs can find QA traffic).
 *   • Every request (and every redirect hop) passes guards/targets.ts.
 *   • Auth headers are added in-process and never logged; redact() masks
 *     JWTs/Bearer/cookies in anything that might be printed or attached.
 *
 * Playwright is NOT imported. The client takes any object structurally
 * compatible with Playwright's APIRequestContext (`ApiRequestLike`), so each
 * framework passes its own `request` fixture / `request.newContext()`.
 */
import { assertAllowedTarget, checkTarget, type TargetTier } from '../guards/targets';
import { BlockedError, BlockedSessionError } from '../errors';

// ───────────────────────── structural Playwright types ─────────────────────────

export interface RequestOptionsLike {
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  form?: Record<string, string | number | boolean>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  failOnStatusCode?: boolean;
  maxRedirects?: number;
}

export interface ApiResponseLike {
  status(): number;
  ok(): boolean;
  url(): string;
  headers(): Record<string, string>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** Satisfied by Playwright's APIRequestContext (checked in selftest/types.selftest.ts). */
export interface ApiRequestLike {
  fetch(url: string, options?: RequestOptionsLike): Promise<ApiResponseLike>;
}

// ───────────────────────── headers / run id ─────────────────────────

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Browser-like headers: User-Agent + Accept only. */
export const BROWSER_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json',
});

export const RUN_ID_HEADER = 'X-QA-Run-Id';

function env(name: string): string | undefined {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env?.[name];
}

let cachedRunId: string | undefined;
/** QA_RUN_ID / RUN_ID from the environment, else one stable id per process. */
export function resolveRunId(explicit?: string): string {
  if (explicit) return explicit;
  const fromEnv = env('QA_RUN_ID') || env('RUN_ID');
  if (fromEnv) return fromEnv;
  if (!cachedRunId) {
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    cachedRunId = `qa-${ts}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return cachedRunId;
}

// ───────────────────────── redaction ─────────────────────────

export const SENSITIVE_HEADER_NAMES: readonly string[] = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-qa-key',
  'x-wp-nonce',
  'x-shopify-access-token',
];

const SENSITIVE_JSON_KEYS =
  'access_?token|refresh_?token|id_?token|token|jwt|password|passwd|secret|client_?secret|api_?key|nonce|cookie|authorization|session(?:_?id)?|__PE__token__|__LEDGERPORT_AUTH_STATE__';

const REDACTIONS: Array<[RegExp, string]> = [
  // storageState localStorage entries: {"name":"__PE__token__","value":"..."}
  [/("name"\s*:\s*"(?:__PE__token__|__PE__user__|__LEDGERPORT_AUTH_STATE__)"\s*,\s*"value"\s*:\s*)"(?:[^"\\]|\\.)*"/g, '$1"[REDACTED]"'],
  // JSON "key": "value"
  [new RegExp(`("(?:${SENSITIVE_JSON_KEYS})"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'gi'), '$1"[REDACTED]"'],
  // escaped JSON inside a JSON string: \"accessToken\":\"...\"
  [new RegExp(`(\\\\"(?:${SENSITIVE_JSON_KEYS})\\\\"\\s*:\\s*)\\\\"(?:[^"\\\\]|\\\\[^"])*\\\\"`, 'gi'), '$1\\"[REDACTED]\\"'],
  // JWTs anywhere
  [/eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, '[REDACTED_JWT]'],
  // Authorization schemes
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [REDACTED]'],
  // header lines "Authorization: ...", "Cookie: ..."
  [/^(\s*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-qa-key|x-wp-nonce|x-shopify-access-token)\s*[:=]\s*).+$/gim, '$1[REDACTED]'],
  // query / form params
  [/([?&;\s](?:access_token|refresh_token|id_token|token|password|api_key|apikey|_wpnonce|nonce|cf_clearance|code)=)[^&\s"';]+/gi, '$1[REDACTED]'],
  // well-known session cookies "name=value"
  [/\b(wordpress_logged_in_[a-f0-9]*|wordpress_sec_[a-f0-9]*|wordpress_[a-f0-9]{32}|wp-settings-\d+|cf_clearance|__cf_bm|koa\.sid(?:\.sig)?|_secure_admin_session_id\w*|_shopify_\w+|PHPSESSID|connect\.sid)=([^;\s"]+)/gi, '$1=[REDACTED]'],
];

/** Mask secrets in arbitrary text before it is printed, attached or stored. */
export function redact(text: unknown): string {
  let s = typeof text === 'string' ? text : (() => { try { return JSON.stringify(text); } catch { return String(text); } })();
  if (!s) return '';
  for (const [re, rep] of REDACTIONS) s = s.replace(re, rep);
  return s;
}

/** Copy of a header map with sensitive values replaced. */
export function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = SENSITIVE_HEADER_NAMES.includes(k.toLowerCase()) ? '[REDACTED]' : redact(v);
  }
  return out;
}

// ───────────────────────── WAF detection ─────────────────────────

/** True when a response looks like a Cloudflare challenge/block rather than the app. */
export function detectWafChallenge(status: number, headers: Record<string, string>, body: string): boolean {
  const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (h['cf-mitigated'] === 'challenge') return true;
  if (![403, 429, 503].includes(status)) return false;
  return /Just a moment\.\.\.|cf-chl-|challenge-platform|Attention Required! \| Cloudflare|cf-error-details/i.test(body || '');
}

// ───────────────────────── client ─────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly url: string;
  /** Redacted, truncated body. */
  readonly bodySnippet: string;
  constructor(method: string, url: string, status: number, body: string) {
    const snippet = redact(body).slice(0, 500);
    super(`${method} ${redact(url)} -> HTTP ${status}: ${snippet}`);
    this.name = 'ApiError';
    this.status = status;
    this.method = method;
    this.url = redact(url);
    this.bodySnippet = snippet;
  }
}

export interface ApiClientOptions {
  /** Playwright APIRequestContext (or anything structurally compatible). */
  request: ApiRequestLike;
  /** Absolute base, may include a path, e.g. https://api-staging.ledgerport.com/api/v1 */
  baseURL: string;
  /** Short client name for messages, e.g. 'lpApi'. */
  name?: string;
  runId?: string;
  /** Extra static headers (merged over BROWSER_HEADERS). */
  headers?: Record<string, string>;
  /** Called per request; returns auth headers (may throw BlockedSessionError). Never logged. */
  authHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** humanAction used when the server rejects the session (HTTP 401). */
  sessionHumanAction?: string;
  persona?: string;
  timeoutMs?: number;
  /** Max redirects followed for GET/HEAD (each hop re-checked by the guard). Default 5. */
  maxRedirects?: number;
}

export interface CallOptions extends Omit<RequestOptionsLike, 'method' | 'data' | 'maxRedirects' | 'failOnStatusCode'> {
  /** Skip auth headers for this call (public endpoints). */
  anonymous?: boolean;
}

export interface ApiClient {
  readonly name: string;
  readonly baseURL: string;
  readonly runId: string;
  url(path: string): string;
  /** Raw request: never throws on HTTP status (tests may assert 401/403 deliberately). Throws BlockedError on guard refusal. */
  request(method: string, path: string, opts?: CallOptions & { data?: unknown }): Promise<ApiResponseLike>;
  get(path: string, opts?: CallOptions): Promise<ApiResponseLike>;
  head(path: string, opts?: CallOptions): Promise<ApiResponseLike>;
  delete(path: string, opts?: CallOptions): Promise<ApiResponseLike>;
  post(path: string, data?: unknown, opts?: CallOptions): Promise<ApiResponseLike>;
  put(path: string, data?: unknown, opts?: CallOptions): Promise<ApiResponseLike>;
  patch(path: string, data?: unknown, opts?: CallOptions): Promise<ApiResponseLike>;
  /** JSON helpers: 2xx → parsed body; 401 → BlockedSessionError; WAF → BlockedError{ENV}; other → ApiError. */
  getJson<T = unknown>(path: string, opts?: CallOptions): Promise<T>;
  postJson<T = unknown>(path: string, data?: unknown, opts?: CallOptions): Promise<T>;
  putJson<T = unknown>(path: string, data?: unknown, opts?: CallOptions): Promise<T>;
  patchJson<T = unknown>(path: string, data?: unknown, opts?: CallOptions): Promise<T>;
  deleteJson<T = unknown>(path: string, opts?: CallOptions): Promise<T>;
}

/** Join base + path without losing the base path (URL(path, base) would drop '/api/v1'). */
export function joinUrl(baseURL: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const b = baseURL.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function isPlainObject(v: unknown): boolean {
  return !!v && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v));
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const name = opts.name || 'api';
  const runId = resolveRunId(opts.runId);
  const maxRedirects = opts.maxRedirects ?? 5;
  // Validate the base HOST up-front so a mis-wired fixture fails at setup, not mid-test.
  // (Paths/methods are checked per request: a production base like /d/v1 is fine as long
  // as each call targets a listed read path.)
  if (checkTarget(opts.baseURL, 'GET').tier === 'unknown') assertAllowedTarget(opts.baseURL, 'GET');

  async function send(method: string, path: string, call: CallOptions & { data?: unknown } = {}): Promise<ApiResponseLike> {
    const m = method.toUpperCase();
    const { anonymous, data, headers: callHeaders, ...rest } = call;
    let url = joinUrl(opts.baseURL, path);
    const firstOrigin = url;
    let decision = assertAllowedTarget(url, m);

    const auth = anonymous || !opts.authHeaders ? {} : await opts.authHeaders();
    const baseHeaders: Record<string, string> = { ...BROWSER_HEADERS, ...(opts.headers || {}), ...(callHeaders || {}) };
    if (data !== undefined && isPlainObject(data) && !Object.keys(baseHeaders).some((k) => k.toLowerCase() === 'content-type')) {
      baseHeaders['Content-Type'] = 'application/json';
    }

    for (let hop = 0; ; hop++) {
      const headers: Record<string, string> = { ...baseHeaders };
      if (decision.tier !== 'production') headers[RUN_ID_HEADER] = runId;
      // Credentials only ever go to the origin they were issued for.
      if (sameOrigin(url, firstOrigin)) Object.assign(headers, auth);

      const res = await opts.request.fetch(url, {
        ...rest,
        method: m,
        headers,
        data,
        timeout: call.timeout ?? opts.timeoutMs ?? 30_000,
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      const status = res.status();
      const location = res.headers()['location'];
      const canFollow = (m === 'GET' || m === 'HEAD') && status >= 300 && status < 400 && location && hop < maxRedirects;
      if (!canFollow) return res;
      url = new URL(location, url).toString();
      decision = assertAllowedTarget(url, m); // every hop is guarded
    }
  }

  async function json<T>(method: string, path: string, data: unknown, call: CallOptions = {}): Promise<T> {
    const res = await send(method, path, { ...call, data });
    const status = res.status();
    const body = await res.text().catch(() => '');
    if (detectWafChallenge(status, res.headers(), body)) {
      throw new BlockedError({
        cls: 'ENV',
        code: 'waf',
        persona: opts.persona,
        reason: `${name}: ${method} ${redact(res.url())} was answered by a Cloudflare challenge/block (HTTP ${status}), not the app`,
        humanAction: 'Run from an allow-listed network, or ask devs for a WAF skip rule / Turnstile test keys on staging (do not try to bypass the challenge).',
      });
    }
    if (status === 401 && !call.anonymous && opts.authHeaders) {
      throw new BlockedSessionError({
        code: 'rejected',
        persona: opts.persona,
        reason: `${name}: the server rejected the saved session (HTTP 401) for ${method} ${redact(res.url())}`,
        humanAction: opts.sessionHumanAction || 'Re-capture the session for this persona (npm run auth:capture in its framework).',
      });
    }
    if (status < 200 || status >= 300) throw new ApiError(method, res.url(), status, body);
    if (!body) return undefined as T;
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new ApiError(method, res.url(), status, `non-JSON body: ${body}`);
    }
  }

  return {
    name,
    baseURL: opts.baseURL,
    runId,
    url: (p) => joinUrl(opts.baseURL, p),
    request: (method, path, o) => send(method, path, o),
    get: (p, o) => send('GET', p, o),
    head: (p, o) => send('HEAD', p, o),
    delete: (p, o) => send('DELETE', p, o),
    post: (p, d, o) => send('POST', p, { ...o, data: d }),
    put: (p, d, o) => send('PUT', p, { ...o, data: d }),
    patch: (p, d, o) => send('PATCH', p, { ...o, data: d }),
    getJson: (p, o) => json('GET', p, undefined, o),
    postJson: (p, d, o) => json('POST', p, d, o),
    putJson: (p, d, o) => json('PUT', p, d, o),
    patchJson: (p, d, o) => json('PATCH', p, d, o),
    deleteJson: (p, o) => json('DELETE', p, undefined, o),
  };
}

export type { TargetTier };
