try {
  // Keep .env loading optional so this module still works
  // when dependencies are temporarily unavailable.
  // eslint-disable-next-line global-require
  require('dotenv').config();
} catch (_) {}

function getEnv() {
  return {
    baseUrl: process.env.LEDGERPORT_BASE_URL || 'https://staging.ledgerport.com',
    signupPath: process.env.LEDGERPORT_SIGNUP_PATH || '/signup',
    loginPath: process.env.LEDGERPORT_LOGIN_PATH || '/login',
    signupEmail: process.env.LEDGERPORT_SIGNUP_EMAIL || 'kgosal@awesomemotive.com',
    signupPassword: process.env.LEDGERPORT_SIGNUP_PASSWORD || 'TempPass@123',
    firstName: process.env.LEDGERPORT_FIRST_NAME || 'Kulvinder',
    lastName: process.env.LEDGERPORT_LAST_NAME || 'Gosal',
    company: process.env.LEDGERPORT_COMPANY || 'Awesome Motive',
    phone: process.env.LEDGERPORT_PHONE || '5551234567',
    website: process.env.LEDGERPORT_WEBSITE || 'https://awesomemotive.com',
  };
}

module.exports = {
  getEnv,
};
