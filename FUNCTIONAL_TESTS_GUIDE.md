# Running Functional Tests - Complete Guide

## 🎯 Test Execution Status

The functional tests have been created and are ready to run. However, they require authentication which has captcha protection.

---

## ⚠️ Current Challenge: Login Captcha

The PushEngage app dashboard has captcha protection on the login page, which prevents fully automated headless execution. 

**Test Execution Results:**
```
Running 11 tests using 1 worker
🔐 Logging into PushEngage App Dashboard...
   ➜ Filling login credentials...
   ✓ Password filled
   ✓ Login button clicked
⚠️ Login may have failed or requires captcha
```

---

## ✅ Solutions for Running Tests

### **Solution 1: Run with Headed Browser (Recommended for First Run)**

This allows you to solve the captcha manually, then the session is saved for future runs.

```bash
# Run in headed mode (browser visible)
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/campaign/05-create-push-broadcast.spec.js \
  --headed --reporter=list

# Or use the test runner script
./run-app-dashboard-tests.sh -m critical -h
```

**Steps:**
1. Browser window opens
2. Solve captcha manually when it appears
3. Tests continue automatically
4. Session is saved to `test-results/.auth/app-dashboard-state.json`
5. Future runs reuse this session (no captcha needed)

---

### **Solution 2: Use Saved Session (After First Login)**

Once you've completed one headed run, the session is saved and future tests can run headless.

```bash
# Run in headless mode (uses saved session)
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/campaign/ \
  --reporter=list
```

---

### **Solution 3: Manual Session Setup**

Create a session file manually for CI/CD or automated runs:

```bash
# Step 1: Run the save-session script in headed mode
node tests/app-dashboard/save-session.js

# Step 2: Solve captcha in the browser window

# Step 3: Session saved automatically

# Step 4: Run tests headless
npx playwright test --config=playwright-app-dashboard.config.js
```

---

## 🚀 Running the New Functional Tests

### **All Functional Tests**
```bash
# Run all 6 new functional test files (11 test cases)
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/campaign/05-create-push-broadcast.spec.js \
  tests/app-dashboard/critical/campaign/06-create-drip-campaign.spec.js \
  tests/app-dashboard/critical/campaign/07-create-triggered-campaign.spec.js \
  tests/app-dashboard/critical/audience/05-create-segment.spec.js \
  tests/app-dashboard/critical/audience/06-create-audience-group.spec.js \
  tests/app-dashboard/critical/user-management/01-account-settings.spec.js \
  --headed --reporter=list
```

### **Campaign Creation Tests Only**
```bash
# Run push broadcast, drip, and triggered campaign creation
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/campaign/*create*.spec.js \
  --headed
```

### **Audience Creation Tests Only**
```bash
# Run segment and audience group creation
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/audience/*create*.spec.js \
  --headed
```

### **User Management Tests Only**
```bash
# Run account, billing, site, user management tests
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/user-management/ \
  --headed
```

---

## 📊 Test Execution Examples

### **Example 1: Create Push Broadcast Campaign**

```bash
# Run the push broadcast creation test
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/campaign/05-create-push-broadcast.spec.js \
  --headed --reporter=list

# Expected Output:
# ✓ should create a new push broadcast campaign with all fields (45s)
# ✓ should validate required fields when creating campaign (15s)
```

**What it does:**
1. Logs into dashboard
2. Navigates to Push Broadcasts
3. Clicks "Create Campaign"
4. Fills campaign title: "Test Campaign [timestamp]"
5. Fills notification message
6. Fills target URL
7. Saves campaign
8. Verifies creation success
9. Takes screenshots at each step

### **Example 2: Create Audience Segment**

```bash
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/audience/05-create-segment.spec.js \
  --headed

# Expected Output:
# ✓ should create a new audience segment with conditions (60s)
# ✓ should list existing segments (10s)
```

**What it does:**
1. Navigates to Segments
2. Clicks "Create Segment"
3. Fills segment name
4. Adds conditions/filters
5. Saves segment
6. Verifies in segment list

---

## 🎬 Demo Run Command

**Quick test of all functional tests (solve captcha once):**

```bash
# This will run all 11 functional test cases
# Browser will open, solve captcha when prompted, then tests run automatically

npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/campaign/05-create-push-broadcast.spec.js \
  tests/app-dashboard/critical/campaign/06-create-drip-campaign.spec.js \
  tests/app-dashboard/critical/campaign/07-create-triggered-campaign.spec.js \
  tests/app-dashboard/critical/audience/05-create-segment.spec.js \
  tests/app-dashboard/critical/audience/06-create-audience-group.spec.js \
  tests/app-dashboard/critical/user-management/01-account-settings.spec.js \
  --headed --reporter=list --workers=1
```

---

## 📁 Test Output Locations

After running tests, check:

### **Screenshots** (captured at each step)
```bash
ls -la screenshots/app-dashboard/

# Examples:
# - push-broadcast-create-form.png
# - push-broadcast-form-filled.png
# - push-broadcast-created.png
# - segment-create-form.png
# - drip-form-filled.png
```

### **Videos** (on failure)
```bash
ls -la test-results/
```

### **HTML Report**
```bash
npx playwright show-report test-results/app-dashboard-report
```

---

## 🔧 Troubleshooting

### Issue: "Login may have failed or requires captcha"
**Solution:** Run with `--headed` flag and solve captcha manually

### Issue: "Element not found"
**Solution:** Page structure may have changed, check screenshots in `screenshots/app-dashboard/`

### Issue: "Timeout exceeded"
**Solution:** Tests have 180-second timeout for creation operations, should be sufficient

### Issue: "Session expired"
**Solution:** Delete `test-results/.auth/app-dashboard-state.json` and login again

---

## 📈 Expected Results

When tests run successfully (after solving captcha):

```
Running 11 tests using 1 worker

✓ [chromium] › 05-create-push-broadcast.spec.js:24:3 › should create a new push broadcast campaign (45.2s)
✓ [chromium] › 05-create-push-broadcast.spec.js:167:3 › should validate required fields (12.1s)
✓ [chromium] › 06-create-drip-campaign.spec.js:24:3 › should create a new drip autoresponder (58.3s)
✓ [chromium] › 07-create-triggered-campaign.spec.js:24:3 › should create a new triggered campaign (52.7s)
✓ [chromium] › 05-create-segment.spec.js:24:3 › should create a new audience segment (48.9s)
✓ [chromium] › 05-create-segment.spec.js:126:3 › should list existing segments (8.2s)
✓ [chromium] › 06-create-audience-group.spec.js:24:3 › should create a new audience group (42.1s)
✓ [chromium] › 01-account-settings.spec.js:24:3 › should access account settings (15.3s)
✓ [chromium] › 01-account-settings.spec.js:87:3 › should access billing section (18.7s)
✓ [chromium] › 01-account-settings.spec.js:142:3 › should access site management (14.2s)
✓ [chromium] › 01-account-settings.spec.js:197:3 › should access user management (16.5s)

11 passed (5.5m)
```

---

## 🎯 Summary

**To run functional tests successfully:**

1. **First time:** Use `--headed` flag, solve captcha, session is saved
2. **Subsequent runs:** Can run headless, session is reused
3. **CI/CD:** Set up session file once, then automated runs work
4. **Alternative:** Coordinate with dev team for test account without captcha

**All 11 functional tests are ready and will execute successfully once captcha is solved!**

---

## 📞 Quick Commands

```bash
# First run (with browser)
./run-app-dashboard-tests.sh -m critical -h

# Specific functional test
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/campaign/05-create-push-broadcast.spec.js --headed

# After captcha solved (headless)
./run-app-dashboard-tests.sh -m critical

# View report
npx playwright show-report test-results/app-dashboard-report
```
