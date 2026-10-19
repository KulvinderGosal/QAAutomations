// @ts-check
const { defineConfig, devices } = require('@playwright/test');
try { require('dotenv').config(); } catch (e) { /* optional */ }

/**
 * Playwright config for the AI Onboarding Wizard suite.
 * Target: staging app dashboard (pushengage-app FE + adonis-node-api BE).
 * @see https://playwright.dev/docs/test-configuration
 */
const APP_URL = (process.env.APP_DASHBOARD_URL || 'https://staging-app-dashboard2.pushengage.com').replace(/\/$/, '');

module.exports = defineConfig({
  testDir: './tests/onboarding-wizard',
  // Keep per-test artifacts out of the HTML report folder (they must not nest).
  outputDir: './test-results/onboarding-artifacts',
  // The wizard mutates real account/site state (creates segments, popups,
  // workflows, widgets) so run serially to keep fixtures deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['html', { outputFolder: 'test-results/onboarding-report', open: 'never' }],
    ['json', { outputFile: 'test-results/onboarding-results.json' }],
    ['list'],
  ],

  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
    // Safari pass for the subdomain-cutoff date parsing (cases L2 / D11 / J6).
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  timeout: 120000,
  expect: { timeout: 10000 },
  globalTimeout: 7200000,
});
