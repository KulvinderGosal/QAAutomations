// Minimal Playwright config for TestPilot's ad-hoc "test any URL" runs.
// The runner middleware (server/runner.ts) spawns this with TestPilot's own
// Playwright binary, passing the target via ADHOC_* env vars. JSON results go to
// PLAYWRIGHT_JSON_OUTPUT_NAME (a temp file); trace/screenshot artifacts go to a
// temp outputDir — nothing is ever written into this folder or the repo.
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: path.join(os.tmpdir(), "testpilot-adhoc-artifacts"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["json"]],
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Default to the system Google Chrome (channel:"chrome"), matching the other
    // QA frameworks — no bundled-browser download needed. firefox/webkit use
    // Playwright's bundled builds and require `npx playwright install` if missing.
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
