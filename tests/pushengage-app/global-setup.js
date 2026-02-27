const { chromium, test as setup } = require('@playwright/test');
const { getStorageStatePath } = require('./utils/app-auth');
const config = require('./utils/config');
const fs = require('fs');

/**
 * Global setup for app dashboard tests
 * This will check if we have a saved session, and if not,
 * it will guide the user to login manually and save the session.
 */

setup('authenticate to app dashboard', async ({ }) => {
  const statePath = getStorageStatePath();
  
  // Check if session already exists
  if (fs.existsSync(statePath)) {
    console.log('✅ Found existing session - tests will use saved authentication\n');
    return;
  }
  
  console.log('⚠️ No saved session found');
  console.log('   Please run the session capture script first:\n');
  console.log('   node tests/pushengage-app/save-session.js\n');
  console.log('   Or use the browser to login and save the session.\n');
});

module.exports = setup;
