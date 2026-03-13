# PushEngage App Dashboard Tests - Quick Reference

## 🚀 Getting Started (3 Steps)

### 1. Setup Environment
```bash
# Create .env file with credentials
cat > .env << 'EOF'
APP_DASHBOARD_URL=https://app.pushengage.com
APP_USERNAME=kgosal@awesomemotive.com
APP_PASSWORD=KGs0911@PE
TEST_SITE=AutomationTesting
EOF
```

### 2. Run Tests
```bash
# Make script executable (first time only)
chmod +x run-app-dashboard-tests.sh

# Run critical tests (recommended first run)
./run-app-dashboard-tests.sh -m critical -h
```

### 3. View Results
```bash
# Open HTML report
npx playwright show-report test-results/app-dashboard-report
```

---

## 📊 Test Suite Overview

| Metric | Count |
|--------|-------|
| **Total Tests** | 85 |
| **Critical (P0)** | 24 |
| **High (P1)** | 20 |
| **Medium (P2)** | 20 |
| **Low (P3)** | 21 |
| **Modules** | 9 |

---

## 🎯 Common Commands

```bash
# Run all tests
./run-app-dashboard-tests.sh

# Run by priority
./run-app-dashboard-tests.sh -m critical
./run-app-dashboard-tests.sh -m high

# Run by module
./run-app-dashboard-tests.sh -m login
./run-app-dashboard-tests.sh -m dashboard
./run-app-dashboard-tests.sh -m campaign
./run-app-dashboard-tests.sh -m design
./run-app-dashboard-tests.sh -m audience
./run-app-dashboard-tests.sh -m analytics
./run-app-dashboard-tests.sh -m site-settings
./run-app-dashboard-tests.sh -m chat-widgets
./run-app-dashboard-tests.sh -m publisher

# Run with browser visible
./run-app-dashboard-tests.sh -m dashboard -h

# Debug mode
./run-app-dashboard-tests.sh -m login -d

# UI mode (interactive)
./run-app-dashboard-tests.sh --ui
```

---

## 📁 Project Structure

```
tests/app-dashboard/
├── critical/    # P0 - 24 tests
├── high/        # P1 - 20 tests
├── medium/      # P2 - 20 tests
├── low/         # P3 - 21 tests
└── utils/       # Helper functions
    ├── app-auth.js      # Login/logout
    ├── app-helpers.js   # UI helpers
    └── config.js        # Configuration
```

---

## 🔍 Module Breakdown

| Module | Tests | Description |
|--------|-------|-------------|
| **Login** | 4 | Authentication & sessions |
| **Dashboard** | 11 | Main dashboard UI & stats |
| **Campaign** | 16 | Push, Drip, Triggered, RSS |
| **Design** | 12 | Modals, Widgets, Targeting |
| **Audience** | 16 | Subscribers, Segments, Groups |
| **Analytics** | 12 | Overview, Opt-in, Goals |
| **Site Settings** | 16 | Details, Install, Defaults |
| **Chat Widgets** | 8 | Widget management |
| **Publisher** | 4 | Publisher features |

---

## 📚 Documentation

| File | Description |
|------|-------------|
| `APP_DASHBOARD_TESTS.md` | Complete project overview |
| `tests/app-dashboard/README.md` | Detailed usage guide |
| `tests/app-dashboard/SUMMARY.md` | Executive summary |
| `QUICK_REFERENCE.md` | This file |

---

## ⚙️ Configuration Files

| File | Purpose |
|------|---------|
| `playwright-app-dashboard.config.js` | Playwright configuration |
| `.env` | Credentials and settings |
| `run-app-dashboard-tests.sh` | Test execution script |

---

## 🛠️ Helper Functions

### Authentication
- `loginToAppDashboard(page, username, password)`
- `isLoggedIn(page)`
- `logoutFromAppDashboard(page)`

### Navigation
- `navigateToPage(page, pageName)`
- `selectSite(page, siteName)`
- `openHamburgerMenu(page)`

### UI Interaction
- `checkElementExists(page, selectors, elementName)`
- `clickElement(page, selectors, elementName)`
- `fillFormField(page, selectors, value, fieldName)`
- `closeModalIfPresent(page)`

### Utilities
- `waitForPageLoad(page)`
- `takeScreenshot(page, name)`
- `getTextContent(page, selectors)`
- `verifyDashboardMetrics(page)`

---

## 🐛 Debugging

```bash
# Debug specific test
npx playwright test --config=playwright-app-dashboard.config.js --debug \
  tests/app-dashboard/critical/login/01-valid-login.spec.js

# View trace
npx playwright show-trace test-results/.../trace.zip

# Screenshots location
ls screenshots/app-dashboard/
```

---

## ✅ Test Execution Checklist

- [ ] Environment variables configured (`.env`)
- [ ] Playwright installed globally
- [ ] Browsers installed (`playwright install`)
- [ ] Script made executable (`chmod +x`)
- [ ] Critical tests pass
- [ ] HTML report reviewed

---

## 🎯 Recommended Test Flow

### For Development
```bash
# 1. Quick smoke test (5-10 min)
./run-app-dashboard-tests.sh -m critical

# 2. Module-specific testing (as needed)
./run-app-dashboard-tests.sh -m campaign -h
```

### For CI/CD
```bash
# Smoke test on every commit
./run-app-dashboard-tests.sh -m critical

# Full regression nightly/weekly
./run-app-dashboard-tests.sh
```

---

## 📊 Test Results

After running tests, check:

1. **Console Output**: Pass/fail summary
2. **HTML Report**: Detailed results with screenshots
3. **Screenshots**: `screenshots/app-dashboard/*.png`
4. **Videos**: On failures in `test-results/`

---

## 🎉 Quick Wins

```bash
# See all available tests
find tests/app-dashboard -name "*.spec.js" | sort

# Count tests by priority
find tests/app-dashboard/critical -name "*.spec.js" | wc -l

# Run single test file
npx playwright test --config=playwright-app-dashboard.config.js \
  tests/app-dashboard/critical/login/01-valid-login.spec.js
```

---

## 📞 Support

Need help? Check:
1. `tests/app-dashboard/README.md` - Full documentation
2. Test logs and screenshots
3. HTML report for detailed errors
4. QA team contact

---

## 🔑 Key Features

✅ **85 comprehensive tests**  
✅ **4 priority levels**  
✅ **9 modules covered**  
✅ **Uses global Playwright**  
✅ **Separate from WP plugin tests**  
✅ **AutomationTesting site configured**  
✅ **Complete documentation**  
✅ **Ready to run!**

---

**Last Updated**: March 2026  
**Version**: 1.0  
**Status**: Production Ready ✅
