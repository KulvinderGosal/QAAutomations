const { getEnv } = require('../utils/env');
const { uniqueEmail } = require('../utils/test-helpers');

const env = getEnv();

const routes = {
  home: '/',
  signup: env.signupPath || '/signup',
  login: env.loginPath || '/login',
};

const selectors = {
  homeCtas: [
    'a:has-text("Sign up")',
    'a:has-text("Get started")',
    'button:has-text("Sign up")',
    'button:has-text("Get started")',
    'a[href*="signup"]',
    'a[href*="register"]',
  ],
  form: {
    firstName: ['#firstName', 'input[name="firstName"]', 'input[name="firstname"]', 'input[placeholder*="first name" i]'],
    lastName: ['#lastName', 'input[name="lastName"]', 'input[name="lastname"]', 'input[placeholder*="last name" i]'],
    fullName: ['#name', 'input[name="name"]', 'input[name="fullName"]', 'input[placeholder*="full name" i]'],
    email: ['#email', 'input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'],
    password: ['#password', 'input[type="password"]', 'input[name="password"]', 'input[placeholder*="password" i]'],
    company: ['#company', 'input[name="company"]', 'input[placeholder*="company" i]'],
    website: ['#website', 'input[type="url"]', 'input[name="website"]', 'input[placeholder*="website" i]'],
    phone: ['#phone', 'input[type="tel"]', 'input[name="phone"]', 'input[placeholder*="phone" i]'],
    terms: [
      'input[type="checkbox"][name*="terms" i]',
      'input[type="checkbox"][id*="terms" i]',
      'input[type="checkbox"][name*="agree" i]',
    ],
    submit: [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Sign up")',
      'button:has-text("Create")',
      'button:has-text("Get Started")',
    ],
    errors: ['[role="alert"]', '.error', '.form-error', '.invalid-feedback', 'text=/required|invalid|error/i'],
  },
};

function buildSignupData(overrides = {}) {
  return {
    firstName: env.firstName,
    lastName: env.lastName,
    fullName: `${env.firstName} ${env.lastName}`.trim(),
    email: uniqueEmail(env.signupEmail, 'ledgerport'),
    password: env.signupPassword,
    company: env.company,
    website: env.website,
    phone: env.phone,
    ...overrides,
  };
}

module.exports = {
  env,
  routes,
  selectors,
  buildSignupData,
};
