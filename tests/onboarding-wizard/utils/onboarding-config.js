/**
 * Configuration for the AI Onboarding Wizard test suite.
 *
 * Everything is environment-driven so the same specs run against staging or a
 * local build. Copy `.env.example` to `.env` and fill in the app-dashboard
 * accounts / site fixtures before running.
 *
 * Env vars (see .env.example for the full list):
 *   APP_DASHBOARD_URL          e.g. https://staging-app-dashboard2.pushengage.com
 *   PE_ACCOUNT_A_EMAIL/PASS    Free-plan admin owner   (quota + upgrade-gate cases)
 *   PE_ACCOUNT_B_EMAIL/PASS    Business+ admin owner   (paid-plan cases)
 *   PE_SUBUSER_EMAIL/PASS      Non-admin sub-user on B (403 cases)
 *   PE_SITE_1..5_*             Site fixtures (see below)
 *   PE_BACKEND_URL             Adonis API base (M/N/O direct-API cases)
 *   PE_ADMIN_TOKEN             Dashboard bearer token for direct API calls
 */
require('dotenv').config();

const APP_DASHBOARD_URL = (
  process.env.APP_DASHBOARD_URL || 'https://staging-app-dashboard2.pushengage.com'
).replace(/\/$/, '');

module.exports = {
  appDashboardUrl: APP_DASHBOARD_URL,
  backendUrl: (process.env.PE_BACKEND_URL || '').replace(/\/$/, ''),
  adminToken: process.env.PE_ADMIN_TOKEN || '',

  // Owner accounts. Account A = Free plan, Account B = Business or higher.
  accounts: {
    free: {
      email: process.env.PE_ACCOUNT_A_EMAIL || '',
      password: process.env.PE_ACCOUNT_A_PASSWORD || '',
      plan: 'free',
    },
    paid: {
      email: process.env.PE_ACCOUNT_B_EMAIL || '',
      password: process.env.PE_ACCOUNT_B_PASSWORD || '',
      plan: process.env.PE_ACCOUNT_B_PLAN || 'business',
    },
    subUser: {
      email: process.env.PE_SUBUSER_EMAIL || '',
      password: process.env.PE_SUBUSER_PASSWORD || '',
      admin: false,
    },
    shopify: {
      email: process.env.PE_SHOPIFY_EMAIL || '',
      password: process.env.PE_SHOPIFY_PASSWORD || '',
    },
  },

  /**
   * Site fixtures. Each is an object { id?, url, name? }.
   *  site1 - live, https, PushEngage installed correctly (WordPress if possible)
   *  site2 - live, https, no PushEngage code
   *  site3 - live, running PushEngage under a DIFFERENT site key (foreign install)
   *  site4 - created before 2026-08-05 with an http:// site_url
   *  site5 - created on/after 2026-08-05 with an http:// site_url
   */
  sites: {
    site1: { id: process.env.PE_SITE_1_ID || '', url: process.env.PE_SITE_1_URL || '', name: process.env.PE_SITE_1_NAME || '' },
    site2: { id: process.env.PE_SITE_2_ID || '', url: process.env.PE_SITE_2_URL || '', name: process.env.PE_SITE_2_NAME || '' },
    site3: { id: process.env.PE_SITE_3_ID || '', url: process.env.PE_SITE_3_URL || '', name: process.env.PE_SITE_3_NAME || '' },
    site4: { id: process.env.PE_SITE_4_ID || '', url: process.env.PE_SITE_4_URL || '', name: process.env.PE_SITE_4_NAME || '' },
    site5: { id: process.env.PE_SITE_5_ID || '', url: process.env.PE_SITE_5_URL || '', name: process.env.PE_SITE_5_NAME || '' },
  },

  // Mobile fixtures for the App Push track (K / I groups).
  mobile: {
    androidServiceAccountJson: process.env.PE_ANDROID_SA_JSON_PATH || '',
    androidSenderId: process.env.PE_ANDROID_SENDER_ID || '',
    iosP12Path: process.env.PE_IOS_P12_PATH || '',
    iosP12Password: process.env.PE_IOS_P12_PASSWORD || '',
    iosP12ExpiredPath: process.env.PE_IOS_P12_EXPIRED_PATH || '',
    playPackage: process.env.PE_PLAY_PACKAGE || 'com.whatsapp',
    appStoreUrl: process.env.PE_APPSTORE_URL || '',
  },

  // Stripe test card reused from the shared config (utils/config.js).
  testCreditCard: {
    cardholderName: 'Kulvinder Singh',
    cardNumber: '4242424242424242',
    expiryDate: '12/44',
    cvv: '123',
    expiryMonth: '12',
    expiryYear: '44',
    expiryYear4Digit: '2044',
  },

  timeouts: {
    action: parseInt(process.env.PE_ACTION_TIMEOUT || '15000', 10),
    nav: parseInt(process.env.PE_NAV_TIMEOUT || '30000', 10),
    // The analyzing board is capped at 20s server-side; allow headroom.
    analyzing: parseInt(process.env.PE_ANALYZING_TIMEOUT || '25000', 10),
  },

  // The onboarding-ai routes live under this path on the backend.
  onboardingAiPath: (siteId) => `/d/v1/sites/${siteId}/onboarding-ai`,
};
