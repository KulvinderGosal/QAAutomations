# 📊 PushEngage Excel Test Suite

**Total Tests:** 528  
**Source:** WordPress Plugin Regression Sheet.xlsx  
**Status:** ✅ Converted to Playwright  
**Framework:** Playwright + Node.js

---

## 📁 Quick Overview

This folder contains **528 Playwright test cases** automatically converted from the official PushEngage WordPress Plugin Regression Excel sheet. All tests are organized by priority and feature.

### Test Distribution

| Priority | Tests | Features | Coverage |
|----------|-------|----------|----------|
| **Critical** | 215 | 5 | 41% |
| **High** | 152 | 5 | 29% |
| **Medium** | 119 | 6 | 23% |
| **Low** | 42 | 6 | 8% |

---

## 🚀 Quick Start

### Run All Excel Tests
```bash
npm run test:excel:all
```

### Run by Priority
```bash
npm run test:excel:critical    # 215 critical tests
npm run test:excel:high        # 152 high priority tests
npm run test:excel:medium      # 119 medium priority tests
npm run test:excel:low         # 42 low priority tests
```

### Run by Feature
```bash
npm run test:excel:installation   # Installation tests
npm run test:excel:onboarding     # Onboarding flow tests
npm run test:excel:dashboard      # Dashboard tests
npm run test:excel:campaigns      # Campaign/broadcast tests
npm run test:excel:settings       # Settings tests
npm run test:excel:drip           # Drip campaign tests
npm run test:excel:audience       # Audience management tests
npm run test:excel:design         # Design customization tests
npm run test:excel:analytics      # Analytics tests
```

### Run in Headed Mode (See Browser)
```bash
npm run test:excel:all:headed
```

---

## 📂 Folder Structure

```
pushengage-excel-tests/
│
├── critical/              (215 tests - Core functionality)
│   ├── installation/      14 tests - Plugin installation & setup
│   ├── onboarding/        41 tests - User onboarding flow
│   ├── dashboard/         53 tests - Main dashboard interface
│   ├── campaigns/         57 tests - Push broadcasts & campaigns
│   └── settings/          50 tests - Plugin configuration
│
├── high/                  (152 tests - Important features)
│   ├── drip/              52 tests - Drip campaign automation
│   ├── audience/          44 tests - Audience segmentation
│   ├── posttypes/          5 tests - WordPress post type settings
│   ├── posteditor/        47 tests - Post editor integration
│   └── serviceworkererrorhandling/ 4 tests - Error handling
│
├── medium/                (119 tests - Secondary features)
│   ├── design/            42 tests - UI design & customization
│   ├── analytics/         44 tests - Analytics & reporting
│   ├── notificationicon/   8 tests - Notification icon tests
│   ├── quickstats/         8 tests - Quick statistics
│   ├── quicklinks/         8 tests - Quick links feature
│   └── adminbarmenu/       9 tests - WordPress admin bar menu
│
└── low/                   (42 tests - Support features)
    ├── about/             14 tests - About page
    ├── help/               6 tests - Help documentation
    ├── ratings/            4 tests - Plugin ratings
    ├── subscriptionplantags/ 7 tests - Plan tags
    ├── reviewbanner/       6 tests - Review banner
    └── misc/               5 tests - Miscellaneous tests
```

---

## 🎯 Test Priorities Explained

### 🔴 Critical (P0) - 215 tests
**Must pass before release**
- Installation & plugin activation
- Onboarding flow
- Dashboard functionality
- Push broadcast creation & sending
- Core settings

### 🟠 High (P1) - 152 tests
**Core user workflows**
- Drip campaign automation
- Audience segmentation
- Post editor integration
- Post type configuration

### 🟡 Medium (P2) - 119 tests
**Important but not blocking**
- Design customization
- Analytics & reports
- UI elements (icons, stats, links)
- Admin bar menu

### 🟢 Low (P3) - 42 tests
**Nice-to-have features**
- Help documentation
- About page
- Rating prompts
- Review banners

---

## 📝 Test File Structure

Each test follows this structure:

```javascript
const { test, expect } = require('@playwright/test');
const config = require('../../../utils/config');
const helpers = require('../../../utils/playwright-helpers');

/**
 * Test ID: QAWPREG301
 * Priority: CRITICAL
 * Feature: CAMPAIGNS
 * Test: Validate Push Broadcast page
 * 
 * Status: 📝 CONVERTED FROM EXCEL
 * Source: WordPress Plugin Regression Sheet.xlsx
 */

test.describe('CRITICAL - Campaigns - Validate Push Broadcast page', () => {
  
  test('Validate Push Broadcast page', async ({ page }) => {
    test.setTimeout(120000);
    
    // Test Steps from Excel:
    // 1) Login to WordPress admin
    // 2) Navigate to PushEngage page
    // 3) Click Push Broadcast
    
    // Expected Result:
    // Following elements should be present on Push Broadcast page:
    // 1) Pushengage logo
    // 2) Notification icon
    // 3) Help link
    // 4) Add new button
    // 5) List of notifications/Push Broadcast
    // 6) Filter
    // 7) Export
    
    // Step 1: Login to WordPress
    await helpers.loginToWordPress(page, config);
    
    // Step 2: Navigate to dashboard
    await helpers.visitDashboard(page, config);
    
    // TODO: Implement test steps
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/qawpreg301-validate-push-broadcast-page.png', 
      fullPage: true 
    });
    
    expect(true).toBeTruthy();
  });
});
```

---

## 🔧 Implementation Guide

### Each Test Includes

✅ **Test ID** - Original Excel test ID (QAWPREG###)  
✅ **Priority Level** - Critical/High/Medium/Low  
✅ **Feature Category** - Organized by functionality  
✅ **Test Description** - Clear purpose  
✅ **Original Steps** - From Excel (as comments)  
✅ **Expected Results** - From Excel (as comments)  
✅ **Auto-Login** - WordPress authentication included  
✅ **Navigation** - Dashboard access built-in  
✅ **Screenshot Capture** - Automatic  
✅ **TODO Markers** - Ready for implementation  

### How to Implement a Test

1. **Open the test file**
   ```bash
   code tests/pushengage-excel-tests/critical/installation/01-validate-plugin-search.spec.js
   ```

2. **Read the steps** (in comments at top of test)
   ```javascript
   // Test Steps from Excel:
   // 1) Login to your wordpress site
   // 2) Navigate to Plugins menu
   // 3) Click Add New
   // 4) Type PushEngage in search bar
   ```

3. **Implement using Playwright**
   ```javascript
   // Navigate to Plugins
   await page.goto(`${config.wpAdminUrl}plugin-install.php`);
   
   // Search for PushEngage
   await page.fill('#search-plugins', 'PushEngage');
   await page.click('button[type="submit"]');
   
   // Verify plugin appears
   const pluginCard = await page.locator('.plugin-card-pushengage');
   await expect(pluginCard).toBeVisible();
   ```

4. **Follow proven patterns** from working tests:
   - `tests/pushengage-regression/critical/push-broadcasts/01-send-immediate-broadcast.spec.js`
   - `tests/pushengage-regression/medium/goal-tracking/01-enable-goal-tracking.spec.js`

5. **Test locally**
   ```bash
   npm run test:excel:installation
   ```

---

## 📊 Feature Coverage

### Core Features (215 tests)
- ✅ Plugin Installation & Setup
- ✅ User Onboarding
- ✅ Dashboard Management
- ✅ Push Broadcast Campaigns
- ✅ Plugin Settings & Configuration

### Advanced Features (152 tests)
- ✅ Drip Campaign Automation
- ✅ Audience Segmentation & Targeting
- ✅ WordPress Post Editor Integration
- ✅ Custom Post Types
- ✅ Service Worker Management

### UI & Analytics (119 tests)
- ✅ Design Customization
- ✅ Analytics Dashboard
- ✅ Notification Icons
- ✅ Quick Stats Widget
- ✅ Quick Links Menu
- ✅ Admin Bar Integration

### Support Features (42 tests)
- ✅ Help Documentation
- ✅ About Page
- ✅ Rating System
- ✅ Review Banners
- ✅ Plan Tags & Upgrades

---

## 🎓 Helper Functions Available

All tests can use helpers from `tests/utils/playwright-helpers.js`:

### Authentication
```javascript
await helpers.loginToWordPress(page, config);
```

### Navigation
```javascript
await helpers.visitDashboard(page, config);
await helpers.openPushEngageMenuItemByIndex(page, 1); // Push Broadcasts
await helpers.openPushEngageMenuItemByIndex(page, 2); // Drip Campaigns
```

### Form Interactions
```javascript
await helpers.fillNotificationForm(page, {
  title: 'Test Notification',
  message: 'Test Message',
  url: 'https://example.com'
});
```

### Wait Utilities
```javascript
await helpers.waitForPushEngageLoad(page);
await helpers.waitForElement(page, '.some-selector');
```

---

## 🌍 Multi-Environment Support

All tests work across environments:

### Local WordPress
```bash
# Set in .env
LOCAL_WP_ADMIN_URL=http://productionautomation.local/wp-admin/
LOCAL_WP_USERNAME=admin
LOCAL_WP_PASSWORD=admin@123=

# Run tests
TEST_ENV=local npm run test:excel:all
```

### Staging
```bash
# Set in .env
WP_ADMIN_URL=https://qastaging.pushengage.com/wp-admin/
WP_USERNAME=kgosal
WP_PASSWORD=!letmeIn@123=

# Run tests (default)
npm run test:excel:all
```

---

## 📈 Progress Tracking

### Implementation Status

| Priority | Total | Implemented | Pending | Progress |
|----------|-------|-------------|---------|----------|
| Critical | 215 | 0 | 215 | 📝 0% |
| High | 152 | 0 | 152 | 📝 0% |
| Medium | 119 | 0 | 119 | 📝 0% |
| Low | 42 | 0 | 42 | 📝 0% |
| **TOTAL** | **528** | **0** | **528** | **📝 0%** |

*All tests are converted and ready for implementation!*

---

## 🎯 Recommended Implementation Order

### Phase 1: Quick Wins (37 tests)
Start with simple validation tests:
1. **Installation** (14 tests) - Element visibility checks
2. **Help** (6 tests) - Modal and link validation
3. **About** (14 tests) - Page element checks
4. **Ratings** (4 tests) - Simple UI validation

**Estimated Time:** 1-2 days  
**Complexity:** Low

### Phase 2: Core Features (157 tests)
Essential user workflows:
1. **Campaigns** (57 tests) - Push broadcast CRUD
2. **Settings** (50 tests) - Configuration management
3. **Dashboard** (53 tests) - Main interface validation

**Estimated Time:** 1-2 weeks  
**Complexity:** Medium-High

### Phase 3: Automation (96 tests)
Advanced features:
1. **Drip** (52 tests) - Automated campaigns
2. **Audience** (44 tests) - Segmentation logic

**Estimated Time:** 1 week  
**Complexity:** High

### Phase 4: Integration (88 tests)
WordPress integration:
1. **Post Editor** (47 tests) - Editor integration
2. **Onboarding** (41 tests) - Multi-step flow with OAuth

**Estimated Time:** 1 week  
**Complexity:** High

### Phase 5: Analytics & UI (150 tests)
Remaining features:
1. **Analytics** (44 tests)
2. **Design** (42 tests)
3. **Other UI elements** (64 tests)

**Estimated Time:** 1 week  
**Complexity:** Medium

---

## 📚 Additional Resources

### Documentation
- **Complete Report:** `EXCEL_CONVERSION_REPORT.md`
- **Test Data JSON:** `excel-test-data.json`
- **Conversion Script:** `convert-excel-to-tests.js`

### Working Examples
- Immediate broadcast: `tests/pushengage-regression/critical/push-broadcasts/01-send-immediate-broadcast.spec.js`
- Goal tracking: `tests/pushengage-regression/medium/goal-tracking/01-enable-goal-tracking.spec.js`

### Helper Files
- **Playwright Helpers:** `tests/utils/playwright-helpers.js`
- **Configuration:** `tests/utils/config.js`
- **Selectors:** Defined in `playwright-helpers.js`

---

## 🐛 Troubleshooting

### Common Issues

**Test timeout:**
```javascript
// Increase timeout at test level
test.setTimeout(120000); // 2 minutes
```

**Element not found:**
```javascript
// Use multi-selector strategy from working tests
const selectors = [
  '#pushengage-container',
  '.pushengage-wrapper',
  '[data-testid="pushengage-main"]'
];

for (const selector of selectors) {
  const element = await page.locator(selector);
  if (await element.isVisible()) {
    await element.click();
    break;
  }
}
```

**Login issues:**
```javascript
// Use the proven login helper
await helpers.loginToWordPress(page, config);
```

---

## ✅ Quality Checklist

Before marking a test as complete:

- [ ] All steps from Excel implemented
- [ ] Expected results validated
- [ ] Assertions added
- [ ] Error handling included
- [ ] Screenshots captured
- [ ] Test runs successfully
- [ ] Test is idempotent (can run multiple times)
- [ ] Follows existing code style
- [ ] Console logs are informative
- [ ] Works on all configured environments

---

## 🎊 Summary

### What You Have

✅ **528 test cases** ready to implement  
✅ **Original Excel data** preserved in comments  
✅ **Organized structure** by priority & feature  
✅ **Auto-login** included in every test  
✅ **Multi-environment** support built-in  
✅ **Helper functions** available  
✅ **Proven patterns** to follow  
✅ **Complete documentation**

### Next Steps

1. **Review** a few test files to understand structure
2. **Implement** starting with Phase 1 (Quick Wins)
3. **Test locally** before moving to next feature
4. **Track progress** by updating status markers
5. **Run full suite** periodically to catch regressions

---

## 📞 Need Help?

- Check **working test examples** in `tests/pushengage-regression/`
- Review **helper functions** in `tests/utils/playwright-helpers.js`
- Read **complete report** in `EXCEL_CONVERSION_REPORT.md`
- Look at **original Excel** steps in test comments

---

**Generated:** February 17, 2026  
**Framework:** Playwright  
**Total Tests:** 528  
**Status:** ✅ Ready for Implementation
