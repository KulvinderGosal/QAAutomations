// Test remaining submittable forms SAFELY (no real-world transactions).
// Newsletter optin: render + empty-submit validation only (no real subscription).
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = '/home/user/QAAutomations/test-results/prod-qa';
fs.mkdirSync(OUT, { recursive: true });
const results = {};
async function dismissCookie(page) { for (const sel of ['button:has-text("Accept")']) { try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1200 })) { await b.click(); } } catch (e) {} } }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' }, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const ts = Date.now();

  // ---- A) "Take PushEngage for a Test Drive" email capture (-> signup handoff, no account created) ----
  {
    const p = await ctx.newPage();
    await p.goto('https://www.pushengage.com/integrations/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(3500); await dismissCookie(p);
    const input = p.locator('.pushengage-cta-test-drive-form input').first();
    await input.scrollIntoViewIfNeeded().catch(() => {});
    await input.fill(`kgosal+qa_td_${ts}@awesomemotive.com`);
    const btn = p.locator(':text("Take PushEngage for a Test Drive")').first();
    const before = p.url();
    await Promise.all([p.waitForNavigation({ timeout: 20000 }).catch(() => {}), btn.click().catch(() => {})]);
    await p.waitForTimeout(3500);
    const after = p.url();
    const emailPrefilled = await p.evaluate(() => (document.querySelector('#pushengage-email-input,input[type=email]')?.value || ''));
    results.testDrive = { before, after, navigated: before !== after, landedOnSignup: /\/signup\//.test(after), emailPrefilled };
    console.log('TEST-DRIVE:', JSON.stringify(results.testDrive));
    await p.close();
  }

  // ---- B) Blog search (read-only query) ----
  {
    const p = await ctx.newPage();
    await p.goto('https://www.pushengage.com/blog/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(3000); await dismissCookie(p);
    const input = p.locator('input[type=search][name="s"]').first();
    await input.fill('push notifications');
    await Promise.all([p.waitForNavigation({ timeout: 20000 }).catch(() => {}), p.locator('button:has-text("Search")').first().click().catch(() => input.press('Enter'))]);
    await p.waitForTimeout(3000);
    const url = p.url();
    const resultCount = await p.locator('article, .post, .search-result, h2 a').count().catch(() => 0);
    results.blogSearch = { url, isSearchUrl: /[?&]s=/.test(url) || /\/\?s=/.test(url), resultsFound: resultCount };
    console.log('BLOG-SEARCH:', JSON.stringify(results.blogSearch));
    await p.close();
  }

  // ---- C) Newsletter "Join Us" optin — render + EMPTY-submit validation only (no real subscription) ----
  {
    const p = await ctx.newPage();
    await p.goto('https://www.pushengage.com/workflows/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(3500); await dismissCookie(p);
    const form = p.locator('form[id^="sp-optin-form"]').first();
    const present = await form.isVisible().catch(() => false);
    const emailInput = form.locator('input[type=email]').first();
    // Empty submit -> expect browser/native required validation to block (no value entered)
    await p.locator('button:has-text("Join Us")').first().click().catch(() => {});
    await p.waitForTimeout(1200);
    const validation = await p.evaluate(() => {
      const el = document.querySelector('form[id^="sp-optin-form"] input[type=email]');
      return el ? { required: el.required, validityValid: el.validity ? el.validity.valid : null, validationMessage: el.validationMessage || '' } : null;
    });
    results.newsletter = { formPresent: present, emailRequired: !!(validation && validation.required), emptyBlocked: !!(validation && validation.validityValid === false), validationMessage: validation && validation.validationMessage, note: 'Actual subscription NOT submitted (real-world transaction).' };
    console.log('NEWSLETTER (render+validation only):', JSON.stringify(results.newsletter));
    await p.close();
  }

  // ---- D) "Submit a Support Ticket" destination (read-only) ----
  {
    const p = await ctx.newPage();
    await p.goto('https://www.pushengage.com/contact-us/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(3500); await dismissCookie(p);
    await p.locator('a.pe-showcontact-from-block').first().click().catch(() => {});
    await p.waitForTimeout(1200);
    const href = await p.locator('a:has-text("Submit a Support Ticket")').first().getAttribute('href').catch(() => null);
    results.supportTicket = { buttonHref: href, pointsToDocs: /\/documentation\//.test(href || '') };
    console.log('SUPPORT-TICKET LINK:', JSON.stringify(results.supportTicket));
    await p.close();
  }

  fs.writeFileSync(`${OUT}/forms-test.json`, JSON.stringify(results, null, 2));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
