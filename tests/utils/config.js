require('dotenv').config();

// Determine which environment to use based on TEST_ENV or command-line flag
const isLocal = process.env.TEST_ENV === 'local' || process.argv.includes('--local');

module.exports = {
  wpAdminUrl: isLocal 
    ? (process.env.LOCAL_WP_ADMIN_URL || 'http://productionautomation.local/wp-admin')
    : (process.env.WP_ADMIN_URL || 'https://qastaging.pushengage.com/admin'),
  
  wpUsername: isLocal
    ? (process.env.LOCAL_WP_USERNAME || 'admin')
    : (process.env.WP_USERNAME || 'kgosal'),
  
  wpPassword: isLocal
    ? (process.env.LOCAL_WP_PASSWORD || 'admin@123=')
    : (process.env.WP_PASSWORD || '!letmeIn@123='),
  
  pluginName: process.env.PLUGIN_NAME || 'PushEngage',
  pluginSearchTerm: process.env.PLUGIN_SEARCH_TERM || 'pushengage',
  timeout: parseInt(process.env.TEST_TIMEOUT) || 30000,
  
  // Test credit card data (for payment testing)
  testCreditCard: {
    cardholderName: 'Kulvinder Singh',
    cardNumber: '4242424242424242',
    expiryDate: '12/44',
    cvv: '123',
    // Individual fields for forms that split month/year
    expiryMonth: '12',
    expiryYear: '44',
    expiryYear4Digit: '2044'
  },
  
  // Environment info
  environment: isLocal ? 'local' : 'staging',
  isLocal: isLocal,

  // TypeSafe Jev (System One) decision model
  // Used for confidence-scored, AI-assisted assertions. See tests/utils/jev-helpers.js
  jev: {
    apiKey: process.env.TYPESAFE_API_KEY || '',
    baseUrl: process.env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai',
    model: process.env.JEV_MODEL || 'typesafe/jev',
    // Minimum confidence (0..1) before an AI answer is treated as decisive.
    minConfidence: parseFloat(process.env.JEV_MIN_CONFIDENCE) || 0.7,
    timeout: parseInt(process.env.JEV_TIMEOUT) || 10000,
  },
};
