/**
 * Fresh-signup helper for the manual walkthrough.
 *
 * Registers a NEW account on the app dashboard the way a tester would, so the
 * run starts from the true new-user entry point (plan case B6: new-user login
 * lands on the wizard picker). Resilient multi-selector fills; anything that
 * must be confirmed against the live signup form is marked TODO(selector) and
 * gets calibrated on the first live run.
 *
 * Email verification: staging may require confirming the address before the
 * dashboard loads. A spec can't read an inbox, so `signup()` reports
 * `verified:false` when it detects a "verify your email" wall — the caller
 * records that case as Blocked (a human clicks the link) and can then continue
 * via login once verified. Plus-addressing (kgosal+...@awesomemotive.com) routes
 * the verification mail to the real inbox.
 */
const cfg = require('./onboarding-config');

function uniqueEmail(base = 'kgosal', domain = 'awesomemotive.com') {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `${base}+onb${stamp}@${domain}`;
}

async function fillFirst(page, selectors, value) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2500 }).catch(() => false)) { await el.fill(value); return true; }
    } catch (e) { /* next */ }
  }
  return false;
}

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2500 }).catch(() => false)) { await el.click(); return true; }
    } catch (e) { /* next */ }
  }
  return false;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} opts { plan: 'free'|'business', email?, password?, name?, website?, signupUrl? }
 * @returns {Promise<{email,password,plan,verified,onWizard,url}>}
 */
async function signup(page, opts = {}) {
  const plan = opts.plan || process.env.WALKTHROUGH_PLAN || 'business';
  const email = opts.email || process.env.WALKTHROUGH_EMAIL || uniqueEmail();
  const password = opts.password || process.env.WALKTHROUGH_PASSWORD || 'QaTest!' + Date.now().toString().slice(-6);
  const name = opts.name || 'QA Onboarding Tester';
  const website = opts.website || cfg.sites.site1.url || 'https://example.com';
  // The signup entry point on staging — override with WALKTHROUGH_SIGNUP_URL if it differs.
  const signupUrl = opts.signupUrl || process.env.WALKTHROUGH_SIGNUP_URL || `${cfg.appDashboardUrl}/register`;

  console.log(`📝 Signing up: ${email} (${plan} plan) at ${signupUrl}`);
  await page.goto(signupUrl, { waitUntil: 'domcontentloaded', timeout: cfg.timeouts.nav });
  await page.waitForTimeout(1500);

  // TODO(selector): confirm the register form field names on the live signup page.
  await fillFirst(page, ['input[name="name" i]', 'input[placeholder*="name" i]', 'input[autocomplete="name"]'], name);
  await fillFirst(page, ['input[name="email" i]', 'input[type="email"]', 'input[placeholder*="email" i]'], email);
  await fillFirst(page, ['input[name="password" i]', 'input[type="password"]', 'input[placeholder*="password" i]'], password);
  await fillFirst(page, ['input[name*="website" i]', 'input[name*="url" i]', 'input[placeholder*="website" i]'], website);

  await clickFirst(page, [
    'button[type="submit"]',
    'button:has-text("Sign up")', 'button:has-text("Sign Up")',
    'button:has-text("Create account")', 'button:has-text("Start For Free")', 'button:has-text("Get Started")',
  ]);
  await page.waitForTimeout(4000);

  // Paid plan: a Stripe card step may appear. Fill it with the shared test card.
  if (plan !== 'free') {
    await fillStripeIfPresent(page);
  }

  const url = page.url();
  const bodyText = (await page.textContent('body').catch(() => '')) || '';
  const verified = !/verify your email|confirm your email|check your (inbox|email)/i.test(bodyText);
  const onWizard = /\/onboarding/.test(url);

  console.log(`   ↳ url=${url}  verified=${verified}  onWizard=${onWizard}`);
  return { email, password, plan, verified, onWizard, url };
}

/** Fill a Stripe card iframe if one is present (paid signup / upgrade). */
async function fillStripeIfPresent(page) {
  const card = cfg.testCreditCard;
  try {
    const hasStripe = await page.locator('iframe[name^="__privateStripeFrame"], iframe[src*="js.stripe.com"]').first()
      .isVisible({ timeout: 4000 }).catch(() => false);
    if (!hasStripe) return false;
    console.log('   💳 Stripe card step detected — filling test card 4242…');
    const numFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await numFrame.locator('input[name="cardnumber"]').fill(card.cardNumber).catch(() => {});
    const expFrame = page.frameLocator('iframe[title*="expiration" i]').first();
    await expFrame.locator('input[name="exp-date"]').fill(card.expiryDate).catch(() => {});
    const cvcFrame = page.frameLocator('iframe[title*="CVC" i]').first();
    await cvcFrame.locator('input[name="cvc"]').fill(card.cvv).catch(() => {});
    await clickFirst(page, ['button:has-text("Subscribe")', 'button:has-text("Pay")', 'button:has-text("Start")', 'button[type="submit"]']);
    await page.waitForTimeout(4000);
    return true;
  } catch (e) { console.log('   ⚠️ Stripe fill skipped:', e.message); return false; }
}

module.exports = { signup, uniqueEmail, fillStripeIfPresent };
