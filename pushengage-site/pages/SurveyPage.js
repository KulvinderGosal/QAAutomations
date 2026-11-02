const BasePage = require('./BasePage');
const config = require('../utils/config');

/**
 * Page Object for the PushEngage survey forms (WPForms), reused by both:
 *   - /user-survey/        (single step: Email + 0-10 NPS rating + feedback textareas)
 *   - /affiliates-survey/  (4-step: contact + industry/visitors/channels/goals/resources)
 * Both end in Google reCAPTCHA + a Submit button.
 *
 * The fill logic is generic: it fills whatever required fields are VISIBLE on the
 * current step, so it works for single-step and multi-step surveys alike.
 */
class SurveyPage extends BasePage {
  async open(path) {
    await this.goto(path);
  }

  form()        { return this.page.locator('form.wpforms-form, form[id^="wpforms-form"]').first(); }
  recaptcha()   { return this.page.locator('.g-recaptcha, iframe[src*="recaptcha"]').first(); }
  submitButton(){ return this.page.locator('form.wpforms-form button[type="submit"], .wpforms-submit').filter({ hasText: /submit/i }).first(); }
  nextButton()  { return this.page.locator('.wpforms-page-next, form.wpforms-form button:has-text("Next")').first(); }

  async isReady() {
    return this.form().isVisible({ timeout: 8000 }).catch(() => false);
  }

  async errorCount() {
    return this.page.locator('label.wpforms-error:visible, .wpforms-error:visible, [aria-invalid="true"]').count().catch(() => 0);
  }

  async recaptchaPresent() {
    return (await this.recaptcha().count().catch(() => 0)) > 0;
  }

  /** Fill every required field that is VISIBLE on the current step. */
  async fillCurrentStep(data = config.forms.survey) {
    const form = this.form();

    // Text-like inputs (skip hidden + reCAPTCHA fields)
    const text = form.locator('input[type="text"]:visible, input[type="email"]:visible, input[type="url"]:visible, input[type="tel"]:visible, input[type="number"]:visible, textarea:visible');
    const tn = await text.count();
    for (let i = 0; i < tn; i++) {
      const el = text.nth(i);
      const name = (await el.getAttribute('name')) || '';
      if (/recaptcha/i.test(name)) continue;
      const type = (await el.getAttribute('type')) || 'textarea';
      const val = type === 'email' ? data.email
        : type === 'url' ? data.website
        : type === 'number' ? '5'
        : data.text;
      await el.fill(val).catch(() => {});
    }

    // Radio + checkbox groups: select the first choice in EACH group on the
    // active step. Done in-page because WPForms visually hides the native
    // inputs (e.g. the 0-10 NPS rating), so Playwright .check() can't see them.
    // Scope to the visible .wpforms-page (multi-step) or the whole form.
    await form.evaluate((formEl, rating) => {
      const pages = [...formEl.querySelectorAll('.wpforms-page')];
      const active = pages.find((p) => p.offsetParent !== null) || formEl;
      const fire = (el) => {
        el.checked = true;
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const labelOf = (inp) => {
        const l = inp.closest('label') || (inp.id && formEl.querySelector('label[for="' + inp.id + '"]')) || (inp.parentElement && inp.parentElement.querySelector('label'));
        return l ? l.textContent.trim() : '';
      };
      // Radios: one per group — prefer the option matching the desired rating
      // (e.g. the NPS "10"), else the first option.
      const radioNames = [...new Set([...active.querySelectorAll('input[type="radio"]:not([disabled])')].map((r) => r.name))];
      for (const name of radioNames) {
        const opts = [...active.querySelectorAll('input[type="radio"][name="' + name + '"]:not([disabled])')];
        const pick = opts.find((o) => o.value === rating) || opts.find((o) => labelOf(o) === rating) || opts[0];
        if (pick) fire(pick);
      }
      // Checkboxes: first option per group.
      const seenCheck = new Set();
      active.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach((c) => {
        if (!seenCheck.has(c.name)) { seenCheck.add(c.name); fire(c); }
      });
    }, config.forms.survey.rating || '10').catch(() => {});
  }

  /** True if a "Next" (multi-step) button is currently visible. */
  async hasNext() {
    return this.nextButton().isVisible({ timeout: 1500 }).catch(() => false);
  }

  /** Walk a multi-step survey: fill each visible step, click Next until the last step. Returns steps advanced. */
  async stepThrough({ maxSteps = 8 } = {}) {
    let advanced = 0;
    for (let s = 0; s < maxSteps; s++) {
      await this.fillCurrentStep();
      if (await this.hasNext()) {
        await this.nextButton().click().catch(() => {});
        await this.page.waitForTimeout(900);
        advanced++;
      } else {
        break;
      }
    }
    return advanced;
  }

  async clickSubmit() {
    const btn = this.submitButton();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) await btn.click().catch(() => {});
    await this.page.waitForTimeout(1500);
  }

  async hasSuccessConfirmation() {
    return this.page.locator('.wpforms-confirmation-container, .wpforms-confirmation-container-full')
      .first().isVisible({ timeout: 3000 }).catch(() => false);
  }
}

module.exports = SurveyPage;
