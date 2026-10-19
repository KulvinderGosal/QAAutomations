const { test, expect } = require('@playwright/test');
const HomePage = require('../../pages/home.page');
const SignupPage = require('../../pages/signup.page');
const { buildSignupData } = require('../../fixtures/test-data');

test.describe('Ledgerport smoke: homepage and signup entry', () => {
  test('homepage renders and signup path can be opened', async ({ page }) => {
    const homePage = new HomePage(page);
    const signupPage = new SignupPage(page);

    await homePage.open();
    await homePage.handleCookieBannerIfPresent();
    await homePage.assertHomePageVisible();

    await homePage.goToSignup();
    await signupPage.assertSignupFormVisible();
  });

  test('signup form accepts basic input set', async ({ page }) => {
    const homePage = new HomePage(page);
    const signupPage = new SignupPage(page);
    const signupData = buildSignupData();

    await homePage.open();
    await homePage.handleCookieBannerIfPresent();
    await homePage.goToSignup();
    await signupPage.assertSignupFormVisible();

    await signupPage.fillSignupBasics(signupData);
    await signupPage.acceptTermsIfPresent();

    // Presence check before submit click makes failures easier to diagnose.
    await expect(signupPage.primarySubmitButton).toBeVisible();
  });
});
