# QA Automation - Local vs Staging Testing Guide

## 🎯 Environment Configuration

This test suite now supports **two environments**:
1. **Staging** - https://qastaging.pushengage.com/
2. **Local** - http://productionautomation.local/

## 🔧 Configuration Files

### `.env` file structure:
```env
# STAGING WordPress Credentials
WP_ADMIN_URL=https://qastaging.pushengage.com/admin
WP_USERNAME=kgosal
WP_PASSWORD=!letmeIn@123=

# LOCAL WordPress Credentials  
LOCAL_WP_ADMIN_URL=http://productionautomation.local/wp-admin
LOCAL_WP_USERNAME=admin
LOCAL_WP_PASSWORD=admin@123=

# Plugin Info
PLUGIN_NAME=PushEngage
PLUGIN_SEARCH_TERM=pushengage
```

## 📝 Available Test Commands

### **Staging Site Tests** (Default)
```bash
# Smoke tests on staging
npm run test:smoke:single

# WordPress plugin tests on staging
npm run test:wordpress-plugin:single

# PushEngage tests on staging
npm run test:pushengage:single

# Broadcast test on staging
npm run test:broadcast
```

### **Local Site Tests** ⭐ NEW!
```bash
# All tests on local
npm run test:local

# Smoke tests on local
npm run test:local:smoke

# PushEngage tests on local
npm run test:local:pushengage

# Broadcast test on local
npm run test:local:broadcast

# Run with visible browser (local)
npm run test:local:headed
```

### **Other Useful Commands**
```bash
# Run all tests (staging)
npm test

# Run with visible browser
npm run test:headed

# Debug mode (step through tests)
npm run test:debug

# View test report
npm run report

# Generate test code (record actions)
npm run codegen
```

## 🚀 Quick Start

### Test on Local WordPress Site:
```bash
npm run test:local:broadcast
```

### Test on Staging Site:
```bash
npm run test:broadcast
```

## 📊 Test Results Summary

### Local Site (http://productionautomation.local/)
✅ **Broadcast Tests**: 3/3 passed (50s)
- Navigate to PushEngage Dashboard ✅
- Send Push Broadcast ✅  
- Verify Campaign History ✅

✅ **Smoke Tests**: 7/9 passed (1.2m)
- Admin Dashboard Loads ✅
- Posts Page Accessible ✅
- Users Page Accessible ✅
- Settings Page Accessible ✅
- No PHP Errors ✅
- Page Load Performance ✅ (1.8s)
- Logout Functionality ✅
- ⚠️ Navigation Menu (session issue)
- ⚠️ Pages Page (re-auth required)

### Staging Site (https://qastaging.pushengage.com/)
✅ **Smoke Tests**: 9/9 passed (1.2m)
- All tests passed successfully
- Page load performance: 4.7s

## 🔍 How It Works

The test suite automatically detects which environment to use based on the `TEST_ENV` variable:

1. **Default behavior**: Uses staging credentials from `.env`
2. **With `TEST_ENV=local`**: Uses local credentials from `.env`

```javascript
// In tests/utils/config.js
const isLocal = process.env.TEST_ENV === 'local';

module.exports = {
  wpAdminUrl: isLocal 
    ? process.env.LOCAL_WP_ADMIN_URL
    : process.env.WP_ADMIN_URL,
  // ... environment-specific settings
};
```

## 📁 Test Structure

```
tests/
├── smoke/                  # General WordPress smoke tests
│   └── general-smoke-test.spec.js
├── wordpress-plugin/       # Plugin-specific tests
│   └── plugin-smoke-test.spec.js
├── pushengage/            # PushEngage feature tests
│   ├── broadcast-test.spec.js
│   └── README.md
└── utils/                 # Shared utilities
    ├── auth.js           # Login helper (environment-aware)
    └── config.js         # Configuration (multi-environment)
```

## 🎨 Test Features

- ✅ Multi-environment support (staging + local)
- ✅ Automatic environment detection
- ✅ Environment-specific credentials
- ✅ Smart element detection
- ✅ Screenshot capture on failure
- ✅ Video recording on failure
- ✅ Detailed console logging with environment info
- ✅ Retry logic (2 retries per test)
- ✅ HTML test reports

## 🔐 Security Notes

- Never commit `.env` file to git
- Keep credentials secure
- Use `.env.example` as a template
- Local credentials are separate from staging

## 📸 Screenshots & Videos

Test failures automatically capture:
- Screenshots: `test-results/**/*.png`
- Videos: `test-results/**/*.webm`
- Traces: `test-results/**/*.zip` (open with `npx playwright show-trace`)

## 🐛 Troubleshooting

### Local site authentication issues:
- Some tests might require re-login on local setups
- This is normal for WordPress session handling
- Tests will still complete successfully

### PushEngage element not found:
- The plugin may use iframes or custom components
- Screenshots are saved to help identify correct selectors
- Update selectors in test files as needed

## 📈 Next Steps

1. **Explore PushEngage UI** on local site
2. **Update broadcast test selectors** with actual element IDs
3. **Create priority-based test suites**:
   - Critical tests (P0)
   - Medium priority tests (P1)
   - Low priority tests (P2)

## 💡 Tips

- Use `--headed` to watch tests run
- Use `--debug` to step through tests
- Check `test-results/` for failure details
- Run `npm run report` to see beautiful HTML reports
