// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { getStorageStatePath } = require('./tests/app-dashboard/utils/app-auth');

// Load dotenv if available (optional)
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not available, using environment variables');
}

/**
 * Playwright configuration for PushEngage App Dashboard tests
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests/app-dashboard',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  
  reporter: [
    ['html', { outputFolder: 'test-results/app-dashboard-report' }],
    ['json', { outputFile: 'test-results/app-dashboard-results.json' }],
    ['list']
  ],
  
  use: {
    baseURL: process.env.APP_DASHBOARD_URL || 'https://app.pushengage.com',
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
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
          ],
        },
      },
    },
  ],

  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  globalTimeout: 7200000, // 2 hours for full test suite
});
