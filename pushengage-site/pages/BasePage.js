const { expect } = require('@playwright/test');
const { waitForPageLoad, dismissCookieBanner } = require('../utils/helpers');

class BasePage {
  constructor(page) {
    this.page = page;
  }

  async goto(path = '/') {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(this.page);
    await dismissCookieBanner(this.page);
  }

  async getTitle() {
    return this.page.title();
  }

  async getUrl() {
    return this.page.url();
  }

  async waitForVisible(selector, timeout = 10000) {
    await this.page.locator(selector).first().waitFor({ state: 'visible', timeout });
  }

  async isVisible(selector, timeout = 5000) {
    return this.page.locator(selector).first().isVisible({ timeout }).catch(() => false);
  }

  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.page.waitForTimeout(500);
  }
}

module.exports = BasePage;
