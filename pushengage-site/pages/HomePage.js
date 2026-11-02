const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');
const config = require('../utils/config');

class HomePage extends BasePage {
  async open() {
    await this.goto(config.pages.home);
  }

  // ── Hero section ──────────────────────────────────────────────────────────
  get heroHeadlineSelectors() {
    return [
      'h1',
      '.hero h1',
      '[class*="hero"] h1',
      '[class*="banner"] h1',
      'section:first-of-type h1',
    ];
  }

  get heroCTASelectors() {
    return [
      '.pe-hero a.pe-btn--primary',            // current hero primary CTA ("Book a strategy call" → /demo)
      '.pe-hero a.pe-btn',
      '.pe-hero a:has-text("Book a strategy call")',
      '.pe-hero a:has-text("Get Started")',
      '.pe-hero a:has-text("Start For Free")',
      'a.wp-block-button__link:has-text("Get Started")',
      'section:first-of-type a.pe-btn',
      'section:first-of-type a:has-text("Get Started")',
    ];
  }

  // ── Features overview ─────────────────────────────────────────────────────
  get featuresSectionSelectors() {
    return [
      '[class*="features"]',
      '#features',
      'section:has(h2)',
      '[class*="benefit"]',
    ];
  }

  // ── Social proof / logos ──────────────────────────────────────────────────
  get socialProofSelectors() {
    return [
      '[class*="testimonial"]',
      '[class*="review"]',
      '[class*="trust"]',
      '[class*="customer"]',
      '[class*="logo-bar"]',
      '[class*="brand"]',
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  async getHeroHeadline() {
    return findFirstVisible(this.page, this.heroHeadlineSelectors);
  }

  async getHeroCTA() {
    return findFirstVisible(this.page, this.heroCTASelectors);
  }

  async isFeaturesVisible() {
    const el = await findFirstVisible(this.page, this.featuresSectionSelectors, 8000);
    return !!el;
  }

  async isSocialProofVisible() {
    const el = await findFirstVisible(this.page, this.socialProofSelectors, 8000);
    return !!el;
  }

  async clickHeroCTA() {
    const cta = await this.getHeroCTA();
    if (cta) {
      await cta.click();
      return true;
    }
    return false;
  }
}

module.exports = HomePage;
