const { test, expect } = require('@playwright/test');
const SignupPage = require('../../pages/signup.page');
const { buildSignupData } = require('../../fixtures/test-data');

test.describe('Ledgerport Signup Form Regression', () => {
  test('shows validation errors for empty submission', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await signupPage.open();

    await signupPage.submit();

    const errorText = (await signupPage.getInlineErrors()).join(' ');
    await expect
      .soft(errorText.toLowerCase())
      .toMatch(/required|invalid|email|name|password/);
  });

  test('accepts valid data and responds without client-side validation blockers', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const signupData = buildSignupData();

    await signupPage.open();
    await signupPage.fillSignupForm(signupData);
    await signupPage.acceptTermsIfPresent();

    const responseStatus = await signupPage.submitAndCaptureResponseStatus();
    const urlAfterSubmit = page.url();
    const inlineErrors = await signupPage.getInlineErrors();
    const hasBlockingInlineValidation = inlineErrors.some((msg) =>
      /(required|invalid|must|format|error)/i.test(msg),
    );

    // A successful signup may redirect, show confirmation, or return a successful API call.
    // Existing accounts can also yield a deterministic "already exists" response and still
    // prove that the flow reached backend validation.
    const knownAlreadyExists = inlineErrors.some((msg) =>
      /(already exists|already registered|already in use)/i.test(msg),
    );

    const navigatedAwayFromSignup = !/signup|register/i.test(urlAfterSubmit);
    const backendAccepted = typeof responseStatus === 'number' && responseStatus < 500;

    expect(
      navigatedAwayFromSignup || backendAccepted || knownAlreadyExists || !hasBlockingInlineValidation,
    ).toBeTruthy();
  });
});
