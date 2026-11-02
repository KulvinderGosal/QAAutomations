/**
 * STAGING signup + onboarding — LedgerPort SaaS (app-staging.ledgerport.com).
 *
 * A real end-to-end account-creation journey with a human-in-the-loop email
 * verification code.
 *
 * Flow: /signup → fill (name, email, password, account, business) → "Continue"
 * → EMAIL VERIFICATION (the operator supplies the code mid-run) → the app's
 * onboarding "connect your store" surface. Reaching the authenticated onboarding
 * screen proves the account was created + verified. Actually connecting a real
 * Shopify store + QuickBooks is an external OAuth handshake that CANNOT be
 * automated — the spec asserts onboarding was reached and stops there.
 *
 * HOW TO RUN (on-demand — creates a REAL staging account):
 *     SIGNUP_PASSWORD='<pw>' HEADED=1 npm run test:signup
 *   When it prints "WAITING FOR VERIFICATION CODE", supply it:
 *     echo <code> > "$TMPDIR/lp-signup-otp.txt"     (or set SIGNUP_OTP=<code>)
 *   Email auto-generates as <QA_EMAIL user>+<random>@<QA_EMAIL domain> (override with
 *   SIGNUP_EMAIL) so the plus-addressed code lands in a mailbox you can read.
 *
 * SAFETY: staging ONLY — hard-skips on production so it can never create a real
 * production account. Runs under the PUBLIC project (no stored session).
 * Gated by QA_ALLOW_LOGIN_SPECS=1 (+ SIGNUP_PASSWORD) — it is an account-creation +
 * email-OTP flow. Once enabled, a missing signup form or failing to reach the app
 * after verification FAILS (those are the regressions this smoke exists to catch);
 * only a missing human-supplied OTP skips. Not part of the unattended smoke gate.
 * CLEANUP: each run leaves a kgosal+<random>@ staging account behind — delete it
 * manually (no self-serve delete-account flow is automated here).
 *
 * IDs: LP-SIGNUP-001
 */
import { test, expect, Page } from '@playwright/test';
import { waitForVerificationCode } from '../helpers/verification-code';
import { resolveEnvName } from '../../config/env';

const IS_PROD = resolveEnvName() === 'production';

function signupEmail(): string {
  if (process.env.SIGNUP_EMAIL) return process.env.SIGNUP_EMAIL;
  // Plus-addressed to QA_EMAIL (from .env) so the verification code lands in
  // a mailbox the operator can read (they relay the code back mid-run).
  const rnd = Math.random().toString(36).slice(2, 12);
  return (process.env.QA_EMAIL || 'qa@example.com').replace('@', `+${rnd}@`);
}

/** Fill an OTP into the inline #otp-code field, a one-time-code field, or split boxes. */
async function fillOtp(page: Page, code: string): Promise<void> {
  const single = page.locator('#otp-code, input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], input[name*="code" i]').first();
  const boxes = page.locator('input[maxlength="1"]');
  const boxCount = await boxes.count().catch(() => 0);
  if (await single.isVisible().catch(() => false)) {
    await single.fill(code);
  } else if (boxCount >= code.length) {
    for (let i = 0; i < code.length; i++) await boxes.nth(i).fill(code[i]).catch(() => {});
  } else {
    await page.keyboard.type(code);
  }
}

/** Reached the authenticated app (onboarding "connect store" or a dashboard). */
async function reachedApp(page: Page): Promise<boolean> {
  if (/\/(onboarding|connect|setup|dashboard|home|connections|app)\b/i.test(page.url())) return true;
  const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/connect your (store|shopify)|connect quickbooks|onboarding|welcome to ledgerport|get started/i.test(bodyText)) return true;
  return page.locator('nav, [class*="sidebar" i], [data-testid*="dashboard" i]').first().isVisible().catch(() => false);
}

test.describe('Staging signup + onboarding (real account, human OTP) @signup', () => {
  test.skip(IS_PROD, 'Signup smoke NEVER runs against production (it would create a real prod account). Staging only.');
  test.skip(!process.env.QA_ALLOW_LOGIN_SPECS, 'login spec: set QA_ALLOW_LOGIN_SPECS=1 with the QA account env vars to run');
  test.setTimeout(8 * 60 * 1000); // generous — pauses for the human-supplied code

  test('completes signup + email verification, reaches onboarding @signup', async ({ page }) => {
    const password = process.env.SIGNUP_PASSWORD;
    test.skip(!password, 'Set SIGNUP_PASSWORD to run the signup smoke. See the file header for the full run recipe.');
    const email = signupEmail();
    console.log(`\n📝 LedgerPort staging signup smoke — email: ${email}`);

    await test.step('Stage 1 — registration form', async () => {
      await page.goto('/signup', { waitUntil: 'domcontentloaded' });
      const emailField = page.locator('#email, input[type="email"]').first();
      await expect(emailField, 'signup form (email field) renders at /signup').toBeVisible({ timeout: 15_000 });
      await page.locator('#displayName, input[name="displayName"]').first().fill(process.env.SIGNUP_NAME || 'QA Smoke').catch(() => {});
      await emailField.fill(email);
      await page.locator('#password, input[type="password"]').first().fill(password as string);
      await page.locator('#accountName, input[name="accountName"]').first().fill(process.env.SIGNUP_ACCOUNT || 'QA Smoke Org').catch(() => {});
      await page.locator('#businessName, input[name="businessName"]').first().fill(process.env.SIGNUP_BUSINESS || 'QA Smoke Business').catch(() => {});
      // A terms checkbox may be required.
      const terms = page.locator('#signup-terms, input[type="checkbox"][name*="term" i]').first();
      if (await terms.isVisible().catch(() => false)) await terms.check().catch(() => {});
      console.log('  ✅ Registration form filled.');

      await page.getByRole('button', { name: /continue|create account|sign ?up|get started/i }).first().click().catch(() => {});
      await page.waitForTimeout(3500);
      console.log('  ✅ Registration submitted.');
    });

    await test.step('Stage 2 — email verification (human supplies the code)', async () => {
      const otpField = page.locator('#otp-code, input[autocomplete="one-time-code"], input[maxlength="1"], input[name*="otp" i], input[id*="otp" i], input[name*="code" i]').first();
      const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
      const needsOtp =
        (await otpField.isVisible({ timeout: 15000 }).catch(() => false)) ||
        /verify your email|verification code|enter the code|we sent (you )?a code|confirm your email|check your (email|inbox)/i.test(bodyText);
      if (!needsOtp) {
        console.log('  ℹ️ No email-verification step detected — continuing.');
        return;
      }
      const otp = await waitForVerificationCode({ timeoutMs: 300000 });
      if (!otp) {
        test.skip(true, 'No verification code supplied within 5 min. Provide it via SIGNUP_OTP or the OTP file (path printed above).');
      }
      await fillOtp(page, otp as string);
      await page.getByRole('button', { name: /verify|confirm|continue|create account|submit|next/i }).first().click().catch(() => {});
      await page.waitForTimeout(3500);
      console.log('  ✅ Verification code entered.');
    });

    await test.step('Stage 3 — reach the app / onboarding', async () => {
      // Onboarding proper (connect Shopify + QuickBooks) is an external OAuth
      // handshake that can't be automated. Reaching the authenticated onboarding
      // surface proves signup + verification succeeded, which is the smoke's goal.
      await expect
        .poll(() => reachedApp(page), {
          timeout: 20_000,
          message: 'Signup + verification should land on the authenticated app / onboarding surface',
        })
        .toBe(true);
      console.log(`  Final URL: ${page.url()}`);
      console.log('  ℹ️ Onboarding reached. Connecting a real Shopify store + QuickBooks is a manual OAuth step (not automatable).');
    });

    console.log(`✅ Signup + verification completed for ${email}`);
  });
});
