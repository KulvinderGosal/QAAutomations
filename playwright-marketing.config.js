// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

/**
 * Config for the live PushEngage marketing-site QA specs
 * (tests/marketing-site/*.prod.spec.js).
 *
 * These specs hit PRODUCTION (https://www.pushengage.com) and are read-only /
 * non-destructive: they never submit a real signup or a real demo booking.
 *
 * Env overrides (useful in sandboxed/proxied runners):
 *   PW_EXECUTABLE_PATH  - path to a Chromium binary (e.g. the bundled /opt/pw-browsers Chromium)
 *   HTTPS_PROXY         - outbound proxy; when set, the browser is routed through it
 */
const launchOptions = {
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
};
if (process.env.PW_EXECUTABLE_PATH) {
  launchOptions.executablePath = process.env.PW_EXECUTABLE_PATH;
}

const proxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY }
  : undefined;

module.exports = defineConfig({
  testDir: './tests/marketing-site',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/marketing-results.json' }]],
  use: {
    baseURL: 'https://www.pushengage.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 45000,
    ...(proxy ? { proxy } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
  ],
  timeout: 90000,
  expect: { timeout: 10000 },
});
