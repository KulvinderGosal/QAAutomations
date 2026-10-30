/**
 * qa-core — LedgerPort SaaS API client (lpApi).
 *
 * Token order (in-process only; never printed):
 *   1. a QA key from env LP_QA_API_KEY (placeholder until the dev ask lands; sent as X-QA-Key)
 *   2. the persona storageState: localStorage __LEDGERPORT_AUTH_STATE__ on the
 *      app-staging / app origin → state.tokens.accessToken (JWT, ~15 min; refresh ~7 d)
 *   3. otherwise BlockedSessionError with the capture command.
 *
 * Refresh is NOT done here (that is I2a keepSessionFresh). Pass `refresh` to let
 * the client call it once when the access token is expired but the refresh token
 * is still valid; the storageState file is re-read afterwards (mtime cache).
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
  type SessionSummary,
  type StorageStateLike,
} from './session';

export const LP_AUTH_STATE_KEY = '__LEDGERPORT_AUTH_STATE__';

export type LpEnvName = 'staging' | 'production';

export const LP_ENVS: Readonly<Record<LpEnvName, { appOrigin: string; apiBase: string }>> = {
  staging: { appOrigin: 'https://app-staging.ledgerport.com', apiBase: 'https://api-staging.ledgerport.com/api/v1' },
  production: { appOrigin: 'https://app.ledgerport.com', apiBase: 'https://api.ledgerport.com/api/v1' },
};

export const LP_QA_KEY_ENV = 'LP_QA_API_KEY';

export function lpCaptureAction(env: LpEnvName = 'staging'): string {
  return `LP_ENV=${env} npm run auth:capture in ledgerport-saas-automation`;
}

interface LpAuthState {
  state?: {
    tokens?: { accessToken?: string; refreshToken?: string; expiresAt?: number };
    user?: { email?: string; id?: string };
    account?: { id?: string | number; name?: string; planCode?: string };
    businesses?: Array<{ id?: string | number; businessId?: string | number; name?: string }>;
  };
}

function readTokens(state: StorageStateLike | null, env: LpEnvName, appOrigin?: string) {
  const origins = [appOrigin || LP_ENVS[env].appOrigin];
  const hit = findLocalStorage(state, LP_AUTH_STATE_KEY, origins);
  if (!hit) return null;
  const parsed = safeJson<LpAuthState>(hit.value);
  return { origin: hit.origin, parsed };
}

export interface InspectOptions {
  /** Treat the access token as expired when it has less than this many seconds left. Default 60. */
  minValiditySec?: number;
  nowMs?: number;
  appOrigin?: string;
}

/** Token-free session summary for a LedgerPort storageState (path or object). */
export function inspectLpSession(
  storageState: string | StorageStateLike | null | undefined,
  env: LpEnvName = 'staging',
  o: InspectOptions = {},
): SessionSummary {
  const humanAction = lpCaptureAction(env);
  const state = loadStorageState(storageState);
  if (!state) return { state: 'human-needed', code: 'no-file', identity: {}, humanAction };
  const t = readTokens(state, env, o.appOrigin);
  const tokens = t?.parsed?.state?.tokens;
  if (!t || !tokens?.accessToken) return { state: 'human-needed', code: 'no-tokens', identity: {}, origin: t?.origin, humanAction };

  const s = t.parsed?.state;
  const identity = {
    email: s?.user?.email,
    account: s?.account?.id != null ? String(s.account.id) : undefined,
    accountName: s?.account?.name,
    plan: s?.account?.planCode,
    businesses: (s?.businesses || []).map((b) => String(b.id ?? b.businessId ?? '')).filter(Boolean).join(',') || undefined,
  };
  const now = Math.floor((o.nowMs ?? Date.now()) / 1000);
  const accessExp = jwtExpSeconds(tokens.accessToken) || (tokens.expiresAt ? Math.floor(tokens.expiresAt / 1000) : 0);
  const refreshExp = jwtExpSeconds(tokens.refreshToken);
  const base = { identity, origin: t.origin, expiresAt: isoFromSeconds(accessExp), refreshExpiresAt: isoFromSeconds(refreshExp) };
  if (accessExp - now > (o.minValiditySec ?? 60)) return { ...base, state: 'ok', code: 'ok' };
  if (tokens.refreshToken && refreshExp > now) return { ...base, state: 'refreshable', code: 'access-expired', humanAction };
  return { ...base, state: 'human-needed', code: 'refresh-expired', humanAction };
}

export interface LpApiOptions {
  request: ApiRequestLike;
  env?: LpEnvName;
  /** storageState path (re-read when its mtime changes) or object. */
  storageState?: string | StorageStateLike;
  apiBase?: string;
  appOrigin?: string;
  persona?: string;
  runId?: string;
  /** Explicit QA key (else env LP_QA_API_KEY). */
  qaKey?: string;
  qaKeyHeader?: string;
  /** Optional I2a hook: refresh the storageState in place (e.g. keepSessionFresh). Called at most once per expiry. */
  refresh?: () => Promise<unknown>;
  minValiditySec?: number;
  timeoutMs?: number;
}

export interface LpApi extends ApiClient {
  readonly env: LpEnvName;
  /** Token-free summary of the current persona session. */
  inspect(): SessionSummary;
}

export function createLpApi(o: LpApiOptions): LpApi {
  const env = o.env || 'staging';
  const humanAction = lpCaptureAction(env);
  const statePath = typeof o.storageState === 'string' ? o.storageState : undefined;
  let cached: { mtime: number; state: StorageStateLike | null } | null = null;

  const load = (): StorageStateLike | null => {
    if (!statePath) return loadStorageState(o.storageState);
    const mtime = storageStateMtime(statePath);
    if (!cached || cached.mtime !== mtime) cached = { mtime, state: loadStorageState(statePath) };
    return cached.state;
  };
  const inspect = () => inspectLpSession(load(), env, { minValiditySec: o.minValiditySec, appOrigin: o.appOrigin });

  const authHeaders = async (): Promise<Record<string, string>> => {
    const qaKey = o.qaKey ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[LP_QA_KEY_ENV];
    if (qaKey) return { [o.qaKeyHeader || 'X-QA-Key']: qaKey };

    let summary = inspect();
    if (summary.state === 'refreshable' && o.refresh) {
      await o.refresh();
      cached = null;
      summary = inspect();
    }
    if (summary.state !== 'ok') {
      throw new BlockedSessionError({
        code: summary.code,
        persona: o.persona,
        refreshable: summary.state === 'refreshable',
        expiresAt: summary.state === 'refreshable' ? summary.expiresAt : summary.refreshExpiresAt ?? summary.expiresAt,
        reason: `LedgerPort ${env} session is not usable (${summary.code})${summary.identity.email ? ` for ${summary.identity.email}` : ''}`,
        humanAction,
        details: { account: summary.identity.account ?? null },
      });
    }
    const token = readTokens(load(), env, o.appOrigin)?.parsed?.state?.tokens?.accessToken as string;
    return { Authorization: `Bearer ${token}` };
  };

  const client = createApiClient({
    request: o.request,
    baseURL: o.apiBase || LP_ENVS[env].apiBase,
    name: 'lpApi',
    runId: o.runId,
    persona: o.persona,
    authHeaders,
    sessionHumanAction: humanAction,
    timeoutMs: o.timeoutMs,
  });
  return Object.assign(client, { env, inspect });
}
