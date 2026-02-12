require('dotenv').config();

module.exports = {
  wpAdminUrl: process.env.WP_ADMIN_URL || 'https://qastaging.pushengage.com/admin',
  wpUsername: process.env.WP_USERNAME || 'kgosal',
  wpPassword: process.env.WP_PASSWORD || '!letmeIn@123=',
  pluginName: process.env.PLUGIN_NAME || 'PushEngage',
  pluginSearchTerm: process.env.PLUGIN_SEARCH_TERM || 'pushengage',
  timeout: parseInt(process.env.TEST_TIMEOUT) || 30000,
};
