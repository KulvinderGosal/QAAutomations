# 🎯 PushEngage Plugin - Complete Regression Test Suite

## Overview

This is a comprehensive, priority-based regression test suite for the PushEngage WordPress plugin. The suite contains **605 test cases** organized by priority and feature, covering all major functionality of the plugin.

## 📊 Test Suite Statistics

| Priority | Tests | Description |
|----------|-------|-------------|
| **Critical (P0)** | 245 | Must pass tests - core functionality |
| **High (P1)** | 181 | Important features - high user impact |
| **Medium (P2)** | 136 | Standard features - moderate importance |
| **Low (P3)** | 43 | Nice-to-have features and edge cases |
| **TOTAL** | **605** | Complete regression coverage |

## 🗂️ Test Organization

```
tests/pushengage-regression/
├── critical/                         # P0 - Must pass tests (245 tests)
│   ├── campaigns/                    # Campaign management (57 tests)
│   ├── dashboard/                    # Dashboard functionality (53 tests)
│   ├── installation/                 # Plugin installation & smoke (16 tests)
│   ├── onboarding/                   # User onboarding (41 tests)
│   ├── push-broadcasts/              # Push notifications (18 tests)
│   ├── settings-core/                # Core settings (9 tests)
│   └── settings-excel/               # Advanced settings (50 tests)
│
├── high/                             # P1 - Important features (181 tests)
│   ├── audience/                     # Audience management (48 tests)
│   ├── drip/                         # Drip campaigns main (52 tests)
│   ├── drip-campaigns/               # Drip campaign flows (6 tests)
│   ├── posteditor/                   # Post editor integration (47 tests)
│   ├── posttypes/                    # Custom post types (5 tests)
│   ├── serviceworkererrorhandling/   # Error handling (4 tests)
│   ├── triggers/                     # Automation triggers (11 tests)
│   └── woocommerce-core/             # WooCommerce integration (8 tests)
│
├── medium/                           # P2 - Standard features (136 tests)
│   ├── adminbarmenu/                 # Admin bar menu (9 tests)
│   ├── analytics/                    # Analytics & reporting (44 tests)
│   ├── click-to-chat/                # Chat widget (4 tests)
│   ├── design/                       # UI customization (42 tests)
│   ├── goal-tracking/                # Goal tracking (2 tests)
│   ├── notificationicon/             # Notification icons (8 tests)
│   ├── quicklinks/                   # Quick access links (8 tests)
│   ├── quickstats/                   # Dashboard stats (8 tests)
│   ├── testing-tools/                # Development helpers (3 tests)
│   ├── whatsapp/                     # WhatsApp integration (5 tests)
│   └── woocommerce-templates/        # WooCommerce templates (3 tests)
│
└── low/                              # P3 - Nice to have (43 tests)
    ├── about/                        # About page (14 tests)
    ├── about-us/                     # About us section (1 test)
    ├── help/                         # Help documentation (6 tests)
    ├── misc/                         # Miscellaneous (5 tests)
    ├── ratings/                      # Plugin ratings (4 tests)
    ├── reviewbanner/                 # Review prompts (6 tests)
    └── subscriptionplantags/         # Subscription tags (7 tests)
```

## 🚀 Quick Start

### Run All Tests
```bash
npm run test:regression:all           # All 605 tests (~2 hours)
```

### Run By Priority Level
```bash
npm run test:regression:critical      # P0 tests (245 tests, ~45 min)
npm run test:regression:high          # P1 tests (181 tests, ~35 min)
npm run test:regression:medium        # P2 tests (136 tests, ~25 min)
npm run test:regression:low           # P3 tests (43 tests, ~10 min)
```

### Run By Feature
```bash
npm run test:regression:broadcasts    # Push broadcast tests
npm run test:regression:campaigns     # Campaign management
npm run test:regression:settings      # Settings tests
npm run test:regression:installation  # Installation & smoke tests
npm run test:regression:onboarding    # Onboarding flow
npm run test:regression:dashboard     # Dashboard tests
npm run test:regression:drip          # Drip campaigns
npm run test:regression:triggers      # Automation triggers
npm run test:regression:audience      # Audience management
npm run test:regression:woo           # WooCommerce tests
npm run test:regression:analytics     # Analytics & reporting
npm run test:regression:design        # UI/Design tests
```

### Run With Different Options
```bash
# Run in headed mode (visible browser)
npm run test:regression:critical:headed

# Run with full network access (local environment)
TEST_ENV=local npm run test:regression:critical

# Run specific test file
npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --project=chromium
```

## 📋 Test Coverage by Priority

### CRITICAL (P0) - 245 Tests

Core functionality that must work for the plugin to be usable.

| Feature | Tests | Description |
|---------|-------|-------------|
| **Campaigns** | 57 | Campaign creation, management, and execution |
| **Dashboard** | 53 | Main dashboard functionality and stats |
| **Installation** | 16 | Plugin installation, activation, and smoke tests |
| **Onboarding** | 41 | User onboarding and initial setup |
| **Push Broadcasts** | 18 | Push notification creation and sending |
| **Settings Core** | 9 | Essential plugin settings |
| **Settings Excel** | 50 | Advanced settings and configurations |

**Run Critical Tests:**
```bash
npm run test:regression:critical
```

### HIGH PRIORITY (P1) - 181 Tests

Important features with significant user impact.

| Feature | Tests | Description |
|---------|-------|-------------|
| **Audience** | 48 | Audience segmentation and management |
| **Drip** | 52 | Drip campaign automation |
| **Drip Campaigns** | 6 | Drip campaign workflows |
| **Post Editor** | 47 | WordPress editor integration |
| **Post Types** | 5 | Custom post type support |
| **Service Worker Error Handling** | 4 | Error handling and recovery |
| **Triggers** | 11 | Automation triggers and rules |
| **WooCommerce Core** | 8 | E-commerce integration |

**Run High Priority Tests:**
```bash
npm run test:regression:high
```

### MEDIUM PRIORITY (P2) - 136 Tests

Standard features that enhance the user experience.

| Feature | Tests | Description |
|---------|-------|-------------|
| **Admin Bar Menu** | 9 | WordPress admin bar integration |
| **Analytics** | 44 | Analytics and reporting features |
| **Click to Chat** | 4 | Chat widget functionality |
| **Design** | 42 | UI customization and theming |
| **Goal Tracking** | 2 | Conversion goal tracking |
| **Notification Icon** | 8 | Notification icon management |
| **Quick Links** | 8 | Quick access navigation |
| **Quick Stats** | 8 | Dashboard statistics widgets |
| **Testing Tools** | 3 | Development and testing helpers |
| **WhatsApp** | 5 | WhatsApp integration |
| **WooCommerce Templates** | 3 | E-commerce notification templates |

**Run Medium Priority Tests:**
```bash
npm run test:regression:medium
```

### LOW PRIORITY (P3) - 43 Tests

Nice-to-have features and edge cases.

| Feature | Tests | Description |
|---------|-------|-------------|
| **About** | 14 | About page and information |
| **About Us** | 1 | About us section |
| **Help** | 6 | Help documentation and links |
| **Misc** | 5 | Miscellaneous features |
| **Ratings** | 4 | Plugin rating prompts |
| **Review Banner** | 6 | Review request banners |
| **Subscription Plan Tags** | 7 | Subscription tagging system |

**Run Low Priority Tests:**
```bash
npm run test:regression:low
```

## 🎯 Test Execution Strategy

### Daily Smoke Test (5 minutes)
```bash
npm run test:regression:installation
# Run installation/smoke tests - fastest verification
```

### Pre-Release Regression (1 hour 20 minutes)
```bash
npm run test:regression:critical
npm run test:regression:high
# Run P0 + P1 tests before any release (426 tests)
```

### Full Regression (2 hours)
```bash
npm run test:regression:all
# Run all 605 tests - complete coverage
```

### Feature-Specific Testing
```bash
# Before releasing broadcast features
npm run test:regression:broadcasts

# Before WooCommerce updates
npm run test:regression:woo

# Before UI changes
npm run test:regression:design
```

## 🛠️ Development Workflow

### Running Individual Tests

```bash
# Run a specific test file
npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --project=chromium

# Run with visible browser (debugging)
npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --headed --project=chromium

# Run in debug mode (step-by-step)
npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --debug
```

### Running Tests in Different Environments

```bash
# Staging environment (default)
npm run test:regression:critical

# Local environment
TEST_ENV=local npm run test:regression:critical
```

### Viewing Test Reports

```bash
# Show HTML report after test run
npm run report

# Or open directly
npx playwright show-report
```

## 📝 Test File Structure

Each test file follows this structure:

```javascript
const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test.describe('Feature - Test Description', () => {
  
  test('Test description', async ({ page }) => {
    test.setTimeout(120000);
    
    // Step 1: Login
    await loginToWordPress(page);
    
    // Step 2: Navigate to feature
    await page.goto(`${config.wpAdminUrl}/admin.php?page=feature`);
    
    // Step 3: Perform actions
    await page.click('button.action');
    
    // Step 4: Assert results
    await expect(page.locator('.success')).toBeVisible();
    
    // Step 5: Cleanup (if needed)
  });
});
```

## 🎨 Priority Definitions

| Priority | Definition | Run Frequency | Blocking |
|----------|------------|---------------|----------|
| **P0 - Critical** | Must pass before any release. Core functionality that breaks the product if it fails. | Every commit, Pre-release | ✅ Blocks release |
| **P1 - High** | Important features that significantly impact user experience. | Daily, Pre-release | ✅ Blocks major releases |
| **P2 - Medium** | Standard features that should work but are not critical. | Weekly, Full regression | ⚠️ Investigate failures |
| **P3 - Low** | Nice-to-have features and edge cases. | Monthly, Full regression | ℹ️ Track for fix |

## 🔧 Technical Details

### Prerequisites
- Node.js 16.x or higher
- Playwright installed (`npm install`)
- Access to WordPress environment:
  - **Staging**: `https://qastaging.pushengage.com/admin`
  - **Local**: `http://productionautomation.local/`
- PushEngage plugin installed and activated

### Configuration

Tests use environment variables from `.env`:

```env
# WordPress Admin Credentials
WP_ADMIN_URL=https://qastaging.pushengage.com/admin
WP_USERNAME=your_username
WP_PASSWORD=your_password

# Local Environment (optional)
LOCAL_WP_ADMIN_URL=http://productionautomation.local/wp-admin
LOCAL_WP_USERNAME=admin
LOCAL_WP_PASSWORD=admin@123=

# Plugin Configuration
PLUGIN_NAME=PushEngage
PLUGIN_SEARCH_TERM=pushengage
```

### Test Features
- ✅ Automatic login handling
- ✅ Smart element detection with multiple strategies
- ✅ Screenshot capture on failure
- ✅ Video recording on failure
- ✅ Detailed console logging
- ✅ Retry logic (2 retries per test)
- ✅ Parallel execution support
- ✅ Multiple browser support (Chrome, Firefox, Safari)

### Browsers

Tests run on Chromium by default. Other browsers available:

```bash
# Run on Firefox
npm run test:firefox

# Run on WebKit (Safari)
npm run test:webkit

# Run on all browsers
npm run test
```

## 📊 Test Reports

After running tests, reports are available in multiple formats:

### HTML Report (Interactive)
```bash
npm run report
```
- Visual test results with pass/fail status
- Execution time per test
- Console logs and errors
- Screenshots and videos of failures
- Filterable and searchable

### JSON Report
Located at: `test-results/results.json`
- Machine-readable test results
- Useful for CI/CD integration
- Contains detailed test metadata

### JUnit Report
Located at: `test-results/junit.xml`
- Standard format for CI/CD tools
- Compatible with Jenkins, GitLab CI, etc.

## 📈 Success Metrics

### Test Coverage
- ✅ **605 total tests** covering all major features
- ✅ **245 critical tests** for core functionality
- ✅ **181 high priority tests** for important features
- ✅ **136 medium tests** for standard features
- ✅ **43 low priority tests** for edge cases

### Test Quality
- ✅ All tests follow consistent structure
- ✅ Proper error handling and logging
- ✅ Screenshots/videos on failure
- ✅ Clear test descriptions
- ✅ Maintainable and reusable code

### Execution Performance
- ✅ Installation/Smoke: ~5 minutes
- ✅ Critical tests: ~45 minutes
- ✅ High priority tests: ~35 minutes
- ✅ Full regression: ~2 hours
- ✅ Parallel execution supported

## 📚 Documentation

- **CLEANUP_SUMMARY.md** - Empty folder cleanup details
- **REORGANIZATION_SUMMARY.md** - Test reorganization guide
- **critical/README.md** - Critical priority tests (coming soon)
- **high/README.md** - High priority tests (coming soon)
- **medium/README.md** - Medium priority tests (coming soon)
- **low/README.md** - Low priority tests (coming soon)

## 🎊 Current Status

**✅ Test Suite Complete:**
- 605 tests fully organized
- All tests in priority-based structure
- Zero tests outside organized folders
- Consistent naming conventions
- Fixed import paths
- Comprehensive documentation

**🚀 Production Ready:**
- Clear priority-based organization
- Easy to run by priority or feature
- CI/CD ready
- Multiple environment support
- Detailed reporting

## 📞 Support

For questions or issues:
- Review test file structure above
- Check existing tests for reference patterns
- See REORGANIZATION_SUMMARY.md for recent changes
- Open an issue in the repository

---

**Last Updated:** February 21, 2026  
**Total Tests:** 605  
**Status:** ✅ Production Ready

🎉 **Complete regression test suite with 605 tests!** 🚀
