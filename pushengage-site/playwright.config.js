// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

const env = process.env.TEST_ENV || 'production';
const baseURL =
  env === 'staging'
    ? process.env.STAGING_SITE_URL || 'https://staging.pushengage.com'
    : process.env.PROD_SITE_URL    || 'https://www.pushengage.com';

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    ['./reporters/coverage-reporter.ts', { tester: process.env.QA_TESTER || process.env.USER || 'automation' }],
  ],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Off unless PW_TRACE is set (same convention as the other QA frameworks):
    // recording video via system Chrome with 4 workers hangs browserContext.close,
    // so every worker sat out Playwright's 5-min stop timeout and was force-killed
    // (8/8 passed but the run exited 1). Traces still capture failures.
    video: process.env.PW_TRACE ? 'retain-on-failure' : 'off',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  timeout: 60000,
  expect: { timeout: 10000 },
  globalTimeout: 3600000,
  outputDir: 'test-results',
});
