/**
 * Group H — Chat Widget track
 * Plan cases H1–H9. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * Conventions mirror the reference spec (web-track/01-web-install.spec.js):
 *   - one test per plan case; the case id + priority live in the title so you can
 *     `--grep @P0` / `--grep H5`; traceability back to cases.json.
 *   - fixtures come from onboarding-config; a test.skip() guards each case when
 *     its required account / site fixture is not configured.
 *   - selectors prefer role/text pulled from each case's `expected` copy. Anything
 *     that must be confirmed against the live DOM is marked TODO(selector).
 *   - only robust facts are asserted (URL, key copy present, event fired, request
 *     fired). Flows that cannot be driven without the live DOM are test.fixme().
 *
 * Accounts (see onboarding-config):
 *   - paid  (Account B, Business+) → widget-creation cases H1–H3, H5, H7, H8, H9.
 *   - free  (Account A, Free plan)  → free-plan gate cases H4, H6.
 *
 * Chat recommendations (GET onboarding-ai/recommendations?track=chat) returns
 *   { greeting, subheading, channel_prefills, suggested_pages (≤6),
 *     suggested_channels (≤8, ≤4 enabled), fallback }.
 * `fallback: true` is NOT an error (model/lock/cap all return usable defaults).
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

// Cases that must run on the Free plan (Account A) to exercise the plan gates.
const FREE_CASES = /^(H4|H6)\b/;

/**
 * Watch Chat Widget CRUD requests so we can prove a create/update fired (H5/H8)
 * or that a gated action fired NOTHING (H4/H6).
 * TODO(endpoint): confirm the Chat Widgets REST path on staging and tighten the
 * pattern; onboarding-ai adjust/create calls are covered separately by
 * wiz.watchOnboardingApi.
 */
function watchWidgetApi(page) {
  const calls = [];
  const onReq = (req) => {
    const url = req.url();
    if (!/chat[-_]?widget|chatbot|\/widgets?\b/i.test(url)) return;
    calls.push({ url, method: req.method() });
  };
  page.on('request', onReq);
  return {
    calls,
    creates: () => calls.filter((c) => c.method === 'POST'),
    updates: () => calls.filter((c) => c.method === 'PUT' || c.method === 'PATCH'),
    stop: () => page.off('request', onReq),
  };
}

/** onboarding-ai POST calls (chat adjust / any write) captured by the shared watcher. */
function onboardingWrites(watch) {
  return watch.calls.filter((c) => c.method === 'POST' || c.method === 'PUT' || c.method === 'PATCH');
}

test.describe('H · Chat Widget track', () => {
  test.beforeEach(async ({ context, page }, testInfo) => {
    await wiz.startTelemetryCapture(context);
    const acctKey = FREE_CASES.test(testInfo.title) ? 'free' : 'paid';
    test.skip(!cfg.accounts[acctKey].email, `${acctKey === 'free' ? 'PE_ACCOUNT_A_*' : 'PE_ACCOUNT_B_*'} not configured`);
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, acctKey);
  });

  test('H1 @P0 Channels step curated for the site', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const watch = wiz.watchOnboardingApi(page);

    // Enter the chat track from the picker so ai_onboarding_channel_selected fires.
    await wiz.goto(page, wiz.routes.picker);
    // TODO(selector): confirm the Chat Widget card's set-up affordance on the picker.
    await page
      .getByRole('button', { name: /Set up Chat Widget/i })
      .or(page.getByText(/Chat Widget/i))
      .first()
      .click();

    await expect(page).toHaveURL(/\/onboarding\/chat\/channels/, { timeout: cfg.timeouts.nav });

    // Skeleton copy while reading the site, or the resolved list once curated.
    await expect(
      page
        .getByText(/Reading .* to pick the channels/i)
        .or(page.getByText(/Continue with \d+ channels?/i))
        .first()
    ).toBeVisible({ timeout: cfg.timeouts.nav });

    // Assistant line: curated vs fallback copy.
    await expect(
      page
        .getByText(/Picked \d+ channels? for/i)
        .or(page.getByText(/Starting you off with the \d+ channels businesses use most/i))
        .first()
    ).toBeVisible({ timeout: cfg.timeouts.nav });

    // Primary reflects the current selection count.
    await expect(page.getByRole('button', { name: /Continue with \d+ channels?/i })).toBeVisible();

    // chat recommendations must have been fetched.
    await expect
      .poll(() => watch.calls.some((c) => /recommendations/.test(c.url) && /track=chat/.test(c.url)), {
        timeout: cfg.timeouts.nav,
      })
      .toBeTruthy();

    const selected = wiz.onboardingEvents(await wiz.getTelemetry(page), 'ai_onboarding_channel_selected');
    expect(selected.some((e) => (e.label || e.channel) === 'chat')).toBeTruthy();
    watch.stop();
  });

  test('H2 @P1 Channel value validation', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.chatChannels);

    // TODO(selector): confirm the per-channel value inputs (WhatsApp number, email).
    const whatsapp = page
      .locator('input[type="tel"], input[name*="whatsapp" i], input[placeholder*="number" i]')
      .first();
    const email = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();

    if (await whatsapp.count()) await whatsapp.fill('123');
    if (await email.count()) await email.fill('not-an-email');

    await page.getByRole('button', { name: /Continue with \d+ channels?/i }).or(page.getByRole('button', { name: /^Continue/i })).first().click();

    // Robust fact: invalid values hold the step — we do NOT advance to design.
    await expect(page).toHaveURL(/\/onboarding\/chat\/channels/);
    await expect(page).not.toHaveURL(/\/onboarding\/chat\/design/);
  });

  test('H3 @P1 Section skip returns to Channels not Agents', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const widgetWatch = watchWidgetApi(page);
    await wiz.goto(page, wiz.routes.chatChannels);

    await page.getByRole('button', { name: /Skip chat widget setup/i }).or(page.getByText(/Skip chat widget setup/i)).first().click();

    // Summary marks the track skipped (not done).
    await expect(page.getByText(/Setup skipped — add it anytime from Chat Widgets/i)).toBeVisible({
      timeout: cfg.timeouts.nav,
    });

    // Go Back must return to Channels, never Agents.
    await page.getByRole('button', { name: /Go Back/i }).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/channels/, { timeout: cfg.timeouts.nav });
    await expect(page).not.toHaveURL(/\/onboarding\/chat\/agents/);

    // Skipping must not create a widget.
    expect(widgetWatch.creates().length).toBe(0);
    widgetWatch.stop();
  });

  test('H4 @P1 Design step free-plan gates open the upgrade popup', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const watch = wiz.watchOnboardingApi(page);
    const widgetWatch = watchWidgetApi(page);
    await wiz.goto(page, wiz.routes.chatDesign);

    await expect(page).toHaveURL(/\/onboarding\/chat\/design/);

    // A gated control (page rules / Chat Panel style / Custom position) opens the
    // ChatWidgetUpgradeGate / FeatureGateUpgrade popup carrying a BUSINESS badge.
    // TODO(selector): confirm which gated control is easiest to click; using the
    // "specific pages" page-rule option here with a resilient text locator.
    await page
      .getByText(/specific pages/i)
      .or(page.getByText(/Chat Panel/i))
      .or(page.getByText(/Custom/i))
      .first()
      .click();

    // The gate popup: a BUSINESS badge plus an upgrade CTA.
    await expect(page.getByText(/BUSINESS/).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Upgrade|higher plan|Business/i).first()).toBeVisible();

    // The gated action must fire NO create/adjust request.
    expect(onboardingWrites(watch).length).toBe(0);
    expect(widgetWatch.creates().length).toBe(0);

    // NOTE: the Account-B "all controls apply" half of H4, and the duration/scroll
    // trigger copy ("DISPLAY AFTER (SECONDS)" 0–600 / percent 0–100, and the Chat
    // Panel "Give the chat panel a heading" requirement) need the design-step
    // control selectors confirmed on staging before they can be driven here.
    watch.stop();
    widgetWatch.stop();
  });

  test('H5 @P0 Finish Setup creates the widget', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const widgetWatch = watchWidgetApi(page);
    await wiz.goto(page, wiz.routes.chatChannels);

    // Drive Channels → Design → Agents. Prefilled channels come from the chat
    // recommendations, so the default selection is non-empty.
    await page.getByRole('button', { name: /Continue with \d+ channels?/i }).or(page.getByRole('button', { name: /^Continue/i })).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/design/, { timeout: cfg.timeouts.nav });

    // Design → Agents.
    // TODO(selector): confirm the Design step's primary label (Continue / Next).
    await page.getByRole('button', { name: /Continue|Next/i }).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/agents/, { timeout: cfg.timeouts.nav });

    // Add one agent (name + contact).
    // TODO(selector): confirm the "Add agent" trigger and the name/contact inputs.
    await page.getByRole('button', { name: /Add agent/i }).or(page.getByText(/Add agent/i)).first().click().catch(() => {});
    const agentName = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
    const agentContact = page.locator('input[name*="contact" i], input[name*="email" i], input[type="email"]').first();
    if (await agentName.count()) await agentName.fill('QA Agent');
    if (await agentContact.count()) await agentContact.fill('qa-agent@example.com');

    await page.getByRole('button', { name: /Finish Setup/i }).click();

    // Robust facts: the creating spinner shows and a create request fires.
    await expect(page.getByText(/Creating your chat widget/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect.poll(() => widgetWatch.creates().length, { timeout: cfg.timeouts.nav }).toBeGreaterThan(0);

    // Summary confirms the widget is live for the site.
    await expect(page.getByText(/\d+ channels? · \d+ agents? — live on/i)).toBeVisible({ timeout: cfg.timeouts.nav });

    // TODO(selector): pixel parity — the wizard "LIVE WIDGET PREVIEW" should match
    // the created widget on the Chat Widgets edit page (ChatWidgetStage). Assert the
    // observable parts here (widget name "Chat Widget N Chat|Simple", chosen channels
    // and greeting) once the Chat Widgets edit-page selectors are confirmed.
    widgetWatch.stop();
  });

  test('H6 @P1 Free plan widget limit reached', async ({ page }) => {
    // Precondition: Account A already has one chat widget (Free cap = 1).
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const watch = wiz.watchOnboardingApi(page);
    const widgetWatch = watchWidgetApi(page);
    await wiz.goto(page, wiz.routes.chatAgents);

    await expect(page.getByText(/Free plan widget limit reached/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByRole('button', { name: /Upgrade/i }).or(page.getByText(/Upgrade/i)).first()).toBeVisible();
    await expect(page.getByText(/Manage chat widgets/i)).toBeVisible();
    // Agents are shown as Business-only.
    await expect(page.getByText(/Add Agent — Business/i)).toBeVisible();

    // Finish opens the upgrade gate and fires NO create request.
    await page.getByRole('button', { name: /Finish/i }).first().click();
    await expect(page.getByText(/BUSINESS/).first()).toBeVisible({ timeout: cfg.timeouts.nav });
    expect(onboardingWrites(watch).length).toBe(0);
    expect(widgetWatch.creates().length).toBe(0);
    watch.stop();
    widgetWatch.stop();
  });

  test('H7 @P1 Missing channel details routes back to Channels', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await wiz.goto(page, wiz.routes.chatChannels);

    // Clear a selected channel's contact value so its details are incomplete.
    // TODO(selector): confirm the per-channel contact input for an enabled channel.
    const contact = page
      .locator('input[type="tel"], input[type="email"], input[name*="contact" i], input[placeholder*="number" i]')
      .first();
    if (await contact.count()) await contact.fill('');

    // Advance and try to finish.
    await page.getByRole('button', { name: /Continue with \d+ channels?/i }).or(page.getByRole('button', { name: /^Continue/i })).first().click();
    // Best-effort progression to the Finish control.
    await page.getByRole('button', { name: /Continue|Next/i }).first().click().catch(() => {});
    await page.getByRole('button', { name: /Finish Setup|Finish/i }).first().click().catch(() => {});

    await expect(page.getByText(/Add your channel details first/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page).toHaveURL(/\/onboarding\/chat\/channels/, { timeout: cfg.timeouts.nav });
  });

  test('H8 @P1 Re-Finish updates the same widget, not a duplicate', async ({ page }) => {
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const widgetWatch = watchWidgetApi(page);
    await wiz.goto(page, wiz.routes.chatChannels);

    // Create the widget (same flow as H5).
    await page.getByRole('button', { name: /Continue with \d+ channels?/i }).or(page.getByRole('button', { name: /^Continue/i })).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/design/, { timeout: cfg.timeouts.nav });
    await page.getByRole('button', { name: /Continue|Next/i }).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/agents/, { timeout: cfg.timeouts.nav });

    // TODO(selector): confirm the "Add agent" trigger and name/contact inputs.
    await page.getByRole('button', { name: /Add agent/i }).or(page.getByText(/Add agent/i)).first().click().catch(() => {});
    const agentName = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
    if (await agentName.count()) await agentName.fill('QA Agent');

    await page.getByRole('button', { name: /Finish Setup/i }).click();
    await expect.poll(() => widgetWatch.creates().length, { timeout: cfg.timeouts.nav }).toBe(1);

    // Capture the created widget id from the POST url for the same-id assertion.
    const createUrl = widgetWatch.creates()[0].url;
    // TODO(selector): confirm how the widget id appears in the create response/url.
    const idMatch = createUrl.match(/\/(\d+)(?:\?|$)/) || createUrl.match(/widget[s]?\/(\w+)/i);
    const widgetId = idMatch ? idMatch[1] : null;

    // Go Back to Agents, change the agent name, Finish again.
    await page.getByRole('button', { name: /Go Back/i }).first().click();
    await expect(page).toHaveURL(/\/onboarding\/chat\/agents/, { timeout: cfg.timeouts.nav });
    if (await agentName.count()) await agentName.fill('QA Agent Renamed');
    await page.getByRole('button', { name: /Finish Setup/i }).click();

    // Robust facts: the re-finish is an update (PUT/PATCH), not a second create.
    await expect.poll(() => widgetWatch.updates().length, { timeout: cfg.timeouts.nav }).toBeGreaterThan(0);
    expect(widgetWatch.creates().length).toBe(1);
    if (widgetId) {
      expect(widgetWatch.updates().some((c) => c.url.includes(widgetId))).toBeTruthy();
    }
    widgetWatch.stop();
  });

  test('H9 @P2 Live preview panel', async ({ page }) => {
    // Un-automatable without the live DOM: the "LIVE WIDGET PREVIEW" re-render on
    // Desktop/Mobile toggle, the inert launcher (click keeps the panel open), and the
    // per-channel "N agents available" counter all need confirmed selectors + visual
    // inspection inside the preview frame.
    // Steps to implement once the ChatWidgetStage preview selectors are pinned:
    //   1. Reach /onboarding/chat/design (or /agents) on the paid account.
    //   2. Toggle Desktop / Mobile above the preview → assert the frame re-renders
    //      (LIVE WIDGET PREVIEW heading, layout changes) but no URL change.
    //   3. Click the launcher in the preview → assert the panel stays open (inert).
    //   4. Add an agent → assert the per-channel "N agents available" count updates.
    test.fixme(true, 'Live preview interactivity: confirm ChatWidgetStage preview selectors + device toggle + launcher-inert behaviour on staging, then implement.');
  });
});
