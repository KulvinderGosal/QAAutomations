const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');
const config = require('../utils/config');

class SignupPage extends BasePage {
  async open() {
    await this.goto(config.pages.signup);
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
        'input[placeholder*="password" i]',
      ],
      nameField: [
        'input[name="name"]',
        'input[name="first_name"]',
        'input[placeholder*="name" i]',
        '#name',
        '#first_name',
      ],
      submitBtn: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign Up")',
        'button:has-text("Create Account")',
        'button:has-text("Get Started")',
        'button:has-text("Register")',
      ],
      googleOAuth: [
        'button:has-text("Continue with Google")',
        'a:has-text("Continue with Google")',
        'button:has-text("Sign up with Google")',
        '[class*="google"]',
      ],
    };
  }

  async getEmailField()    { return findFirstVisible(this.page, this.formSelectors.emailField); }
  async getPasswordField() { return findFirstVisible(this.page, this.formSelectors.passwordField); }
  async getNameField()     { return findFirstVisible(this.page, this.formSelectors.nameField); }
  async getSubmitBtn()     { return findFirstVisible(this.page, this.formSelectors.submitBtn); }
  async getGoogleOAuth()   { return findFirstVisible(this.page, this.formSelectors.googleOAuth); }

  async fillEmail(email) {
    const field = await this.getEmailField();
    if (field) { await field.fill(email); return true; }
    return false;
  }

  async fillPassword(password) {
    const field = await this.getPasswordField();
    if (field) { await field.fill(password); return true; }
    return false;
  }

  async isFormVisible() {
    const email = await this.getEmailField();
    const submit = await this.getSubmitBtn();
    return !!(email && submit);
  }

  async submitEmpty() {
    const btn = await this.getSubmitBtn();
    if (btn) await btn.click();
  }

  async getValidationErrors() {
    const errorSelectors = [
      '[class*="error"]',
      '[class*="invalid"]',
      '.field-error',
      'span[role="alert"]',
      'p[class*="error"]',
    ];
    for (const selector of errorSelectors) {
      const count = await this.page.locator(selector).count();
      if (count > 0) return count;
    }
    return 0;
  }
}

module.exports = SignupPage;
