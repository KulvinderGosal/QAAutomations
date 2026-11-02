const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');
const config = require('../utils/config');

class LoginPage extends BasePage {
  async open() {
    // Login lives on app subdomain
    await this.page.goto(`${config.appUrl}/login`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  get formSelectors() {
    return {
      emailField: [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        '#email',
      ],
      passwordField: [
        'input[type="password"]',
        'input[name="password"]',
        '#password',
      ],
      submitBtn: [
        'button[type="submit"]',
        'button:has-text("Log In")',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        'input[type="submit"]',
      ],
      forgotLink: [
        'a:has-text("Forgot")',
        'a:has-text("Reset Password")',
        'a[href*="forgot"]',
        'a[href*="reset"]',
      ],
      googleOAuth: [
        'button:has-text("Continue with Google")',
        'a:has-text("Continue with Google")',
        'button:has-text("Sign in with Google")',
        'button:has-text("Log in with Google")', // app.pushengage.com login uses this label
        'a:has-text("Log in with Google")',
        'button:has-text("Google")',
        '[class*="google-btn"]',
      ],
      signupLink: [
        'a:has-text("Sign Up")',
        'a:has-text("Create Account")',
        'a:has-text("Register")',
        'a[href*="signup"]',
        'a[href*="register"]',
      ],
    };
  }

  async getEmailField()    { return findFirstVisible(this.page, this.formSelectors.emailField); }
  async getPasswordField() { return findFirstVisible(this.page, this.formSelectors.passwordField); }
  async getSubmitBtn()     { return findFirstVisible(this.page, this.formSelectors.submitBtn); }
  async getForgotLink()    { return findFirstVisible(this.page, this.formSelectors.forgotLink); }
  async getGoogleOAuth()   { return findFirstVisible(this.page, this.formSelectors.googleOAuth); }
  async getSignupLink()    { return findFirstVisible(this.page, this.formSelectors.signupLink); }

  async isFormVisible() {
    const email = await this.getEmailField();
    const submit = await this.getSubmitBtn();
    return !!(email && submit);
  }

  async fillCredentials(email, password) {
    const emailField = await this.getEmailField();
    const passField  = await this.getPasswordField();
    if (emailField) await emailField.fill(email);
    if (passField)  await passField.fill(password);
  }

  async submitInvalidCredentials() {
    await this.fillCredentials('invalid@example.com', 'wrongpassword123');
    const btn = await this.getSubmitBtn();
    if (btn) await btn.click();
    await this.page.waitForTimeout(2000);
  }

  async getErrorMessage() {
    const errorSelectors = [
      '[class*="error"]',
      '[class*="alert"]',
      '[role="alert"]',
      '.notification-error',
    ];
    for (const selector of errorSelectors) {
      const loc = this.page.locator(selector).first();
      if (await loc.isVisible({ timeout: 5000 }).catch(() => false)) {
        return loc.textContent();
      }
    }
    return null;
  }
}

module.exports = LoginPage;
