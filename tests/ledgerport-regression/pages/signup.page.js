const { expect } = require('@playwright/test');
const BasePage = require('./base.page');
const { routes, selectors } = require('../fixtures/test-data');

class SignupPage extends BasePage {
  constructor(page) {
    super(page);
    this.form = page.locator('form').first();
    this.primarySubmitButton = page.locator(selectors.form.submit.join(', ')).first();
  }

  async open() {
    await this.goto(routes.signup);
  }

  async assertSignupFormVisible() {
    await expect(this.form).toBeVisible({ timeout: 30000 });
  }

  async fillOptional(value, selectorList) {
    if (!value) {
      return false;
    }

    for (const selector of selectorList) {
      const field = this.page.locator(selector).first();
      if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
        await field.fill(value);
        return true;
      }
    }

    return false;
  }

  async fillSignupBasics(data) {
    const hasSplitName =
      (await this.page.locator(selectors.form.firstName.join(', ')).count()) > 0 ||
      (await this.page.locator(selectors.form.lastName.join(', ')).count()) > 0;

    if (hasSplitName) {
      await this.fillOptional(data.firstName, selectors.form.firstName);
      await this.fillOptional(data.lastName, selectors.form.lastName);
    } else {
      await this.fillOptional(data.fullName, selectors.form.fullName);
    }

    await this.fillOptional(data.email, selectors.form.email);
    await this.fillOptional(data.password, selectors.form.password);
    await this.fillOptional(data.company, selectors.form.company);
    await this.fillOptional(data.website, selectors.form.website);
    await this.fillOptional(data.phone, selectors.form.phone);
  }

  async fillSignupForm(data) {
    await this.fillSignupBasics(data);
    return data;
  }

  async acceptTermsIfPresent() {
    const checkbox = this.page.locator(selectors.form.terms.join(', ')).first();
    if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await checkbox.isChecked())) {
        await checkbox.check({ force: true });
      }
      return true;
    }
    return false;
  }

  async submit() {
    await this.primarySubmitButton.click();
  }

  async getInlineErrors() {
    const errors = [];
    for (const selector of selectors.form.errors) {
      const locators = this.page.locator(selector);
      const count = await locators.count();
      for (let i = 0; i < count; i++) {
        const item = locators.nth(i);
        if (await item.isVisible().catch(() => false)) {
          const text = (await item.textContent().catch(() => '')).trim();
          if (text) {
            errors.push(text);
          }
        }
      }
    }
    return [...new Set(errors)];
  }

  async submitAndCaptureResponseStatus() {
    const requestPromise = this.page
      .waitForResponse(
        (resp) =>
          /signup|register|users|accounts/i.test(resp.url()) &&
          ['POST', 'PUT'].includes(resp.request().method()),
        { timeout: 20000 },
      )
      .catch(() => null);

    await this.submit();

    const response = await requestPromise;
    return response ? response.status() : null;
  }
}

module.exports = SignupPage;
