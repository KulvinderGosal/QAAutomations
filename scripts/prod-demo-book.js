// Completes a QA-labeled Schedule-Demo booking end to end (Calendly step).
// Authorized by the user; data is clearly marked "QA AUTOMATION TEST".
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = '/home/user/QAAutomations/test-results/prod-qa';
fs.mkdirSync(OUT, { recursive: true });

async function clickVisible(page, text) {
  const btns = page.locator(`button:has-text("${text}")`);
  const n = await btns.count();
  for (let i = 0; i < n; i++) { const bt = btns.nth(i); if (await bt.isVisible().catch(() => false)) { await bt.click(); return true; } }
  return false;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' }, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await p.goto('https://www.pushengage.com/schedule_demo/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(3500);
  for (const sel of ['button:has-text("Accept")']) { try { const x = p.locator(sel).first(); if (await x.isVisible({ timeout: 1000 })) { await x.click(); } } catch (e) {} }

  const ts = Date.now();
  const email = `kgosal+qa_demo_${ts}@awesomemotive.com`;
  await p.fill('#wpforms-28814-field_1', email);
  await p.fill('#wpforms-28814-field_2', 'QA');
  await p.fill('#wpforms-28814-field_2-last', 'AutomationTEST');
  await p.fill('#wpforms-28814-field_4', 'https://www.example.com');
  await p.fill('#wpforms-28814-field_5', 'QA AUTOMATION TEST - please ignore / cancel. Verifying booking flow.').catch(() => {});
  await clickVisible(p, 'Continue'); await p.waitForTimeout(1800);
  await p.selectOption('#wpforms-28814-field_7', { index: 1 }).catch(() => {});
  await p.selectOption('#wpforms-28814-field_8', { index: 1 }).catch(() => {});
  await p.selectOption('#wpforms-28814-field_9', { index: 1 }).catch(() => {});
  await p.waitForTimeout(500);
  await clickVisible(p, 'See available times');
  console.log('Reached step 3 (Calendly). Waiting for open times to load...');

  const cal = p.frameLocator('iframe[src*="calendly.com"]');
  // Wait for an available day button to become enabled (Calendly marks them aria-label "Times available")
  let booked = { step: 'none' };
  try {
    await cal.locator('button[aria-label*="Times available"], td[aria-label*="Times available"] button, button.calendar-day--available').first().waitFor({ state: 'visible', timeout: 45000 });
    await p.waitForTimeout(1000);
    await cal.locator('button[aria-label*="Times available"], td[aria-label*="Times available"] button, button.calendar-day--available').first().click();
    booked.step = 'day-selected';
    console.log('  Selected first available day.');
    await p.waitForTimeout(2500);

    // Time slots appear as buttons with times
    const timeBtn = cal.locator('button[data-container="time-button"], button[data-start-time]').first();
    await timeBtn.waitFor({ state: 'visible', timeout: 20000 });
    const timeLabel = await timeBtn.innerText().catch(() => '');
    await timeBtn.click();
    booked.step = 'time-selected'; booked.time = timeLabel;
    console.log('  Selected time slot:', timeLabel);
    await p.waitForTimeout(1500);

    // Calendly shows the chosen time + a "Next" confirm button
    const nextBtn = cal.locator('button:has-text("Next"), button[aria-label*="Next"]').first();
    if (await nextBtn.isVisible().catch(() => false)) { await nextBtn.click(); booked.step = 'next-clicked'; console.log('  Clicked Next.'); await p.waitForTimeout(3000); }

    await p.screenshot({ path: `${OUT}/demo-calendly-confirm.png`, fullPage: true });

    // Confirmation form: name/email usually prefilled. Ensure, then Schedule Event.
    const nameInput = cal.locator('input[name="full_name"], input#full_name_input').first();
    if (await nameInput.isVisible().catch(() => false)) {
      const v = await nameInput.inputValue().catch(() => '');
      if (!v) await nameInput.fill('QA AutomationTEST');
    }
    const emailInput = cal.locator('input[name="email"], input#email_input').first();
    if (await emailInput.isVisible().catch(() => false)) {
      const v = await emailInput.inputValue().catch(() => '');
      if (!v) await emailInput.fill(email);
    }
    // Any additional required text fields -> mark as QA
    const reqText = cal.locator('textarea[required], input[type="text"][required]');
    const rn = await reqText.count().catch(() => 0);
    for (let i = 0; i < rn; i++) {
      const el = reqText.nth(i);
      if (await el.isVisible().catch(() => false) && !(await el.inputValue().catch(() => 'x'))) {
        await el.fill('QA AUTOMATION TEST - please ignore/cancel.').catch(() => {});
      }
    }
    booked.confirmFields = { reqTextCount: rn };

    const schedule = cal.locator('button:has-text("Schedule Event"), button[type="submit"]:has-text("Schedule")').first();
    if (await schedule.isVisible().catch(() => false)) {
      await schedule.click();
      booked.step = 'schedule-clicked';
      console.log('  Clicked Schedule Event.');
      await p.waitForTimeout(6000);
    } else {
      console.log('  Schedule Event button not visible yet.');
    }

    // Confirmation
    const confirmed = await cal.locator('text=/You are scheduled|Confirmed|scheduled with/i').first().isVisible().catch(() => false);
    booked.confirmed = confirmed;
    booked.pageText = (await cal.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
  } catch (e) {
    booked.error = String(e.message).split('\n')[0];
    console.log('  Booking interaction error:', booked.error);
  }

  await p.screenshot({ path: `${OUT}/demo-booking-result.png`, fullPage: true });
  fs.writeFileSync(`${OUT}/demo-booking.json`, JSON.stringify({ email, booked }, null, 2));
  console.log('RESULT:', JSON.stringify(booked, null, 2));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
