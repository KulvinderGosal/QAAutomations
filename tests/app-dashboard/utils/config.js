// Load dotenv if available (optional)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, will use environment variables
}

const config = {
  // App Dashboard Credentials
  appUrl: process.env.APP_DASHBOARD_URL || 'https://app.pushengage.com',
  appUsername: process.env.APP_USERNAME || 'kgosal@awesomemotive.com',
  appPassword: process.env.APP_PASSWORD || 'KGs0911@PE',
  
  // Test Site
  testSite: process.env.TEST_SITE || 'AutomationTesting',
  
  // Test Configuration
  testTimeout: parseInt(process.env.TEST_TIMEOUT) || 120000,
  headless: process.env.HEADLESS === 'true',
  browser: process.env.BROWSER || 'chromium',
  
  // Paths
  reportPath: process.env.REPORT_PATH || './test-results/app-dashboard',
  screenshotPath: process.env.SCREENSHOT_PATH || './screenshots/app-dashboard',
  videoPath: process.env.VIDEO_PATH || './videos/app-dashboard',
  
  // Retry Configuration
  retries: parseInt(process.env.RETRIES) || 2,
  
  // Navigation Menu Items
  mainMenuItems: [
    'Dashboard',
    'Campaign',
    'Design',
    'Audience',
    'Analytics',
    'Site Settings',
    'Chat Widgets',
    'Publisher'
  ],
  
  campaignSubMenuItems: [
    'Push Broadcasts',
    'Drip Autoresponders',
    'Triggered Campaigns',
    'RSS Auto Push'
  ],
  
  designSubMenuItems: [
    'Popup Modals',
    'Widgets',
    'Targeting Rule'
  ],
  
  audienceSubMenuItems: [
    'Subscribers',
    'Segments',
    'Audience Groups',
    'Attributes'
  ],
  
  analyticsSubMenuItems: [
    'Overview',
    'Opt-in Analytics',
    'Goal Tracking'
  ],
  
  siteSettingsSubMenuItems: [
    'Site Details',
    'Installation',
    'Campaign Defaults',
    'Advanced Settings'
  ],
  
  chatWidgetsSubMenuItems: [
    'Manage Widgets',
    'Analytics Overview'
  ]
};

module.exports = config;
