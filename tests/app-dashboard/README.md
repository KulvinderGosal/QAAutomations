# PushEngage App Dashboard Test Suite

This directory contains comprehensive automated tests for the PushEngage App Dashboard using Playwright.

## 📁 Directory Structure

```
tests/app-dashboard/
├── critical/          # Critical priority tests (P0)
│   ├── login/        # Authentication tests
│   ├── dashboard/    # Dashboard core functionality
│   ├── campaign/     # Campaign management
│   ├── design/       # Design configuration
│   ├── audience/     # Audience management
│   ├── analytics/    # Analytics features
│   ├── site-settings/# Site configuration
│   ├── chat-widgets/ # Chat widgets
│   └── publisher/    # Publisher features
├── high/             # High priority tests (P1)
├── medium/           # Medium priority tests (P2)
├── low/              # Low priority tests (P3)
└── utils/            # Helper functions and configuration
    ├── app-auth.js   # Authentication helpers
    ├── app-helpers.js# General helper functions
    └── config.js     # Test configuration
```

## 🎯 Test Coverage

### Total Test Files: 84

#### By Priority:
- **Critical (P0)**: 24 tests
- **High (P1)**: 20 tests
- **Medium (P2)**: 20 tests
- **Low (P3)**: 20 tests

#### By Module:
1. **Login** (4 tests)
   - Valid login
   - Session persistence
   - User profile display
   - Site selector display

2. **Dashboard** (8 tests)
   - UI elements validation
   - Stats display
   - Navigation menu
   - Metrics verification

3. **Campaign** (16 tests)
   - Push Broadcasts
   - Drip Autoresponders
   - Triggered Campaigns
   - RSS Auto Push

4. **Design** (12 tests)
   - Popup Modals
   - Widgets
   - Targeting Rule

5. **Audience** (16 tests)
   - Subscribers
   - Segments
   - Audience Groups
   - Attributes

6. **Analytics** (12 tests)
   - Overview
   - Opt-in Analytics
   - Goal Tracking

7. **Site Settings** (16 tests)
   - Site Details
   - Installation
   - Campaign Defaults
   - Advanced Settings

8. **Chat Widgets** (8 tests)
   - Manage Widgets
   - Analytics Overview

9. **Publisher** (4 tests)
   - Publisher page functionality

## 🚀 Running Tests

### Prerequisites

```bash
# Install dependencies (globally or locally)
npm install -g playwright
playwright install

# Or use the project's existing Playwright installation
# (tests will use globally installed Playwright and browsers)
```

### Environment Setup

Create a `.env` file in the project root:

```env
# App Dashboard Credentials
APP_DASHBOARD_URL=https://app.pushengage.com
APP_USERNAME=kgosal@awesomemotive.com
APP_PASSWORD=KGs0911@PE

# Test Configuration
TEST_SITE=AutomationTesting
TEST_TIMEOUT=120000
HEADLESS=false
BROWSER=chromium
RETRIES=2
```

### Run All App Dashboard Tests

```bash
# Run all app-dashboard tests
npx playwright test --config=playwright-app-dashboard.config.js

# Run with UI mode
npx playwright test --config=playwright-app-dashboard.config.js --ui

# Run in headed mode (see browser)
npx playwright test --config=playwright-app-dashboard.config.js --headed
```

### Run Tests by Priority

```bash
# Critical tests only
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/critical

# High priority tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/high

# Medium priority tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/medium

# Low priority tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/low
```

### Run Tests by Module

```bash
# Login tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/critical/login

# Dashboard tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/critical/dashboard

# Campaign tests (all priorities)
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/*/campaign

# Design tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/*/design

# Audience tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/*/audience

# Analytics tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/*/analytics

# Site Settings tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/*/site-settings

# Chat Widgets tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/*/chat-widgets

# Publisher tests
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/*/publisher
```

### Run Specific Test File

```bash
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/critical/login/01-valid-login.spec.js
```

## 📊 Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report test-results/app-dashboard-report
```

## 🔧 Configuration

### Playwright Configuration
- **File**: `playwright-app-dashboard.config.js`
- **Workers**: 1 (sequential execution to maintain session state)
- **Retries**: 2
- **Timeout**: 120 seconds per test
- **Screenshot**: On failure
- **Video**: On failure
- **Trace**: On failure

### Test Configuration
- **File**: `tests/app-dashboard/utils/config.js`
- Credentials, timeouts, menu items, and paths

## 🎨 Test Structure

Each test follows this structure:

```javascript
test.describe('PRIORITY - Module - Feature', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login and setup
    const loginSuccess = await loginToAppDashboard(page, config.appUsername, config.appPassword);
    expect(loginSuccess).toBe(true);
    
    await selectSite(page, config.testSite);
    await closeModalIfPresent(page);
  });
  
  test('should perform specific action', async ({ page }) => {
    // Test implementation
  });
});
```

## 🛠️ Helper Functions

### Authentication (`app-auth.js`)
- `loginToAppDashboard(page, username, password)` - Login to app
- `isLoggedIn(page)` - Check login status
- `logoutFromAppDashboard(page)` - Logout from app
- `getStorageStatePath()` - Get session storage path

### General Helpers (`app-helpers.js`)
- `navigateToPage(page, pageName)` - Navigate to specific page
- `waitForPageLoad(page)` - Wait for page to load
- `selectSite(page, siteName)` - Select site from dropdown
- `checkElementExists(page, selectors, elementName)` - Check if element exists
- `checkElementVisible(page, selectors, elementName)` - Check if element is visible
- `clickElement(page, selectors, elementName)` - Click an element
- `closeModalIfPresent(page)` - Close modal if present
- `verifyDashboardMetrics(page)` - Verify dashboard metrics
- `openHamburgerMenu(page)` - Open navigation menu
- `fillFormField(page, selectors, value, fieldName)` - Fill form fields
- `takeScreenshot(page, name)` - Take screenshot with timestamp

## 📝 Adding New Tests

1. Choose the appropriate priority folder (critical/high/medium/low)
2. Navigate to the module folder (campaign/design/audience/etc.)
3. Create a new spec file: `XX-feature-name.spec.js`
4. Follow the existing test structure
5. Use helper functions from `utils/` for common operations

## 🔍 Test Organization

Tests are organized by:
1. **Priority Level**: Critical → High → Medium → Low
2. **Module**: Functionality grouping (Campaign, Design, etc.)
3. **Feature**: Specific feature within module

This structure allows for:
- Running critical tests in CI/CD pipelines
- Parallel execution within priority levels
- Easy maintenance and updates
- Clear test coverage visibility

## 📈 Test Execution Strategy

### Recommended Execution Order:
1. **Critical Tests** (P0): Run before every deployment
2. **High Tests** (P1): Run daily
3. **Medium Tests** (P2): Run weekly
4. **Low Tests** (P3): Run bi-weekly or monthly

### Smoke Test Suite
Run critical tests for quick validation:
```bash
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard/critical
```

### Full Regression Suite
Run all tests for comprehensive validation:
```bash
npx playwright test --config=playwright-app-dashboard.config.js tests/app-dashboard
```

## 🐛 Debugging

### Debug Specific Test
```bash
npx playwright test --config=playwright-app-dashboard.config.js --debug tests/app-dashboard/critical/login/01-valid-login.spec.js
```

### View Trace
```bash
npx playwright show-trace test-results/.../trace.zip
```

### Screenshots
Failed test screenshots are saved in: `screenshots/app-dashboard/`

## 📞 Support

For issues or questions about the app dashboard tests, please contact the QA team or refer to the project documentation.

## 🔄 Continuous Integration

These tests are designed to be integrated with CI/CD pipelines. The configuration supports:
- Parallel execution (configurable workers)
- Retry on failure
- Comprehensive reporting
- Screenshot and video capture on failure

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [PushEngage App Dashboard](https://app.pushengage.com)
- [Project README](../../README.md)
