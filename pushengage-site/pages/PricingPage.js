const BasePage = require('./BasePage');
const { findFirstVisible } = require('../utils/helpers');
const config = require('../utils/config');

class PricingPage extends BasePage {
  async open() {
    await this.goto(config.pages.pricing);
  }

  get planCardSelectors() {
    return [
      '[class*="pricing-column"]',                // current theme: one column per plan
      '[class*="pricing-front__action--trial"]',  // per-paid-plan trial CTA button
      '[class*="pricing-card"]',
      '[class*="price-card"]',
      '[class*="plan-card"]',
      '[class*="pricing"] [class*="card"]',
    ];
  }

  get toggleSelectors() {
    return [
      'input[type="checkbox"][id*="toggle"]',
      'input[type="checkbox"][class*="toggle"]',
      'button:has-text("Annual")',
      'button:has-text("Monthly")',
      '[class*="billing-toggle"]',
      '[class*="period-toggle"]',
    ];
  }

  get freePlanSelectors() {
    return [
      '[class*="pricing"] *:has-text("Free")',
      '[class*="plan"]:has-text("Free")',
      'h3:has-text("Free")',
      'h2:has-text("Free")',
      'td:has-text("Free")',
    ];
  }

  get paidPlanSelectors() {
    return [
      '[class*="plan"]:has-text("Business")',
      '[class*="plan"]:has-text("Professional")',
      '[class*="plan"]:has-text("Premium")',
      '[class*="plan"]:has-text("Growth")',
      'h3:has-text("Business")',
      'h3:has-text("Professional")',
    ];
  }

  get planCTASelectors() {
    return [
      '[class*="pricing"] a:has-text("Get Started")',
      '[class*="pricing"] a:has-text("Start For Free")',
      '[class*="pricing"] button:has-text("Get Started")',
      '[class*="pricing"] a[href*="signup"]',
      '[class*="pricing"] a[href*="register"]',
    ];
  }

  async getPlanCards() {
    return findFirstVisible(this.page, this.planCardSelectors);
  }

  async getBillingToggle() {
    return findFirstVisible(this.page, this.toggleSelectors);
  }

  async getFreePlan() {
    return findFirstVisible(this.page, this.freePlanSelectors);
  }

  async getPaidPlan() {
    return findFirstVisible(this.page, this.paidPlanSelectors);
  }

  async getPlanCTA() {
    return findFirstVisible(this.page, this.planCTASelectors);
  }

  async toggleBilling() {
    const toggle = await this.getBillingToggle();
    if (toggle) {
      await toggle.click();
      await this.page.waitForTimeout(500);
      return true;
    }
    return false;
  }

  async countPlanCards() {
    for (const selector of this.planCardSelectors) {
      const count = await this.page.locator(selector).count();
      if (count > 0) return count;
    }
    return 0;
  }
}

module.exports = PricingPage;
