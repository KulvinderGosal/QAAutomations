const BasePage = require('./base.page');
const { selectors, routes } = require('../fixtures/test-data');

class HomePage extends BasePage {
  async open() {
    await this.goto(routes.home);
  }

  async handleCookieBannerIfPresent() {
    const cookieButtons = [
      'button:has-text("Accept")',
      'button:has-text("Allow all")',
      'button:has-text("Agree")',
      '[aria-label*="accept" i]',
    ];

    for (const selector of cookieButtons) {
      const btn = this.page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click().catch(() => {});
        break;
      }
    }
  }

  async assertHomePageVisible() {
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 20000 });
  }

  async goToSignup() {
    try {
      await this.clickAny(selectors.homeCtas, 8000);
    } catch (_) {
      await this.goto(routes.signup);
    }
  }
}

module.exports = HomePage;
