# HIGH Priority Tests (P1)

## Overview

This directory contains **181 HIGH priority tests** for the PushEngage WordPress plugin. These tests cover important features that significantly impact user experience and should be run before major releases.

## 📊 Test Coverage

| Feature | Tests | Description |
|---------|-------|-------------|
| **Audience** | 48 | Audience segmentation and management |
| **Drip** | 52 | Main drip campaign automation |
| **Drip Campaigns** | 6 | Drip campaign workflow tests |
| **Post Editor** | 47 | WordPress editor integration |
| **Post Types** | 5 | Custom post type support |
| **Service Worker Error Handling** | 4 | Error handling and recovery |
| **Triggers** | 11 | Automation triggers and rules |
| **WooCommerce Core** | 8 | E-commerce integration |
| **TOTAL** | **181** | Important feature tests |

## 🚀 Running High Priority Tests

### Run All High Priority Tests
```bash
npm run test:regression:high
# Runs all 181 high priority tests (~35 minutes)
```

### Run By Feature
```bash
npm run test:regression:audience        # 48 tests - Audience management
npm run test:regression:drip            # 52 tests - Drip campaigns  
npm run test:regression:triggers        # 11 tests - Automation triggers
npm run test:regression:woo             # 8 tests - WooCommerce core
```

### Run Specific Test File
```bash
# Example: Run audience tests
npx playwright test tests/pushengage-regression/high/audience/ --project=chromium

# Example: Run drip campaign tests
npx playwright test tests/pushengage-regression/high/drip/ --project=chromium --headed
```

## 📋 Feature Details

### 1. Audience (48 tests)
**Location:** `high/audience/`

Audience segmentation and management:
- Create segments
- Edit segments
- Delete segments
- Audience groups
- Segment rules
- Subscriber management

**Run:** `npm run test:regression:audience`

---

### 2. Drip (52 tests)
**Location:** `high/drip/`

Main drip campaign functionality:
- Create drip campaigns
- Schedule drip sequences
- Edit drip campaigns
- Drip analytics
- Automated messaging
- Subscriber journeys

---

### 3. Drip Campaigns (6 tests)
**Location:** `high/drip-campaigns/`

Drip campaign workflow tests:
- Campaign flows
- Multi-step sequences
- Time-based triggers
- Campaign completion

**Run:** `npm run test:regression:drip`

---

### 4. Post Editor (47 tests)
**Location:** `high/posteditor/`

WordPress editor integration:
- Auto-push on publish
- Notification preview
- Post notification settings
- Custom fields
- Category targeting

---

### 5. Post Types (5 tests)
**Location:** `high/posttypes/`

Custom post type support:
- Enable/disable post types
- Post type configuration
- Custom post type notifications

---

### 6. Service Worker Error Handling (4 tests)
**Location:** `high/serviceworkererrorhandling/`

Error handling and recovery:
- Service worker errors
- Failed notification delivery
- Error logging
- Recovery mechanisms

---

### 7. Triggers (11 tests)
**Location:** `high/triggers/`

Automation triggers:
- Create triggers
- Edit triggers
- Trigger conditions
- Trigger actions
- Enable/disable triggers

**Run:** `npm run test:regression:triggers`

---

### 8. WooCommerce Core (8 tests)
**Location:** `high/woocommerce-core/`

E-commerce integration:
- Order notifications
- Cart abandonment
- Product updates
- Purchase confirmations

**Run:** `npm run test:regression:woo`

---

## 🎯 Test Execution Strategy

### Daily Regression (35 minutes)
```bash
npm run test:regression:high
# Run daily to catch regressions
```

### Pre-Major Release (1 hour 20 minutes)
```bash
npm run test:regression:critical
npm run test:regression:high
# Run critical + high before major releases
```

## ⚠️ Blocking Criteria

**High priority tests should pass before:**
- ✅ Major version releases
- ✅ Feature releases
- ⚠️ Investigate failures before minor releases

**If high priority tests fail:**
- 🔍 Investigate impact
- ⚠️ Document known issues
- 🛠️ Fix before next major release

## 📈 Success Criteria

- Tests complete in ~35 minutes
- Tests are stable and reliable
- All major features covered
- Clear failure messages

---

**Priority:** P1 - High  
**Total Tests:** 181  
**Estimated Time:** ~35 minutes  
**Status:** ✅ Blocks major releases
