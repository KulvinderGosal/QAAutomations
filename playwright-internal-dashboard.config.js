// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

/**
 * Internal dashboard (admin) tests, e.g. refresh-token QA.
 * BROWSERS=chromium,firefox,webkit picks the browsers (default chromium).
 */
const browsers = (process.env.BROWSERS || 'chromium').split(',');
const deviceByBrowser = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' };

module.exports = defineConfig({
  testDir: './tests/internal-dashboard',
  fullyParallel: false,
  // Each test logs in on its own; one at a time keeps the staging login load low
  workers: 1,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'test-results/internal-dashboard-report', open: 'never' }],
    ['json', { outputFile: 'test-results/internal-dashboard-results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.INTERNAL_DASHBOARD_URL || 'https://staging-internal-dashboard.pushengage.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: browsers.map((name) => ({ name, use: { ...devices[deviceByBrowser[name]] } })),
  timeout: 120000,
  expect: { timeout: 10000 },
});
