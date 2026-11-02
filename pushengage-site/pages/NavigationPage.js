const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');

class NavigationPage extends BasePage {
  get logoSelectors() {
    return [
      'a.custom-logo-link',            // current WP theme logo link (absolute href)
      '.custom-logo-link img',
      'img.custom-logo',
      'a[href$="pushengage.com/"] img',
      'header img[alt*="pushengage" i]',
      '.site-logo img',
      '.navbar-brand img',
    ];
  }

  get menuSelectors() {
    return {
      features:  ['a[href*="/features"]',  'nav a:has-text("Features")'],
      pricing:   ['a[href*="/pricing"]',   'nav a:has-text("Pricing")'],
      blog:      ['a[href*="/blog"]',      'nav a:has-text("Blog")'],
      resources: ['a[href*="/resources"]', 'nav a:has-text("Resources")'],
      // "Log In" links to the app (app.pushengage.com); the label uses a space.
      login:     ['a:has-text("Log In")', 'a:has-text("Login")', 'a[href*="app.pushengage.com"]', 'a[href*="login"]'],
      // "Get Started" now routes to /pricing/ (the conversion entry) — there is
      // no on-site signup form anymore. Match by text (+ legacy fallbacks).
      getStarted:['a:has-text("Get Started")', 'a:has-text("Start For Free")', 'a[href*="signup"]', 'a[href*="register"]'],
    };
  }

  get mobileMenuTriggers() {
    return [
      'button[aria-label*="menu" i]',
      'button[class*="hamburger" i]',
      'button[class*="mobile" i]',
      '.menu-toggle',
      '[data-toggle="navigation"]',
    ];
  }

  async getLogo() {
    return findFirstVisible(this.page, this.logoSelectors);
  }

  async getNavLink(name) {
    const candidates = this.menuSelectors[name] || [];
    return findFirstVisible(this.page, candidates);
  }

  async clickLogo() {
    const logo = await this.getLogo();
    if (logo) await logo.click();
    return !!logo;
  }

  async openMobileMenu() {
    const trigger = await findFirstVisible(this.page, this.mobileMenuTriggers);
    if (trigger) {
      await trigger.click();
      await this.page.waitForTimeout(500);
      return true;
    }
    return false;
  }
}

module.exports = NavigationPage;
