# PushEngage App Dashboard Test Suite - Quick Start Guide

## 🎯 Overview

I've created a comprehensive test suite for the PushEngage App Dashboard with **7 test files** covering **~35 test cases** for the Dashboard feature.

## 📁 What Was Created

### Test Files (Dashboard Feature)
```
tests/pushengage-app/
├── dashboard/
│   ├── 01-dashboard-ui-elements.spec.js       # 7 tests - UI validation
│   ├── 02-dashboard-metrics.spec.js           # 8 tests - Metrics & stats
│   ├── 03-dashboard-charts.spec.js            # 3 tests - Charts & graphs  
│   ├── 04-dashboard-recent-notifications.spec.js  # 3 tests - Recent notifications
│   ├── 05-dashboard-strategies.spec.js        # 3 tests - Strategies section
│   ├── 06-dashboard-demographic.spec.js       # 3 tests - Demographic overview
│   └── 07-dashboard-interactions.spec.js      # 6 tests - User interactions
├── utils/
│   ├── app-auth.js          # Authentication & session management
│   ├── app-helpers.js       # Helper functions for app interactions
│   └── config.js            # Configuration settings
├── save-session.js          # Script to capture authenticated session
├── global-setup.js          # Global test setup
└── README.md                # Comprehensive documentation
```

### Configuration Files
- `playwright-app.config.js` - Playwright config for app dashboard tests
- `.env` - Updated with app dashboard credentials

## 🚀 Getting Started

### Step 1: Save Your Authenticated Session

Since the login page has Cloudflare captcha protection, we need to save your authenticated session first:

```bash
npm run test:app:save-session
```

This will:
1. Open a Chrome browser
2. Navigate to the PushEngage login page
3. Wait for you to login manually (solve captcha)
4. Save your session for reuse by all tests

**Instructions:**
- Login with: `kgosal@awesomemotive.com` / `KGs0911@PE`
- Solve the captcha manually
- Wait until you see the dashboard
- Press ENTER in the terminal
- Session will be saved!

### Step 2: Run Dashboard Tests

Once the session is saved, you can run tests:

```bash
# Run all dashboard tests
npm run test:app:dashboard

# Run with browser visible
npm run test:app:dashboard:headed

# Run in debug mode
npm run test:app:dashboard:debug

# Run specific test file
npx playwright test tests/pushengage-app/dashboard/01-dashboard-ui-elements.spec.js --config=playwright-app.config.js
```

## 📊 Test Coverage - Dashboard Feature

### 1. UI Elements (CRITICAL)
✅ PushEngage logo  
✅ Site selector dropdown  
✅ Notification bell icon  
✅ User profile menu  
✅ Create Campaign button  
✅ Navigation menu items (8 items)  
✅ Campaign submenu items (4 items)  

### 2. Metrics & Statistics (CRITICAL)
✅ Total Subscribers  
✅ Notifications Sent  
✅ Views  
✅ Clicks  
✅ Goal Conversion  
✅ Metric values display  
✅ Previous period comparison  

### 3. Charts & Graphs (HIGH)
✅ Analytics chart display  
✅ Chart legend  
✅ Legend toggle functionality  

### 4. Recent Notifications (HIGH)
✅ Section display  
✅ "See More" button  
✅ Button click functionality  

### 5. Strategies Section (MEDIUM)
✅ Section display  
✅ Strategy cards  
✅ "See More" button  

### 6. Demographic Overview (MEDIUM)
✅ Section display  
✅ "View Full Report" button  
✅ Button click functionality  

### 7. User Interactions (HIGH)
✅ Create Campaign button click  
✅ Campaign type options  
✅ Site selector interaction  
✅ User profile menu  
✅ Menu options (My Account, Billing, etc.)  
✅ Sidebar navigation  

## 📈 Test Statistics

- **Total Test Files**: 7
- **Total Test Cases**: ~35
- **Priority Breakdown**:
  - CRITICAL: 15 tests
  - HIGH: 15 tests
  - MEDIUM: 5 tests

## 🔧 Helper Functions Available

### Authentication (`app-auth.js`)
```javascript
- loginToAppDashboard(page, config)
- isLoggedIn(page)
- logoutFromAppDashboard(page)
- getStorageStatePath()
```

### App Helpers (`app-helpers.js`)
```javascript
- navigateToPage(page, pageName)
- waitForPageLoad(page)
- selectSite(page, siteName)
- checkElementExists(page, selectors, elementName)
- clickCreateCampaign(page)
- closeModalIfPresent(page)
- getStatValue(page, statName)
- verifyDashboardMetrics(page)
```

## 📝 Environment Variables

Added to `.env`:
```env
APP_DASHBOARD_URL=https://app.pushengage.com
APP_USERNAME=kgosal@awesomemotive.com
APP_PASSWORD=KGs0911@PE
DEFAULT_SITE=Android.app
```

## 🎯 Next Steps

After dashboard tests are running successfully, we can add:

1. **Campaign Features**
   - Push Broadcasts
   - Drip Autoresponders
   - Triggered Campaigns
   - RSS Auto Push

2. **Design Features**
   - Opt-in customization
   - Templates
   - Branding

3. **Audience Management**
   - Subscribers
   - Segments
   - Attributes

4. **Analytics**
   - Reports
   - Performance metrics
   - Conversion tracking

5. **Site Settings**
   - Configuration
   - Integrations
   - API settings

6. **Chat Widgets**
   - Widget configuration
   - Customization

7. **Publisher**
   - Publisher settings
   - Configuration

## 📚 Documentation

Full documentation available in:
- `tests/pushengage-app/README.md` - Detailed test documentation
- `tests/pushengage-app/dashboard/` - Individual test files with inline comments

## ⚙️ Test Configuration

- **Timeout**: 120 seconds per test
- **Retries**: 2 retries on failure
- **Workers**: 1 (to share session state)
- **Screenshots**: On failure only
- **Videos**: On failure only
- **Traces**: On failure only

## 🐛 Troubleshooting

### Session expired?
Run the save-session script again:
```bash
npm run test:app:save-session
```

### Tests failing?
1. Check if you're logged in manually
2. Verify credentials in `.env`
3. Run with `--headed` flag to see what's happening
4. Check screenshots in `./screenshots/`

### Captcha issues?
The save-session approach bypasses captcha by reusing your authenticated session.

## 📞 Support

For issues or questions:
- Check test output logs
- Review screenshots in `./screenshots/`
- Run in debug mode for step-by-step execution
- Check the README.md for detailed information

## ✅ Success Criteria

Tests will PASS if:
- Session is properly saved
- User is authenticated
- Dashboard elements are visible
- Metrics are displayed
- User interactions work
- Navigation functions properly

---

**Created by**: Kulvinder Singh (kgosal@awesomemotive.com)  
**Date**: February 25, 2026  
**Framework**: Playwright + Node.js  
**Total Test Cases**: ~35 (Dashboard feature only)
