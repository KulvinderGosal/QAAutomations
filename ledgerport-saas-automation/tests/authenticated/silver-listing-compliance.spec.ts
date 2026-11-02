/**
 * LedgerPort Silver Listing (#237) — QuickBooks App-Store compliance, DASHBOARD items D1–D5.
 * Source: the 25 Sep 2026 compliance review (artifact ce40e657). Asserts the DESIRED (fixed) state.
 *
 * Runs in the AUTHENTICATED project (storageState) — needs a captured session:
 *   LP_ENV=staging    npm run auth:capture
 *   LP_ENV=staging    npx playwright test tests/authenticated/silver-listing-compliance.spec.ts --project=authenticated-staging
 *   LP_ENV=production …  --project=authenticated-production
 * The signed-in tests (D1/D2/D3/D5) first check the saved session offline and throw BlockedSessionError
 * (BLOCKED:SESSION + the capture command) when it is expired; a page that still bounces to the login
 * form self-skips with the capture command. D4 (/quickbooks-disconnected) is public and always runs.
 * D2-D5 carry a CONDITIONAL test.fail(...) for the open issues #307/#309: expected-fail only while that
 * issue's exact signature is observed on a rendered page; any other failure is a real FAIL.
 * A Cloudflare block/challenge page throws BlockedError SESSION/waf (never bypassed); any other
 * HTTP >= 400 FAILS (it used to green-skip, hiding outages). D1 throws BlockedError FIXTURE when
 * the account shows no Connect-to-QuickBooks control (QuickBooks already connected).
 *
 * @case mapping (QA Autonomy Plan V2a): each test carries tag @case:SLR-D<n> (SLR = the
 * Silver Listing 22-item Review; D1–D5 are its dashboard item keys) plus a 'review-item'
 * annotation and the GitHub issue(s) filed for it, so `--grep @case:SLR-D3` runs one item.
 * There is no per-item Asana subtask gid for D1–D5 yet, so no 'asana' annotation.
 */
import { test, expect, Page } from "@playwright/test";
import { BlockedError } from "../../../packages/qa-core/errors";
import { detectWafChallenge } from "../../../packages/qa-core/api/base";
import { ACTIVE } from "../../config/env";
import { assertSessionUsable, captureCommand } from "../helpers/session";

const NOTICE = /Intuit and QuickBooks are registered trademarks of Intuit Inc\.\s*Used with permission\./i;

const CF_BLOCK = /Sorry, you have been blocked|Attention Required|Just a moment\.\.\./i;

async function gotoAuthed(page: Page, path: string): Promise<boolean> {
  const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(resp, `navigation to ${path} returned a response`).not.toBeNull();
  const status = resp!.status();
  const bodyText = await resp!.text().catch(() => "");
  if (detectWafChallenge(status, resp!.headers(), bodyText) || CF_BLOCK.test(await page.title().catch(() => "")) || CF_BLOCK.test(bodyText.slice(0, 20000))) {
    throw new BlockedError({
      cls: "SESSION",
      code: "waf",
      reason: `Cloudflare WAF blocked/challenged ${path} (HTTP ${status}) on this host`,
      humanAction: "re-run from an allow-listed IP / after the block clears (never bypass the challenge)",
    });
  }
  expect(status, `${path} should load (HTTP < 400)`).toBeLessThan(400);
  // Readiness: the app sidebar (authed pages) or any page heading (public /quickbooks-disconnected).
  await page
    .getByRole("link", { name: "Connections", exact: true })
    .or(page.locator("h1, h2").first())
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => {});
  // The SPA can render its login form without a /login URL (seen 2026-10-21 with an expired session),
  // so the login FORM counts as a bounce too — otherwise D2/D3/D5 would scan the login page.
  const loginForm = await page.getByRole("heading", { name: /^log in$/i }).first().isVisible().catch(() => false);
  if (/\/login/i.test(page.url()) || loginForm) { test.skip(true, `Bounced to the login page — no valid session (run ${captureCommand(ACTIVE)}).`); return false; }
  return true;
}
/** Offline, token-free session check for the signed-in pages (D1/D2/D3/D5). Expired → BLOCKED{SESSION} in ms. */
const requireSession = () => assertSessionUsable(ACTIVE, { allowRefreshable: true });
const norm = async (page: Page, sel = "body") => ((await page.locator(sel).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();

test.describe("Silver Listing #237 · Dashboard (D1–D5)", () => {
  test("D1 official Intuit Connect button image @silver-listing", { tag: ["@case:SLR-D1"], annotation: [{ type: 'review-item', description: 'Silver Listing #237 22-item review D1' }] }, async ({ page }) => {
    requireSession();
    if (!(await gotoAuthed(page, "/connections"))) return;
    // Precondition = a Connect-to-QuickBooks control is on the page (it only renders when QuickBooks
    // is NOT connected). Detected POSITIVELY: the old whole-body /disconnect|connected/ test matched
    // every storefront row's "Disconnect" button and "Not connected", so D1 skipped on every account.
    const connectCtl = page
      // "Continue with QuickBooks" is the text button staging renders today (the D1 defect itself),
      // so it must count as the control — otherwise D1 mis-reports FIXTURE on a not-connected business.
      .getByRole("button", { name: /(connect (to )?|continue with )quickbooks/i })
      .or(page.getByRole("link", { name: /(connect (to )?|continue with )quickbooks/i }))
      .or(page.locator('img[src*="c2qb" i], img[alt*="connect to quickbooks" i]'));
    await connectCtl.first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    if ((await connectCtl.count()) === 0) {
      throw new BlockedError({
        cls: "FIXTURE",
        code: "qb-connected",
        reason: "D1 needs a business with NO QuickBooks connection — this account shows no Connect-to-QuickBooks control",
        humanAction: "capture a session for (or switch to) a business with no QuickBooks mapping, then re-run @case:SLR-D1",
      });
    }
    // Intuit's official "Connect to QuickBooks" button is an <img> (C2QB), not a text-styled button.
    const c2qb = await page.locator("img, button img, a img").evaluateAll((els: any[]) =>
      els.map((e) => (e.getAttribute("src") || "") + "|" + (e.getAttribute("alt") || ""))
         .filter((s) => /c2qb|connect[-_ ]?to[-_ ]?quickbooks|quickbooks.*(button|connect)|intuit.*button/i.test(s))).catch(() => []);
    expect(c2qb.length, "an official Intuit Connect-to-QuickBooks button image should be present").toBeGreaterThan(0);
  });

  test("D2 no 'QB' / 'qb Online' abbreviations in dashboard copy @silver-listing", { tag: ["@case:SLR-D2"], annotation: [{ type: 'review-item', description: 'Silver Listing #237 22-item review D2' }, { type: 'issue', description: 'awesomemotive/pushengage-ledgerport#309' }, { type: 'issue', description: 'awesomemotive/pushengage-ledgerport#307' }] }, async ({ page }) => {
    requireSession();
    if (!(await gotoAuthed(page, "/connections"))) return;
    const t = await norm(page);
    expect(t.length, "/connections rendered its page text").toBeGreaterThan(50);
    // Expected-fail ONLY while the #309 signature ("qb Online") is observed; anything else is a real FAIL.
    test.fail(/qb\s*online/i.test(t), 'awesomemotive/pushengage-ledgerport#309: known bug ("qb Online" label/img alt on Connections; open 2026-10-21)');
    expect(t, "copy should spell out 'QuickBooks', never 'qb Online'").not.toMatch(/qb online/i);
    // standalone "QB" as a word (not part of a longer token) should be gone from user-facing copy
    expect(t.replace(/QuickBooks/gi, ""), "no standalone 'QB' abbreviation in copy").not.toMatch(/\bQB\b/);
  });

  test("D3 'Disconnect from QuickBooks' label @silver-listing", { tag: ["@case:SLR-D3"], annotation: [{ type: 'review-item', description: 'Silver Listing #237 22-item review D3' }, { type: 'issue', description: 'awesomemotive/pushengage-ledgerport#309' }] }, async ({ page }) => {
    requireSession();
    if (!(await gotoAuthed(page, "/connections"))) return;
    const t = await norm(page);
    expect(t.length, "/connections rendered its page text").toBeGreaterThan(50);
    if (!/\bdisconnect\b/i.test(t)) {
      throw new BlockedError({
        cls: "FIXTURE",
        code: "qb-not-connected",
        reason: "D3 needs a business WITH a QuickBooks connection — /connections shows no Disconnect control at all",
        humanAction: "capture a session for (or switch to) a QuickBooks-connected business, then re-run @case:SLR-D3",
      });
    }
    // Expected-fail ONLY while the #309 signature (a bare "Disconnect", no "from QuickBooks") is observed.
    test.fail(!/Disconnect from QuickBooks/i.test(t), 'awesomemotive/pushengage-ledgerport#309: known bug (bare "Disconnect" label, no "Disconnect from QuickBooks"; open 2026-10-21)');
    expect(t).toMatch(/Disconnect from QuickBooks/i);
  });

  test("D4 disconnect page copy + reconnect steps @silver-listing", { tag: ["@case:SLR-D4"], annotation: [{ type: 'review-item', description: 'Silver Listing #237 22-item review D4' }, { type: 'issue', description: 'awesomemotive/pushengage-ledgerport#307' }] }, async ({ page }) => {
    if (!(await gotoAuthed(page, "/quickbooks-disconnected"))) return;
    const t = await norm(page);
    expect(t.length, "/quickbooks-disconnected rendered its page text").toBeGreaterThan(50);
    // Expected-fail ONLY while the #307 signature ("couldn't verify") is on the page; a page that lost its
    // "connection ended" / reconnect copy without that signature is a real FAIL.
    test.fail(/couldn'?t verify|could not verify|unable to verify/i.test(t), 'awesomemotive/pushengage-ledgerport#307: known bug ("couldn\'t verify" shown without a realmId; open 2026-10-21)');
    expect(t, "states the connection ended").toMatch(/disconnect|connection (ended|was removed|has ended)|no longer connected/i);
    expect(t, "gives reconnect guidance").toMatch(/reconnect|connect again|re-connect|connect your/i);
    expect(t, "must NOT show a 'couldn't verify' error without a realmId").not.toMatch(/couldn'?t verify|could not verify|unable to verify/i);
  });

  test("D5 trademark notice in the dashboard footer @silver-listing", { tag: ["@case:SLR-D5"], annotation: [{ type: 'review-item', description: 'Silver Listing #237 22-item review D5' }, { type: 'issue', description: 'awesomemotive/pushengage-ledgerport#309' }] }, async ({ page }) => {
    requireSession();
    if (!(await gotoAuthed(page, "/connections"))) return;
    // Read the whole page text (notice may live in a footer that isn't a <footer> element).
    const body = (await page.locator("body").innerText({ timeout: 10000 }).catch(() => "")).replace(/\s+/g, " ").trim();
    expect(body.length, "/connections rendered its page text").toBeGreaterThan(50);
    // Expected-fail ONLY while the #309 signature (notice absent) is observed.
    test.fail(!NOTICE.test(body), 'awesomemotive/pushengage-ledgerport#309: known bug (no Intuit trademark notice; open 2026-10-21)');
    expect(body, "trademark notice should appear in the dashboard footer/page").toMatch(NOTICE);
  });
});
