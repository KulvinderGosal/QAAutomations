/**
 * Manual walkthrough — Claude drives the app dashboard like a hands-on tester:
 * fresh signup → wizard picker → Web Push track → (set up another) Chat Widget
 * → (set up another) App Push → completion, recording each plan case as it goes.
 *
 * This is a SOFT pass: each case is attempted, marked Pass/Fail/Blocked with a
 * screenshot, and the run continues (see utils/walkthrough-recorder.js) — the
 * way a tester notes an issue and keeps going. A report is written to
 * test-results/onboarding-walkthrough/<run>/report.md at the end.
 *
 * Scope: the happy-path / linearly-reachable cases across B,C,D,E,F,G,H,I plus
 * an observed telemetry check (P1). Negative/edge/fixture-specific and backend
 * cases stay in the per-case suite + MANUAL_TEST_CHECKLIST.md — together they
 * cover all 148.
 *
 * Prereqs: backend has GOOGLE_GENERATIVE_AI_API_KEY + free-plan migration run.
 * fallback:true is never an error. Run headed to watch it:
 *   npm run test:onboarding:walkthrough:headed
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');
const { signup } = require('../utils/onboarding-signup');
const { WalkthroughRecorder } = require('../utils/walkthrough-recorder');

const PLAN = process.env.WALKTHROUGH_PLAN || 'business';

test.describe.serial('Manual walkthrough — signup → wizard → all tracks', () => {
  let context, page, rec;
  let account = null; // filled by signup or fallback login

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    await context.addInitScript(wiz.TELEMETRY_INIT); // capture GTM dataLayer from the first paint
    page = await context.newPage();
    page.setDefaultTimeout(cfg.timeouts.action);
    rec = new WalkthroughRecorder(`walkthrough-${PLAN}-${Date.now()}`);
    rec.attachConsole(page); // every case auto-flags console errors / page exceptions
  });

  test.afterAll(async () => {
    if (rec) rec.finalize();
    if (context) await context.close();
  });

  // ------------------------------------------------------------ signup + entry
  test('Phase 0 — signup and reach the wizard', async () => {
    test.setTimeout(180000);

    let res = null;
    try {
      res = await signup(page, { plan: PLAN });
      account = { email: res.email, password: res.password };
    } catch (e) {
      rec.observe(`Signup threw: ${e.message}`);
    }

    // B6 — new-user signup lands on the wizard picker.
    await rec.case(page, 'B6', 'New-user signup lands on the wizard picker', async (p) => {
      if (res && !res.verified) throw rec.blockedError('Signup requires email verification — click the link in the inbox, then re-run with WALKTHROUGH_SIGNUP=false to log in.');
      if (!res || !res.onWizard) {
        // Fall back to a configured account so the rest of the pass can run.
        if (!cfg.accounts.paid.email) throw rec.blockedError('Not on /onboarding after signup and no PE_ACCOUNT_B_* fallback configured.');
        await auth.login(p, 'paid');
        account = cfg.accounts.paid;
        await wiz.goto(p, wiz.routes.picker);
      }
      await expect(p).toHaveURL(/\/onboarding\b/);
      return `signed up as ${account && account.email}`;
    }, { priority: 'P0' });

    // C1 — picker content and copy.
    await rec.case(page, 'C1', 'Picker shows the three channel cards', async (p) => {
      await wiz.goto(p, wiz.routes.picker);
      await expect(p.getByText(/What do you want to set up/i)).toBeVisible();
      await expect(p.getByText(/Web Push/i).first()).toBeVisible();
      await expect(p.getByText(/App Push/i).first()).toBeVisible();
      await expect(p.getByText(/Chat Widget/i).first()).toBeVisible();
    }, { priority: 'P0' });
  });

  // ------------------------------------------------------------------ Web track
  test('Phase 1 — Web Push track end to end', async () => {
    test.setTimeout(300000);
    const s1 = cfg.sites.site1;

    await rec.case(page, 'C2', 'Web Push card enters the install step', async (p) => {
      await wiz.goto(p, wiz.routes.picker);
      await p.getByRole('button', { name: /Set up Web Push/i }).or(p.getByText(/Web Push/i)).first().click();
      await expect(p).toHaveURL(/\/onboarding\/web\/install/);
      const evs = wiz.onboardingEvents(await wiz.getTelemetry(p), 'ai_onboarding_channel_selected');
      if (!evs.some((e) => (e.channel || e.label) === 'web')) rec.observe('C2: channel_selected(web) not seen in dataLayer');
    }, { priority: 'P0' });

    await rec.case(page, 'D1', 'Platform auto-detection shows a platform card', async (p) => {
      await expect(p.getByText(/WordPress|Custom Site|Shopify/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    }, { priority: 'P0' });

    await rec.case(page, 'D6', 'Install check runs and reports a verdict', async (p) => {
      const btn = p.getByRole('button', { name: /Confirm and Check Status/i });
      if (!(await btn.isVisible().catch(() => false))) throw rec.blockedError('Confirm-and-Check-Status button not found (confirm selector).');
      await btn.click();
      // Either "is live" (installed site) or "isn't live" (uninstalled) — both are valid verdicts to record.
      const live = p.getByText(/is live on/i);
      const notLive = p.getByText(/isn.t live on/i);
      await expect(live.or(notLive).first()).toBeVisible({ timeout: cfg.timeouts.nav });
      const isLive = await live.first().isVisible().catch(() => false);
      return isLive ? 'site reported live' : 'site reported NOT live (expected for an uninstalled fixture)';
    }, { priority: 'P0' });

    await rec.case(page, 'D6b', 'Advance to Popup Design (if the check passed)', async (p) => {
      const cont = p.getByRole('button', { name: /Continue to Popup Design/i });
      if (!(await cont.isVisible().catch(() => false))) {
        // Uninstalled site: skip forward so the walkthrough can still see the popup step.
        const skip = p.getByRole('button', { name: /Skip for now/i });
        if (await skip.isVisible().catch(() => false)) { await skip.click(); return 'check did not pass; used Skip for now'; }
        throw rec.blockedError('Neither Continue nor Skip available after the check.');
      }
      await cont.click();
      await expect(p).toHaveURL(/\/onboarding\/web\/(analyzing|popup)/);
    }, { priority: 'P1' });

    await rec.case(page, 'E1', 'Analyzing board completes and hands off to popup', async (p) => {
      // The board is capped ~20s server-side even if slow.
      await expect(p).toHaveURL(/\/onboarding\/web\/popup/, { timeout: cfg.timeouts.analyzing + 15000 });
    }, { priority: 'P0' });

    await rec.case(page, 'E3', 'Popup step is seeded from the analysis', async (p) => {
      await expect(p.getByText(/Your Opt-in Popup|Opt-in Popup/i).first()).toBeVisible();
    }, { priority: 'P0' });

    await rec.case(page, 'E7', 'Continue writes the popup and advances to audiences', async (p) => {
      const cont = p.getByRole('button', { name: /Looks Good, Continue|Continue/i }).first();
      const [resp] = await Promise.all([
        p.waitForResponse((r) => /optin[_-]?settings/i.test(r.url()) && r.request().method() === 'PUT', { timeout: cfg.timeouts.nav }).catch(() => null),
        cont.click(),
      ]);
      await expect(p).toHaveURL(/\/onboarding\/web\/segments/, { timeout: cfg.timeouts.nav });
      return resp ? `optin_settings PUT ${resp.status()}` : 'advanced (PUT not captured — confirm endpoint)';
    }, { priority: 'P0' });

    await rec.case(page, 'F1', 'Audiences step renders the curation', async (p) => {
      await expect(p.getByText(/Segments & Groups|Segments|Audience Groups/i).first()).toBeVisible();
    }, { priority: 'P0' });

    await rec.case(page, 'F3', 'Create the selected segments & groups and advance', async (p) => {
      const create = p.getByRole('button', { name: /Create .*segment|Create .*group|Create/i }).first();
      if (!(await create.isVisible().catch(() => false))) throw rec.blockedError('Create button not found on audiences step.');
      await create.click();
      await expect(p).toHaveURL(/\/onboarding\/web\/workflows/, { timeout: cfg.timeouts.nav });
    }, { priority: 'P0' });

    await rec.case(page, PLAN === 'free' ? 'F6' : 'F7', 'Automations sections match the plan', async (p) => {
      const header = PLAN === 'free' ? /READY ON YOUR FREE PLAN/i : /READY ON YOUR (BUSINESS|[A-Z]+) PLAN/i;
      await expect(p.getByText(header).first()).toBeVisible();
    }, { priority: 'P0' });

    await rec.case(page, 'F11', 'Create workflow drafts and reach the summary', async (p) => {
      const create = p.getByRole('button', { name: /Create .*workflow/i }).first();
      if (await create.isVisible().catch(() => false)) await create.click();
      await expect(p).toHaveURL(/\/onboarding\/web\/summary/, { timeout: cfg.timeouts.nav });
    }, { priority: 'P0' });

    await rec.case(page, 'G1', 'Summary claims completion honestly', async (p) => {
      await expect(p.getByText(/You.re All Set|Your Setup Is Saved/i).first()).toBeVisible();
      const evs = wiz.onboardingEvents(await wiz.getTelemetry(p), 'ai_onboarding_completed');
      return evs.length ? 'ai_onboarding_completed fired' : 'completed event not seen yet';
    }, { priority: 'P0' });
  });

  // --------------------------------------------------------------- Chat track
  test('Phase 2 — Chat Widget track (set up another channel)', async () => {
    test.setTimeout(240000);

    await rec.case(page, 'G3', 'Set up another channel → Chat', async (p) => {
      // From summary; else from the picker's Chat card.
      const fromSummary = p.getByText(/Chat Widget/i).first();
      if (await fromSummary.isVisible().catch(() => false)) await fromSummary.click();
      else { await wiz.goto(p, wiz.routes.picker); await p.getByText(/Chat Widget/i).first().click(); }
      await expect(p).toHaveURL(/\/onboarding\/chat\/channels/, { timeout: cfg.timeouts.nav });
    }, { priority: 'P1' });

    await rec.case(page, 'H1', 'Channels step is curated for the site', async (p) => {
      await expect(p.getByText(/Continue with \d+ channels|channels/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    }, { priority: 'P0' });

    await rec.case(page, 'H5', 'Finish Setup creates the chat widget', async (p) => {
      // Walk to Agents → Finish. Selectors best-effort; recorded soft.
      const cont = p.getByRole('button', { name: /Continue|Next/i }).first();
      if (await cont.isVisible().catch(() => false)) await cont.click();
      const finish = p.getByRole('button', { name: /Finish Setup/i });
      if (!(await finish.isVisible({ timeout: cfg.timeouts.nav }).catch(() => false))) throw rec.blockedError('Did not reach the Finish Setup step (confirm chat design/agents selectors).');
      await finish.click();
      await expect(p.getByText(/live on|All Set|Setup Is Saved/i).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    }, { priority: 'P0' });
  });

  // ---------------------------------------------------------------- App track
  test('Phase 3 — App Push track (set up another channel)', async () => {
    test.setTimeout(240000);

    await rec.case(page, 'I1', 'App Details + store lookup', async (p) => {
      await wiz.goto(p, wiz.routes.picker);
      await p.getByText(/App Push/i).first().click();
      await expect(p).toHaveURL(/\/onboarding\/app\/details/, { timeout: cfg.timeouts.nav });
      // Primary disabled without a name; fill and continue.
      await p.locator('input[name*="app" i], input[placeholder*="app name" i]').first().fill('QA Test App').catch(() => {});
      await p.getByRole('button', { name: /Analyze & Continue|Continue/i }).first().click().catch(() => {});
      await expect(p).toHaveURL(/\/onboarding\/app\/(sdk|analyzing)/, { timeout: cfg.timeouts.nav });
    }, { priority: 'P0' });

    if (cfg.mobile.androidServiceAccountJson) {
      await rec.case(page, 'I2', 'Android SDK stepper + Firebase credentials', async (p) => {
        // TODO(selector): rail navigation to the Firebase step + save.
        throw rec.blockedError('Android credential save needs the confirmed stepper selectors — calibrate on the live run.');
      }, { priority: 'P0' });
    } else {
      await rec.block(page, 'I2', 'Android SDK stepper + Firebase credentials', 'PE_ANDROID_SA_JSON_PATH not set — credential fixture missing.', 'P0');
    }
  });

  // --------------------------------------------------------------- responsive
  test('Phase 4 — responsive sweep of the wizard', async () => {
    test.setTimeout(120000);
    const widths = [[1440, 900], [1024, 768], [768, 1024], [375, 812]];
    await wiz.goto(page, wiz.routes.picker).catch(() => {});
    for (const [w, h] of widths) {
      await rec.case(page, `R1-${w}`, `Wizard at ${w}px — no horizontal scroll, footer usable`, async (p) => {
        await p.setViewportSize({ width: w, height: h });
        await p.waitForTimeout(600);
        // screenshot per width for the visual/responsive review
        await p.screenshot({ path: require('path').join(rec.outDir, `R1-${w}.png`), fullPage: true }).catch(() => {});
        const overflow = await p.evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return el.scrollWidth - el.clientWidth;
        });
        if (overflow > 2) throw new Error(`horizontal overflow of ${overflow}px at ${w}px width`);
        return `no horizontal scroll at ${w}px`;
      }, { priority: 'P1' });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // --------------------------------------------------------------- telemetry
  test('Phase 5 — telemetry sanity on the captured dataLayer', async () => {
    await rec.case(page, 'P1', 'Onboarding telemetry events were emitted', async (p) => {
      const all = wiz.onboardingEvents(await wiz.getTelemetry(p));
      const names = [...new Set(all.map((e) => e.event || e.eventName).filter(Boolean))];
      rec.observe(`Telemetry events seen: ${names.join(', ') || '(none)'}`);
      expect(all.some((e) => (e.event || e.eventName) === 'ai_onboarding_opened')).toBeTruthy();
    }, { priority: 'P1' });
  });
});
