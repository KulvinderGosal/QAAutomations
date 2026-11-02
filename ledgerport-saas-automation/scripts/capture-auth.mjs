/**
 * Manual one-time auth capture (Turnstile-friendly), per environment.
 *
 * Cloudflare Turnstile refuses to issue a token to automation-launched
 * Chromium, so fully scripted login is impossible. This opens a REAL Google
 * Chrome window with a persistent profile (best chance of a solvable Turnstile
 * checkbox), pre-fills your email/password, and then polls until you finish
 * logging in. The moment you land off /login, it saves the session to
 * .auth/<env>.json — no need to touch the terminal.
 *
 * Usage:
 *   LP_ENV=staging    node scripts/capture-auth.mjs     (npm run auth:capture)
 *   LP_ENV=production node scripts/capture-auth.mjs      (npm run auth:capture:prod)
 */
import { chromium } from '@playwright/test';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// --- Resolve the active environment (mirror of config/env.ts) ---
const raw = (process.env.LP_ENV || 'staging').trim().toLowerCase();
const ENV = raw === 'production' || raw === 'prod' ? 'production' : 'staging';
const UPPER = ENV === 'production' ? 'PROD' : 'STAGING';
const DEFAULT_BASE =
  ENV === 'production'
    ? 'https://app.ledgerport.com'
    : 'https://app-staging.ledgerport.com';

const BASE_URL =
  process.env[`LP_${UPPER}_BASE_URL`] || process.env.LP_BASE_URL || DEFAULT_BASE;
const EMAIL = process.env[`LP_${UPPER}_EMAIL`] || process.env.LP_EMAIL || '';
const PASSWORD = process.env[`LP_${UPPER}_PASSWORD`] || process.env.LP_PASSWORD || '';

const AUTH_FILE = path.join(ROOT, '.auth', `${ENV}.json`);
const PROFILE_DIR = path.join(ROOT, '.auth', `chrome-profile-${ENV}`);
const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes to complete login

const host = new URL(BASE_URL).hostname;

fs.mkdirSync(PROFILE_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1366, height: 900 },
  // Strip Playwright's automation fingerprint so Cloudflare Turnstile presents
  // a normal, solvable checkbox instead of silently blocking the browser.
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = context.pages()[0] || (await context.newPage());

await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
if (EMAIL) await page.fill('#email', EMAIL).catch(() => {});
if (PASSWORD) await page.fill('#password', PASSWORD).catch(() => {});

console.log('\n========================================================');
console.log(`  Environment : ${ENV}`);
console.log(`  URL         : ${BASE_URL}/login`);
console.log(`  Account     : ${EMAIL || '(fill manually)'}`);
console.log('--------------------------------------------------------');
console.log(' 👉 Complete the login in the Chrome window that opened.');
console.log('    - Solve the Cloudflare Turnstile checkbox if shown');
console.log('    - Click "Log in" (or "Continue with Shopify")');
console.log(' Waiting up to 8 minutes for you to reach the dashboard...');
console.log('========================================================\n');

const start = Date.now();
let success = false;
let lastSeen = '';
while (Date.now() - start < TIMEOUT_MS) {
  await page.waitForTimeout(1500);
  const cur = context.pages().map((p) => p.url());
  let hit;
  for (const u of cur) {
    let url;
    try {
      url = new URL(u);
    } catch {
      continue;
    }
    if (url.hostname.includes(host) && !/\/login/.test(url.pathname)) {
      hit = u;
      break;
    }
  }
  if (cur.join('|') !== lastSeen) {
    lastSeen = cur.join('|');
    console.log('  [poll] open tabs:', cur.join(' , '));
  }
  if (hit) {
    success = true;
    break;
  }
}

if (success) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  console.log(`\n✅ Logged in. Saved ${ENV} session to ${path.relative(ROOT, AUTH_FILE)}`);
  console.log(`   Current URL: ${page.url()}\n`);
} else {
  console.log(`\n⏱  Timed out waiting for login. Re-run the capture for ${ENV}.\n`);
}

await context.close();
process.exit(success ? 0 : 1);
