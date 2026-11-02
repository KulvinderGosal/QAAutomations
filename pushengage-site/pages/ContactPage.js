const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');
const config = require('../utils/config');

class ContactPage extends BasePage {
  async open() {
    await this.goto(config.pages.contact);
    await this.revealForm();
  }

  /**
   * FINDING: the redesigned /contact-us/ hides the WPForms contact form inside a
   * `.pe-contact-page-contact-form.hidden` column — the page leads with the
   * PushHelper AI chat + a "Submit a Support Ticket" link instead, and the
   * visible "create a support ticket" link (href="#") does NOT reveal the form.
   * We un-hide it here so the form's fields/validation/submit can still be
   * exercised. (See PESITE-1070 which asserts this hidden-by-default state.)
   */
  async revealForm() {
    await this.page.evaluate(() => {
      document.querySelectorAll('.pe-contact-page-contact-form').forEach((el) => {
        el.classList.remove('hidden');
        el.style.display = '';
      });
      let el = document.getElementById('wpforms-form-1682') || document.querySelector('form.wpforms-form');
      while (el && el !== document.body) {
        if (getComputedStyle(el).display === 'none') el.style.display = 'block';
        el = el.parentElement;
      }
    }).catch(() => {});
    await this.page.waitForTimeout(300);
  }

  /** True if the contact form is hidden by default (before revealForm). */
  async isFormHiddenByDefault() {
    return this.page.evaluate(() => {
      const f = document.getElementById('wpforms-form-1682') || document.querySelector('form.wpforms-form');
      return f ? (f.offsetParent === null || f.getClientRects().length === 0) : null;
    }).catch(() => null);
  }

  get formSelectors() {
    return {
      nameField: [
        'input[name="name"]',
        'input[name="your-name"]',
        'input[placeholder*="name" i]',
        '#name',
      ],
      emailField: [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="your-email"]',
        '#email',
      ],
      messageField: [
        'textarea',
        'textarea[name="message"]',
        'textarea[placeholder*="message" i]',
        '#message',
      ],
      submitBtn: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Send")',
        'button:has-text("Submit")',
        'button:has-text("Contact")',
      ],
    };
  }

  get demoFormSelectors() {
    return [
      'form[id*="demo"]',
      'form[class*="demo"]',
      'div[class*="demo-form"]',
      '[id*="demo-request"]',
    ];
  }

  async getNameField()    { return findFirstVisible(this.page, this.formSelectors.nameField); }
  async getEmailField()   { return findFirstVisible(this.page, this.formSelectors.emailField); }
  async getMessageField() { return findFirstVisible(this.page, this.formSelectors.messageField); }
  async getSubmitBtn()    { return findFirstVisible(this.page, this.formSelectors.submitBtn); }
  async getDemoForm()     { return findFirstVisible(this.page, this.demoFormSelectors); }

  async isContactFormVisible() {
    const email  = await this.getEmailField();
    const submit = await this.getSubmitBtn();
    return !!(email && submit);
  }

  async fillContactForm(name, email, message) {
    const nameField    = await this.getNameField();
    const emailField   = await this.getEmailField();
    const messageField = await this.getMessageField();
    if (nameField)    await nameField.fill(name);
    if (emailField)   await emailField.fill(email);
    if (messageField) await messageField.fill(message);
  }

  async submitEmpty() {
    const btn = await this.getSubmitBtn();
    if (btn) await btn.click();
    await this.page.waitForTimeout(1000);
  }

  // ── Full WPForms contact form (/contact-us/): Name, Email, Website, Topic, Message ──
  // NOTE: scope to :visible — WPForms adds a hidden honeypot text input + a hidden
  // reCAPTCHA textarea that would otherwise be matched first.
  form()        { return this.page.locator('form.wpforms-form, form[id^="wpforms-form"]').first(); }
  nameInput()   { return this.form().locator('input[type="text"]:visible').first(); }
  emailInput()  { return this.form().locator('input[type="email"]:visible').first(); }
  websiteField(){ return this.form().locator('input[type="url"]:visible').first(); }
  topicSelect() { return this.form().locator('select').first(); }
  messageBox()  { return this.form().locator('textarea:visible').first(); }
  submitBtn()   { return this.form().locator('button[type="submit"]:visible, .wpforms-submit:visible').first(); }
  recaptcha()   { return this.page.locator('.g-recaptcha, iframe[src*="recaptcha"]').first(); }

  async recaptchaPresent() { return (await this.recaptcha().count().catch(() => 0)) > 0; }
  async errorCount()       { return this.page.locator('label.wpforms-error:visible, .wpforms-error:visible, [aria-invalid="true"]').count().catch(() => 0); }

  /** True when all required contact fields are present (Name/Email/Website/Topic/Message + submit). */
  async hasAllRequiredFields() {
    const text   = await this.nameInput().isVisible({ timeout: 8000 }).catch(() => false);
    const email  = await this.emailInput().isVisible({ timeout: 4000 }).catch(() => false);
    const url    = await this.websiteField().isVisible({ timeout: 4000 }).catch(() => false);
    const topic  = (await this.topicSelect().count().catch(() => 0)) > 0;
    const msg    = await this.messageBox().isVisible({ timeout: 4000 }).catch(() => false);
    const submit = await this.submitBtn().isVisible({ timeout: 4000 }).catch(() => false);
    return { text, email, url, topic, msg, submit, all: text && email && url && topic && msg && submit };
  }

  /** Fill every contact field with the given data (Topic = first real option). */
  async fillAll(data = config.forms.contact) {
    await this.nameInput().fill(data.name).catch(() => {});
    await this.emailInput().fill(data.email).catch(() => {});
    const url = this.websiteField();
    if (await url.count().catch(() => 0)) await url.fill(data.website || 'https://www.pushengage.com').catch(() => {});
    const sel = this.topicSelect();
    if (await sel.count().catch(() => 0)) {
      // WPForms "modern" dropdown (Choices.js) hides the native <select>, so set
      // its value + fire change directly rather than selectOption (needs visibility).
      await sel.evaluate((s) => { s.selectedIndex = s.options.length > 1 ? 1 : 0; s.dispatchEvent(new Event('change', { bubbles: true })); }).catch(async () => {
        await sel.selectOption({ index: 1 }).catch(() => {});
      });
    }
    await this.messageBox().fill(data.message).catch(() => {});
  }

  async submit() {
    await this.submitBtn().click().catch(() => {});
    await this.page.waitForTimeout(1500);
  }

  async hasSuccessConfirmation() {
    return this.page.locator('.wpforms-confirmation-container, .wpforms-confirmation-container-full')
      .first().isVisible({ timeout: 3000 }).catch(() => false);
  }
}

module.exports = ContactPage;
