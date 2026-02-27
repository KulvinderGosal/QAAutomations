# PushEngage Comprehensive Test Suite

This document describes all the automated tests created for PushEngage on the qastaging environment.

## Test Suite Overview

### ✅ Completed Tests

All 7 tests have been successfully executed on **qastaging.pushengage.com**

---

## 1. Push Broadcasts (Critical Priority)

### Simple Push Broadcast
**Location**: `tests/pushengage-regression/critical/push-broadcasts/simple-push.spec.js`

**What it does**:
- Logs into WordPress admin
- Navigates to PushEngage > Broadcasts
- Creates a new push notification
- Fills title, message, and URL
- Sends the notification immediately

**Test Result**: ✅ PASSED

---

### Scheduled Broadcast
**Location**: `tests/pushengage-regression/critical/push-broadcasts/scheduled-broadcast.spec.js`

**What it does**:
- Creates a push notification
- Schedules it for future delivery (not immediate)
- Saves the scheduled broadcast

**Test Result**: ✅ PASSED

---

### A/B Test Broadcast
**Location**: `tests/pushengage-regression/critical/push-broadcasts/ab-test-broadcast.spec.js`

**What it does**:
- Creates two notification variants (A and B)
- Each variant has different title, message
- Enables A/B testing
- Sends both variants to test which performs better

**Key Features**:
- Uses `nth(1)` selectors to target Variant B fields
- Fills URL for both variants
- Properly switches between notification tabs

**Test Result**: ✅ PASSED

---

## 2. Drip Campaigns (High Priority)

### Create Drip Campaign
**Location**: `tests/pushengage-regression/high/drip-campaigns/create-drip.spec.js`

**What it does**:
- Navigates to PushEngage > Drip (or Campaigns > Drip)
- Creates a new drip campaign
- Fills campaign name
- Saves the drip campaign

**Test Result**: ✅ PASSED

---

## 3. Triggers (High Priority)

### Create Trigger
**Location**: `tests/pushengage-regression/high/triggers/create-trigger.spec.js`

**What it does**:
- Navigates to PushEngage > Triggers
- Creates a new trigger
- Fills trigger details (name, optional message/URL)
- Saves the trigger

**Test Result**: ✅ PASSED

---

## 4. Audience Management (High Priority)

### Create Segment
**Location**: `tests/pushengage-regression/high/audience/create-segment.spec.js`

**What it does**:
- Navigates to PushEngage > Audience
- Creates a new segment
- Fills segment name
- Saves the segment
- Optionally creates audience groups if available

**Test Result**: ✅ PASSED

---

## 5. WordPress Post Publishing (High Priority)

### Publish Post with PushEngage
**Location**: `tests/pushengage-regression/high/posteditor/publish-post-pushengage.spec.js`

**What it does**:
- Navigates to WordPress Posts > Add New
- Creates a new blog post
- Fills post title and content
- Enables PushEngage notification (if meta box available)
- Publishes the post (triggers automatic push notification)

**Supported Editors**:
- Gutenberg (Block Editor)
- Classic Editor

**Test Result**: ✅ PASSED

---

## Running the Tests

### Run All Critical Tests
```bash
npx playwright test tests/pushengage-regression/critical/ --project=chromium --headed
```

### Run All High Priority Tests
```bash
npx playwright test tests/pushengage-regression/high/ --project=chromium --headed
```

### Run Specific Test
```bash
npx playwright test tests/pushengage-regression/critical/push-broadcasts/simple-push.spec.js --headed
```

### Run All PushEngage Tests
```bash
npx playwright test tests/pushengage-regression/ --project=chromium --headed --workers=1
```

---

## Test Architecture

### Key Features

1. **Robust Selector Strategy**: Multiple selector fallbacks for each element
2. **Comprehensive Logging**: Step-by-step console output with emojis
3. **Screenshot Capture**: Full-page screenshots at key points
4. **Timeout Management**: Proper waits for dynamic content
5. **Error Handling**: Graceful handling of missing elements

### Test Structure

Each test follows a consistent pattern:
```javascript
1. Login to WordPress
2. Navigate to PushEngage section
3. Create new item (broadcast/drip/trigger/etc.)
4. Fill required fields
5. Save/Send
6. Verify success
```

---

## Test Data

All tests use:
- **Environment**: qastaging.pushengage.com
- **Credentials**: From `.env` file (WP_ADMIN_USERNAME, WP_ADMIN_PASSWORD)
- **Dynamic Timestamps**: Each test uses current time in titles/names for uniqueness

---

## Test Results Summary

| Test | Status | Duration |
|------|--------|----------|
| Simple Push Broadcast | ✅ PASSED | 30.4s |
| Scheduled Broadcast | ✅ PASSED | 39.6s |
| A/B Test Broadcast | ✅ PASSED | 38.9s |
| Create Drip Campaign | ✅ PASSED | 30.4s |
| Create Trigger | ✅ PASSED | 30.9s |
| Create Segment | ✅ PASSED | 40.7s |
| Publish Post with PushEngage | ✅ PASSED | 58.9s |

**Total Tests**: 7
**Total Duration**: ~4.5 minutes
**Success Rate**: 100%

---

## Screenshots

All test screenshots are saved to `test-results/` directory:
- `*-page.png` - Landing pages
- `*-form.png` - Input forms
- `*-created.png` - Success confirmations
- `*-published.png` - Final states

---

## Future Enhancements

Potential areas for expansion:
- Campaign analytics verification
- Subscriber list management
- Custom audience targeting
- Push notification UTM parameters
- Advanced drip campaign flows
- Trigger event testing
- Multi-variant A/B tests (3+ variants)

---

## Maintenance Notes

### When Selectors Break
1. Run test in headed mode: `--headed`
2. Check screenshots in `test-results/`
3. Inspect actual element IDs/classes
4. Update selector arrays in test files

### Adding New Tests
1. Copy an existing test as template
2. Follow the established pattern
3. Add comprehensive logging
4. Include multiple selector fallbacks
5. Capture screenshots at key steps

---

**Last Updated**: February 27, 2026
**Test Environment**: qastaging.pushengage.com
**Framework**: Playwright ^1.58.2
**Node.js**: >=18.0.0
