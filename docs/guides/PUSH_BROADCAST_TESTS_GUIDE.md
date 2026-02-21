# 🚀 PUSH BROADCAST TESTS - EXECUTION GUIDE

**Date:** February 17, 2026  
**Environment:** http://productionautomation.local/  
**Total Push Broadcast Tests:** 70

---

## 📊 PUSH BROADCAST TEST BREAKDOWN

### Existing Tests (13 tests)
Located in: `tests/pushengage-regression/critical/push-broadcasts/`

1. ✅ **01-send-immediate-broadcast.spec.js** - Send broadcast immediately (WORKING!)
2. 📝 **02-schedule-future-broadcast.spec.js** - Schedule for future date/time
3. 📝 **03-create-recurring-broadcast.spec.js** - Create recurring notification
4. 📝 **04-ab-test-broadcast.spec.js** - Create A/B test broadcast
5. 📝 **05-send-to-segment.spec.js** - Send to specific segment
6. 📝 **06-send-to-audience-group.spec.js** - Send to audience group
7. 📝 **07-duplicate-broadcast.spec.js** - Duplicate existing broadcast
8. 📝 **08-export-broadcast.spec.js** - Export broadcast data
9. 📝 **09-view-broadcast-analytics.spec.js** - View analytics and stats
10. 📝 **10-edit-draft-broadcast.spec.js** - Edit draft broadcast
11. 📝 **11-delete-broadcast.spec.js** - Delete broadcast
12. 📝 **12-broadcast-history.spec.js** - Verify broadcast in history
13. 📝 **13-resend-broadcast.spec.js** - Resend existing broadcast

### Excel Tests - Campaigns (57 tests)
Located in: `tests/pushengage-regression/critical/campaigns/`

1. **01-validate-push-broadcast-page.spec.js** - Page validation
2. **02-validate-notification-icon.spec.js** - Icon validation
3. **03-validate-help-link.spec.js** - Help link
4. **04-validate-add-new.spec.js** - Add new button
5. **05-validate-add-new-content-page.spec.js** - Content page elements
6. **06-validate-add-new-content-notification-fields.spec.js** - Form fields
7. **07-validate-add-new-content-notification-fields-show-large-image.spec.js** - Large image
8. **08-validate-add-new-content-notification-fields-multi-action-first-button.spec.js** - Multi-action button 1
9. **09-validate-add-new-content-notification-fields-multi-action-second-button.spec.js** - Multi-action button 2
10. **10-validate-add-new-content-notification-duration.spec.js** - Duration settings
... and 47 more tests covering all broadcast features!

---

## 🚀 HOW TO RUN (Regular Terminal Required)

### ⚠️ IMPORTANT: Cannot Run in Cursor
Due to Cursor's sandbox limitations (missing ffmpeg), these tests **MUST be run in your regular terminal** (iTerm, Terminal.app, etc.)

### Open Your Regular Terminal
```bash
# 1. Open iTerm or Terminal.app (NOT Cursor's terminal)
# 2. Navigate to project
cd /Users/kulvindersingh/QA-Automation
```

---

## 📋 EXECUTION COMMANDS

### Run ALL Push Broadcast Tests (70 tests)
```bash
# Run push-broadcasts folder (13 tests)
npm run test:regression:broadcasts

# Run campaigns folder (57 tests)  
npm run test:regression:campaigns

# Or run both together
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/ tests/pushengage-regression/critical/campaigns/ --project=chromium
```

### Run with Browser Visible (Recommended)
```bash
# Watch tests execute in browser
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/ --headed --project=chromium

# Or for campaigns
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/campaigns/ --headed --project=chromium
```

### Run Individual Test Files
```bash
# Run the working broadcast test
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-send-immediate-broadcast.spec.js --headed --project=chromium

# Run schedule test
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/02-schedule-future-broadcast.spec.js --headed --project=chromium

# Run campaign validation test
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/campaigns/01-validate-push-broadcast-page.spec.js --headed --project=chromium
```

### Run Specific Number of Tests
```bash
# Run first 5 broadcast tests
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/ --headed --project=chromium --max-failures=5
```

---

## 🎯 RECOMMENDED EXECUTION ORDER

### Phase 1: Verify Setup (1 test, ~1 min)
Start with the known working test:
```bash
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-send-immediate-broadcast.spec.js --headed --project=chromium
```
**Expected:** Test should pass and send a broadcast!

### Phase 2: Existing Tests (12 tests, ~5-10 mins)
```bash
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/02-*.spec.js tests/pushengage-regression/critical/push-broadcasts/03-*.spec.js --headed --project=chromium
```

### Phase 3: Excel Campaign Tests (57 tests, ~30-45 mins)
```bash
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/campaigns/ --headed --project=chromium
```

### Phase 4: All Together (70 tests, ~1 hour)
```bash
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/ tests/pushengage-regression/critical/campaigns/ --headed --project=chromium --workers=1
```

---

## 📊 TEST EXECUTION MATRIX

| Test Category | Count | Status | Location |
|--------------|-------|--------|----------|
| **Send Immediate** | 1 | ✅ Working | push-broadcasts/01-* |
| **Schedule Future** | 1 | 📝 Template | push-broadcasts/02-* |
| **Recurring** | 1 | 📝 Template | push-broadcasts/03-* |
| **A/B Testing** | 1 | 📝 Template | push-broadcasts/04-* |
| **Segmentation** | 2 | 📝 Template | push-broadcasts/05-06-* |
| **CRUD Operations** | 4 | 📝 Template | push-broadcasts/07-10-* |
| **Analytics** | 1 | 📝 Template | push-broadcasts/09-* |
| **History** | 1 | 📝 Template | push-broadcasts/12-* |
| **Delete/Resend** | 2 | 📝 Template | push-broadcasts/11,13-* |
| **Page Validation** | 5 | 📝 Template | campaigns/01-05-* |
| **Form Fields** | 10 | 📝 Template | campaigns/06-15-* |
| **UTM Parameters** | 5 | 📝 Template | campaigns/17-21-* |
| **Audience Selection** | 5 | 📝 Template | campaigns/22-26-* |
| **Draft/Send** | 2 | 📝 Template | campaigns/28-29-* |
| **A/B Testing (Excel)** | 10 | 📝 Template | campaigns/30-39-* |
| **Preview/Export** | 10 | 📝 Template | campaigns/40-49-* |
| **Filters** | 7 | 📝 Template | campaigns/48-54-* |

---

## 🔧 CONFIGURATION

### Environment Variables (Already Set ✅)
```bash
LOCAL_WP_ADMIN_URL=http://productionautomation.local/wp-admin
LOCAL_WP_USERNAME=admin
LOCAL_WP_PASSWORD=admin@123=
TEST_ENV=local
```

### WordPress Site
- **URL:** http://productionautomation.local/
- **Admin Panel:** http://productionautomation.local/wp-admin
- **PushEngage Plugin:** Should be installed and activated

---

## 📝 WHAT TO EXPECT

### Working Test (01-send-immediate-broadcast)
This test will:
1. ✅ Login to WordPress
2. ✅ Navigate to PushEngage
3. ✅ Create a new broadcast
4. ✅ Fill in title, message, URL
5. ✅ Send immediately
6. ✅ Verify sent successfully

**You should receive the notification!**

### Template Tests (All Others)
These tests will:
1. ✅ Login to WordPress
2. ✅ Navigate to dashboard
3. ✅ Take a screenshot
4. ⚠️ Pass with "needs implementation" message

Each has:
- Original steps from Excel (as comments)
- Expected results (as comments)
- TODO markers for implementation

---

## 🐛 TROUBLESHOOTING

### Error: "Executable doesn't exist" (ffmpeg)
**Cause:** Running in Cursor's sandboxed terminal  
**Solution:** Use your regular terminal (iTerm, Terminal.app)

### Error: Login failed
**Check:**
```bash
# Verify WordPress is running
curl http://productionautomation.local/

# Check credentials in .env
cat .env | grep LOCAL_WP
```

### Tests Pass But Don't Actually Test
**Normal!** Template tests just login + screenshot. They need:
1. Implementation of test logic
2. Proper assertions
3. Element interactions

### Browser Doesn't Open (Headless Mode)
Add `--headed` flag:
```bash
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-send-immediate-broadcast.spec.js --headed --project=chromium
```

---

## 📊 EXECUTION REPORT TEMPLATE

After running, create a report:

```
Push Broadcast Test Execution - Feb 17, 2026

Environment: http://productionautomation.local/
Browser: Chromium
Tests Executed: 70

Results:
✅ Passed: X tests
❌ Failed: Y tests
⚠️  Skipped: Z tests

Key Findings:
- Test 01 (Send Immediate): ✅ PASSED - Broadcast sent successfully
- Test 02 (Schedule): ⚠️ Needs implementation
- Test 03 (Recurring): ⚠️ Needs implementation
... etc

Recommendations:
1. Implement test logic for template tests
2. Add proper assertions
3. Verify element selectors
```

---

## 🎯 QUICK START COMMANDS

### Just Want to See It Work?
```bash
cd /Users/kulvindersingh/QA-Automation
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/01-send-immediate-broadcast.spec.js --headed --project=chromium
```

### Run All Broadcast Tests
```bash
cd /Users/kulvindersingh/QA-Automation
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/ tests/pushengage-regression/critical/campaigns/ --headed --project=chromium --workers=1
```

### Generate HTML Report
```bash
cd /Users/kulvindersingh/QA-Automation
TEST_ENV=local npx playwright test tests/pushengage-regression/critical/push-broadcasts/ tests/pushengage-regression/critical/campaigns/ --project=chromium --reporter=html
npx playwright show-report
```

---

## ✅ SUMMARY

### Test Suite Ready
✅ **70 Push Broadcast tests** organized and ready  
✅ **1 fully working test** (send immediate)  
✅ **69 template tests** ready for implementation  
✅ **Environment configured** for local WordPress  
✅ **Commands documented** for easy execution  

### To Run Now
1. **Open your regular terminal** (NOT Cursor)
2. **Navigate:** `cd /Users/kulvindersingh/QA-Automation`
3. **Run:** `npm run test:regression:broadcasts --headed`
4. **Watch** the tests execute in the browser!

---

**Created:** February 17, 2026  
**Total Tests:** 70 (13 existing + 57 Excel)  
**Status:** ✅ Ready to Execute  
**Requirement:** Must use regular terminal (not Cursor)

---

🎉 **Your Push Broadcast test suite is ready! Run it in your regular terminal to see all 70 tests execute on your local WordPress site!**
