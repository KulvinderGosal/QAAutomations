/**
 * Group C — Channel picker and reconfigure
 * Plan cases C1–C5. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * The /onboarding channel picker (Web Push / App Push / Chat Widget), the
 * per-track entry, the "choose a different channel" / skip links, and the
 * reconfigure flow for an already-completed channel.
 *
 * Conventions follow the reference spec (web-track/01-web-install.spec.js):
 * one test per plan case, id + priority in the title (`--grep @P0` / `--grep C2`),
 * fixtures from onboarding-config with a test.skip() guard per case, role/text
 * selectors with TODO(selector) where the live DOM must confirm them.
 *
 * Prereqs (see MANUAL_TEST_CHECKLIST.md): backend deployed with
 * GOOGLE_GENERATIVE_AI_API_KEY, free-plan migration run. AI responses with
 * `fallback:true` are NOT errors.
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

test.describe('C · Channel picker and reconfigure', () => {
  test.beforeEach(async ({ context, page }) => {
    await wiz.startTelemetryCapture(context);
    // Account B (paid) keeps every channel/feature available for picker cases.
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    await auth.login(page, 'paid');
  });

  test('C1 @P0 Picker content and copy', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.picker);

    await expect(page.getByText(/What do you want to set up\?/i)).toBeVisible();
    await expect(page.getByText(/Choose one.*each takes a few minutes/i)).toBeVisible();

    // Three channel cards with their headline stats and the Web Push "AI PICK" badge.
    await expect(page.getByText(/Web Push/i).first()).toBeVisible();
    await expect(page.getByText(/App Push/i).first()).toBeVisible();
    await expect(page.getByText(/Chat Widget/i).first()).toBeVisible();
    await expect(page.getByText(/AI PICK/i)).toBeVisible();
    await expect(page.getByText(/12.?x ROI/i)).toBeVisible();
    await expect(page.getByText(/90% delivery/i)).toBeVisible();
    await expect(page.getByText(/45% more leads/i)).toBeVisible();

    // Assistant strip names the site domain.
    const domain = site.site1.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    await expect(page.getByText(new RegExp(escapeRe(domain), 'i')).first()).toBeVisible();
  });

  test('C2 @P0 Each card enters its track', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // Web Push → /onboarding/web/install
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up Web Push/i })
      .or(page.getByText(/Set up Web Push/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/web\/install/, { timeout: cfg.timeouts.nav });

    // App Push → /onboarding/app/details
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up App Push/i })
      .or(page.getByText(/Set up App Push/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/app\/details/, { timeout: cfg.timeouts.nav });

    // Chat Widget → /onboarding/chat/channels
    await wiz.goto(page, wiz.routes.picker);
    await page.getByRole('button', { name: /Set up Chat Widget/i })
      .or(page.getByText(/Set up Chat Widget/i)).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/channels/, { timeout: cfg.timeouts.nav });

    // dataLayer records an ai_onboarding_channel_selected for each channel.
    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'ai_onboarding_channel_selected');
    const channels = events.map((e) => e.label || e.channel);
    expect(channels).toEqual(expect.arrayContaining(['web', 'app', 'chat']));
  });

  test('C3 @P1 Completed channel shows Done and Reconfigure', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    test.fixme(
      true,
      'Requires a fully completed web run (G1) as precondition; confirm the completed-run state ' +
        '(localStorage snapshot shape) on staging, then implement.'
    );
    // Steps (once a completed web run exists for the site):
    //  - await wiz.goto(page, wiz.routes.picker);
    //  - Web Push card shows a Done badge + a Reconfigure action;
    //  - subtitle reads "1 of 3 channels configured";
    //  - click Reconfigure → dialog "Reconfigure Web Push?" with body
    //    "This will walk you through the setup again. Your current settings will be replaced.";
    //  - Cancel → no change (still on the picker, card still Done);
    //  - Reconfigure → /onboarding/web/install with empty step data and
    //    NO ai_onboarding_channel_selected event.
  });

  test('C4 @P1 "Choose a different channel" only on the first step', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.webInstall);

    // First step: both the channel-switch link and the skip link are present.
    const chooseDifferent = page.getByRole('button', { name: /Choose a different channel/i })
      .or(page.getByText(/Choose a different channel/i));
    await expect(chooseDifferent.first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Skip setup and go to the Dashboard/i })
        .or(page.getByText(/Skip setup and go to the Dashboard/i)).first()
    ).toBeVisible();

    // Clicking returns to the picker (and keeps entered data).
    await chooseDifferent.first().click();
    await expect(page).toHaveURL(/\/onboarding(\/|$|\?)/, { timeout: cfg.timeouts.nav });
    await expect(page).not.toHaveURL(/\/onboarding\/web/);
    await expect(page.getByText(/What do you want to set up\?/i)).toBeVisible();

    // Note: the link's ABSENCE on later steps (analyzing/popup) requires advancing
    // through a passing install check; "Skip setup…" stays present on every step.
  });

  test('C5 @P1 Skip setup from a mid-flow step', async ({ page }) => {
    test.skip(!site.site1.url, 'Site 1 not configured');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);

    // The case targets the popup step; the Skip control + abandoned telemetry share
    // one mechanism across steps, so we exercise it from the (reachable) first step.
    // The resume-card-at-popup-step assertion needs a full passing run (see E cases).
    await wiz.goto(page, wiz.routes.webInstall);

    await page.getByRole('button', { name: /Skip setup and go to the Dashboard/i })
      .or(page.getByText(/Skip setup and go to the Dashboard/i)).first().click();

    // Leaves the wizard for the Dashboard.
    await expect(page).not.toHaveURL(/\/onboarding/, { timeout: cfg.timeouts.nav });

    // ai_onboarding_abandoned fires exactly once.
    const events = wiz.onboardingEvents(await wiz.getTelemetry(page), 'ai_onboarding_abandoned');
    expect(events.length).toBe(1);
  });
});

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
