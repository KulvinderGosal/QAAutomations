/**
 * qa-core — PushEngage adonis /d/v1 API client (peApi).
 *
 * Token order (in-process only; never printed):
 *   1. a QA key from env PE_QA_API_KEY (placeholder until the dev ask lands; sent as X-QA-Key)
 *   2. the persona storageState: localStorage __PE__token__ (raw JWT, ~7 days) on a
 *      dashboard origin (staging-app-dashboard / staging-app-dashboard2 / app.pushengage.com)
 *   3. otherwise BlockedSessionError (human capture — Turnstile must be solved by a person).
 *
 * API hosts (from memory/evidence):
 *   staging    → https://staging-app.pushengage.com/d/v1        (used by both staging dashboards)
 *   production → https://dashboard-public-api.pushengage.com/d/v1 (GET/HEAD to listed paths only — see targets.ts)
 */
import { BlockedSessionError } from '../errors';
import { createApiClient, type ApiClient, type ApiRequestLike } from './base';
import {
  findLocalStorage,
  isoFromSeconds,
  jwtExpSeconds,
  loadStorageState,
  safeJson,
  storageStateMtime,
  unquote,
  type SessionSummary,
  type StorageStateLike,
} from './session';

export const PE_TOKEN_KEY = '__PE__token__';
export const PE_USER_KEY = '__PE__user__';
export const PE_CURRENT_SITE_KEY = '__PE__currentSite__';
export const PE_QA_KEY_ENV = 'PE_QA_API_KEY';

export type PeEnvName = 'staging' | 'production';

export const PE_ENVS: Readonly<Record<PeEnvName, { apiBase: string; dashboardOrigins: readonly string[] }>> = {
  staging: {
    apiBase: 'https://staging-app.pushengage.com/d/v1',
    dashboardOrigins: ['https://staging-app-dashboard2.pushengage.com', 'https://staging-app-dashboard.pushengage.com'],
  },
  production: {
    apiBase: 'https://dashboard-public-api.pushengage.com/d/v1',
    dashboardOrigins: ['https://app.pushengage.com'],
  },
};

export function peCaptureAction(env: PeEnvName = 'staging'): string {
  return env === 'production'
    ? 'npm run auth:capture:prod in pushengage-app-dashboard (a human logs in and solves Turnstile)'
    : 'npm run auth:capture in pushengage-app-dashboard (a human logs in and solves Turnstile)';
}

interface PeUser {
  user_id?: number | string;
  user_email?: string;
  owner_id?: number | string;
}

function originsFor(env: PeEnvName, preferred?: string): string[] {
  const list = [...PE_ENVS[env].dashboardOrigins];
  return preferred ? [preferred, ...list.filter((x) => x !== preferred)] : list;
}

function readToken(state: StorageStateLike | null, env: PeEnvName, dashboardOrigin?: string) {
  const hit = findLocalStorage(state, PE_TOKEN_KEY, originsFor(env, dashboardOrigin));
  if (!hit) return null;
  return { origin: hit.origin, token: unquote(hit.value) };
}

export interface PeInspectOptions {
  minValiditySec?: number;
  nowMs?: number;
  dashboardOrigin?: string;
}

/** Token-free session summary for a PushEngage dashboard storageState (path or object). */
export function inspectPeSession(
  storageState: string | StorageStateLike | null | undefined,
  env: PeEnvName = 'staging',
  o: PeInspectOptions = {},
): SessionSummary {
  const humanAction = peCaptureAction(env);
  const state = loadStorageState(storageState);
  if (!state) return { state: 'human-needed', code: 'no-file', identity: {}, humanAction };
  const t = readToken(state, env, o.dashboardOrigin);
  if (!t?.token) return { state: 'human-needed', code: 'no-tokens', identity: {}, humanAction };

  const userHit = findLocalStorage(state, PE_USER_KEY, [t.origin]);
  const siteHit = findLocalStorage(state, PE_CURRENT_SITE_KEY, [t.origin]);
  const user = safeJson<PeUser>(userHit?.value);
  const identity = {
    email: user?.user_email,
    account: user?.owner_id != null ? String(user.owner_id) : undefined,
    user: user?.user_id != null ? String(user.user_id) : undefined,
    site: siteHit ? unquote(siteHit.value) : undefined,
  };
  const exp = jwtExpSeconds(t.token);
  const base = { identity, origin: t.origin, expiresAt: isoFromSeconds(exp) };
  if (!exp) return { ...base, state: 'human-needed', code: 'not-jwt', humanAction };
  const now = Math.floor((o.nowMs ?? Date.now()) / 1000);
  if (exp - now > (o.minValiditySec ?? 60)) return { ...base, state: 'ok', code: 'ok' };
  return { ...base, state: 'human-needed', code: 'expired', humanAction };
}

export interface PeApiOptions {
  request: ApiRequestLike;
  env?: PeEnvName;
  storageState?: string | StorageStateLike;
  apiBase?: string;
  /** Prefer this dashboard origin's localStorage (e.g. https://staging-app-dashboard2.pushengage.com). */
  dashboardOrigin?: string;
  persona?: string;
  runId?: string;
  qaKey?: string;
  qaKeyHeader?: string;
  minValiditySec?: number;
  timeoutMs?: number;
}

export interface PeApi extends ApiClient {
  readonly env: PeEnvName;
  inspect(): SessionSummary;
}

export function createPeApi(o: PeApiOptions): PeApi {
  const env = o.env || 'staging';
  const humanAction = peCaptureAction(env);
  const statePath = typeof o.storageState === 'string' ? o.storageState : undefined;
  let cached: { mtime: number; state: StorageStateLike | null } | null = null;
  const load = (): StorageStateLike | null => {
    if (!statePath) return loadStorageState(o.storageState);
    const mtime = storageStateMtime(statePath);
    if (!cached || cached.mtime !== mtime) cached = { mtime, state: loadStorageState(statePath) };
    return cached.state;
  };
  const inspect = () => inspectPeSession(load(), env, { minValiditySec: o.minValiditySec, dashboardOrigin: o.dashboardOrigin });

  const authHeaders = async (): Promise<Record<string, string>> => {
    const qaKey = o.qaKey ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[PE_QA_KEY_ENV];
    if (qaKey) return { [o.qaKeyHeader || 'X-QA-Key']: qaKey };
    const summary = inspect();
    if (summary.state !== 'ok') {
      throw new BlockedSessionError({
        code: summary.code,
        persona: o.persona,
        expiresAt: summary.expiresAt,
        reason: `PushEngage ${env} dashboard session is not usable (${summary.code})${summary.identity.email ? ` for ${summary.identity.email}` : ''}`,
        humanAction,
        details: { account: summary.identity.account ?? null, site: summary.identity.site ?? null },
      });
    }
    const token = readToken(load(), env, o.dashboardOrigin)?.token as string;
    return { Authorization: `Bearer ${token}` };
  };

  const client = createApiClient({
    request: o.request,
    baseURL: o.apiBase || PE_ENVS[env].apiBase,
    name: 'peApi',
    runId: o.runId,
    persona: o.persona,
    authHeaders,
    sessionHumanAction: humanAction,
    timeoutMs: o.timeoutMs,
  });
  return Object.assign(client, { env, inspect });
}
