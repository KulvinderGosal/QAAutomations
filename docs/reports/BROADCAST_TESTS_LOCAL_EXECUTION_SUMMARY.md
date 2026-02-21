# 📊 Push Broadcast Tests - Local WordPress Execution Summary

**Test Run Date**: February 21, 2026, 10:02 PM  
**Environment**: Local WordPress + QA Staging (Mixed)  
**Browser**: Chromium  
**Total Tests Attempted**: 22  
**Tests Executed**: 11 (before interruption/truncation)  
**Duration**: ~4 minutes (260 seconds observed)

---

## 🎯 Executive Summary

**Test Results (Visible)**:
- ✅ **Passed**: 1 test (9%)
- ❌ **Failed**: 10 tests (91%)
- ⏸️ **Not Executed**: 11 tests (interrupted/truncated)

**Status**: ⚠️ **INCOMPLETE - OUTPUT TRUNCATED**

---

## 📋 Detailed Test Results

### ✅ Passed Tests (1)

| # | Test File | Test Name | Duration | Status |
|---|-----------|-----------|----------|--------|
| 7 | `02-schedule-future-broadcast.spec.js` | Schedule broadcast for future date/time | 6.1s | ✅ PASSED (Stub) |

**Note**: This is a stub/TODO test that just passes without real implementation.

---

### ❌ Failed Tests (10)

#### Failed Test #1: **01-send-immediate-broadcast.spec.js**
```
Test: Auto-Send Push Broadcast › Send Push Broadcast Automatically
Status: ❌ FAILED (all 3 attempts)
Attempts:
  - Initial: Failed after 25.3s
  - Retry #1: Failed after 25.8s
  - Retry #2: Failed after 25.7s

Console Output:
📍 Navigating to WordPress login...
🔐 Logging in...
✓ Logged in
📍 Going to WordPress dashboard...
📍 Navigating to PushEngage...
✓ Page loaded
📍 Looking for Create button...
⚠️ Trying to click first clickable element in pe-container...
[FAILED]

Issue: Unable to find/click Create button after trying fallback strategy
```

#### Failed Test #2: **01-simple-broadcast-test.spec.js**
```
Test: Simple Broadcast Test - Create and Send
Status: ❌ FAILED (all 3 attempts)
Attempts:
  - Initial: Failed after 11.1s
  - Retry #1: Failed after 9.4s
  - Retry #2: Failed after 9.5s

Console Output:
🚀 Starting broadcast test...
🌍 Environment: https://qastaging.pushengage.com/admin
🔐 Logging into WordPress admin (staging)...
✓ Login successful
✅ Logged in
📍 Navigating to campaigns...
✅ On campaigns page
📍 Clicking Create button...
[FAILED]

Issue: Successfully logged in and navigated, but failed when clicking Create button
```

#### Failed Test #3: **02-working-campaign-test.spec.js** (2 tests)
```
Test 1: Create and Send Immediate Broadcast
Status: ❌ FAILED (all 3 attempts)
Attempts:
  - Initial: Failed after 8.9s
  - Retry #1: Failed after 9.1s
  - Retry #2: Failed after 9.0s

Console Output:
🚀 Starting broadcast test...
🔐 Logging into WordPress admin (staging)...
✓ Login successful
✅ Logged in
📍 Going to PushEngage Campaigns...
✅ On campaigns page
📍 Clicking Create button...
[FAILED]

Test 2: Create Scheduled Broadcast
Status: ❌ FAILED after 22.0s
(Only 1 attempt visible)

Console Output:
📅 Starting scheduled broadcast test...
🔐 Logging into WordPress admin (staging)...
✓ Login successful
✅ Logged in
📍 Creating new broadcast...
✅ Create form opened
📝 Filling title: "Scheduled Test 10:05:58 PM"
✅ Form filled
📍 Saving...
[Output truncated]

Issue: Test progressed further (form opened and filled) but failed during save operation
```

---

## 🔍 Root Cause Analysis

### Primary Issue: **Create Button Not Found/Clickable**

**Pattern Observed**:
1. ✅ Login successful (both local and staging)
2. ✅ Navigation to campaigns page successful
3. ❌ **Failure point**: Clicking "Create" button

**Evidence**:
- All tests failing at the same step: "📍 Clicking Create button..."
- Even with multi-selector fallback strategy, button not found
- Fallback message: "⚠️ Trying to click first clickable element in pe-container..."

### Possible Causes:

#### 1. **Page Not Fully Loaded**
- JavaScript-heavy React/Angular app may need longer wait time
- Elements might be dynamically loaded via AJAX
- Current wait (5000ms) might be insufficient

#### 2. **Element Selector Mismatch**
- Button text/class changed in the UI
- Button inside iframe or shadow DOM
- Button hidden behind overlay/modal

#### 3. **Authentication/Permissions Issue**
- User might not have permission to create broadcasts
- Button only visible for certain roles
- License/subscription issue

#### 4. **Environment Configuration**
- Tests trying to run on staging (https://qastaging.pushengage.com/admin)
- User requested "localwp site" but tests defaulted to staging
- Mix of environments causing confusion

---

## 🚨 Critical Findings

### Issue #1: **Wrong Environment Detected**
```
Expected: Local WordPress (http://productionautomation.local)
Actual:   QA Staging (https://qastaging.pushengage.com/admin)
```

**Impact**: Tests ran on staging instead of local WordPress as requested

**Evidence**:
- Test console shows: `🌍 Environment: https://qastaging.pushengage.com/admin`
- Should show: `🌍 Environment: http://productionautomation.local`

### Issue #2: **Incomplete Test Run**
- Only 11 out of 22 tests executed
- Terminal output truncated at 188 lines (7999 bytes)
- Remaining 11 tests not executed

### Issue #3: **100% Failure Rate on Actual Tests**
- Only passing test is a stub (not implemented)
- All real tests failed at Create button interaction
- Same failure pattern across all test files

---

## 📈 Test Statistics

### By Test File:

| File | Tests | Passed | Failed | Pass Rate |
|------|-------|--------|--------|-----------|
| 01-send-immediate-broadcast.spec.js | 1 | 0 | 1 (3 attempts) | 0% |
| 01-simple-broadcast-test.spec.js | 1 | 0 | 1 (3 attempts) | 0% |
| 02-schedule-future-broadcast.spec.js | 1 | 1 | 0 | 100% ⚠️ Stub |
| 02-working-campaign-test.spec.js | 2 | 0 | 2 (4 attempts) | 0% |
| **Total (Visible)** | **5** | **1** | **4** | **20%** |

### By Failure Point:

| Failure Point | Count | Percentage |
|---------------|-------|------------|
| Create button click | 3 tests | 75% |
| Save operation | 1 test | 25% |

### Overall Metrics:

- **Total Test Attempts**: 14 (including retries)
- **Successful Logins**: 100% ✅
- **Successful Navigation**: 100% ✅
- **Successful Button Interaction**: 0% ❌
- **Test Completion Rate**: 50% (11/22 tests)

---

## 🔧 Recommended Actions

### Immediate Fixes Required:

#### 1. **Verify Environment Configuration**
```bash
# Check .env file
cat .env | grep -E "WP_ADMIN_URL|TEST_ENV"

# Should be:
WP_ADMIN_URL=http://productionautomation.local/wp-admin
TEST_ENV=local

# Currently appears to be:
WP_ADMIN_URL=https://qastaging.pushengage.com/admin
TEST_ENV=staging
```

#### 2. **Investigate Create Button**
- Manually navigate to campaigns page
- Inspect actual button HTML
- Check if button text is "Create", "New", or something else
- Verify button is not in iframe/shadow DOM

#### 3. **Increase Wait Times**
```javascript
// Current wait
await page.waitForTimeout(5000);

// Try longer wait
await page.waitForTimeout(10000);

// Or wait for specific element
await page.waitForSelector('.pe-container', { timeout: 15000 });
```

#### 4. **Add Debug Screenshots**
```javascript
// Before clicking Create
await page.screenshot({ 
  path: 'debug-before-create.png', 
  fullPage: true 
});

// Log all buttons found
const buttons = await page.locator('button').all();
console.log(`Found ${buttons.length} buttons on page`);
```

### Testing Recommendations:

#### Phase 1: Environment Verification
1. ✅ Confirm Local WordPress is running
2. ✅ Verify `.env` points to local, not staging
3. ✅ Test single file first: `npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --headed`

#### Phase 2: Button Investigation
1. ✅ Run test in headed mode to visually see the page
2. ✅ Pause test before button click: `await page.pause();`
3. ✅ Manually inspect button in browser devtools

#### Phase 3: Selector Update
1. ✅ Update selectors based on actual HTML
2. ✅ Test with single selector first
3. ✅ Add debug logging for each selector attempt

---

## 📊 Comparison with Previous Runs

| Metric | Previous (Staging) | Current (Mixed) | Delta |
|--------|-------------------|-----------------|-------|
| Tests Executed | 8 | 11 | +3 |
| Pass Rate | 25% (2/8) | 9% (1/11) | -16% ⬇️ |
| Environment | Staging Only | Mixed (Local→Staging) | Changed |
| Create Button Success | Partial | 0% | Worse ⬇️ |

**Observation**: Tests performing worse than previous run, likely due to environment confusion.

---

## 🎯 Next Steps

### Option 1: Fix Environment (Recommended)
```bash
# 1. Verify local WordPress is running
open http://productionautomation.local

# 2. Check .env configuration
cat .env

# 3. Update .env if needed
TEST_ENV=local
WP_ADMIN_URL=http://productionautomation.local/wp-admin

# 4. Re-run single test
npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --headed --project=chromium
```

### Option 2: Debug Create Button
```bash
# Run in headed mode with pause
npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-simple-broadcast-test.spec.js --headed --project=chromium --debug
```

### Option 3: Test on Staging (If Intentional)
```bash
# Explicitly set staging
TEST_ENV=staging npx playwright test tests/pushengage-regression/critical/push-broadcasts/ --project=chromium
```

---

## 📝 Test Logs Location

- **Terminal Output**: `/Users/kulvindersingh/.cursor/projects/Users-kulvindersingh-QA-Automation/terminals/190234.txt`
- **Screenshots**: `test-results/` folder
- **Videos**: `test-results/` folder (if enabled)
- **Traces**: `test-results/` folder (on failure)

---

## 📞 Support

**Test Engineer**: Kulvinder Singh  
**Email**: kgosal@awesomemotive.com  
**Phone**: +91 9779290090  
**Repository**: https://github.com/KulvinderGosal/QAAutomations

---

**Report Generated**: February 21, 2026, 10:10 PM  
**Test Run Status**: ⚠️ INCOMPLETE - ENVIRONMENT ISSUE DETECTED  
**Primary Issue**: Tests ran on staging instead of local WordPress  
**Recommendation**: Verify `.env` configuration and re-run on correct environment
