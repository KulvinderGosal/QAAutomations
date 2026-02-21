# MEDIUM Priority Tests (P2)

## Overview

This directory contains **136 MEDIUM priority tests** for the PushEngage WordPress plugin. These tests cover standard features that enhance user experience but are not critical to core functionality.

## 📊 Test Coverage

| Feature | Tests | Description |
|---------|-------|-------------|
| **Admin Bar Menu** | 9 | WordPress admin bar integration |
| **Analytics** | 44 | Analytics and reporting features |
| **Click to Chat** | 4 | Chat widget functionality |
| **Design** | 42 | UI customization and theming |
| **Goal Tracking** | 2 | Conversion goal tracking |
| **Notification Icon** | 8 | Notification icon management |
| **Quick Links** | 8 | Quick access navigation |
| **Quick Stats** | 8 | Dashboard statistics widgets |
| **Testing Tools** | 3 | Development and testing helpers |
| **WhatsApp** | 5 | WhatsApp integration |
| **WooCommerce Templates** | 3 | E-commerce notification templates |
| **TOTAL** | **136** | Standard feature tests |

## 🚀 Running Medium Priority Tests

### Run All Medium Priority Tests
```bash
npm run test:regression:medium
# Runs all 136 medium priority tests (~25 minutes)
```

### Run By Feature
```bash
npm run test:regression:analytics       # 44 tests - Analytics
npm run test:regression:design          # 42 tests - UI/Design
```

## 📋 Feature Details

### 1. Admin Bar Menu (9 tests)
WordPress admin bar integration and quick access features.

### 2. Analytics (44 tests)
Analytics dashboards, reports, and data visualization.

**Run:** `npm run test:regression:analytics`

### 3. Click to Chat (4 tests)
Chat widget configuration and functionality.

### 4. Design (42 tests)
UI customization, themes, and appearance settings.

**Run:** `npm run test:regression:design`

### 5. Goal Tracking (2 tests)
Conversion tracking and goal management.

### 6. Notification Icon (8 tests)
Notification icon upload and management.

### 7. Quick Links (8 tests)
Dashboard quick access links and shortcuts.

### 8. Quick Stats (8 tests)
Dashboard statistics and metrics widgets.

### 9. Testing Tools (3 tests)
Development helpers and testing utilities.

### 10. WhatsApp (5 tests)
WhatsApp integration and messaging.

### 11. WooCommerce Templates (3 tests)
E-commerce notification template management.

---

**Priority:** P2 - Medium  
**Total Tests:** 136  
**Estimated Time:** ~25 minutes  
**Status:** ⚠️ Investigate failures
