// Exercises the production Signup and Schedule-Demo flows.
// NON-DESTRUCTIVE: it never submits a real account or a real demo booking.
// - Signup: follows pricing CTAs to /signup/ and verifies the registration form renders
//   with the correct plan carried in the URL. Stops before creating an account.
// - Schedule demo: tests step-1 required-field validation, then walks the multi-step
//   WPForms wizard (client-side page breaks only) WITHOUT final submit.
const { chromium } = require('@playwright/test');
const fs = require('fs');

const OUT = '/home/user/QAAutomations/test-results/prod-qa';
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PROXY = process.env.HTTPS_PROXY || 'http://127.0.0.1:40213';
const results = [];
function log(...a) { console.log(...a); }

async function dismissCookie(page) {
  for (const sel of ['button:has-text("Accept")', 'button:has-text("Reject")', 'button:has-text("Allow")']) {
    try {
      const b = page.locator(sel).first();
      if (await b.isVisible({ timeout: 1500 })) { await b.click(); await page.waitForTimeout(500); return; }
    } catch (e) {}
  }
}

async function signupFlow(context) {
  log('\n########## SIGNUP FLOW ##########');
  const plans = [
    { label: 'Free (Try it free)', expectParam: 'planName=free' },
    { label: 'Growth (Get Growth)', expectParam: 'planName=growth' },
  ];
  const page = await context.newPage();
  await page.goto('https://www.pushengage.com/pricing/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  await dismissCookie(page);

  // Grab the plan CTA hrefs straight from the page
  const ctaHrefs = await page.evaluate(() => {
    const map = {};
    document.querySelectorAll('a[href*="/signup/"]').forEach((a) => {
      const t = (a.innerText || '').trim();
      if (t && !map[t]) map[t] = a.getAttribute('href');
    });
    return map;
  });
  log('Signup CTA hrefs found on pricing page:', JSON.stringify(ctaHrefs, null, 2));

  for (const plan of plans) {
    const r = { flow: 'signup', plan: plan.label };
    // find a matching href
    const href = Object.entries(ctaHrefs).find(([t, h]) => h.includes(plan.expectParam))?.[1];
    r.ctaHref = href || '(not found)';
    r.paramCarried = !!href && href.includes(plan.expectParam);
    if (href) {
      const url = href.startsWith('http') ? href : 'https://www.pushengage.com' + href;
      const sp = await context.newPage();
      const resp = await sp.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => ({ err: e.message }));
      await sp.waitForTimeout(5000);
      r.signupStatus = resp && resp.status ? resp.status() : String(resp && resp.err);
      r.signupFinalUrl = sp.url();
      // Detect registration form fields
      r.fields = await sp.evaluate(() => {
        const ids = ['#pushengage-email-input', '#pushengage-password-input', '#pushengage-firstname', '#pushengage-lastname', '#pushengage-url'];
        const present = {};
        ids.forEach((i) => present[i] = !!document.querySelector(i));
        const anyEmail = !!document.querySelector('input[type="email"]');
        const anyPwd = !!document.querySelector('input[type="password"]');
        const submit = !!document.querySelector('button[type="submit"], input[type="submit"]');
        return { knownIds: present, anyEmail, anyPwd, submit, inputCount: document.querySelectorAll('input').length };
      });
      const slug = plan.label.split(' ')[0].toLowerCase();
      await sp.screenshot({ path: `${OUT}/signup-${slug}.png`, fullPage: true }).catch(() => {});
      await sp.close();
    }
    log(JSON.stringify(r, null, 2));
    results.push(r);
  }
  await page.close();
}

async function scheduleDemoFlow(context) {
  log('\n########## SCHEDULE DEMO FLOW ##########');
  const page = await context.newPage();
  const r = { flow: 'schedule_demo', steps: {} };
  await page.goto('https://www.pushengage.com/schedule_demo/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  await dismissCookie(page);

  const form = page.locator('form.wpforms-form, form[id*="wpforms"]').first();

  // ---- Step 1 validation: click Continue with empty required fields ----
  log('\n-- Step 1: empty-submit validation --');
  const continueBtn = page.locator('button:has-text("Continue"), .wpforms-page-next').first();
  await continueBtn.scrollIntoViewIfNeeded().catch(() => {});
  await continueBtn.click().catch((e) => log('continue click err', e.message));
  await page.waitForTimeout(1500);
  const step1Errors = await page.evaluate(() => {
    const errs = Array.from(document.querySelectorAll('.wpforms-error, label.wpforms-error, .wpforms-field-error'))
      .map((e) => (e.innerText || e.textContent || '').trim()).filter(Boolean);
    const invalids = document.querySelectorAll('input[aria-invalid="true"], input:invalid').length;
    return { messages: [...new Set(errs)], invalidCount: invalids };
  });
  r.steps.step1Validation = step1Errors;
  r.steps.step1BlockedAdvance = await page.locator('text=/STEP 1 OF/i').first().isVisible().catch(() => false);
  log('Validation errors:', JSON.stringify(step1Errors));
  log('Still on step 1 (blocked advance as expected):', r.steps.step1BlockedAdvance);
  await page.screenshot({ path: `${OUT}/demo-step1-validation.png`, fullPage: false }).catch(() => {});

  // ---- Fill step 1 with QA test data and advance ----
  log('\n-- Step 1: fill valid data and advance --');
  const ts = Date.now();
  const testData = {
    email: `kgosal+qa_demo_${ts}@awesomemotive.com`,
    first: 'QA', last: `Automation${ts}`,
    website: 'https://www.example.com',
  };
  r.steps.testData = testData;
  await page.fill('#wpforms-28814-field_1', testData.email).catch((e) => log('email fill err', e.message));
  await page.fill('#wpforms-28814-field_2', testData.first).catch((e) => log('first fill err', e.message));
  await page.fill('#wpforms-28814-field_2-last', testData.last).catch((e) => log('last fill err', e.message));
  await page.fill('#wpforms-28814-field_4', testData.website).catch((e) => log('website fill err', e.message));
  await page.waitForTimeout(500);
  await continueBtn.click().catch((e) => log('continue2 err', e.message));
  await page.waitForTimeout(1800);
  r.steps.reachedStep2 = await page.locator('text=/STEP 2 OF/i').first().isVisible().catch(() => false);
  // capture what step 2 asks
  r.steps.step2Fields = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const labels = Array.from(document.querySelectorAll('.wpforms-field'))
      .filter(vis)
      .map((f) => {
        const lab = f.querySelector('.wpforms-field-label');
        const ctrl = f.querySelector('select, input, textarea');
        return { label: lab ? (lab.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80) : '', control: ctrl ? ctrl.tagName.toLowerCase() + (ctrl.type ? ':' + ctrl.type : '') : '' };
      }).filter((x) => x.label);
    return labels;
  });
  log('Reached step 2:', r.steps.reachedStep2);
  log('Step 2 visible fields:', JSON.stringify(r.steps.step2Fields, null, 2));
  await page.screenshot({ path: `${OUT}/demo-step2.png`, fullPage: false }).catch(() => {});

  log('\nℹ️  Stopping BEFORE final submit — not creating a real demo booking in production.');
  r.steps.finalSubmitted = false;
  results.push(r);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXEC,
    proxy: { server: PROXY },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await signupFlow(context);
  await scheduleDemoFlow(context);
  await browser.close();
  fs.writeFileSync(`${OUT}/flows.json`, JSON.stringify(results, null, 2));
  log('\nDONE. Flow results in', `${OUT}/flows.json`);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
