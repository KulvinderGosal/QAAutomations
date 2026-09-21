/**
 * Authentication helpers for the AI Onboarding Wizard suite.
 *
 * Logs into the staging app dashboard and (optionally) caches a storageState
 * per account so specs can reuse a warm session instead of logging in each time.
 */
const path = require('path');
const fs = require('fs');
const cfg = require('./onboarding-config');

const AUTH_DIR = path.join(process.cwd(), 'test-results', '.auth');

function storageStatePath(accountKey) {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  return path.join(AUTH_DIR, `onboarding-${accountKey}.json`);
}

/**
 * Resolve an account descriptor from a key ('free' | 'paid' | 'subUser' | 'shopify')
 * or accept an explicit { email, password } object.
 */
function resolveAccount(account) {
  if (account && typeof account === 'object' && account.email) return account;
  const acc = cfg.accounts[account];
  if (!acc || !acc.email) {
    throw new Error(
      `Onboarding account "${account}" is not configured. Set the matching PE_* env vars (see .env.example).`
    );
  }
  return acc;
}

/**
 * Log into the app dashboard as the given account.
 * @param {import('@playwright/test').Page} page
 * @param {string|object} account  account key or { email, password }
 * @returns {Promise<boolean>} true when we end up on a non-login URL
 */
async function login(page, account) {
  const acc = resolveAccount(account);
  console.log(`🔐 Logging into ${cfg.appDashboardUrl} as ${acc.email} ...`);

  await page.goto(`${cfg.appDashboardUrl}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: cfg.timeouts.nav,
  });
  await page.waitForTimeout(1500);

  if (!page.url().includes('login')) {
    console.log('✅ Already authenticated (existing session).');
    return true;
  }

  const emailSelectors = ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="email" i]'];
  const passSelectors = ['input[name="password"]', 'input[type="password"]', 'input[placeholder*="password" i]'];
  const submitSelectors = ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Login")', 'button:has-text("Sign in")'];

  await fillFirst(page, emailSelectors, acc.email, 'email');
  await fillFirst(page, passSelectors, acc.password, 'password');
  await clickFirst(page, submitSelectors, 'submit');

  // Wait until the app routes away from /login (dashboard, onboarding, etc.)
  try {
    await page.waitForURL((url) => !String(url).includes('/login'), { timeout: cfg.timeouts.nav });
  } catch (e) {
    await page.screenshot({ path: `test-results/onboarding-login-failed-${Date.now()}.png`, fullPage: true }).catch(() => {});
    console.log('⚠️  Still on /login after submit — check credentials / captcha.');
    return false;
  }

  console.log('✅ Logged in.');
  return true;
}

/**
 * Log in and persist storageState for reuse (call from a setup/beforeAll).
 */
async function loginAndSaveState(page, accountKey) {
  const ok = await login(page, accountKey);
  if (ok) await page.context().storageState({ path: storageStatePath(accountKey) });
  return ok;
}

async function fillFirst(page, selectors, value, label) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await el.fill(value);
        console.log(`   ✓ filled ${label}`);
        return true;
      }
    } catch (e) { /* try next */ }
  }
  console.log(`   ⚠️  could not find ${label} field`);
  return false;
}

async function clickFirst(page, selectors, label) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await el.click();
        console.log(`   ✓ clicked ${label}`);
        return true;
      }
    } catch (e) { /* try next */ }
  }
  console.log(`   ⚠️  could not find ${label} control`);
  return false;
}

module.exports = { login, loginAndSaveState, storageStatePath, resolveAccount };
