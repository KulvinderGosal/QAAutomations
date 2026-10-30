/**
 * qa-core — deny-by-default network target guard (G3 / I3).
 *
 *   assertAllowedTarget(url, method)
 *
 * Policy:
 *   • local dev hosts (localhost, 127.0.0.1, ::1, *.localhost, *.test, wp-env ports) → any method
 *   • staging hosts on the allowlist below, and the QA Shopify stores → any method
 *   • production hosts → ONLY GET/HEAD, and ONLY to the path prefixes listed in
 *     PRODUCTION_READ_ALLOWLIST. Any write, or any unlisted path, is refused.
 *   • anything else (unknown host, non-http(s), credentials in the URL) → refused.
 *
 * A refusal throws BlockedError{cls:'TARGET'}. Widening the policy is a code
 * change to the exported lists (reviewable), never an env var or a runtime flag.
 *
 * Pure module (no Node / Playwright imports) so TestPilot's server AND UI can reuse it.
 */
import { BlockedError } from '../errors';

export type TargetTier = 'local' | 'staging' | 'production';

export const READ_ONLY_METHODS = ['GET', 'HEAD'] as const;

/** Exact local hostnames (URL.hostname form; IPv6 is bracketed). */
export const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]', '::1'];
/** Local development suffixes (wp-env, *.localhost, *.test). */
export const LOCAL_HOST_SUFFIXES: readonly string[] = ['.localhost', '.test'];

/** Exact staging hostnames seen in the QA evidence + memory. */
export const STAGING_HOSTS: readonly string[] = [
  // PushEngage
  'staging-app.pushengage.com', // adonis API: https://staging-app.pushengage.com/d/v1
  'staging-app-dashboard.pushengage.com', // dashboard 1 SPA
  'staging-app-dashboard2.pushengage.com', // dashboard 2 SPA (features under QA ship here)
  'staging-shopify-app.pushengage.com', // embedded Shopify app host
  'staging-web-sdk.pushengage.com', // web SDK (staging)
  'staging-dexter2.pushengage.com', // IAM / mobile SDK API (staging)
  'staging.pushengage.com', // marketing site staging
  'qastaging.pushengage.com', // WP QA site (PushEngage WP + LedgerPort WP plugins)
  // LedgerPort
  'app-staging.ledgerport.com', // SaaS dashboard
  'api-staging.ledgerport.com', // SaaS API: https://api-staging.ledgerport.com/api/v1
  'staging-shopify-app.ledgerport.com', // embedded Shopify app host
  'staging.ledgerport.com', // marketing site staging
];

/** Staging hostname patterns (numbered dashboard / dexter clones). */
export const STAGING_HOST_PATTERNS: readonly RegExp[] = [
  /^staging-app-dashboard\d*\.pushengage\.com$/,
  /^staging-dexter\d*\.pushengage\.com$/,
];

/**
 * QA-owned Shopify dev stores (handle = `<handle>.myshopify.com`). Any method is
 * allowed (they are QA stores) — data-level safety is fixtures.json destructiveOk.
 */
export const QA_SHOPIFY_STORE_HANDLES: readonly string[] = [
  'ledgerport-staging-qa',
  'billingpagetesting-2',
  'silverlisting',
  'pushengage-staging-qa',
  'pushengage-qa',
  '7daysfreetrail',
  'freetrial7daysfixes',
  'gauthtest',
  '2fatest-ikbpztwz',
  'aiagenttest-tciprs0r',
];

/** Stores that run the PRODUCTION app / are the live store → production tier (GET/HEAD only). */
export const PRODUCTION_SHOPIFY_STORE_HANDLES: readonly string[] = ['ledgerport', 'pushengage-production-qa'];

export interface ProductionReadRule {
  host: string;
  /** Segment-aware path prefixes ('/' = every path). GET/HEAD only. */
  pathPrefixes: readonly string[];
  note: string;
}

/** The ONLY production reads permitted. Everything else on a production host is refused. */
export const PRODUCTION_READ_ALLOWLIST: readonly ProductionReadRule[] = [
  { host: 'pushengage.com', pathPrefixes: ['/'], note: 'public marketing pages (health smoke)' },
  { host: 'www.pushengage.com', pathPrefixes: ['/'], note: 'public marketing pages (health smoke)' },
  { host: 'ledgerport.com', pathPrefixes: ['/'], note: 'public marketing pages (health smoke)' },
  { host: 'www.ledgerport.com', pathPrefixes: ['/'], note: 'public marketing pages (health smoke)' },
  { host: 'app.pushengage.com', pathPrefixes: ['/'], note: 'dashboard SPA shell (health smoke); /d/v1 here only serves the SPA' },
  { host: 'app.ledgerport.com', pathPrefixes: ['/'], note: 'SaaS dashboard SPA shell (health smoke)' },
  { host: 'api.ledgerport.com', pathPrefixes: ['/api/v1/plans'], note: 'public Plans API contract' },
  {
    host: 'dashboard-public-api.pushengage.com',
    pathPrefixes: ['/d/v1/users/me', '/d/v1/sites/76524'],
    note: 'prod adonis API: identity probe + QA Playground site 76524 reads only',
  },
  { host: 'dexter-cdn.pushengage.com', pathPrefixes: ['/p/v1/iam/'], note: 'prod IAM campaign sync reads (mobile SDK)' },
  { host: 'qaprod.pushengage.com', pathPrefixes: ['/'], note: 'production WP QA site pages (interactive Cloudflare challenge)' },
];

/** Known production hosts (for a precise refusal message). Hosts here but not in the allowlist get no reads at all. */
export const PRODUCTION_HOSTS: readonly string[] = [
  ...PRODUCTION_READ_ALLOWLIST.map((r) => r.host),
  'api.pushengage.com',
  'clients-api.pushengage.com',
  'clientcdn.pushengage.com',
  'cdn.pushengage.com',
  'assetscdn.pushengage.com',
  'web-sdk.pushengage.com',
  'notify.pushengage.com',
  'noti-analytics.pushengage.com',
  's2s.pushengage.com',
  'sapp.pushengage.com',
  'skb.pushengage.com',
  'dexter2.pushengage.com',
  ...PRODUCTION_SHOPIFY_STORE_HANDLES.map((h) => `${h}.myshopify.com`),
];

export interface TargetDecision {
  allowed: boolean;
  tier: TargetTier | 'unknown';
  host: string;
  method: string;
  path: string;
  /** Machine code: 'ok' | 'bad-url' | 'bad-protocol' | 'credentials-in-url' | 'unknown-host' | 'production-write' | 'production-path-not-listed' | 'shopify-admin-unknown-store' */
  code: string;
  reason: string;
}

function normHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

/** Segment-aware prefix match: '/d/v1/sites/76524' matches '/d/v1/sites/76524' and '/d/v1/sites/76524/x', not '/d/v1/sites/765240'. */
export function pathMatchesPrefix(path: string, prefix: string): boolean {
  if (prefix === '/' || prefix === '') return true;
  if (path === prefix) return true;
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return path.startsWith(p) || `${path}/` === p;
}

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.includes(host) || LOCAL_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

function isStagingHost(host: string): boolean {
  return STAGING_HOSTS.includes(host) || STAGING_HOST_PATTERNS.some((re) => re.test(host));
}

function shopifyHandle(host: string): string | null {
  const m = /^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/.exec(host);
  return m ? m[1] : null;
}

/** Classify a host into a tier without considering method/path. */
export function classifyHost(hostname: string): TargetTier | 'unknown' {
  const host = normHost(hostname);
  if (isLocalHost(host)) return 'local';
  if (isStagingHost(host)) return 'staging';
  const handle = shopifyHandle(host);
  if (handle && QA_SHOPIFY_STORE_HANDLES.includes(handle)) return 'staging';
  if (PRODUCTION_HOSTS.includes(host)) return 'production';
  return 'unknown';
}

/** Non-throwing decision. */
export function checkTarget(url: string | URL, method = 'GET'): TargetDecision {
  const m = String(method || 'GET').toUpperCase();
  let u: URL;
  try {
    u = typeof url === 'string' ? new URL(url) : url;
  } catch {
    return { allowed: false, tier: 'unknown', host: '', method: m, path: '', code: 'bad-url', reason: 'not an absolute URL' };
  }
  const host = normHost(u.hostname);
  const path = u.pathname || '/';
  const base = { host, method: m, path };
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { ...base, allowed: false, tier: 'unknown', code: 'bad-protocol', reason: `protocol ${u.protocol} is not http(s)` };
  }
  if (u.username || u.password) {
    return { ...base, allowed: false, tier: 'unknown', code: 'credentials-in-url', reason: 'credentials embedded in the URL are refused' };
  }

  // admin.shopify.com is shared by every store: scope it by /store/<handle>.
  if (host === 'admin.shopify.com') {
    const sm = /^\/store\/([a-z0-9][a-z0-9-]*)(?:\/|$)/.exec(path);
    const handle = sm?.[1];
    if (handle && QA_SHOPIFY_STORE_HANDLES.includes(handle)) {
      return { ...base, allowed: true, tier: 'staging', code: 'ok', reason: `QA store ${handle}` };
    }
    if (handle && PRODUCTION_SHOPIFY_STORE_HANDLES.includes(handle)) {
      const ro = (READ_ONLY_METHODS as readonly string[]).includes(m);
      return ro
        ? { ...base, allowed: true, tier: 'production', code: 'ok', reason: `production store ${handle} (read-only)` }
        : { ...base, allowed: false, tier: 'production', code: 'production-write', reason: `${m} to production store ${handle} is refused` };
    }
    return { ...base, allowed: false, tier: 'unknown', code: 'shopify-admin-unknown-store', reason: `admin.shopify.com path is not a known QA store (${handle ?? 'no /store/<handle>'})` };
  }

  const tier = classifyHost(host);
  if (tier === 'local' || tier === 'staging') {
    return { ...base, allowed: true, tier, code: 'ok', reason: `${tier} host` };
  }
  if (tier === 'production') {
    if (!(READ_ONLY_METHODS as readonly string[]).includes(m)) {
      return { ...base, allowed: false, tier, code: 'production-write', reason: `${m} to production host ${host} is refused (production is GET/HEAD only)` };
    }
    const rule = PRODUCTION_READ_ALLOWLIST.find((r) => r.host === host);
    const shopHandle = shopifyHandle(host);
    if (shopHandle && PRODUCTION_SHOPIFY_STORE_HANDLES.includes(shopHandle)) {
      return { ...base, allowed: true, tier, code: 'ok', reason: `production store ${shopHandle} (read-only)` };
    }
    if (rule && rule.pathPrefixes.some((p) => pathMatchesPrefix(path, p))) {
      return { ...base, allowed: true, tier, code: 'ok', reason: `production read: ${rule.note}` };
    }
    return { ...base, allowed: false, tier, code: 'production-path-not-listed', reason: `production path ${host}${path} is not in PRODUCTION_READ_ALLOWLIST` };
  }
  return { ...base, allowed: false, tier: 'unknown', code: 'unknown-host', reason: `host ${host || '(empty)'} is not on the staging/local allowlist or the production read list` };
}

/** Throws BlockedError{cls:'TARGET'} unless allowed. Returns the decision on success. */
export function assertAllowedTarget(url: string | URL, method = 'GET'): TargetDecision {
  const d = checkTarget(url, method);
  if (!d.allowed) {
    throw new BlockedError({
      cls: 'TARGET',
      code: d.code,
      reason: `${d.method} ${d.host}${d.path}: ${d.reason}`,
      humanAction:
        d.tier === 'production'
          ? 'Run this against staging instead, or (if a production READ is genuinely needed) add the path to PRODUCTION_READ_ALLOWLIST in packages/qa-core/guards/targets.ts via a reviewed change.'
          : 'Point the run at an allowlisted staging/local host, or add the host to packages/qa-core/guards/targets.ts via a reviewed change.',
      details: { host: d.host, method: d.method, tier: d.tier },
    });
  }
  return d;
}

export function isProductionTarget(url: string | URL): boolean {
  return checkTarget(url, 'GET').tier === 'production';
}
