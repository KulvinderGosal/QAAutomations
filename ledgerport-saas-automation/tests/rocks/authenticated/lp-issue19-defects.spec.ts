/**
 * Rock lp-issue19-defects — omnysync-backend#19: re-verify the 20 reported
 * LedgerPort defects (Asana 1218737602807621; TestPilot suite-lp-issue19,
 * cases TC-2565..TC-2584). This file holds the SaaS-dashboard items (the
 * redesigned billing plans view on app-staging.ledgerport.com). The embedded
 * Shopify-app items live in ledgerport-shopify/tests/rocks/.
 *
 * Wave 1: TC-2584 (D19-20, item 20: billing CTA, and "Feature unavailable"
 * shown on upgrade). TC-2578 (D19-14, struck vs actual price) and TC-2579
 * (D19-15, card alignment) are appended in a later wave and reuse the shared
 * helpers below (openPlansView / assertNoFeatureUnavailable).
 *
 * Path: tests/rocks/authenticated/ so the `authenticated-<env>` project
 * (testMatch /authenticated\/.*\.spec\.ts/) picks it up with the saved session.
 *
 * SAFETY (non-negotiable):
 *   - Staging only. On production every test skips (a plan CTA click is not a
 *     read-only action).
 *   - The QA account (id 145, Scale) is a live Stripe test-mode subscriber.
 *     "Confirm & continue to payment" is located ONLY to assert it is there and
 *     enabled. It is NEVER clicked. No coupon is applied.
 *   - Any top-level navigation to a *.stripe.com page is aborted, so a plan
 *     CTA can never hand the browser to a Stripe-hosted checkout or portal.
 *   - After the review step the test goes back and re-reads /billing to prove
 *     the current plan did not change.
 *
 * Session: reuses .auth/<env>.json. A missing/expired session, or a bounce to
 * /login, throws qa-core BlockedSessionError ([BLOCKED:SESSION/...]) so the
 * run reports BLOCKED, not PASS/FAIL. A Cloudflare challenge throws
 * BlockedError{ENV/waf}. Never bypassed.
 *
 * Run (staging; blank the creds so global-setup never attempts a scripted login):
 *   LP_ENV=staging LP_STAGING_EMAIL= LP_STAGING_PASSWORD= LP_EMAIL= LP_PASSWORD= \
 *   caffeinate -i npx playwright test tests/rocks/authenticated/lp-issue19-defects.spec.ts \
 *     --project=authenticated-staging --no-deps --reporter=list --retries=0 --workers=1 --trace=off
 */
import { test, expect, type Page, type Locator, type TestInfo } from '@playwright/test';
import { ROUTES, goto } from '../../helpers/app';
import { assertSessionUsable, captureCommand } from '../../helpers/session';
import { ACTIVE } from '../../../config/env';
import { BlockedError, BlockedSessionError } from '../../../../packages/qa-core/errors';

const PERSONA = `ledgerport-saas-automation:${ACTIVE.name}`;
const APP_ORIGIN = new URL(ACTIVE.baseURL).origin;

// ---- locators (no data-testids in the app → role/text anchors; mirrors billing-coupon.spec.ts) ----

const changePlanButton = (page: Page) => page.getByRole('button', { name: /change plan/i }).first();

/**
 * Plan CTA buttons on the plans view (NOT "Change Plan" / "Manage …" / "Current plan").
 * billing-coupon.spec.ts's set, plus "Get started" / "Choose plan" used by the
 * redesigned 3-card view.
 */
const planActionButtons = (page: Page) =>
  page.getByRole('button', { name: /^(upgrade|downgrade|select(\s+plan)?|choose|switch|get started)/i });

/** "Confirm & continue to payment" — located ONLY to assert it. NEVER clicked. */
const confirmPayButton = (page: Page) =>
  page.getByRole('button', { name: /confirm.*(payment|continue)|continue to payment/i }).first();

const securedByStripe = (page: Page) => page.getByText(/secured by stripe/i).first();

/** The defect in item 20: a "Feature unavailable" / "Feature not available" message or modal. */
const FEATURE_UNAVAILABLE = /feature[\s_-]*(not[\s_-]*|un)available/i;

/** Current-plan heading on /billing (billing.spec.ts LP-BILL-002 anchors on "Scale Plan"). */
const currentPlanHeading = (page: Page) =>
  page.getByRole('heading', { name: /^(free|growth|scale|enterprise)\b.*plan/i }).first();

// ------------------------------------ helpers ------------------------------------

/** Throws BLOCKED (never a silent pass) when the page is a login wall or a WAF challenge. */
async function assertAppReachable(page: Page): Promise<void> {
  const title = await page.title().catch(() => '');
  const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 2000);
  if (/just a moment|attention required/i.test(title) || /verify you are human|checking your browser|cf-ray/i.test(body)) {
    throw new BlockedError({
      cls: 'ENV',
      code: 'waf',
      persona: PERSONA,
      reason: `Cloudflare challenge on ${new URL(page.url()).host} (title "${title}")`,
      humanAction: 'Load app-staging.ledgerport.com in a normal browser / from an allow-listed IP, then re-run. Never bypass the challenge.',
    });
  }
  if (/\/login/i.test(new URL(page.url()).pathname)) {
    throw new BlockedSessionError({
      code: 'login-redirect',
      persona: PERSONA,
      refreshable: false,
      reason: `LedgerPort ${ACTIVE.name} bounced to /login — the saved session was rejected`,
      humanAction: captureCommand(ACTIVE),
    });
  }
}

/** Asserts no "Feature unavailable" text or modal is on screen. */
async function assertNoFeatureUnavailable(page: Page, where: string): Promise<void> {
  await expect(page.getByText(FEATURE_UNAVAILABLE).filter({ visible: true }), `no "Feature unavailable" text on ${where}`).toHaveCount(0);
  await expect(
    page.locator('[role="dialog"],[role="alertdialog"]').filter({ hasText: FEATURE_UNAVAILABLE, visible: true }),
    `no "Feature unavailable" modal on ${where}`,
  ).toHaveCount(0);
}

/** Asserts the page is a real app route, not a 404 / error page. */
async function assertNotErrorPage(page: Page, where: string): Promise<void> {
  expect(new URL(page.url()).origin, `${where} stays on the LedgerPort app`).toBe(APP_ORIGIN);
  await expect(
    page.getByText(/\b404\b|page not found|something went wrong/i).filter({ visible: true }),
    `${where} is not a 404 / error page`,
  ).toHaveCount(0);
}

/** From /billing click "Change Plan" and wait for the plans view (route or dialog) to render its CTAs. */
async function openPlansView(page: Page): Promise<void> {
  await expect(changePlanButton(page), '"Change Plan" on /billing').toBeVisible();
  await changePlanButton(page).click();
  await expect(planActionButtons(page).first(), 'plans view shows at least one plan CTA').toBeVisible({
    timeout: 20_000,
  });
  await assertAppReachable(page);
}

/** Plan CTAs ordered upgrade-first (the safest direction for a Scale subscriber's review step). */
async function enabledPlanCtas(page: Page): Promise<{ btn: Locator; label: string }[]> {
  const all = planActionButtons(page);
  const n = await all.count();
  const out: { btn: Locator; label: string; rank: number }[] = [];
  for (let i = 0; i < n; i++) {
    const btn = all.nth(i);
    if (!(await btn.isVisible()) || !(await btn.isEnabled())) continue;
    const label = ((await btn.innerText()) || '').trim();
    out.push({ btn, label, rank: /^upgrade/i.test(label) ? 0 : /^downgrade/i.test(label) ? 2 : 1 });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

/** Records non-GET calls (method + path only, no bodies/headers) for the report. */
function recordMutatingRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'GET' || r.method() === 'HEAD' || r.method() === 'OPTIONS') return;
    try {
      const u = new URL(r.url());
      if (/ledgerport\.com$/.test(u.hostname)) seen.push(`${r.method()} ${u.host}${u.pathname}`);
    } catch {
      /* ignore */
    }
  });
  return seen;
}

function annotate(testInfo: TestInfo, type: string, description: string): void {
  testInfo.annotations.push({ type, description });
}

// ------------------------------------- tests -------------------------------------

test.describe('lp-issue19-defects — omnysync#19 SaaS billing items @rock-lp-issue19-defects', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      ACTIVE.name !== 'staging',
      'Staging only: clicking a plan CTA is not read-only, so this never runs against production (LP_ENV=staging).',
    );
    // Offline session check first (token-free). Expired/missing → BLOCKED{SESSION}.
    assertSessionUsable(ACTIVE, { allowRefreshable: true, persona: PERSONA });

    // Hard stop: never let a plan CTA hand the page to a Stripe-hosted checkout/portal.
    await page.route(/^https:\/\/([a-z0-9-]+\.)*stripe\.com\//i, (route) =>
      route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()
        ? route.abort('blockedbyclient')
        : route.continue(),
    );

    await goto(page, ROUTES.billing);
    await assertAppReachable(page);
    await expect(page.getByRole('heading', { level: 1, name: /^Billing & Subscription$/i })).toBeVisible();
  });

  test(
    'TC-2584 — D19-20 · plan CTA reaches Review & confirm (Confirm & continue to payment, Secured by Stripe), no "Feature unavailable"',
    { tag: ['@case:TC-2584'] },
    async ({ page }, testInfo) => {
      const mutating = recordMutatingRequests(page);

      // Baseline: the current plan before we touch anything.
      await expect(currentPlanHeading(page), 'current plan heading on /billing').toBeVisible();
      const planBefore = ((await currentPlanHeading(page).innerText()) || '').trim();
      annotate(testInfo, 'current-plan', planBefore);

      // Step 1 — Billing → Change Plan → plans view.
      await openPlansView(page);
      await assertNotErrorPage(page, 'plans view');
      await assertNoFeatureUnavailable(page, 'plans view');
      annotate(testInfo, 'plans-view-url', new URL(page.url()).pathname);

      // Every plan CTA on the plans view is enabled ("Current plan" is not a CTA).
      const all = planActionButtons(page);
      const total = await all.count();
      const labels: string[] = [];
      for (let i = 0; i < total; i++) {
        const btn = all.nth(i);
        if (!(await btn.isVisible())) continue;
        const label = ((await btn.innerText()) || '').trim();
        labels.push(label);
        await expect(btn, `plan CTA "${label}" is enabled`).toBeEnabled();
      }
      annotate(testInfo, 'plan-ctas', labels.join(' | '));
      const ctas = await enabledPlanCtas(page);
      expect(ctas.length, 'at least one enabled plan CTA on the plans view').toBeGreaterThan(0);

      // Step 2 — click ONE enabled plan CTA (upgrade-first) to reach Review & confirm.
      const chosen = ctas[0];
      annotate(testInfo, 'clicked-cta', chosen.label);
      await chosen.btn.click();

      // NEVER clicked — only asserted.
      await expect(confirmPayButton(page), '"Confirm & continue to payment" is shown on Review & confirm').toBeVisible({
        timeout: 20_000,
      });
      await expect(confirmPayButton(page), '"Confirm & continue to payment" is enabled').toBeEnabled();
      await expect(securedByStripe(page), '"Secured by Stripe" is shown on Review & confirm').toBeVisible();
      await expect(page.getByText(/\$\s?\d/).first(), 'an order summary with a price renders').toBeVisible();
      await assertNotErrorPage(page, 'Review & confirm');
      expect(new URL(page.url()).pathname, 'Review & confirm is a billing route').toMatch(/^\/billing\b/);
      await assertNoFeatureUnavailable(page, 'Review & confirm');
      annotate(testInfo, 'review-url', new URL(page.url()).pathname);

      // Step 3 — stop: go back without confirming or applying a coupon.
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect(confirmPayButton(page), 'left the review step without confirming').toBeHidden();
      annotate(testInfo, 'after-goBack-url', page.url().replace(/[?#].*$/, ''));

      // Prove nothing was committed: /billing still shows the same current plan.
      await goto(page, ROUTES.billing);
      await assertAppReachable(page);
      await expect(currentPlanHeading(page), 'current plan unchanged after leaving review').toHaveText(planBefore);
      await assertNoFeatureUnavailable(page, '/billing after review');

      if (mutating.length) annotate(testInfo, 'non-GET requests (method+path)', [...new Set(mutating)].join(' ; '));
    },
  );
});
