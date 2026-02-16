# 🎯 PushEngage Plugin - Complete Regression Test Suite

## Overview

This is a comprehensive, priority-based regression test suite for the PushEngage WordPress plugin. The suite contains **71 test cases** organized by priority and feature, covering all major functionality of the plugin.

## 📊 Test Suite Statistics

| Priority | Tests | Completed | Remaining | Progress |
|----------|-------|-----------|-----------|----------|
| **Critical (P0)** | 27 | 6 | 21 | 22% |
| **High (P1)** | 29 | 0 | 29 | 0% |
| **Medium (P2)** | 14 | 0 | 14 | 0% |
| **Low (P3)** | 1 | 0 | 1 | 0% |
| **TOTAL** | **71** | **6** | **65** | **8%** |

## 🗂️ Test Organization

```
tests/pushengage-regression/
├── critical/                    # P0 - Must pass tests (27 tests)
│   ├── smoke/                  # Basic functionality (5 tests) ✅
│   ├── push-broadcasts/        # Core broadcasts (13 tests) - 1 done
│   └── settings-core/          # Critical settings (9 tests)
├── high/                        # P1 - Important features (29 tests)
│   ├── drip-campaigns/         # Automated campaigns (6 tests)
│   ├── triggers/               # Automation triggers (11 tests)
│   ├── audience/               # Segmentation (4 tests)
│   └── woocommerce-core/       # E-commerce (8 tests)
├── medium/                      # P2 - Standard features (14 tests)
│   ├── click-to-chat/          # Chat widget (4 tests)
│   ├── whatsapp/               # WhatsApp integration (5 tests)
│   ├── goal-tracking/          # Analytics (2 tests)
│   └── woocommerce-templates/  # WooCommerce templates (3 tests)
└── low/                         # P3 - Nice to have (1 test)
    └── about-us/               # Help/docs (1 test)
```

## 🚀 Quick Start

### Run All Critical Tests
```bash
npm run test:regression:critical
```

### Run By Priority Level
```bash
npm run test:regression:critical    # P0 tests (27 tests, ~15 min)
npm run test:regression:high        # P1 tests (29 tests, ~20 min)
npm run test:regression:medium      # P2 tests (14 tests, ~10 min)
npm run test:regression:low         # P3 tests (1 test, ~1 min)
npm run test:regression:all         # All tests (71 tests, ~45 min)
```

### Run By Feature
```bash
npm run test:regression:broadcasts  # Push broadcast tests
npm run test:regression:settings    # Settings tests
npm run test:regression:drip        # Drip campaign tests
npm run test:regression:triggers    # Trigger tests
npm run test:regression:woo         # WooCommerce tests
```

## 📋 Test Coverage by Feature

### CRITICAL (P0) - 27 Tests

#### 1. Smoke Tests (5 tests) ✅ **DONE**
- [x] WordPress login
- [x] Dashboard load
- [x] PushEngage menu visible
- [x] PushEngage menu click
- [x] Frontend reachable

#### 2. Push Broadcasts (13 tests) - 1/13 done
- [x] Send immediate broadcast ✅
- [ ] Schedule future broadcast
- [ ] Create recurring broadcast
- [ ] A/B test broadcast
- [ ] Send to segment
- [ ] Send to audience group
- [ ] Duplicate broadcast
- [ ] Export broadcast
- [ ] View analytics
- [ ] Edit draft
- [ ] Delete broadcast
- [ ] Broadcast history
- [ ] Resend broadcast

#### 3. Settings - Core (9 tests)
- [ ] Connect site
- [ ] Disconnect site
- [ ] Dashboard sign-in
- [ ] Enable auto push
- [ ] Disable auto push
- [ ] Configure post types
- [ ] Use site icon
- [ ] Upload notification icon
- [ ] Save settings

### HIGH PRIORITY (P1) - 29 Tests

#### 4. Drip Campaigns (6 tests)
- [ ] Create basic drip
- [ ] Create drip for audience
- [ ] Duplicate drip
- [ ] Edit drip
- [ ] Export drip
- [ ] Delete drip

#### 5. Triggers (11 tests)
- [ ] Create custom trigger
- [ ] Create inventory trigger
- [ ] Create price drop trigger
- [ ] Create cart abandonment trigger
- [ ] Edit trigger
- [ ] Add notification to trigger
- [ ] Export trigger
- [ ] Duplicate trigger
- [ ] Disable trigger
- [ ] Enable trigger
- [ ] Delete trigger

#### 6. Audience (4 tests)
- [ ] Create segment
- [ ] Delete segment
- [ ] Create audience group
- [ ] Delete audience group

#### 7. WooCommerce Core (8 tests)
- [ ] New order notification
- [ ] Cancelled order notification
- [ ] Failed order notification
- [ ] Pending order notification
- [ ] Processing order notification
- [ ] On-hold order notification
- [ ] Completed order notification
- [ ] Refunded order notification

### MEDIUM PRIORITY (P2) - 14 Tests

#### 8. Click to Chat (4 tests)
- [ ] Enable click to chat
- [ ] Disable click to chat
- [ ] Configure chat style
- [ ] Verify frontend widget

#### 9. WhatsApp (5 tests)
- [ ] Configure WhatsApp settings
- [ ] Configure WhatsApp Cloud
- [ ] Enable WhatsApp notifications
- [ ] Configure WhatsApp templates
- [ ] Test WhatsApp integration

#### 10. Goal Tracking (2 tests)
- [ ] Enable goal tracking
- [ ] Disable goal tracking

#### 11. WooCommerce Templates (3 tests)
- [ ] Navigate to templates
- [ ] Enable template notifications
- [ ] Disable template notifications

### LOW PRIORITY (P3) - 1 Test

#### 12. About Us (1 test)
- [ ] Verify documentation links

## 🎯 Test Execution Strategy

### Daily Smoke Test (2 minutes)
```bash
npm run test:regression:critical
# Run smoke tests only - fastest way to verify basic functionality
```

### Pre-Release Regression (35 minutes)
```bash
npm run test:regression:critical
npm run test:regression:high
# Run P0 + P1 tests before any release
```

### Full Regression (45 minutes)
```bash
npm run test:regression:all
# Run all tests - complete coverage
```

## 🛠️ Development Workflow

### 1. Adding New Tests

All test templates are already generated! To implement a test:

1. Navigate to the test file (e.g., `tests/pushengage-regression/critical/push-broadcasts/02-schedule-future-broadcast.spec.js`)
2. Replace the `// TODO` comments with actual test implementation
3. Follow the pattern from the working broadcast test
4. Run the test to verify it works

### 2. Regenerating Test Templates

If you need to add more tests or regenerate templates:

```bash
npm run generate:tests
```

This will regenerate all test templates based on the test plan.

### 3. Running Individual Tests

```bash
# Run a specific test file
npx playwright test tests/pushengage-regression/critical/push-broadcasts/02-schedule-future-broadcast.spec.js --project=chromium

# Run with visible browser (debugging)
npx playwright test tests/pushengage-regression/critical/push-broadcasts/02-schedule-future-broadcast.spec.js --headed --project=chromium
```

## 📝 Test File Structure

Each test file follows this structure:

```javascript
const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../utils/auth');
const config = require('../../utils/config');

test.describe('PRIORITY - Feature - Test Description', () => {
  
  test('Test description', async ({ page }) => {
    test.setTimeout(120000);
    
    // Step 1: Login
    // Step 2: Navigate
    // Step 3: Perform actions
    // Step 4: Assert results
    // Step 5: Cleanup
  });
});
```

## 🎨 Priority Definitions

| Priority | Definition | Run Frequency |
|----------|------------|---------------|
| **P0 - Critical** | Must pass before any release. Core functionality that breaks the product if it fails. | Every commit, Pre-release |
| **P1 - High** | Important features that significantly impact user experience. | Daily, Pre-release |
| **P2 - Medium** | Standard features that should work but are not critical. | Weekly, Full regression |
| **P3 - Low** | Nice-to-have features and edge cases. | Monthly, Full regression |

## 📊 Implementation Progress

### Phase 1: Critical Tests (Current)
- ✅ Infrastructure setup
- ✅ Test templates generated
- ✅ Smoke tests implemented (5/5)
- ✅ First broadcast test implemented (1/13)
- 🚧 Remaining broadcast tests (12/13)
- 📝 Settings tests (0/9)

### Phase 2: High Priority
- 📝 Drip campaigns (0/6)
- 📝 Triggers (0/11)
- 📝 Audience (0/4)
- 📝 WooCommerce core (0/8)

### Phase 3: Medium Priority
- 📝 Click to Chat (0/4)
- 📝 WhatsApp (0/5)
- 📝 Goal Tracking (0/2)
- 📝 WooCommerce templates (0/3)

### Phase 4: Low Priority
- 📝 About Us (0/1)

## 🔧 Technical Details

### Prerequisites
- Node.js installed
- Playwright installed (`npm install`)
- Local WordPress site running at `http://productionautomation.local/`
- PushEngage plugin activated

### Configuration
Tests use environment variables from `.env`:
```env
LOCAL_WP_ADMIN_URL=http://productionautomation.local/wp-admin
LOCAL_WP_USERNAME=admin
LOCAL_WP_PASSWORD=admin@123=
```

### Test Features
- ✅ Automatic login handling
- ✅ Smart element detection
- ✅ Screenshot capture on failure
- ✅ Detailed logging
- ✅ Retry logic (2 retries per test)
- ✅ Video recording on failure

## 📈 Success Metrics

### Phase 1 Complete (Target: Week 1)
- ✅ All P0 tests passing (27 tests)
- ✅ Test execution time < 15 minutes
- ✅ Documentation complete

### Phase 2 Complete (Target: Week 2)
- ✅ All P0 + P1 tests passing (56 tests)
- ✅ Test execution time < 35 minutes
- ✅ CI/CD integration ready

### Phase 3 Complete (Target: Week 3)
- ✅ All P0 + P1 + P2 tests passing (70 tests)
- ✅ Test execution time < 45 minutes
- ✅ Performance benchmarks established

### Phase 4 Complete (Target: Week 4)
- ✅ All tests passing (71 tests)
- ✅ 100% feature coverage
- ✅ Automated reporting
- ✅ Production-ready regression suite

## 📚 Documentation

- `REGRESSION_TEST_PLAN.md` - Detailed test plan and strategy
- `critical/README.md` - Critical priority tests
- `high/README.md` - High priority tests
- `medium/README.md` - Medium priority tests
- `low/README.md` - Low priority tests
- `BROADCAST_SUCCESS.md` - Broadcast automation guide

## 🎊 Current Status

**✅ Infrastructure Complete:**
- Test suite structure created
- 71 test templates generated
- NPM commands configured
- Documentation complete

**✅ Tests Implemented:**
- Smoke tests: 5/5 (100%)
- Broadcast tests: 1/13 (8%)
- Total: 6/71 (8%)

**🚀 Ready to Scale:**
- Framework proven with working tests
- Templates ready for implementation
- Clear roadmap for completion

## 🤝 Contributing

To implement a test:

1. Pick a TODO test from the list
2. Open the test file
3. Replace TODO comments with actual implementation
4. Follow the working broadcast test as a reference
5. Test locally
6. Mark as complete in this README

## 📞 Support

For questions or issues:
- Check the working broadcast test for reference
- Review `BROADCAST_SUCCESS.md` for automation patterns
- Look at Cypress tests in `/Users/kulvindersingh/cypress/e2e/pewpplugin/` for test logic

---

**🎉 Ready to build a comprehensive regression test suite!** 🚀
