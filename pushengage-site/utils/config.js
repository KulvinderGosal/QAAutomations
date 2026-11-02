require('dotenv').config();

const env = process.env.TEST_ENV || 'production';
const isStaging    = env === 'staging';
const isProduction = env === 'production';

const config = {
  env,

  // ── Site URLs ──────────────────────────────────────────────────────────────
  baseUrl: isStaging
    ? process.env.STAGING_SITE_URL || 'https://staging.pushengage.com'
    : process.env.PROD_SITE_URL    || 'https://www.pushengage.com',

  // Staging login/app lives on the dashboard host (staging-app-dashboard);
  // the old 'staging-app.pushengage.com' default returned 404 "Route not found".
  appUrl: isStaging
    ? process.env.STAGING_APP_URL || 'https://staging-app-dashboard.pushengage.com'
    : process.env.PROD_APP_URL    || 'https://app.pushengage.com',

  // ── Key Pages ──────────────────────────────────────────────────────────────
  pages: {
    home:        '/',
    pricing:     '/pricing/',
    features:    '/features/',
    blog:        '/blog/',
    contact:     '/contact-us/',
    contactUs:   '/contact-us/',
    scheduleDemo:'/schedule_demo/',
    userSurvey:  '/user-survey/',
    affiliateSurvey: '/affiliates-survey/',
    wpUserSurvey:'/wordpress-plugin-user-survey/',
    about:       '/about/',
    login:       '/login/',
    signup:      '/register/',
    docs:        'https://docs.pushengage.com',
    privacy:     '/privacy-policy/',
    terms:       '/terms-of-service/',
    wordpress:   '/features/wordpress-push-notifications-plugin/',
    ecommerce:   '/features/deep-ecommerce-integrations/',
    abandoned:   '/woocommerce-cart-recovery/',
    drip:        '/features/automatic-drip-campaigns/',
  },

  // ── Timeouts ───────────────────────────────────────────────────────────────
  timeout: {
    action:     15000,
    navigation: 30000,
    page:       60000,
  },

  // ── Form test data + submit gate ────────────────────────────────────────────
  // Real form submits (demo/contact) are OFF unless SUBMIT_FORMS=true, to avoid
  // emailing the PushEngage team. Use clearly-fake test data.
  forms: {
    submit: process.env.SUBMIT_FORMS === 'true',
    demo: {
      name:    process.env.DEMO_NAME    || 'QA Automation Test',
      email:   process.env.QA_EMAIL     || 'qa@example.com',
      city:    process.env.DEMO_CITY    || 'San Diego',
      country: process.env.DEMO_COUNTRY || 'United States',
      website: process.env.DEMO_WEBSITE || 'https://example.com',
    },
    contact: {
      name:    process.env.CONTACT_NAME    || 'PushEngage QA',
      email:   process.env.QA_EMAIL        || 'qa@example.com',
      website: process.env.CONTACT_WEBSITE || 'https://www.pushengage.com',
      message: process.env.QA_MESSAGE      || 'This is a test submission from PushEngage QA automation — please ignore.',
    },
    survey: {
      email:   process.env.QA_EMAIL       || 'qa@example.com',
      website: process.env.SURVEY_WEBSITE || 'https://www.pushengage.com',
      text:    process.env.QA_MESSAGE     || 'This is a test submission from PushEngage QA automation — please ignore.',
      rating:  process.env.SURVEY_RATING  || '10',
    },
  },
};

module.exports = config;
