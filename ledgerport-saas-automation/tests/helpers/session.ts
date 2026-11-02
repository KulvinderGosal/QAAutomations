/**
 * Session utilities for the captured LedgerPort storageState (.auth/<env>.json).
 *
 * LedgerPort stores auth in localStorage under __LEDGERPORT_AUTH_STATE__:
 *   { state: { tokens: { accessToken, refreshToken, expiresAt, ... }, user, account, businesses } }
 *
 * The accessToken lives ~15 minutes; the refreshToken ~7 days. The SPA refreshes
 * the access token itself via `POST {apiBase}/auth/refresh` with `{ refreshToken }`.
 *
 * What this module does (offline, token-free):
 *   - readSession(env)        decodes access/refresh expiry + identity labels.
 *                             Never returns, logs or prints a token.
 *   - assertSessionUsable()   throws BlockedSessionError (qa-core) when not usable.
 *   - keepSessionFresh(env)   NO-OP PLACEHOLDER until Spike A decides the refresh
 *                             strategy (see scripts/spike-a-refresh.ts). It never
 *                             calls the network and never rewrites the auth file.
 *
 * Why keepSessionFresh is a no-op (QA Autonomy Plan, I2a):
 *   The previous version POSTed /auth/refresh with a bare Node fetch (no browser
 *   User-Agent — api-staging's WAF blocks that) and rewrote the file. Whether a
 *   refresh slides the refresh token's exp, and whether re-using the old refresh
 *   token revokes the token family, is unknown. Until Spike A answers that, the
 *   suite does not rotate tokens behind the user's back. UI specs still work
 *   while the refresh token is valid because the SPA refreshes in-browser.
 *   After Spike A:
 *     - sliding  → implement keepSessionFresh with that path (+ daily
 *                  'lp-refresh-keepalive'), keep workers:1.
 *     - absolute → leave this a no-op; the persona is "weekly human capture".
 */
import fs from 'fs';
import type { LpEnv } from '../../config/env';
import { inspectLpSession } from '../../../packages/qa-core/api/lpApi';
import { BlockedSessionError } from '../../../packages/qa-core/errors';

/** The framework-correct capture command (package.json auth:capture pins LP_ENV). */
export function captureCommand(env: Pick<LpEnv, 'name'>): string {
  return `npm run auth:capture${env.name === 'production' ? ':prod' : ''} (in ledgerport-saas-automation; a human logs in and solves Turnstile)`;
}

export interface LpSessionInfo {
  env: LpEnv['name'];
  /** Basename only — never the contents. */
  file: string;
  exists: boolean;
  /** 'ok' | 'refreshable' (access expired, refresh valid) | 'human-needed'. */
  state: 'ok' | 'refreshable' | 'human-needed';
  /** 'ok' | 'no-file' | 'no-tokens' | 'access-expired' | 'refresh-expired'. */
  code: string;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
  /** Seconds until access / refresh expiry (negative once expired, 0 when unknown). */
  accessSecondsLeft: number;
  refreshSecondsLeft: number;
  identity: { email?: string; account?: string; accountName?: string; businessIds: string[] };
  /** File mtime (ISO) — when the session was last captured/rewritten. */
  savedAt?: string;
  humanAction?: string;
}

const secondsUntil = (iso: string | undefined, nowMs: number) =>
  iso ? Math.floor((Date.parse(iso) - nowMs) / 1000) : 0;

/** Token-free view of the saved session for `env`. Offline; never throws on a bad file. */
export function readSession(env: LpEnv, nowMs = Date.now()): LpSessionInfo {
  const exists = fs.existsSync(env.authFile);
  const summary = inspectLpSession(exists ? env.authFile : null, env.name, {
    appOrigin: new URL(env.baseURL).origin,
    nowMs,
  });
  let savedAt: string | undefined;
  try {
    savedAt = exists ? fs.statSync(env.authFile).mtime.toISOString() : undefined;
  } catch {
    /* ignore */
  }
  return {
    env: env.name,
    file: env.authFile.split(/[\\/]/).pop() || env.authFile,
    exists,
    state: summary.state,
    code: summary.code,
    accessExpiresAt: summary.expiresAt,
    refreshExpiresAt: summary.refreshExpiresAt,
    accessSecondsLeft: secondsUntil(summary.expiresAt, nowMs),
    refreshSecondsLeft: secondsUntil(summary.refreshExpiresAt, nowMs),
    identity: {
      email: summary.identity.email,
      account: summary.identity.account,
      accountName: summary.identity.accountName,
      businessIds: (summary.identity.businesses || '').split(',').filter(Boolean),
    },
    savedAt,
    humanAction: summary.state === 'ok' ? undefined : captureCommand(env),
  };
}

/** One-line, token-free description for logs. */
export function describeSession(s: LpSessionInfo): string {
  const who = [s.identity.email, s.identity.account && `account ${s.identity.account}`].filter(Boolean).join(' / ');
  return (
    `${s.file}: ${s.state} (${s.code})` +
    (who ? ` for ${who}` : '') +
    (s.accessExpiresAt ? `; access exp ${s.accessExpiresAt}` : '') +
    (s.refreshExpiresAt ? `; refresh exp ${s.refreshExpiresAt}` : '')
  );
}

/**
 * Throws qa-core BlockedSessionError unless the saved session is usable.
 * `allowRefreshable` (default true) accepts an expired access token while the
 * refresh token is valid — fine for UI specs (the SPA refreshes in-browser),
 * NOT for in-process API calls (lpApi needs a live access token).
 */
export function assertSessionUsable(env: LpEnv, o: { allowRefreshable?: boolean; persona?: string } = {}): LpSessionInfo {
  const s = readSession(env);
  const usable = s.state === 'ok' || (s.state === 'refreshable' && o.allowRefreshable !== false);
  if (usable) return s;
  throw new BlockedSessionError({
    code: s.code,
    persona: o.persona ?? `ledgerport-saas-automation:${env.name}`,
    refreshable: s.state === 'refreshable',
    expiresAt: s.state === 'refreshable' ? s.accessExpiresAt : s.refreshExpiresAt ?? s.accessExpiresAt,
    reason: `LedgerPort ${env.name} session is not usable — ${describeSession(s)}`,
    humanAction: captureCommand(env),
  });
}

/** Strategy marker — flipped once Spike A decides (see header). */
export const KEEP_FRESH_MODE = 'noop-until-spike-a' as const;

export type FreshResult =
  | { ok: true; refreshed: false; mode: typeof KEEP_FRESH_MODE; session: LpSessionInfo }
  | {
      ok: false;
      refreshed: false;
      mode: typeof KEEP_FRESH_MODE;
      reason: 'no-file' | 'no-tokens' | 'access-expired' | 'refresh-expired' | string;
      session: LpSessionInfo;
    };

/**
 * NO-OP placeholder (I2a). Reports the saved session's freshness; does not
 * refresh, does not touch the network, does not rewrite .auth/<env>.json.
 * Signature is async so the post-Spike-A implementation can drop in unchanged
 * (it is also the shape lpApi's optional `refresh` hook expects).
 */
export async function keepSessionFresh(env: LpEnv): Promise<FreshResult> {
  const session = readSession(env);
  if (session.state === 'ok') return { ok: true, refreshed: false, mode: KEEP_FRESH_MODE, session };
  return { ok: false, refreshed: false, mode: KEEP_FRESH_MODE, reason: session.code, session };
}
