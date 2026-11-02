import { Page, expect } from '@playwright/test';
import { ACTIVE, getEnv, EnvName } from '../../config/env';
import { BlockedError, BlockedSessionError } from '../../../packages/qa-core/errors';

/** Base URL of the active environment (staging unless LP_ENV=production). */
export const BASE_URL = ACTIVE.baseURL;

/**
 * Performs an email/password login on /login and waits until we land in the app.
 *
 * The login page is protected by Cloudflare Turnstile. In production-grade
 * "managed" mode, Turnstile refuses to issue a token to an automation-launched
 * browser, so scripted login will fail here — use `npm run auth:capture` (a
 * one-time manual login in a real Chrome window) instead. This helper still
 * works if an environment ever runs Turnstile in "always passes" test mode.
 */
export async function login(
  page: Page,
  envName: EnvName = ACTIVE.name,
): Promise<void> {
  const env = getEnv(envName);
  const capture = `npm run auth:capture${env.name === 'production' ? ':prod' : ''} (in ledgerport-saas-automation)`;
  if (!env.email || !env.password) {
    throw new BlockedError({
      cls: 'ENV',
      code: 'missing-credentials',
      persona: `ledgerport-saas-automation:${env.name}`,
      reason: `Missing credentials for "${env.name}" (LP_${env.name === 'production' ? 'PROD' : 'STAGING'}_EMAIL / _PASSWORD not set)`,
      humanAction: `Capture a session by hand: ${capture} — or fill .env from .env.example if Turnstile runs in test mode`,
    });
  }

  await page.goto(`${env.baseURL}/login`, { waitUntil: 'domcontentloaded' });

  await page.fill('#email', env.email);
  await page.fill('#password', env.password);

  // Give Turnstile a moment to resolve its token in test mode.
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: /^log in$/i }).click();

  // Success = we leave /login. The redirect target depends on account state.
  // Still on /login after 30s = Turnstile refused the automated browser (or
  // 2FA/credentials) — a session problem a human fixes, not a product bug.
  await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 30_000 }).catch(() => {
    throw new BlockedSessionError({
      code: 'turnstile',
      persona: `ledgerport-saas-automation:${env.name}`,
      reason: `Scripted ${env.name} login did not leave /login within 30s (Cloudflare Turnstile blocks automation-launched browsers)`,
      humanAction: capture,
    });
  });
}

/** True once the page is on an authenticated route (not /login or /signup). */
export async function expectLoggedIn(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/(login|signup)/);
}
