class BasePage {
  constructor(page) {
    this.page = page;
  }

  async goto(path = '/', options = {}) {
    await this.page.goto(path, {
      waitUntil: 'domcontentloaded',
      ...options,
    });
  }

  async waitForAnyVisible(selectors, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const selector of selectors) {
        const locator = this.page.locator(selector).first();
        if (await locator.isVisible().catch(() => false)) {
          return locator;
        }
      }
      await this.page.waitForTimeout(250);
    }

    throw new Error(`None of the selectors became visible: ${selectors.join(', ')}`);
  }

  async clickAny(selectors, timeout = 10000) {
    const locator = await this.waitForAnyVisible(selectors, timeout);
    await locator.click();
  }

  async fillAny(selectors, value, timeout = 10000) {
    const locator = await this.waitForAnyVisible(selectors, timeout);
    await locator.fill(value);
  }
}

module.exports = BasePage;
