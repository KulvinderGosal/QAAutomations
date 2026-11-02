/**
 * Environment resolution for the LedgerPort SaaS test suite.
 *
 * One suite, two targets:
 *   - staging    → https://app-staging.ledgerport.com
 *   - production → https://app.ledgerport.com
 *
 * Pick the target with the LP_ENV env var (defaults to "staging"):
 *   LP_ENV=staging    npm test
 *   LP_ENV=production npm test
 *
 * Each environment has its own credentials and its own saved Playwright
 * storageState file under .auth/, so a staging session is never reused
 * against production (or vice-versa).
 */
import path from 'path';

export type EnvName = 'staging' | 'production';

export interface LpEnv {
  name: EnvName;
  baseURL: string;
  /** Backend API origin (used for programmatic token refresh). */
  apiBaseURL: string;
  email: string;
  password: string;
  /** Absolute path to the storageState file for this environment. */
  authFile: string;
}

const ROOT = path.resolve(__dirname, '..');

const DEFAULTS: Record<EnvName, { baseURL: string; apiBaseURL: string }> = {
  staging: {
    baseURL: 'https://app-staging.ledgerport.com',
    apiBaseURL: 'https://api-staging.ledgerport.com/api/v1',
  },
  production: {
    baseURL: 'https://app.ledgerport.com',
    apiBaseURL: 'https://api.ledgerport.com/api/v1',
  },
};

/** Normalises whatever LP_ENV holds into a known environment name. */
export function resolveEnvName(raw = process.env.LP_ENV): EnvName {
  const v = (raw || 'staging').trim().toLowerCase();
  if (v === 'production' || v === 'prod') return 'production';
  if (v === 'staging' || v === 'stage') return 'staging';
  return 'staging';
}

/** Returns the fully-resolved configuration for the active environment. */
export function getEnv(name: EnvName = resolveEnvName()): LpEnv {
  const upper = name === 'production' ? 'PROD' : 'STAGING';

  const baseURL =
    process.env[`LP_${upper}_BASE_URL`] || process.env.LP_BASE_URL || DEFAULTS[name].baseURL;
  const apiBaseURL =
    process.env[`LP_${upper}_API_BASE_URL`] ||
    process.env.LP_API_BASE_URL ||
    DEFAULTS[name].apiBaseURL;
  const email = process.env[`LP_${upper}_EMAIL`] || process.env.LP_EMAIL || '';
  const password = process.env[`LP_${upper}_PASSWORD`] || process.env.LP_PASSWORD || '';

  return {
    name,
    baseURL,
    apiBaseURL,
    email,
    password,
    authFile: path.join(ROOT, '.auth', `${name}.json`),
  };
}

/** Convenience: the active environment for this process. */
export const ACTIVE = getEnv();
