# CRITICAL Priority Tests (P0)

## Overview

This directory contains **245 CRITICAL priority tests** for the PushEngage WordPress plugin. These tests must pass before any release as they cover core functionality that would break the product if they fail.

## 📊 Test Coverage

| Feature | Tests | Description |
|---------|-------|-------------|
| **Campaigns** | 57 | Campaign creation, management, and execution |
| **Dashboard** | 53 | Main dashboard functionality and statistics |
| **Installation** | 16 | Plugin installation, activation, and smoke tests |
| **Onboarding** | 41 | User onboarding and initial setup flow |
| **Push Broadcasts** | 18 | Push notification creation and sending |
| **Settings Core** | 9 | Essential plugin settings and configuration |
| **Settings Excel** | 50 | Advanced settings imported from Excel test cases |
| **TOTAL** | **245** | All critical functionality tests |

## 🚀 Running Critical Tests

### Run All Critical Tests
```bash
npm run test:regression:critical
# Runs all 245 critical tests (~45 minutes)
```

### Run By Feature
```bash
# Campaigns
npm run test:regression:campaigns           # 57 tests

# Dashboard
npm run test:regression:dashboard           # 53 tests

# Installation & Smoke
npm run test:regression:installation        # 16 tests

# Onboarding
npm run test:regression:onboarding          # 41 tests

# Push Broadcasts
npm run test:regression:broadcasts          # 18 tests

# Settings
npm run test:regression:settings            # 9 tests
npm run test:regression:settings-excel      # 50 tests
```

### Run Specific Test File
```bash
# Example: Run installation tests
npx playwright test tests/pushengage-regression/critical/installation/ --project=chromium

# Example: Run specific broadcast test
npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --project=chromium --headed
```

## 📋 Feature Details

### 1. Campaigns (57 tests)
**Location:** `critical/campaigns/`

Campaign management and execution features including:
- Campaign creation and editing
- Campaign duplication and deletion
- Campaign scheduling
- Campaign templates
- Campaign analytics
- Campaign history

**Run:** `npm run test:regression:campaigns`

---

### 2. Dashboard (53 tests)
**Location:** `critical/dashboard/`

Main dashboard functionality including:
- Dashboard widget display
- Quick statistics
- Recent activity
- Performance metrics
- Navigation elements
- User interface validation

**Run:** `npm run test:regression:dashboard`

---

### 3. Installation (16 tests)
**Location:** `critical/installation/`

Plugin installation and smoke tests including:
- WordPress login
- Plugin activation/deactivation
- Plugin settings access
- Basic WordPress functionality
- PushEngage menu visibility
- No PHP/JavaScript errors

**Run:** `npm run test:regression:installation`

---

### 4. Onboarding (41 tests)
**Location:** `critical/onboarding/`

User onboarding flow including:
- Initial setup wizard
- Account connection
- Site configuration
- Welcome screens
- Tutorial completion
- Setup verification

**Run:** `npm run test:regression:onboarding`

---

### 5. Push Broadcasts (18 tests)
**Location:** `critical/push-broadcasts/`

Push notification features including:
- Create immediate broadcast
- Schedule future broadcast
- Send to segments
- Broadcast templates
- Broadcast analytics
- Broadcast history
- Edit and delete broadcasts

**Run:** `npm run test:regression:broadcasts`

---

### 6. Settings Core (9 tests)
**Location:** `critical/settings-core/`

Essential plugin settings including:
- Site connection/disconnection
- Auto-push configuration
- Post type selection
- Icon configuration
- Basic settings save

**Run:** `npm run test:regression:settings`

---

### 7. Settings Excel (50 tests)
**Location:** `critical/settings-excel/`

Advanced settings from Excel test cases including:
- Advanced configuration options
- Integration settings
- Feature toggles
- API configurations
- Custom field settings

**Run:** `npm run test:regression:settings-excel`

---

## 🎯 Test Execution Strategy

### Pre-Commit (5 minutes)
```bash
npm run test:regression:installation
# Quick smoke tests before committing
```

### Pre-Release (45 minutes)
```bash
npm run test:regression:critical
# All critical tests must pass before release
```

### Continuous Integration
```bash
# Run on every push to main/staging
npm run test:regression:critical
```

## ⚠️ Blocking Criteria

**All critical tests MUST pass before:**
- ✅ Any production release
- ✅ Any staging deployment
- ✅ Merging to main branch
- ✅ Tagging a new version

**If critical tests fail:**
- 🚫 Block release immediately
- 🔍 Investigate failure root cause
- 🛠️ Fix issue or revert changes
- ✅ Re-run full critical suite

## 📈 Success Criteria

### Test Quality
- All tests have clear descriptions
- Tests are independent and can run in any order
- Tests clean up after themselves
- Tests capture screenshots/videos on failure
- Tests have proper assertions

### Execution
- Tests complete in reasonable time (~45 min for all)
- Tests are stable (no flaky tests)
- Tests run successfully on CI/CD
- Tests work on staging and local environments

## 🔧 Technical Information

### Test Structure
```javascript
const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test.describe('CRITICAL - Feature Name', () => {
  test('Test description', async ({ page }) => {
    test.setTimeout(120000);
    await loginToWordPress(page);
    // ... test implementation
  });
});
```

### Import Paths
All tests in this directory use:
```javascript
require('../../../utils/auth')     // For authentication
require('../../../utils/config')   // For configuration
```

### Timeouts
- Default test timeout: 30 seconds
- Extended timeout for complex tests: 120 seconds
- Page load timeout: 30 seconds

## 📊 Progress Tracking

Track test implementation progress:

- ✅ **Campaigns**: 57/57 tests implemented
- ✅ **Dashboard**: 53/53 tests implemented  
- ✅ **Installation**: 16/16 tests implemented
- ✅ **Onboarding**: 41/41 tests implemented
- ✅ **Push Broadcasts**: 18/18 tests implemented
- ✅ **Settings Core**: 9/9 tests implemented
- ✅ **Settings Excel**: 50/50 tests implemented

**Total: 245/245 (100%)**

---

**Priority:** P0 - Critical  
**Total Tests:** 245  
**Estimated Time:** ~45 minutes  
**Status:** ✅ Blocks all releases
