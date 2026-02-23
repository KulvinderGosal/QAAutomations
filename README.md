# 🧪 PushEngage QA Automation Framework

Automated testing framework for PushEngage WordPress plugin using Playwright. This framework enables comprehensive QA testing with minimal manual intervention.

## 📋 Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Test Suites](#test-suites)
- [CI/CD Integration](#cicd-integration)
- [Test Reports](#test-reports)
- [Commands Reference](#commands-reference)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

- ✅ **605 Regression Test Cases** - Comprehensive test coverage organized by priority
- 🎯 **Priority-Based Testing** - Critical, High, Medium, Low priority levels
- 🔍 **Plugin Discovery & Validation** - Automatically finds and verifies plugin
- 🌐 **Multi-Browser Testing** - Chrome, Firefox, Safari support
- 📊 **Detailed Reports** - HTML, JSON, and JUnit XML outputs
- 🎥 **Video & Screenshot Capture** - Automatic capture on failures
- 🚀 **CI/CD Ready** - GitHub Actions workflow included
- 🔐 **Secure Credentials** - Environment variable based configuration
- ⚡ **Fast Execution** - Parallel test execution support
- 🎯 **Extensible** - Easy to add custom tests

---

## 🚀 Quick Start

### Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- Access to WordPress staging environment

### 1. Clone the Repository

```bash
git clone https://github.com/KulvinderGosal/QAAutomations.git
cd QAAutomations
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
WP_ADMIN_URL=https://qastaging.pushengage.com/admin
WP_USERNAME=kgosal
WP_PASSWORD=!letmeIn@123=
PLUGIN_NAME=PushEngage
PLUGIN_SEARCH_TERM=pushengage
```

### 4. Run Tests

```bash
# Run regression tests by priority
npm run test:regression:critical      # 245 critical tests (~45 min)
npm run test:regression:high          # 181 high priority tests (~35 min)
npm run test:regression:all           # All 605 tests (~2 hours)

# Run with visible browser
npm run test:regression:critical:headed
```

---

## 📊 Test Suite Overview

This framework contains **605 comprehensive regression tests** organized by priority:

| Priority | Tests | Description | Run Time |
|----------|-------|-------------|----------|
| **Critical (P0)** | 245 | Must-pass core functionality | ~45 min |
| **High (P1)** | 181 | Important features | ~35 min |
| **Medium (P2)** | 136 | Standard features | ~25 min |
| **Low (P3)** | 43 | Nice-to-have features | ~10 min |
| **TOTAL** | **605** | Complete coverage | ~2 hours |

### Test Organization

```
tests/pushengage-regression/
├── critical/        # 245 tests - Core functionality
│   ├── campaigns/              # 57 tests
│   ├── dashboard/              # 53 tests
│   ├── installation/           # 16 tests
│   ├── onboarding/             # 41 tests
│   ├── push-broadcasts/        # 18 tests
│   ├── settings-core/          # 9 tests
│   └── settings-excel/         # 50 tests
├── high/            # 181 tests - Important features
│   ├── audience/               # 48 tests
│   ├── drip/                   # 52 tests
│   ├── triggers/               # 11 tests
│   └── ... 5 more folders
├── medium/          # 136 tests - Standard features
│   ├── analytics/              # 44 tests
│   ├── design/                 # 42 tests
│   └── ... 9 more folders
└── low/             # 43 tests - Edge cases
    ├── about/                  # 14 tests
    ├── help/                   # 6 tests
    └── ... 5 more folders
```

For complete details, see [Regression Test Suite Documentation](tests/pushengage-regression/README.md).

---

## 📦 Installation

### Step 1: Install Node.js

If you don't have Node.js installed:

```bash
# macOS (using Homebrew)
brew install node

# Ubuntu/Debian
sudo apt-get install nodejs npm

# Windows (using Chocolatey)
choco install nodejs
```

### Step 2: Clone Repository

```bash
git clone https://github.com/KulvinderGosal/QAAutomations.git
cd QAAutomations
```

### Step 3: Install Dependencies

```bash
npm install
```

This will install:
- `@playwright/test` - Testing framework
- `dotenv` - Environment variable management
- All required dependencies

### Step 4: Install Playwright Browsers

```bash
npx playwright install
```

This downloads and installs Chromium, Firefox, and WebKit browsers (~600MB).

---

## 🔧 Configuration

### Environment Variables

Create/edit `.env` file:

```env
# WordPress Admin Credentials (REQUIRED)
WP_ADMIN_URL=https://qastaging.pushengage.com/admin
WP_USERNAME=kgosal
WP_PASSWORD=!letmeIn@123=

# Plugin Configuration (REQUIRED)
PLUGIN_NAME=PushEngage
PLUGIN_SEARCH_TERM=pushengage

# Test Configuration (OPTIONAL)
TEST_TIMEOUT=30000              # Test timeout in ms
HEADLESS=true                   # Run in headless mode
BROWSER=chromium                # Default browser

# Report Paths (OPTIONAL)
REPORT_PATH=./test-results
SCREENSHOT_PATH=./screenshots
VIDEO_PATH=./videos
```

### Directory Structure

```
QA-Automation/
├── .github/
│   └── workflows/
│       └── smoke-tests.yml          # GitHub Actions CI/CD
├── tests/
│   ├── smoke/
│   │   └── general-smoke-test.spec.js
│   ├── wordpress-plugin/
│   │   └── plugin-smoke-test.spec.js
│   └── utils/
│       ├── auth.js                  # Login utilities
│       └── config.js                # Configuration loader
├── test-results/                    # Test artifacts (auto-generated)
│   ├── index.html                   # HTML report
│   ├── results.json                 # JSON results
│   └── junit.xml                    # JUnit report
├── .env.example                     # Environment template
├── .env                             # Actual credentials (git-ignored)
├── playwright.config.js             # Playwright configuration
├── run-tests.sh                     # Test runner script
├── package.json                     # Dependencies
└── README.md                        # This file
```

---

## 🧪 Running Tests

### Using the Bash Script (Recommended)

```bash
# Show help
./run-tests.sh --help

# Run all tests
./run-tests.sh all

# Run smoke tests only
./run-tests.sh smoke

# Run plugin tests only
./run-tests.sh plugin

# Run with visible browser (good for debugging)
./run-tests.sh headed

# Run in debug mode (step-by-step)
./run-tests.sh debug

# Run on specific browser
./run-tests.sh chrome
./run-tests.sh firefox
./run-tests.sh webkit

# View test report
./run-tests.sh all --report
```

### Using npm Scripts

```bash
# Run all tests
npm run test

# Run with visible browser
npm run test:headed

# Run in debug mode
npm run test:debug

# Run specific suites
npm run test:smoke
npm run test:wordpress-plugin

# Run on specific browser
npm run test:chrome
npm run test:firefox
npm run test:webkit

# Show HTML report
npm run report
```

### Using Playwright CLI Directly

```bash
# Basic test run
npx playwright test

# With options
npx playwright test --headed --workers=1 --debug

# Specific test file
npx playwright test plugin-smoke-test.spec.js

# Specific test case
npx playwright test -g "Search for PushEngage"

# Generate test code from browser
npx playwright codegen https://qastaging.pushengage.com/admin
```

---

## 📝 Test Suites

### 1. General Smoke Tests (`tests/smoke/`)

Basic WordPress functionality tests:

- ✅ Admin Dashboard Loads
- ✅ Navigation Menu Works
- ✅ Posts Page Accessible
- ✅ Pages Page Accessible
- ✅ Users Page Accessible
- ✅ Settings Page Accessible
- ✅ No Fatal PHP Errors
- ✅ Page Load Performance
- ✅ Logout Functionality

**Run:**
```bash
npm run test:smoke
```

### 2. WordPress Plugin Tests (`tests/wordpress-plugin/`)

PushEngage plugin-specific tests:

- ✅ Login to WordPress Admin
- ✅ Navigate to Plugins Page
- ✅ **Search for PushEngage Plugin**
- ✅ Verify Plugin Information Display
- ✅ Check Plugin Status (Active/Inactive)
- ✅ Verify Plugin Actions (Activate/Deactivate)
- ✅ Navigate to Plugin Settings
- ✅ Verify No Plugin Errors
- ✅ Check Plugin Compatibility
- ✅ Verify No JavaScript Console Errors

**Run:**
```bash
npm run test:wordpress-plugin
```

---

## 🔄 CI/CD Integration

### GitHub Actions

Automatic tests run on:
- Push to `main`, `staging`, `develop` branches
- Pull requests to these branches
- Daily schedule at 2 AM UTC
- Manual trigger via workflow dispatch

#### Setup GitHub Secrets

In your GitHub repository, add these secrets:

1. Go to **Settings → Secrets and variables → Actions**
2. Add these secrets:

| Secret Name | Value |
|---|---|
| `WP_ADMIN_URL` | `https://qastaging.pushengage.com/admin` |
| `WP_USERNAME` | Your WordPress username |
| `WP_PASSWORD` | Your WordPress password |
| `PLUGIN_NAME` | `PushEngage` |
| `PLUGIN_SEARCH_TERM` | `pushengage` |

#### View Test Results

1. Go to **Actions** tab in your repository
2. Click on the workflow run
3. Check "Artifacts" for test results, videos, and screenshots

#### Troubleshooting CI/CD

If tests fail in GitHub Actions:

```bash
# Check logs in Actions tab
# Download artifacts to see videos/screenshots
# Common issues:
# - Network connectivity to staging environment
# - Invalid credentials in secrets
# - WordPress environment down
```

---

## 📊 Test Reports

### HTML Report (Interactive)

After tests complete:

```bash
npm run report
```

This opens an interactive HTML report showing:
- All test results with pass/fail status
- Execution time per test
- Console logs and errors
- Screenshots of failures
- Video recordings of failures

### JSON Report

Located at: `test-results/results.json`

Contains:
- Detailed test metadata
- Pass/fail results
- Execution times
- Error messages

### JUnit Report

Located at: `test-results/junit.xml`

Useful for CI/CD integration with Jenkins, GitLab CI, etc.

### Screenshots & Videos

- **Screenshots**: `test-results/screenshots/` (on failure only)
- **Videos**: `test-results/videos/` (on failure only)

---

## 📋 Commands Reference

### Installation & Setup

```bash
npm install                        # Install all dependencies
npx playwright install             # Install browsers
```

### Running Tests

```bash
./run-tests.sh all                 # Run all tests (bash script)
./run-tests.sh smoke               # Run smoke tests
./run-tests.sh plugin              # Run plugin tests
./run-tests.sh headed              # Run with visible browser
./run-tests.sh debug               # Run in debug mode
./run-tests.sh chrome              # Run on Chrome only
./run-tests.sh --help              # Show help
```

### NPM Scripts

```bash
npm run test                       # Run all tests
npm run test:headed               # Run with visible browser
npm run test:debug                # Run in debug mode
npm run test:smoke                # Run smoke tests
npm run test:wordpress-plugin     # Run plugin tests
npm run test:chrome               # Run on Chrome
npm run test:firefox              # Run on Firefox
npm run test:webkit               # Run on Safari
npm run report                    # Show HTML report
npm run codegen                   # Record new tests
```

### Direct Playwright Commands

```bash
npx playwright test                           # Run all tests
npx playwright test --headed                  # With visible browser
npx playwright test --debug                   # Step-by-step debugging
npx playwright test --workers=1               # Sequential execution
npx playwright test -g "plugin"               # Run tests matching pattern
npx playwright test plugin-smoke-test.spec.js # Run specific file
npx playwright show-report                    # Show report
npx playwright codegen <url>                  # Record tests
```

---

## 🐛 Troubleshooting

### Issue: Tests can't login

**Symptoms**: "Login failed" error

**Solutions**:
```bash
# 1. Check .env credentials
cat .env

# 2. Verify credentials are correct
# Try logging in manually to https://qastaging.pushengage.com/admin

# 3. Check network connectivity
ping qastaging.pushengage.com

# 4. Run in headed mode to see what's happening
./run-tests.sh headed
```

### Issue: Tests timeout

**Symptoms**: "Timeout waiting for element"

**Solutions**:
```bash
# 1. Increase timeout in .env
echo "TEST_TIMEOUT=60000" >> .env

# 2. Run specific failing test with debug
npx playwright test plugin-smoke-test.spec.js --headed --debug

# 3. Check if staging server is responding slowly
curl -I https://qastaging.pushengage.com/admin
```

### Issue: Playwright browsers not installed

**Symptoms**: "Error: Executable doesn't exist"

**Solutions**:
```bash
# Reinstall browsers
npx playwright install

# Or install with system dependencies
npx playwright install --with-deps
```

### Issue: Permission denied on run-tests.sh

**Symptoms**: "./run-tests.sh: Permission denied"

**Solutions**:
```bash
# Make script executable
chmod +x run-tests.sh

# Then run
./run-tests.sh all
```

### Issue: Tests fail on CI/CD but pass locally

**Symptoms**: Tests pass locally but fail in GitHub Actions

**Solutions**:
```bash
# 1. Check if staging environment is accessible from CI
# 2. Verify all GitHub secrets are set correctly
# 3. Check if IP is whitelisted on staging server
# 4. Run tests in headed mode locally to replicate CI env
npm run test:headed
```

### Issue: Can't find PushEngage plugin

**Symptoms**: "Plugin not found in search results"

**Solutions**:
```bash
# 1. Verify plugin name in .env
cat .env | grep PLUGIN

# 2. Check if plugin is actually installed
# Log in manually and check Plugins page

# 3. Update search term
PLUGIN_SEARCH_TERM=pushengage npm run test:wordpress-plugin

# 4. Run with headed mode to see search results
./run-tests.sh headed
```

---

## 📚 Further Reading

### Framework Documentation
- **[Quick Start Guide](docs/QUICK_START.md)** - Get started implementing stub tests in 5 minutes
- **[Implementation Guide](docs/FULL_REGRESSION_IMPLEMENTATION_GUIDE.md)** - Comprehensive patterns and templates
- **[Progress Tracker](docs/IMPLEMENTATION_PROGRESS.md)** - Current implementation status and roadmap
- **[Test Coverage Report](docs/TEST_COVERAGE_REPORT.md)** - Complete test inventory and breakdown

### External Resources
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Test Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Testing Best Practices](https://playwright.dev/docs/best-practices)

---

## 🚀 Full Regression Implementation

### Current Status
- **Total Tests**: 615 tests
- **Implemented**: 37 tests (6%)
- **Remaining**: 578 stub tests (94%)

### Implementation Phases

| Phase | Priority | Tests | Status | Timeline |
|-------|----------|-------|--------|----------|
| **Phase 1** | CRITICAL | 201 tests | 🟡 2% | 3 weeks |
| **Phase 2** | HIGH | 160 tests | ⚪ 0% | 3 weeks |
| **Phase 3** | MEDIUM/LOW | 224 tests | ⚪ 0% | 4 weeks |

### Quick Start for Developers

```bash
# 1. Review examples
cat docs/QUICK_START.md

# 2. See what needs to be implemented
node scripts/convert-stub-tests.js

# 3. Pick a stub test and implement using patterns
# See docs/FULL_REGRESSION_IMPLEMENTATION_GUIDE.md

# 4. Run your test
npx playwright test tests/pushengage-regression/critical/campaigns/YOUR-TEST.spec.js

# 5. Commit when passing
git add . && git commit -m "✅ Implement QAWPREG### - test description"
```

### Resources for Implementation Team
- **Patterns Library**: Copy-paste code patterns for all test types
- **Example Tests**: 4 fully implemented examples to follow
- **Helper Scripts**: Automated test discovery and conversion tools
- **Progress Tracking**: Daily/weekly progress dashboards

See [QUICK_START.md](docs/QUICK_START.md) for complete implementation instructions.

---

## 📝 License

MIT License - feel free to modify and reuse

## 👥 Author & Contributors

**Kulvinder Singh**  
Senior QA Automation Engineer  
📧 Email: [kgosal@awesomemotive.com](mailto:kgosal@awesomemotive.com)  
📞 Phone: +91 9779290090

### Contributors
- QA Team
- Development Team

## 📞 Support

For issues, questions, or support:

- **Email**: kgosal@awesomemotive.com
- **Phone**: +91 9779290090
- **GitHub Issues**: [Open an issue](https://github.com/KulvinderGosal/QAAutomations/issues)
- **Repository**: https://github.com/KulvinderGosal/QAAutomations

---

## 🎯 Next Steps

1. ✅ Configure `.env` with your credentials
2. ✅ Run `npm install`
3. ✅ Run `npx playwright install`
4. ✅ Execute `./run-tests.sh smoke`
5. ✅ Review test reports in `test-results/`
6. ✅ Set up GitHub Secrets for CI/CD
7. ✅ Push to trigger automated tests

---

**Last Updated**: February 21, 2026
