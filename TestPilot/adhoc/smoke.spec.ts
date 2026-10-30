// Generic ad-hoc smoke test — the "test any URL" engine behind TestPilot's
// Manual Test page. Everything is parameterised via ADHOC_* env vars set by the
// runner middleware. Credentials arrive by env for this one process only and are
// never logged or written to disk.
import { test, expect } from "@playwright/test";

const URL = process.env.ADHOC_URL || "";
const LOGIN_URL = process.env.ADHOC_LOGIN_URL || "";
const USER = process.env.ADHOC_USER || "";
const PASS = process.env.ADHOC_PASS || "";
const EXPECT_TEXT = process.env.ADHOC_EXPECT_TEXT || "";
const EXPECT_TITLE = process.env.ADHOC_EXPECT_TITLE || "";
const SHOT = process.env.ADHOC_SCREENSHOT || "";

test("ad-hoc smoke", async ({ page }) => {
  test.skip(!URL, "ADHOC_URL not provided");

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // Best-effort login when creds are supplied. Deliberately generic: fill the
  // first plausible user field + the first password field, submit, and continue
  // regardless — the password value is never printed.
  if (USER && PASS) {
    await test.step("best-effort login", async () => {
      await page.goto(LOGIN_URL || URL, { waitUntil: "domcontentloaded" });
      const passField = page.locator('input[type="password"]').first();
      if (await passField.count()) {
        const userField = page
          .locator('input[type="email"], input[name="log"], input[name*="user" i], input[name="username"], input[type="text"]')
          .first();
        await userField.fill(USER).catch(() => {});
        await passField.fill(PASS).catch(() => {});
        const submit = page
          .locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login")')
          .first();
        if (await submit.count()) await submit.click().catch(() => {});
        else await passField.press("Enter").catch(() => {});
        await page.waitForLoadState("networkidle").catch(() => {});
        // Never echo the username/email — it's a credential too (see file header).
        console.log("login: submitted credentials to the form");
      } else {
        console.log("login: no password field found — continuing unauthenticated");
      }
    });
  }

  const resp = await page.goto(URL, { waitUntil: "domcontentloaded" });
  const status = resp?.status() ?? 0;
  console.log(`GET ${URL} -> HTTP ${status}`);
  console.log(`final URL: ${page.url()}`);
  const title = await page.title();
  console.log(`title: ${title || "(empty)"}`);

  // Screenshot BEFORE assertions so we always capture the state, even on failure.
  if (SHOT) await page.screenshot({ path: SHOT }).catch(() => {});

  if (consoleErrors.length) {
    console.log(`⚠ ${consoleErrors.length} console error(s):`);
    for (const e of consoleErrors.slice(0, 20)) console.log(`  · ${e.slice(0, 200)}`);
  } else {
    console.log("no console errors");
  }

  expect(status, `HTTP status for ${URL}`).toBeLessThan(400);
  if (EXPECT_TITLE) expect(title.toLowerCase()).toContain(EXPECT_TITLE.toLowerCase());
  if (EXPECT_TEXT) await expect(page.locator("body")).toContainText(EXPECT_TEXT, { timeout: 10_000 });
});
