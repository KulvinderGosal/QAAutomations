import { chromium, FullConfig } from '@playwright/test';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { login } from './tests/helpers/auth';
import { captureCommand, describeSession, keepSessionFresh, readSession } from './tests/helpers/session';
import { ACTIVE } from './config/env';
import { BlockedSessionError, isBlockedError } from '../packages/qa-core/errors';

/**
 * Prepares .auth/<env>.json so the "authenticated" project can reuse a session
 * for the ACTIVE environment (staging unless LP_ENV=production).
 *
 * The LedgerPort login is protected by Cloudflare Turnstile, which refuses to
 * issue a token to automation-launched browsers — so a session must be captured
 * by a human via `npm run auth:capture` (or `auth:capture:prod`). This setup:
 *   1. Reads the saved session offline (token-free: expiry + identity labels).
 *      ok → reuse it. Access expired but refresh valid → reuse it (the SPA
 *      refreshes in-browser; keepSessionFresh is a no-op until Spike A).
 *   2. No usable session → tries a scripted login (works only if Turnstile is
 *      in test mode).
 *   3. Still no session → throws BlockedSessionError
 *      ("[BLOCKED:SESSION/<code>] … -- human action: npm run auth:capture …")
 *      when the run includes authenticated projects, so the run reports BLOCKED
 *      instead of a green run full of skips. Public-only runs
 *      (`--project public-*`, `npm run test:public`, `tests/public/...`) never
 *      need a session and only get a warning.
 */
export default async function globalSetup(_config: FullConfig) {
  const AUTH_FILE = ACTIVE.authFile;
  console.log(`[global-setup] Active environment: ${ACTIVE.name} (${ACTIVE.baseURL})`);

  // 1. Reuse a previously captured session (offline check — no network, no token output).
  const session = readSession(ACTIVE);
  if (session.exists) {
    const fresh = await keepSessionFresh(ACTIVE); // NO-OP placeholder (I2a, Spike A pending)
    if (fresh.ok) {
      console.log(`[global-setup] Reusing valid session — ${describeSession(session)}`);
      return;
    }
    if (session.state === 'refreshable') {
      console.warn(
        `[global-setup] Access token expired, refresh token valid — ${describeSession(session)}. ` +
          'UI specs reuse it (the app refreshes in-browser); in-process API calls (fixtures/qa-api.ts lpApi) ' +
          `report BLOCKED{SESSION/access-expired} until Spike A picks a refresh path. Fresh session: ${captureCommand(ACTIVE)}.`,
      );
      return;
    }
    console.warn(`[global-setup] Saved session not usable — ${describeSession(session)}.`);
  }

  // 2. Try a scripted login (only succeeds if Turnstile is disabled/test-mode).
  let loginError = '';
  if (ACTIVE.email && ACTIVE.password) {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, ACTIVE.name);
      fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
      await context.storageState({ path: AUTH_FILE });
      console.log(`[global-setup] Scripted login succeeded. Saved ${path.basename(AUTH_FILE)}`);
      return;
    } catch (err) {
      loginError = isBlockedError(err) ? err.reason : (err as Error).message.split('\n')[0];
      console.warn(`[global-setup] Scripted login blocked (Cloudflare Turnstile). ${loginError}`);
    } finally {
      await browser.close();
    }
  }

  // 3. No usable session.
  const blocked = new BlockedSessionError({
    code: session.exists ? session.code : 'no-file',
    persona: `ledgerport-saas-automation:${ACTIVE.name}`,
    refreshable: false,
    expiresAt: session.refreshExpiresAt,
    reason:
      `No usable LedgerPort ${ACTIVE.name} session (${session.exists ? describeSession(session) : `${path.basename(AUTH_FILE)} missing`})` +
      (loginError ? '; scripted login was blocked' : ''),
    humanAction: captureCommand(ACTIVE),
  });
  if (runNeedsSession(process.argv)) throw blocked;
  console.warn(`[global-setup] ${blocked.message} (public-only run — continuing without a session)`);
}

/**
 * Best-effort: does this `playwright test` invocation select any authenticated
 * project? Only an explicit public-only selection returns false — anything
 * ambiguous counts as needing the session (fail BLOCKED rather than skip green).
 */
export function runNeedsSession(argv: readonly string[]): boolean {
  const args = argv.slice(argv.findIndex((a) => a === 'test') + 1);
  const projects: string[] = [];
  const positional: string[] = [];
  const VALUE_FLAGS = new Set(['--project', '-c', '--config', '-g', '--grep', '--grep-invert', '--reporter', '-j', '--workers', '--retries', '--timeout', '--repeat-each', '--max-failures', '--output', '--shard', '--trace', '--tsconfig', '--global-timeout']);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project') projects.push(args[++i] ?? '');
    else if (a.startsWith('--project=')) projects.push(a.slice('--project='.length));
    else if (VALUE_FLAGS.has(a)) i++;
    else if (!a.startsWith('-')) positional.push(a);
  }
  if (projects.length) return projects.some((p) => !/^public-/.test(p));
  if (positional.length) return !positional.every((p) => /(^|[\\/])public([\\/]|$)/.test(p));
  return true;
}
