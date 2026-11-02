/**
 * Test Suite: CRITICAL - Login Flow
 * Test ID Prefix: PESITE-005x
 * Priority: CRITICAL
 * Feature: LOGIN / AUTHENTICATION
 *
 * Covers:
 *  - Login page loads
 *  - Email & password fields present
 *  - Forgot password link present
 *  - Google OAuth option present
 *  - Invalid credentials show error message
 *  - Sign up link present on login page
 *
 * NOTE: Successful login with real credentials is handled separately
 * in auth-state tests to avoid session conflicts.
 */

const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');

test.describe('CRITICAL - Login Flow', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.open();
  });

  test('PESITE-0501 - Login page loads @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0501: Verifying login page loads');

    const url = page.url();
    console.log(`  Login URL: ${url}`);
    expect(url).toMatch(/login|sign-in|signin/i);

    const title = await loginPage.getTitle();
    console.log(`  Page title: "${title}"`);

    console.log('✅ Login page loaded');
  });

  test('PESITE-0502 - Email field visible on login form @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0502: Checking email field');

    const emailField = await loginPage.getEmailField();
    expect(emailField, 'Email input should be visible on login page').toBeTruthy();

    console.log('✅ Email field present');
  });

  test('PESITE-0503 - Password field visible on login form @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0503: Checking password field');

    const passField = await loginPage.getPasswordField();
    expect(passField, 'Password input should be visible on login page').toBeTruthy();

    console.log('✅ Password field present');
  });

  test('PESITE-0504 - Submit / Login button visible @smoke @critical', async ({ page }) => {
    console.log('📍 PESITE-0504: Checking login submit button');

    const btn = await loginPage.getSubmitBtn();
    expect(btn, 'Login/Sign-In submit button should be visible').toBeTruthy();

    const text = await btn.textContent();
    console.log(`  Button text: "${text?.trim()}"`);

    console.log('✅ Login button present');
  });

  test('PESITE-0505 - Forgot password link is present @critical', async ({ page }) => {
    console.log('📍 PESITE-0505: Checking forgot password link');

    const link = await loginPage.getForgotLink();
    expect(link, 'A "Forgot Password" / "Reset Password" link should be on login page').toBeTruthy();

    const href = await link.getAttribute('href');
    console.log(`  Forgot password href: ${href}`);

    console.log('✅ Forgot password link present');
  });

  test('PESITE-0506 - Google OAuth option visible on login @critical', async ({ page }) => {
    console.log('📍 PESITE-0506: Checking Google OAuth on login');

    const googleBtn = await loginPage.getGoogleOAuth();
    expect(googleBtn, '"Continue with Google" button should be on login page').toBeTruthy();

    console.log('✅ Google OAuth option present on login');
  });

  test('PESITE-0507 - Sign up link present on login page @critical', async ({ page }) => {
    console.log('📍 PESITE-0507: Checking signup link on login page');

    const link = await loginPage.getSignupLink();
    expect(link, 'A "Sign Up" or "Create Account" link should be on the login page').toBeTruthy();

    console.log('✅ Signup link present on login page');
  });

  test('PESITE-0508 - Invalid credentials show error message @critical', async ({ page }) => {
    console.log('📍 PESITE-0508: Testing invalid credentials error');

    await loginPage.submitInvalidCredentials();

    const errorMsg = await loginPage.getErrorMessage();
    console.log(`  Error message: "${errorMsg?.trim()}"`);
    expect(errorMsg, 'Invalid credentials should show an error message').toBeTruthy();

    // Make sure we're still on login page (not redirected)
    const url = page.url();
    expect(url).toMatch(/login|sign-in|signin/i);

    console.log('✅ Invalid credentials correctly show error message');
  });
});
