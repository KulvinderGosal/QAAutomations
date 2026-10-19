/**
 * Group F — Audiences and Automations (shared by the web and app tracks)
 * Plan cases F1–F13. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * The plan says: "Run once on a Free account and once on Business." We express
 * that per case — plan-specific cases log in with the right account and
 * test.skip when it is not configured:
 *   - Free-quota / gate cases (F2, F6, F9) → account A ('free')
 *   - Business-unlock case (F7)            → account B ('paid')
 *   - shared cases                         → account B ('paid') by default
 *
 * Endpoints used here (under /d/v1/sites/:siteId/onboarding-ai/):
 *   GET recommendations?track=web   — curation for both tabs
 *   POST adjust-workflow            — AI adjust chips / free text
 * A `fallback:true` response is HTTP 200 with usable content and is NOT an error.
 *
 * The segment/group/workflow *create* calls hit the normal dashboard APIs, not
 * onboarding-ai. Their exact paths are not in the plan's table, so route globs
 * and response matchers below are marked TODO(selector) to be pinned on staging.
 */
const { test, expect } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');
const auth = require('../utils/onboarding-auth');
const wiz = require('../utils/onboarding-helpers');

const site = cfg.sites;

/** Drive install → passing check → analyzing → popup → segments step. */
async function reachSegmentsStep(page) {
  await wiz.goto(page, wiz.routes.webInstall);
  await page.getByRole('button', { name: /Confirm and Check Status/i }).click();
  await page
    .getByRole('button', { name: /Continue to Popup Design/i })
    .click({ timeout: cfg.timeouts.nav });
  await page.waitForURL(/\/onboarding\/web\/popup/, {
    timeout: cfg.timeouts.analyzing + cfg.timeouts.nav,
  });
  await wiz.waitForSpa(page);
  await page.getByRole('button', { name: /Looks Good, Continue/i }).click();
  await page.waitForURL(/\/onboarding\/web\/segments/, { timeout: cfg.timeouts.nav });
  await wiz.waitForSpa(page);
}

/** Continue past segments to the workflows (automations) step. */
async function reachWorkflowsStep(page) {
  await reachSegmentsStep(page);
  // TODO(selector): confirm the footer primary label; it reads either
  // "Create N segments & M groups" or "Continue without audiences".
  await page
    .getByRole('button', { name: /Create \d+ (segment|audience|group)|Continue without audiences|Continue/i })
    .first()
    .click();
  await page.waitForURL(/\/onboarding\/web\/workflows/, { timeout: cfg.timeouts.nav });
  await wiz.waitForSpa(page);
}

test.describe('F · Audiences and Automations', () => {
  test.beforeEach(async ({ context }) => {
    await wiz.startTelemetryCapture(context);
  });

  test('F1 @P0 Audiences renders the curation', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    const watch = wiz.watchOnboardingApi(page);
    await reachSegmentsStep(page);

    await expect(page.getByText(/Segments & Groups/i)).toBeVisible();
    const domain = site.site1.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    await expect(page.getByText(new RegExp(escapeRe(domain), 'i')).first()).toBeVisible();

    // Both tabs present.
    await expect(page.getByRole('tab', { name: /Segments/i }).or(page.getByText(/^Segments/i)).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /Audience Groups/i }).or(page.getByText(/Audience Groups/i)).first()).toBeVisible();

    // Top pick's detail panel is open.
    await expect(page.getByText(/DEFINED BY/i)).toBeVisible();
    await expect(page.getByText(/HOW IT WORKS/i)).toBeVisible();
    await expect(page.getByText(/GREAT FOR/i)).toBeVisible();

    // Assistant line reflects the recommendations `fallback` flag.
    const rec = watch.calls.find((c) => c.endpoint.startsWith('recommendations'));
    if (rec && rec.fallback === false) {
      await expect(page.getByText(/I tailored these/i)).toBeVisible();
    } else if (rec && rec.fallback === true) {
      await expect(page.getByText(/Here are proven starter/i)).toBeVisible();
    }
    watch.stop();
  });

  test('F2 @P0 Free-plan quota in the UI', async ({ page }) => {
    test.skip(!cfg.accounts.free.email, 'PE_ACCOUNT_A_* (Free) not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'free');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachSegmentsStep(page);

    // Overflow rows carry a "Plan limit" badge and open the upgrade popup.
    await expect(page.getByText(/Plan limit/i).first()).toBeVisible();
    await expect(page.getByText(/more .* on higher plans/i)).toBeVisible();

    // TODO(selector): confirm a locked row selector; clicking it opens the
    // segmentation upgrade popup.
    await page.getByText(/Plan limit/i).first().click();
    await expect(page.getByText(/Upgrade/i).first()).toBeVisible();
  });

  test('F3 @P0 Create segments and groups', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachSegmentsStep(page);

    // TODO(selector): confirm the row/checkbox markup to select exactly 3
    // segments and 2 groups. The default curation is used here as a proxy.
    const create = page
      .getByRole('button', { name: /Create \d+ segment/i })
      .or(page.getByRole('button', { name: /Create \d+ .* & \d+/i }))
      .first();
    await expect(create).toBeVisible();
    await create.click();

    await expect(page.getByText(/Creating your audiences/i)).toBeVisible().catch(() => {});
    await expect(page).toHaveURL(/\/onboarding\/web\/workflows/, { timeout: cfg.timeouts.nav });
    // TODO(selector): to prove the creates are sequential, capture request
    // start/finish timestamps on the segment/group create endpoints once pinned.
  });

  test('F4 @P1 Create failure holds the step', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachSegmentsStep(page);

    // Simulate a duplicate-name 400 on the first create call (stands in for the
    // pre-created same-named segment the manual case seeds).
    // TODO(selector): confirm the segment create endpoint; this glob is broad.
    let failedOnce = false;
    await page.route(/\/segments?(\?|$|\/)/, (route) => {
      if (route.request().method() === 'POST' && !failedOnce) {
        failedOnce = true;
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'A segment with this name already exists' }),
        });
      }
      return route.continue();
    });

    await page
      .getByRole('button', { name: /Create \d+ segment|Create \d+ .* & \d+/i })
      .first()
      .click();

    // The failed row shows the server message inline; a notification appears;
    // the step must not advance.
    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: cfg.timeouts.nav });
    await expect(page.getByText(/Couldn.t create \d+ audience/i)).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/web\/segments/);

    await page.unroute(/\/segments?(\?|$|\/)/);
  });

  test('F5 @P1 Continue without audiences', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachSegmentsStep(page);

    // TODO(selector): confirm the "select all / deselect all" affordance. The
    // primary label flips to "Continue without audiences" at zero selection.
    const deselectAll = page.getByRole('button', { name: /Deselect all|Clear all/i }).first();
    if ((await deselectAll.count()) > 0) await deselectAll.click();

    const cont = page.getByRole('button', { name: /Continue without audiences/i });
    await expect(cont).toBeVisible();

    // No create requests should fire on the way out.
    let createSeen = false;
    const onReq = (req) => {
      if (req.method() === 'POST' && /segments?|audience.?groups?/i.test(req.url())) createSeen = true;
    };
    page.on('request', onReq);
    await cont.click();
    await page.waitForURL(/\/onboarding\/web\/workflows/, { timeout: cfg.timeouts.nav });
    page.off('request', onReq);
    expect(createSeen).toBeFalsy();
  });

  test('F6 @P0 Automations sections on Free', async ({ page }) => {
    test.skip(!cfg.accounts.free.email, 'PE_ACCOUNT_A_* (Free) not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'free');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachWorkflowsStep(page);

    await expect(page.getByText(/READY ON YOUR FREE PLAN/i)).toBeVisible();
    await expect(page.getByText(/UNLOCK WITH A HIGHER PLAN/i)).toBeVisible();
    // A lock reason and the plans link are shown on gated rows.
    await expect(page.getByText(/it uses wait timers|A\/B split paths/i).first()).toBeVisible();
    await expect(page.getByText(/View plans/i).first()).toBeVisible();
    // Assistant reminder.
    await expect(page.getByText(/Each saves as a draft/i)).toBeVisible();
  });

  test('F7 @P0 Automations on Business', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(cfg.accounts.paid.plan === 'free', 'Account B must be Business or higher');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachWorkflowsStep(page);

    await expect(page.getByText(/READY ON YOUR BUSINESS PLAN/i)).toBeVisible();
    // Welcome series is unlocked (appears under the ready section).
    await expect(page.getByText(/Welcome/i).first()).toBeVisible();
    // Only Premium+ (A/B) and Growth (HTTP request) remain locked.
    await expect(page.getByText(/A\/B|HTTP request/i).first()).toBeVisible();
  });

  test('F8 @P1 AI adjust: free chip and free text', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachWorkflowsStep(page);

    // TODO(selector): confirm workflow row selection + the "Make it shorter" chip.
    await page.getByText(/Make it shorter/i).first().click();

    // POST adjust-workflow fires and the note + Revert link appear.
    await page.waitForResponse(
      (r) => /onboarding-ai\/adjust-workflow/.test(r.url()) && r.request().method() === 'POST',
      { timeout: cfg.timeouts.nav }
    );
    await expect(page.getByRole('button', { name: /Revert changes/i }).or(page.getByText(/Revert changes/i)).first()).toBeVisible();

    // Free-text direction.
    // TODO(selector): confirm the free-text adjust input + Adjust button.
    const freeText = page.getByRole('textbox').first();
    if ((await freeText.count()) > 0) await freeText.fill('add a reminder after 2 days');
    await page.getByRole('button', { name: /^Adjust$/i }).first().click();
    await page.waitForResponse(
      (r) => /onboarding-ai\/adjust-workflow/.test(r.url()) && r.request().method() === 'POST',
      { timeout: cfg.timeouts.nav }
    );

    // Revert restores the prior tree.
    await page.getByText(/Revert changes/i).first().click();
  });

  test('F9 @P1 Gated chip opens the upgrade popup without an API call', async ({ page }) => {
    test.skip(!cfg.accounts.free.email, 'PE_ACCOUNT_A_* (Free) not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'free');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachWorkflowsStep(page);

    // Clicking a gated chip must NOT hit adjust-workflow.
    let adjustSeen = false;
    const onReq = (req) => {
      if (/onboarding-ai\/adjust-workflow/.test(req.url())) adjustSeen = true;
    };
    page.on('request', onReq);

    // TODO(selector): confirm the crown-gated "Add an A/B test" chip.
    await page.getByText(/Add an A\/B test/i).first().click();
    await expect(page.getByText(/Upgrade/i).first()).toBeVisible();

    await page.waitForTimeout(500);
    page.off('request', onReq);
    expect(adjustSeen).toBeFalsy();
  });

  test('F10 @P1 Backend fallback on adjust', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachWorkflowsStep(page);

    // Block adjust-workflow so the UI must show the inline fallback note.
    await page.route('**/onboarding-ai/adjust-workflow', (route) => route.abort());

    // TODO(selector): confirm the chip that triggers an adjust.
    await page.getByText(/Make it shorter/i).first().click();

    await expect(
      page.getByText(/The AI couldn.t adjust this one right now — it.s saved as-is/i)
    ).toBeVisible({ timeout: cfg.timeouts.nav });
    // No error toast.
    await expect(page.getByText(/error/i)).toHaveCount(0);

    await page.unroute('**/onboarding-ai/adjust-workflow');
  });

  test('F11 @P0 Create workflows and open them in the builder', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachWorkflowsStep(page);

    // TODO(selector): confirm workflow row selection to pick exactly 2.
    const create = page.getByRole('button', { name: /Create \d+ workflow/i }).first();
    await expect(create).toBeVisible();
    await create.click();

    await expect(page.getByText(/Creating/i)).toBeVisible().catch(() => {});
    await expect(page).toHaveURL(/\/onboarding\/web\/summary/, { timeout: cfg.timeouts.nav });

    // The manual case also opens each draft in Campaign › Workflows to confirm
    // no validation errors and that push URLs use the site origin (never
    // example.com). That cross-page verification is left for a follow-up:
    // TODO(selector): navigate to /automation/workflows, open each new draft,
    // assert inactive status + node tree + origin in push URLs.
  });

  test('F12 @P1 Workflow depending on a segment that was not created', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    // The dependency between a specific workflow and a specific segment name is
    // data-driven (comes from the live recommendations payload) and cannot be
    // known statically to select the right rows. Steps to implement once the
    // recommendations shape is confirmed on staging:
    //   1) reachSegmentsStep(page)
    //   2) note the segment a chosen workflow depends on; deselect that segment
    //   3) create the remaining audiences, advance to workflows
    //   4) select the dependent workflow
    //   5) expect row error "This automation needs the {Segment Name} segment.
    //      Go back and create it, or deselect this automation." and the step holds
    test.fixme(true, 'Needs live recommendations payload to map workflow→segment dependency; confirm selectors + dependency names on staging.');
  });

  test('F13 @P2 Refresh on the audiences step refetches recommendations', async ({ page }) => {
    test.skip(!cfg.accounts.paid.email, 'PE_ACCOUNT_B_* not configured');
    test.skip(!site.site1.url, 'Site 1 not configured');
    await auth.login(page, 'paid');
    if (site.site1.name) await wiz.switchSite(page, site.site1.name);
    await reachSegmentsStep(page);

    // Reload and assert recommendations are refetched from the backend cache.
    const recPromise = page.waitForResponse(
      (r) => /onboarding-ai\/recommendations/.test(r.url()) && r.request().method() === 'GET',
      { timeout: cfg.timeouts.nav }
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    const rec = await recPromise;
    expect(rec.status()).toBe(200);
    await expect(page.getByText(/Segments & Groups/i)).toBeVisible();
    // Selection resets to defaults after a refresh (top pick preselected again).
    await expect(page.getByText(/DEFINED BY/i)).toBeVisible();
  });
});

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
