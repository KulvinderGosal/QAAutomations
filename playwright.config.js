// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true, // OPTIMIZED: Enable parallel execution for speed
  forbidOnly: !!process.env.CI,
  retries: 1, // OPTIMIZED: Reduced retries for faster feedback
  workers: process.env.CI ? 2 : 10, // OPTIMIZED: 10 workers locally, 2 in CI
  
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  
  use: {
    baseURL: process.env.WP_ADMIN_URL || 'https://qastaging.pushengage.com/admin',
    trace: 'retain-on-failure', // Changed: Only keep trace on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000, // Changed: Increased from 10s
    navigationTimeout: 30000, // Added: Explicit navigation timeout
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            '--disable-dev-shm-usage', // Prevent /dev/shm memory issues
            '--disable-gpu', // Disable GPU to save resources
            '--no-sandbox', // Required for some environments
            '--disable-setuid-sandbox',
            '--disable-web-security', // Allow cross-origin requests
          ],
        },
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
  ],

  webServer: undefined, // Set if you have local WP server
  timeout: 60000, // Changed: Increased from 30s to 60s
  expect: {
    timeout: 10000, // Changed: Increased from 5s
  },
  globalTimeout: 7200000, // Changed: 2 hours for full regression
});
