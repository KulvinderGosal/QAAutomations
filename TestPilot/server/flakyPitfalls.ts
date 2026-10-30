// Catalogue of Playwright flakiness pitfalls seen across the PushEngage / LedgerPort
// QA frameworks — fed to the AI flaky-diagnosis as PRIORS so it reasons from what
// has actually bitten us here, not just generic advice. Keep this current as new
// classes of flake are found.
export const FLAKY_PITFALLS = `Known flakiness pitfalls in these QA frameworks (use as priors — match the failure to one if it fits, else reason from first principles):

1. HASH-ROUTE / SPA navigation: apps that route via '#/...' (and some admin SPAs) don't fire a full navigation, so waitForNavigation / waitForURL / networkidle never resolves or resolves early. Assert on a landmark element after the click (expect(locator).toBeVisible()) instead of waiting on the URL/load event. CTAs that navigate via JS need click-then-assert-destination, not a bare click.

2. OFF-VIEWPORT / not-yet-scrolled elements: an element that exists in the DOM but is off-screen or lazy-rendered fails .click()/.isVisible() intermittently depending on window size and scroll. Use scrollIntoViewIfNeeded, or a web-first assertion (expect(...).toBeVisible()) that auto-waits, and pin a viewport. Duplicate hidden fields (e.g. an edit modal that keeps both tabs mounted) make getByLabel(...).first() grab the HIDDEN one — scope to ':visible' or a stable container.

3. CLOUDFLARE / Turnstile rate-limiting on LIVE marketing sites (pushengage.com, ledgerport.com): sustained automated crawling triggers 403 / ERR_CONNECTION_RESET / timeouts / blank renders AFTER the first N requests, from a non-allow-listed IP. This reads as a "failure" but is throttling, not a product bug. Mitigate with --workers=1 (serial, no burst) + --retries + longer navigationTimeout, or run from an allow-listed IP/CI. Turnstile/CAPTCHA on login cannot be solved by automation — self-skip or use a captured session.

4. IFRAME / embedded apps (Shopify embedded apps): clicks/reads must go through frameLocator — Claude-in-Chrome / top-frame locators don't reach into the cross-origin iframe. Use page.frameLocator(...). A missing/expired captured session (npm run auth:capture) makes iframe specs flake or self-skip.

5. TOAST / transient UI assertions: asserting on a Toast or a status flash is timing-dependent (it may auto-dismiss before the assert). Prefer asserting on the persistent post-action state (a value in a field, a badge, a table row) over the toast.

6. AUTH / session freshness: storageState-based auth (.auth/*.json) goes stale → the spec lands on a login wall and every downstream assertion fails. Not a real bug — refresh the session. Quick single-case runs that carry no env can land on the wrong environment (local, where no site exists) and skip/error.

7. RETRY-SENSITIVE STATE: tests that mutate shared data (create an order/segment/subscriber) and assert a global count are order-dependent and flake under parallel workers or on retry (the retry sees the first run's leftovers). Isolate data per test or assert relative deltas, not absolute counts.

8. NETWORK / async settle: asserting immediately after an action that triggers a background fetch (sync, save, list refresh) races the response. Use expect.poll / web-first assertions with a generous timeout, or wait for the specific response, instead of a fixed page.waitForTimeout.

9. LOCALE / FORMAT drift: assertions on date/number formats break when the app changes format (e.g. DD/MM/YYYY → 'May 19, 2026'). Assert on semantic content, not an exact formatted string.

10. CDP / synthetic-input limits: some custom controls (a color-picker hex input, certain AntD InputNumber) ignore CDP keystrokes or JS-dispatched input/onChange and revert — a harness limitation, not an app bug. Use real clicks / component-specific handles.`;
