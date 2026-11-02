/**
 * LedgerPort SaaS — Login-page auth CTAs (public, no auth required)
 * Target: https://app-staging.ledgerport.com/login (and prod via LP_ENV)
 *
 * Smoke coverage for the unauthenticated login surface:
 *   - login form renders (email + password)
 *   - "Continue with Google" CTA  — HARD assert it exists (regression guard)
 *   - "Continue with Shopify" CTA — HARD assert it exists (regression guard)
 *   - invalid-credential login is rejected / never logs in
 *   - "Forgot password" routes to the reset page
 *   - sign-up CTA leads to a signup destination (or is documented as marketing-only)
 *
 * Runs under the PUBLIC project (no storageState) on BOTH staging and
 * production. Non-destructive: never submits real credentials and never
 * completes a real OAuth handshake — the social-login checks only verify the
 * click *begins* the provider flow (popup/redirect/initiate request, or the
 * Shopify shop-domain modal), then abort.
 *
 * IDs: LP-AUTHCTA-001 → LP-AUTHCTA-0xx
 */
import { test, expect, Page, Locator } from '@playwright/test';

/* -------------------------------------------------------------------------- */
/* Locators — resilient role/label/text first; #id only where the app uses it */
/* (the login page exposes #email / #password — see tests/public/login.spec.ts) */
/* -------------------------------------------------------------------------- */

const emailField = (page: Page): Locator =>
  page
    .getByRole('textbox', { name: /email/i })
    .or(page.getByLabel(/email/i))
    .or(page.locator('#email'))
    .first();

const passwordField = (page: Page): Locator =>
  page.getByLabel(/password/i).or(page.locator('#password')).first();

const submitButton = (page: Page): Locator =>
  page
    .getByRole('button', { name: /^log ?in$/i })
    .or(page.locator('button[type="submit"]'))
    .first();

/**
 * "Continue with Google" CTA. LedgerPort renders this via Google Identity
 * Services, whose accessible "button" name is "Continue with Google" (the GSI
 * widget lives in an accounts.google.com iframe but exposes that button role to
 * the top document). We also tolerate a plain link/button fallback.
 */
const googleCta = (page: Page): Locator =>
  page
    .getByRole('button', { name: /continue with google/i })
    .or(page.getByRole('link', { name: /continue with google/i }))
    .or(page.getByRole('button', { name: /(sign|log) ?in with google/i }))
    .first();

const shopifyCta = (page: Page): Locator =>
  page
    .getByRole('button', { name: /continue with shopify/i })
    .or(page.getByRole('link', { name: /continue with shopify/i }))
    .or(page.getByRole('button', { name: /(sign|log) ?in with shopify/i }))
    .first();

/**
 * Best-effort, NON-FAILING check that activating a social CTA *begins* its
 * provider flow — without ever entering credentials.
 *
 * "Began" is recognised from any of:
 *   - a top-level navigation to a provider host,
 *   - a popup/new tab opened toward a provider host or an oauth/auth URL,
 *   - a network request to the provider host or an oauth/auth "initiate" URL,
 *   - an in-app provider modal/input appearing (LedgerPort's Shopify CTA opens a
 *     "*.myshopify.com" shop-domain modal before it ever redirects).
 *
 * The provider hand-off is environment-sensitive (popups blocked in CI, GSI
 * One-Tap variations, modal-first flows), so this is annotated, never asserted —
 * the load-bearing regression guard is the CTA's visibility/enabled state in the
 * dedicated presence tests. We tear down anything the click opened.
 */
async function probeOAuthBegins(
  page: Page,
  cta: Locator,
  hostPattern: RegExp,
  label: string,
): Promise<void> {
  const ctx = page.context();
  const budgetMs = 6_000;
  const oauthish = /oauth|\/auth\//i;

  const popupP = ctx.waitForEvent('page', { timeout: budgetMs }).catch(() => null);
  const navP = page
    .waitForURL(hostPattern, { timeout: budgetMs })
    .then(() => true)
    .catch(() => false);
  const reqP = page
    .waitForRequest((r) => hostPattern.test(r.url()) || oauthish.test(r.url()), { timeout: budgetMs })
    .then((r) => r.url())
    .catch(() => null);
  // An in-app provider modal (e.g. Shopify shop-domain entry) also means the
  // flow started. Match a dialog or a *.myshopify.com hint surfacing.
  const modalP = page
    .locator('[role="dialog"], [role="alertdialog"]')
    .filter({ hasText: new RegExp(`${label.split(' ').pop()}|myshopify|store name|shop`, 'i') })
    .first()
    .waitFor({ state: 'visible', timeout: budgetMs })
    .then(() => true)
    .catch(() => false);

  await cta.click().catch(() => {});

  const [popup, nav, reqUrl, modal] = await Promise.all([popupP, navP, reqP, modalP]);
  const popupUrl = popup ? popup.url() : '';
  const began =
    nav ||
    modal ||
    (popup ? hostPattern.test(popupUrl) || oauthish.test(popupUrl) : false) ||
    (reqUrl ? hostPattern.test(reqUrl) || oauthish.test(reqUrl) : false);

  // Tear down so nothing real proceeds; NEVER enter a shop/email/credential.
  if (popup) await popup.close().catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  if (!/\/login/.test(page.url())) await page.goto('/login').catch(() => {});

  const detail =
    (nav ? ' top-level-nav' : '') +
    (modal ? ' in-app-modal' : '') +
    (popupUrl ? ` popup=${popupUrl}` : '') +
    (reqUrl ? ` req=${reqUrl}` : '');
  const msg = `${label} → flow begins: ${began ? 'YES' : 'inconclusive'}${detail}`;
  console.log(`[auth-ctas] ${msg}`);
  test.info().annotations.push({ type: 'oauth-begin', description: msg });
}

/* -------------------------------------------------------------------------- */

test.describe('Login page — auth CTAs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // Land on /login even if a logged-out hit redirects elsewhere first.
    await expect(page).toHaveURL(/\/login/);
  });

  test('LP-AUTHCTA-001 | Login page loads with email + password fields', { tag: '@smoke' }, async ({
    page,
  }) => {
    await expect(emailField(page)).toBeVisible();
    await expect(passwordField(page)).toBeVisible();
    await expect(submitButton(page)).toBeVisible();
  });

  test('LP-AUTHCTA-002 | "Continue with Google" login CTA is visible + enabled', { tag: '@smoke' }, async ({
    page,
  }) => {
    // HARD assertion (regression guard): if Google login is missing this fails
    // by design — do not weaken. Report it as a confirmed product gap.
    const cta = googleCta(page);
    await expect(cta, '"Continue with Google" login CTA must be present on the login page').toBeVisible();
    await expect(cta).toBeEnabled();
  });

  test('LP-AUTHCTA-003 | "Continue with Google" begins Google OAuth (best-effort, no creds)', {
    tag: '@smoke',
  }, async ({ page }) => {
    const cta = googleCta(page);
    // Web-first wait so we don't race GSI iframe hydration. Presence itself is
    // hard-asserted in LP-AUTHCTA-002; here we only annotate the hand-off.
    await expect(cta).toBeVisible();
    await probeOAuthBegins(page, cta, /accounts\.google\.com|\/oauth\/google|\/auth\/google/i, 'Continue with Google');
  });

  test('LP-AUTHCTA-004 | "Continue with Shopify" login CTA is visible + enabled', { tag: '@smoke' }, async ({
    page,
  }) => {
    // HARD assertion (regression guard).
    const cta = shopifyCta(page);
    await expect(cta, '"Continue with Shopify" login CTA must be present on the login page').toBeVisible();
    await expect(cta).toBeEnabled();
  });

  test('LP-AUTHCTA-005 | "Continue with Shopify" begins Shopify OAuth (best-effort, no creds)', {
    tag: '@smoke',
  }, async ({ page }) => {
    const cta = shopifyCta(page);
    await expect(cta).toBeVisible();
    // LedgerPort opens a "*.myshopify.com" shop-domain modal first, then
    // initiates via `oauth/shopify/login/initiate`. We never fill the shop field.
    await probeOAuthBegins(
      page,
      cta,
      /myshopify\.com|\.shopify\.com|oauth\/shopify|\/auth\/shopify/i,
      'Continue with Shopify',
    );
  });

  test('LP-AUTHCTA-006 | Invalid credentials are rejected (no login)', { tag: '@smoke' }, async ({
    page,
  }) => {
    const bogusEmail = `qa-nobody+${Date.now()}@example.com`;
    await emailField(page).fill(bogusEmail);
    await passwordField(page).fill('definitely-not-the-right-password-123!');

    const submit = submitButton(page);
    // The login page gates submit behind Cloudflare Turnstile; in a bot context
    // the button stays disabled and the form can't be submitted at all — which
    // itself proves no login occurred. If it ever is enabled (Turnstile test
    // mode), submit and require a visible inline error.
    if (await submit.isEnabled().catch(() => false)) {
      await submit.click();
      const inlineError = page
        .getByText(/invalid|incorrect|wrong|not match|unable to log|failed|try again|no account|credential/i)
        .or(page.getByRole('alert'))
        .first();
      await expect(inlineError, 'an inline auth error should appear for bad credentials').toBeVisible({
        timeout: 15_000,
      });
    } else {
      const note = 'Submit gated by Cloudflare Turnstile (stayed disabled) — bad creds never submitted.';
      console.log(`[auth-ctas] ${note}`);
      test.info().annotations.push({ type: 'turnstile', description: note });
    }

    // Either path: still on /login and NOT in the authenticated app.
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/(connections|mappings|manual-sync|manage-account|billing)\b/);
  });

  test('LP-AUTHCTA-007 | "Forgot password" link goes to a reset page with an email input', {
    tag: '@smoke',
  }, async ({ page }) => {
    const link = page.getByRole('link', { name: /forgot password/i }).first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/forgot-password|reset/i);
    await expect(emailField(page), 'the password-reset page should expose an email input').toBeVisible();
  });

  test('LP-AUTHCTA-008 | Sign-up CTA leads to a signup destination (marketing site or in-app form)', {
    tag: '@smoke',
  }, async ({ page }) => {
    const signupLink = page
      .getByRole('link', { name: /sign ?up|create (an )?account|get started|don'?t have an account/i })
      .first();
    await expect(signupLink, 'a sign-up CTA should be present on the login page').toBeVisible();

    const href = (await signupLink.getAttribute('href')) || '';
    // The destination must clearly be a signup route.
    expect(href, `sign-up CTA should target a signup route (got: "${href}")`).toMatch(/signup|sign-up|register/i);

    // LedgerPort hosts self-serve signup on the MARKETING site
    // (e.g. https://staging.ledgerport.com/signup), not the dashboard app. When
    // it's an in-app/same-origin route we follow it and require a form; when it
    // points off to the marketing origin we record that and assert by href only
    // (non-destructive — we don't load the full marketing funnel).
    const appOrigin = new URL(page.url()).origin;
    let absolute: URL | null = null;
    try {
      absolute = new URL(href, page.url());
    } catch {
      /* relative-only href already matched the signup pattern above */
    }
    const sameOrigin = absolute ? absolute.origin === appOrigin : true;

    if (sameOrigin) {
      await signupLink.click();
      await expect(page).toHaveURL(/signup|sign-up|register/i);
      await expect(
        emailField(page).or(page.locator('form').first()),
        'the in-app signup destination should render a signup form',
      ).toBeVisible({ timeout: 15_000 });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: `Sign-up is hosted on the marketing site, not the dashboard app: ${absolute?.href}. The login-page CTA links out to it (asserted by href; page not navigated to keep the check non-destructive).`,
      });
    }
  });
});
