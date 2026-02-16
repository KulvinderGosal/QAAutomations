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
  
  // Environment info
  environment: isLocal ? 'local' : 'staging',
  isLocal: isLocal,
};
