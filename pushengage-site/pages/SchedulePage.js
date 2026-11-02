const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');
const config = require('../utils/config');

/**
 * Page Object for the "Schedule a Demo" page (/schedule_demo/).
 * The demo form is a WPForms form (Name, Email, City, Country, Website,
 * preference checkboxes) protected by Google reCAPTCHA + submit "Schedule Demo".
 *
 * Selectors prefer placeholder/type (stable across staging↔prod) and fall back
 * to the WPForms numeric field names which can differ per environment/form-id.
 */
class SchedulePage extends BasePage {
  async open() {
    await this.goto(config.pages.scheduleDemo);
  }

  get selectors() {
    return {
      form: ['form.wpforms-form', 'form[id^="wpforms-form"]', 'div.wpforms-container form'],
      name: ['input[placeholder="Your Name" i]', 'input[name="wpforms[fields][1]"]', '.wpforms-field-name input'],
      email: ['form.wpforms-form input[type="email"]', 'input[placeholder="Email" i]', 'input[name="wpforms[fields][11]"]'],
      city: ['input[placeholder="City" i]', 'input[name="wpforms[fields][6]"]'],
      country: ['input[placeholder="Country" i]', 'input[name="wpforms[fields][2]"]'],
      website: ['form.wpforms-form input[type="url"]', 'input[placeholder="Website" i]', 'input[name="wpforms[fields][12]"]'],
      submit: ['form.wpforms-form button[type="submit"]', '.wpforms-submit', 'button:has-text("Schedule Demo")'],
      recaptcha: ['.g-recaptcha', 'iframe[src*="recaptcha"]', 'textarea[name="g-recaptcha-response"]'],
      validationError: ['label.wpforms-error', '.wpforms-error', '[aria-invalid="true"]'],
      successConfirmation: ['.wpforms-confirmation-container', '.wpforms-confirmation-container-full', 'div:has-text("Thanks for")'],
    };
  }

  async getForm()      { return findFirstVisible(this.page, this.selectors.form); }
  async getNameField() { return findFirstVisible(this.page, this.selectors.name); }
  async getEmailField(){ return findFirstVisible(this.page, this.selectors.email); }
  async getCountryField(){ return findFirstVisible(this.page, this.selectors.country); }
  async getSubmitBtn() { return findFirstVisible(this.page, this.selectors.submit); }
  async getRecaptcha() { return findFirstVisible(this.page, this.selectors.recaptcha); }

  /** True when the demo form's required fields + submit button are all present. */
  async isFormReady() {
    const name = await this.getNameField();
    const email = await this.getEmailField();
    const country = await this.getCountryField();
    const submit = await this.getSubmitBtn();
    return !!(name && email && country && submit);
  }

  /** Fill the demo form with the given data (only fields that exist). */
  async fill({ name, email, city, country, website }) {
    const setIf = async (getter, val) => {
      if (val == null) return;
      const el = await getter.call(this);
      if (el) await el.fill(String(val));
    };
    await setIf(this.getNameField, name);
    await setIf(this.getEmailField, email);
    const cityEl = await findFirstVisible(this.page, this.selectors.city);
    if (cityEl && city) await cityEl.fill(city);
    await setIf(this.getCountryField, country);
    const siteEl = await findFirstVisible(this.page, this.selectors.website);
    if (siteEl && website) await siteEl.fill(website);
  }

  async clickSubmit() {
    const btn = await this.getSubmitBtn();
    if (btn) await btn.click();
    await this.page.waitForTimeout(1500);
  }

  /** Count currently-visible WPForms validation error labels. */
  async visibleValidationErrors() {
    let count = 0;
    for (const sel of this.selectors.validationError) {
      count += await this.page.locator(`${sel}:visible`).count().catch(() => 0);
    }
    return count;
  }

  async hasSuccessConfirmation() {
    const el = await findFirstVisible(this.page, this.selectors.successConfirmation, 3000);
    return !!el;
  }
}

module.exports = SchedulePage;
