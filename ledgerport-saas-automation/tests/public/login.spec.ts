/**
 * LedgerPort SaaS — Login page (public, no auth required)
 * Target: https://app-staging.ledgerport.com/login
 *
 * IDs: LP-LOGIN-001 → LP-LOGIN-0xx
 */
import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
  });

  test('LP-LOGIN-001 | Page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Log ?In \| LedgerPort/i);
  });

  test('LP-LOGIN-002 | Protected route redirects to login', async ({ page }) => {
    await page.goto('/connections', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?redirect=%2Fconnections/);
  });

  test('LP-LOGIN-003 | Email and password fields are present', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#email')).toHaveAttribute('placeholder', /@/);
  });

  test('LP-LOGIN-004 | Log in button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^log in$/i })).toBeVisible();
  });

  test('LP-LOGIN-005 | "Continue with Shopify" option is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /continue with shopify/i })).toBeVisible();
  });

  test('LP-LOGIN-006 | Forgot password link points to /forgot-password', async ({ page }) => {
    const link = page.getByRole('link', { name: /forgot password/i });
    await expect(link).toHaveAttribute('href', '/forgot-password');
  });

  test('LP-LOGIN-007 | Sign up link points to signup', async ({ page }) => {
    const link = page.getByRole('link', { name: /sign up/i });
    await expect(link).toHaveAttribute('href', /signup/);
  });

  test('LP-LOGIN-008 | Show/hide password toggle works', async ({ page }) => {
    const pwd = page.locator('#password');
    await pwd.fill('secret123');
    await expect(pwd).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(pwd).toHaveAttribute('type', 'text');
  });

  test('LP-LOGIN-009 | Cloudflare Turnstile widget is present', async ({ page }) => {
    // The hidden response input is injected by the Turnstile script.
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveCount(1);
  });

  test('LP-LOGIN-010 | Log in is gated behind Turnstile (stays disabled until solved)', async ({ page }) => {
    // Even with both fields filled, the submit button must remain disabled
    // until Cloudflare Turnstile issues a token — this is the anti-bot guard.
    await page.fill('#email', 'someone@example.com');
    await page.fill('#password', 'somepassword123');
    await page.waitForTimeout(3000);
    const token = await page.locator('input[name="cf-turnstile-response"]').inputValue().catch(() => '');
    if (token.length > 10) {
      // Turnstile resolved (test mode) — button should be enabled.
      await expect(page.locator('button[type="submit"]')).toBeEnabled();
    } else {
      // Turnstile not solved (bot context) — button must stay disabled.
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    }
  });
});
