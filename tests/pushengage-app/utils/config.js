require('dotenv').config();

const config = {
  // App Dashboard Credentials
  appUrl: process.env.APP_DASHBOARD_URL || 'https://app.pushengage.com',
  appUsername: process.env.APP_USERNAME || 'kgosal@awesomemotive.com',
  appPassword: process.env.APP_PASSWORD || 'KGs0911@PE',
  
  // WordPress Credentials (for plugin tests)
  wpAdminUrl: process.env.WP_ADMIN_URL || 'https://qastaging.pushengage.com/admin',
  wpUsername: process.env.WP_USERNAME || 'kgosal',
  wpPassword: process.env.WP_PASSWORD || '!letmeIn@123=',
  
  // Test Configuration
  testTimeout: parseInt(process.env.TEST_TIMEOUT) || 120000,
  headless: process.env.HEADLESS === 'true',
  browser: process.env.BROWSER || 'chromium',
  
  // Paths
  reportPath: process.env.REPORT_PATH || './test-results',
  screenshotPath: process.env.SCREENSHOT_PATH || './screenshots',
  videoPath: process.env.VIDEO_PATH || './videos',
  
  // Site Selection
  defaultSite: process.env.DEFAULT_SITE || 'Android.app',
  
  // Retry Configuration
  retries: parseInt(process.env.RETRIES) || 2,
};

module.exports = config;
