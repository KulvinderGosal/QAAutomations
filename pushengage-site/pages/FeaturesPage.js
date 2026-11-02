const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');
const config = require('../utils/config');

class FeaturesPage extends BasePage {
  async open() {
    await this.goto(config.pages.features);
  }

  async openPage(pagePath) {
    await this.goto(pagePath);
  }

  get featureItemSelectors() {
    return [
      '[class*="pushengage-feature__title"]', // current /features/ markup (18 feature blocks)
      '[class*="feature-item"]',
      '[class*="feature-card"]',
      '[class*="feature-box"]',
      '.features-list li',
      'section[class*="feature"] > div',
    ];
  }

  get pageTitleSelectors() {
    return ['h1', '.page-title h1', '.hero h1', 'main h1'];
  }

  get ctaSelectors() {
    return [
      'a:has-text("Get Started")',
      'a:has-text("Start For Free")',
      'a:has-text("Try Free")',
      'a[href*="signup"]',
      'a[href*="register"]',
      'button:has-text("Get Started")',
    ];
  }

  async getPageTitle() {
    const el = await findFirstVisible(this.page, this.pageTitleSelectors);
    return el ? el.textContent() : null;
  }

  async getFeatureItems() {
    return findFirstVisible(this.page, this.featureItemSelectors);
  }

  async getCTA() {
    return findFirstVisible(this.page, this.ctaSelectors);
  }

  async countFeatureItems() {
    for (const selector of this.featureItemSelectors) {
      const count = await this.page.locator(selector).count();
      if (count > 0) return count;
    }
    return 0;
  }

  async hasPageContent() {
    const title = await this.getPageTitle();
    const cta   = await this.getCTA();
    return !!(title || cta);
  }
}

module.exports = FeaturesPage;
