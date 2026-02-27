# PushEngage App Dashboard - Test Suite

## Overview
This directory contains automated test cases for the **PushEngage App Dashboard** using Playwright. The tests cover the main dashboard features and functionalities.

## Test Structure

```
tests/pushengage-app/
├── dashboard/
│   ├── 01-dashboard-ui-elements.spec.js       # UI Elements Validation
│   ├── 02-dashboard-metrics.spec.js           # Metrics and Statistics
│   ├── 03-dashboard-charts.spec.js            # Charts and Graphs
│   ├── 04-dashboard-recent-notifications.spec.js  # Recent Notifications
│   ├── 05-dashboard-strategies.spec.js        # Strategies Section
│   ├── 06-dashboard-demographic.spec.js       # Demographic Overview
│   └── 07-dashboard-interactions.spec.js      # User Interactions
└── utils/
    ├── app-auth.js                            # Authentication helpers
    ├── app-helpers.js                         # App-specific helper functions
    └── config.js                              # Configuration settings
```

## Dashboard Test Coverage

### 1. UI Elements Validation (01-dashboard-ui-elements.spec.js)
**Priority: CRITICAL**

Tests covered:
- ✅ PushEngage logo display
- ✅ Site selector dropdown
- ✅ Notification bell icon
- ✅ User profile menu
- ✅ "Create a Campaign" button
- ✅ Navigation menu items (Dashboard, Campaign, Design, Audience, Analytics, Site Settings, Chat Widgets, Publisher)
- ✅ Campaign submenu items (Push Broadcasts, Drip Autoresponders, Triggered Campaigns, RSS Auto Push)

### 2. Metrics and Statistics (02-dashboard-metrics.spec.js)
**Priority: CRITICAL**

Tests covered:
- ✅ Total Subscribers metric
- ✅ Notifications Sent metric
- ✅ Views metric
- ✅ Clicks metric
- ✅ Goal Conversion metric
- ✅ All metrics displayed together
- ✅ Metric values as numbers
- ✅ Previous period comparison

### 3. Charts and Graphs (03-dashboard-charts.spec.js)
**Priority: HIGH**

Tests covered:
- ✅ Analytics chart/graph display
- ✅ Chart legend display
- ✅ Chart legend toggle functionality

### 4. Recent Notifications (04-dashboard-recent-notifications.spec.js)
**Priority: HIGH**

Tests covered:
- ✅ Recent Notifications section display
- ✅ "See More" button in Recent Notifications
- ✅ "See More" button click functionality

### 5. Strategies Section (05-dashboard-strategies.spec.js)
**Priority: MEDIUM**

Tests covered:
- ✅ Strategies section display
- ✅ Strategy cards display
- ✅ "See More" button in Strategies section

### 6. Demographic Overview (06-dashboard-demographic.spec.js)
**Priority: MEDIUM**

Tests covered:
- ✅ Demographic Overview section display
- ✅ "View Full Report" button display
- ✅ "View Full Report" button click functionality

### 7. User Interactions (07-dashboard-interactions.spec.js)
**Priority: HIGH**

Tests covered:
- ✅ "Create a Campaign" button click
- ✅ Campaign type options after clicking Create Campaign
- ✅ Site selector dropdown click
- ✅ User profile menu click
- ✅ User menu options (My Account, Billing, Site Management, User Management, Sign Out)
- ✅ Sidebar menu navigation

## Running the Tests

### Run all dashboard tests:
```bash
npm run test:app:dashboard
```

### Run specific test file:
```bash
npx playwright test tests/pushengage-app/dashboard/01-dashboard-ui-elements.spec.js
```

### Run with headed browser:
```bash
npx playwright test tests/pushengage-app/dashboard/ --headed
```

### Run in debug mode:
```bash
npx playwright test tests/pushengage-app/dashboard/ --debug
```

### Run specific browser:
```bash
npx playwright test tests/pushengage-app/dashboard/ --project=chromium
```

## Environment Variables

Make sure the following environment variables are set in your `.env` file:

```env
APP_DASHBOARD_URL=https://app.pushengage.com
APP_USERNAME=your-email@domain.com
APP_PASSWORD=your-password
DEFAULT_SITE=Android.app
TEST_TIMEOUT=120000
```

## Test Results

Test results are saved in:
- **Screenshots**: `./screenshots/dashboard-*.png`
- **Videos**: `./videos/`
- **HTML Report**: `./test-results/`
- **JSON Report**: `./test-results/results.json`

## View Test Reports

```bash
npm run report
```

## Helper Functions

### Authentication (`app-auth.js`)
- `loginToAppDashboard(page, config)` - Login to app dashboard
- `isLoggedIn(page)` - Check if user is logged in
- `logoutFromAppDashboard(page)` - Logout from app dashboard

### App Helpers (`app-helpers.js`)
- `navigateToPage(page, pageName)` - Navigate to specific page
- `waitForPageLoad(page)` - Wait for page load
- `selectSite(page, siteName)` - Select site from dropdown
- `checkElementExists(page, selectors, elementName)` - Check element existence
- `clickCreateCampaign(page)` - Click Create Campaign button
- `closeModalIfPresent(page)` - Close modal/popup if present
- `getStatValue(page, statName)` - Get stat value from dashboard
- `verifyDashboardMetrics(page)` - Verify all dashboard metrics

## Test Statistics

- **Total Test Files**: 7
- **Total Test Cases**: ~35
- **Priority Breakdown**:
  - CRITICAL: 2 test files (~15 tests)
  - HIGH: 3 test files (~15 tests)
  - MEDIUM: 2 test files (~5 tests)

## Next Steps

After completing dashboard tests, the following features will be covered:
1. Campaign Management (Push Broadcasts, Drip, Triggered, RSS)
2. Design Features
3. Audience Management
4. Analytics Reports
5. Site Settings
6. Chat Widgets
7. Publisher Features

## Notes

- All tests include proper logging for easy debugging
- Screenshots are captured for each test
- Tests use multiple selector strategies for robustness
- Tests have retry logic (2 retries by default)
- Tests include timeout of 120 seconds by default
- Tests close any welcome modals automatically

## Troubleshooting

If tests fail:
1. Check if login credentials are correct in `.env` file
2. Verify app dashboard URL is accessible
3. Check screenshots in `./screenshots/` folder
4. Review test output logs for specific errors
5. Run test in headed mode (`--headed`) to see browser actions
6. Use debug mode (`--debug`) to step through tests

## Contributing

When adding new tests:
1. Follow the existing naming convention
2. Add proper test descriptions and logging
3. Include screenshot captures
4. Use helper functions from utils folder
5. Add appropriate test timeouts
6. Update this README with new test coverage
