/**
 * qa-core — storageState + JWT helpers shared by lpApi / peApi / probe-lib.
 *
 * Tokens are read here and handed straight to the in-process client. Nothing in
 * this file prints, logs or returns a token in a "summary" object; only expiry
 * times and identity labels leave these helpers.
 */
import * as fs from 'node:fs';

export interface StorageStateLike {
  cookies?: Array<{ name: string; value: string; domain: string; path?: string; expires?: number }>;
  origins?: Array<{ origin: string; localStorage?: Array<{ name: string; value: string }> }>;
}

/** Load a Playwright storageState from a path or pass an object through. Returns null when missing/unreadable. */
export function loadStorageState(src: string | StorageStateLike | undefined | null): StorageStateLike | null {
  if (!src) return null;
  if (typeof src !== 'string') return src;
  try {
    return JSON.parse(fs.readFileSync(src, 'utf8')) as StorageStateLike;
  } catch {
    return null;
  }
}

/** mtime (ms) of a storageState file, or 0. Used to cache-bust when another process refreshes it. */
export function storageStateMtime(path: string | undefined): number {
  if (!path) return 0;
  try {
    return fs.statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Find a localStorage value. `origins` is tried in order (exact origin match);
 * returns the first hit plus which origin held it.
 */
export function findLocalStorage(
  state: StorageStateLike | null,
  key: string,
  origins: readonly string[],
): { origin: string; value: string } | null {
  if (!state?.origins) return null;
  for (const want of origins) {
    const o = state.origins.find((x) => x.origin.replace(/\/+$/, '') === want.replace(/\/+$/, ''));
    const item = o?.localStorage?.find((i) => i.name === key);
    if (o && item) return { origin: o.origin, value: item.value };
  }
  return null;
}

/** Decode a JWT payload WITHOUT verifying it. Returns null when it is not a JWT. Never logs. */
export function decodeJwtPayload(token: string | undefined | null): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const b64 = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const json = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('utf8') : atob(b64);
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** JWT `exp` in seconds since epoch, or 0 when absent/unparseable. */
export function jwtExpSeconds(token: string | undefined | null): number {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' ? exp : 0;
}

/** ISO string for an epoch-seconds value (undefined for 0). */
export function isoFromSeconds(sec: number): string | undefined {
  return sec > 0 ? new Date(sec * 1000).toISOString() : undefined;
}

/** A localStorage value that may be a raw string or a JSON-encoded string. */
export function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const v = JSON.parse(value);
      if (typeof v === 'string') return v;
    } catch {
      /* fallthrough */
    }
  }
  return value;
}

/** Token-free summary of a saved session (what probes/TestPilot may show). */
export type SessionState = 'ok' | 'refreshable' | 'human-needed';

export interface SessionIdentity {
  email?: string;
  store?: string;
  account?: string;
  site?: string;
  [k: string]: string | undefined;
}

export interface SessionSummary {
  state: SessionState;
  /** 'ok' | 'no-file' | 'no-tokens' | 'access-expired' | 'refresh-expired' | 'not-jwt' | ... */
  code: string;
  identity: SessionIdentity;
  /** Access token expiry (ISO). */
  expiresAt?: string;
  /** Refresh token expiry (ISO), when the product has one. */
  refreshExpiresAt?: string;
  /** Origin the token was read from. */
  origin?: string;
  humanAction?: string;
}

/**
 * Summarise a cookie-based session (Shopify admin, wp-admin) from cookie expiry only.
 * `cookie` matches the session cookie names (e.g. /^wordpress_logged_in_/ or /^_secure_admin_session_id/);
 * `domain` optionally restricts by cookie domain.
 *
 * Browser-session cookies (expires -1) cannot be proven valid offline: when the
 * storageState is a file older than `sessionCookieMaxAgeHours` (default 24) the
 * result is human-needed/'stale-session-cookie'; otherwise ok/'unverified-session-cookie'
 * (a `--live` probe should confirm it). Never reported as a plain 'ok'.
 */
export function summarizeCookieSession(
  storageState: string | StorageStateLike | null | undefined,
  o: {
    cookie: RegExp;
    domain?: RegExp;
    humanAction: string;
    identity?: SessionIdentity;
    minValiditySec?: number;
    nowMs?: number;
    sessionCookieMaxAgeHours?: number;
  },
): SessionSummary {
  const state = loadStorageState(storageState);
  const identity = o.identity || {};
  if (!state) return { state: 'human-needed', code: 'no-file', identity, humanAction: o.humanAction };
  const hits = (state.cookies || []).filter((c) => o.cookie.test(c.name) && (!o.domain || o.domain.test(c.domain)));
  if (!hits.length) return { state: 'human-needed', code: 'no-tokens', identity, humanAction: o.humanAction };
  const now = Math.floor((o.nowMs ?? Date.now()) / 1000);
  const exps = hits.map((c) => (typeof c.expires === 'number' ? c.expires : -1));
  const best = Math.max(...exps);
  if (best === -1) {
    const mtime = typeof storageState === 'string' ? storageStateMtime(storageState) : 0;
    const ageH = mtime ? ((o.nowMs ?? Date.now()) - mtime) / 3_600_000 : 0;
    if (mtime && ageH > (o.sessionCookieMaxAgeHours ?? 24)) {
      return { state: 'human-needed', code: 'stale-session-cookie', identity, humanAction: o.humanAction };
    }
    return { state: 'ok', code: 'unverified-session-cookie', identity };
  }
  if (best - now > (o.minValiditySec ?? 60)) return { state: 'ok', code: 'ok', identity, expiresAt: isoFromSeconds(Math.floor(best)) };
  return { state: 'human-needed', code: 'expired', identity, expiresAt: isoFromSeconds(Math.floor(best)), humanAction: o.humanAction };
}

export function safeJson<T = unknown>(value: string | undefined | null): T | null {
  if (value == null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
