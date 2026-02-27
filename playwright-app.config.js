// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { getStorageStatePath } = require('./tests/pushengage-app/utils/app-auth');
require('dotenv').config();

/**
 * Playwright configuration for PushEngage App Dashboard tests
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests/pushengage-app',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1, // Use 1 worker to share session state
  
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
    
    // Use saved storage state for authentication
    storageState: getStorageStatePath(),
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
        // Use saved storage state
        storageState: getStorageStatePath(),
      },
    },
  ],

  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  globalTimeout: 3600000, // 1 hour for full test suite
});
