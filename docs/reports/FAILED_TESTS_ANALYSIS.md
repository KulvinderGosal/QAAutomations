# 🔍 Failed Tests Analysis & Root Cause Investigation

**Investigation Date**: February 21, 2026  
**Failed Tests**: 2 files, 6 total attempts (with retries)

---

## 📋 Test Comparison Summary

| Test File | Status | Root Cause |
|-----------|--------|------------|
| `01-send-immediate-broadcast.spec.js` | ✅ PASSED | Uses **smart multi-selector strategy** |
| `01-simple-broadcast-test.spec.js` | ❌ FAILED | Uses **fragile position-based selectors** |
| `02-working-campaign-test.spec.js` | ❌ FAILED | Uses **attribute-based selectors** (better but still fails) |

---

## 🔬 Detailed Root Cause Analysis

### ❌ Test #1: `01-simple-broadcast-test.spec.js`

#### Issues Identified:

1. **Fragile Position-Based Selectors**
   ```javascript
   // Line 37: Selects FIRST input on page
   await page.locator('input').first().fill(title);
   
   // Line 41: Selects FIRST textarea on page  
   await page.locator('textarea').first().fill('Test message');
   
   // Line 45: Selects THIRD input on page
   await page.locator('input').nth(2).fill('http://productionautomation.local/');
   ```
   
   **Problem**: If the page structure changes (new inputs added, order changes), these selectors break.

2. **Hardcoded Local URLs**
   ```javascript
   // Lines 11, 19, 45: Hardcoded local environment
   'http://productionautomation.local/wp-login.php'
   'http://productionautomation.local/wp-admin/admin.php...'
   ```
   
   **Problem**: Cannot run on staging or other environments.

3. **Manual Login Instead of Using Auth Utility**
   ```javascript
   // Lines 11-15: Manual login implementation
   await page.goto('http://productionautomation.local/wp-login.php');
   await page.fill('input[name="log"]', 'admin');
   await page.fill('input[name="pwd"]', 'admin@123=');
   await page.click('input[type="submit"]');
   ```
   
   **Problem**: Doesn't leverage the fixed `loginToWordPress()` utility, prone to repeated login issues.

4. **Insufficient Wait Strategies**
   ```javascript
   // Lines 20, 26, 34, 48: Fixed timeouts
   await page.waitForTimeout(5000); // Arbitrary waits
   await page.waitForTimeout(3000);
   ```
   
   **Problem**: May be too short or too long, doesn't wait for actual elements.

5. **Ambiguous Button Selector**
   ```javascript
   // Line 25: Multiple possible matches
   await page.locator('button:has-text("Create"), button:has-text("New")').first().click();
   ```
   
   **Problem**: May click the wrong button if multiple matches exist.

---

### ❌ Test #2: `02-working-campaign-test.spec.js`

#### Issues Identified:

1. **Attribute-Based Selectors (Better but Still Fragile)**
   ```javascript
   // Lines 40, 47, 54: Uses maxlength attributes
   await page.locator('input[maxlength="85"]').first().fill(title);
   await page.locator('input[maxlength="135"]').first().fill(message);
   await page.locator('input[maxlength="1600"]').first().fill(url);
   ```
   
   **Problem**: If PushEngage changes field length limits, selectors break. Better than position-based but still fragile.

2. **Same Hardcoded URL Issues**
   ```javascript
   // Lines 15, 24, 52: Hardcoded local environment
   'http://productionautomation.local/...'
   ```

3. **Manual Login (Same Issue)**
   ```javascript
   // Lines 15-20, 99-104, 157-162: Repeated manual login in each test
   ```
   
   **Problem**: Code duplication, doesn't use centralized auth.

4. **Single Button Selector**
   ```javascript
   // Line 30: Only tries one selector
   await page.locator('button:has-text("Create")').first().click();
   ```
   
   **Problem**: If button text changes (e.g., "New" instead of "Create"), test fails.

---

### ✅ Test #3: `01-send-immediate-broadcast.spec.js` (SUCCESSFUL)

#### Why It Works:

1. **Multi-Selector Fallback Strategy**
   ```javascript
   // Lines 58-67: Multiple selectors tried in order
   const createButtonSelectors = [
     'button:has-text("Create")',
     'button:has-text("New")',
     'a:has-text("Create")',
     'span:has-text("Create New")',
     '[data-testid*="create"]',
     '.pe-container button:first-of-type',
     'button.ant-btn-primary',
   ];
   
   // Lines 70-78: Loop through selectors until one works
   for (const selector of createButtonSelectors) {
     const button = page.locator(selector).first();
     const isVisible = await button.isVisible().catch(() => false);
     if (isVisible) {
       await button.click();
       break;
     }
   }
   ```
   
   **Advantage**: If one selector fails, tries next one. Resilient to UI changes.

2. **Semantic Selectors**
   ```javascript
   // Lines 94-100: Targets elements by meaning, not position
   const titleSelectors = [
     '[data-testid="notificationTitle-notification-generic"]',
     '[data-testid*="notificationTitle"]',
     '[placeholder*="title" i]',
     '[name*="title" i]',
     '#notification-title',
   ];
   ```
   
   **Advantage**: More maintainable, survives UI restructuring.

3. **Graceful Degradation**
   ```javascript
   // Lines 116-119: Fallback if all smart selectors fail
   if (!titleFilled) {
     console.log('⚠️ Using first visible text input...');
     await page.locator('input[type="text"]').first().fill(title);
   }
   ```

4. **Uses Config (Though Still Has Hardcoded URLs)**
   ```javascript
   // Line 2: Imports centralized config
   const config = require('../../../utils/config');
   
   // Line 45: Uses config for base URL
   const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
   ```
   
   **Note**: Still has hardcoded login URL (line 16), but better than others.

---

## 📊 Comparison Matrix

| Feature | Simple Test ❌ | Working Test ❌ | Auto-Send Test ✅ |
|---------|---------------|----------------|------------------|
| **Selector Strategy** | Position-based | Attribute-based | Multi-selector fallback |
| **Environment Config** | Hardcoded | Hardcoded | Partial (config + hardcoded) |
| **Login Method** | Manual inline | Manual inline | Manual inline |
| **Wait Strategy** | Fixed timeouts | Fixed timeouts | Fixed timeouts + visibility checks |
| **Fallback Logic** | None | None | Yes |
| **Code Reuse** | None | Minimal | None |
| **Maintainability** | Low | Medium | High |
| **Resilience** | Very Low | Low | High |

---

## 🎯 Critical Failures Explained

### Why `01-simple-broadcast-test.spec.js` Failed

**Console Output Analysis:**
```
✅ Logged in
✅ On campaigns page
📍 Clicking Create button...
✅ Create form opened
📝 Filling form with title: Test 8:16:39 PM
✅ Title filled
❌ Test Failed (after 23.9s)
```

**What Happened:**
1. ✅ Login succeeded
2. ✅ Navigation succeeded
3. ✅ Create button clicked
4. ✅ Title filled with `page.locator('input').first()`
5. ❌ **Next step failed** - likely when trying `page.locator('textarea').first()`

**Root Cause:**
- The page structure doesn't match expectations
- First `input` might not be the title field
- First `textarea` might not exist or not be visible
- The test filled the wrong field, so subsequent steps failed

### Why `02-working-campaign-test.spec.js` Failed

**Console Output Analysis:**
```
✅ Logged in
📍 Going to PushEngage Campaigns...
✅ On campaigns page
📍 Clicking Create button...
❌ Test Failed (after 18.6s)
```

**What Happened:**
1. ✅ Login succeeded
2. ✅ Navigation succeeded
3. ❌ **Create button click failed**

**Root Cause:**
- `page.locator('button:has-text("Create")').first().click()` didn't find the button
- Button might be:
  - Text changed from "Create" to "New"
  - Inside a shadow DOM
  - Dynamically loaded (not yet visible)
  - Behind another element

---

## 🔧 Recommended Fixes

### Priority 1: Fix Failed Tests

#### Fix #1: Update `01-simple-broadcast-test.spec.js`

**Replace fragile selectors with smart strategy:**
```javascript
// Instead of:
await page.locator('input').first().fill(title);

// Use multi-selector strategy:
const titleSelectors = [
  '[data-testid*="notificationTitle"]',
  '[placeholder*="title" i]',
  'input[maxlength="85"]',
  'input[type="text"]',
];

for (const selector of titleSelectors) {
  const input = page.locator(selector).first();
  if (await input.isVisible().catch(() => false)) {
    await input.fill(title);
    break;
  }
}
```

#### Fix #2: Update `02-working-campaign-test.spec.js`

**Add fallback selectors for Create button:**
```javascript
// Instead of:
await page.locator('button:has-text("Create")').first().click();

// Use multi-selector approach:
const createSelectors = [
  'button:has-text("Create")',
  'button:has-text("New")',
  'button.ant-btn-primary',
  '[data-testid*="create"]',
];

for (const selector of createSelectors) {
  const button = page.locator(selector).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    break;
  }
}
```

### Priority 2: Use Centralized Auth

**Replace manual login with:**
```javascript
const { loginToWordPress } = require('../../../utils/auth');

// Instead of 6 lines of manual login:
await loginToWordPress(page);
```

### Priority 3: Use Environment Config

**Replace hardcoded URLs:**
```javascript
const config = require('../../../utils/config');

// Instead of:
await page.goto('http://productionautomation.local/wp-login.php');

// Use:
await page.goto(config.wpAdminUrl.replace('/wp-admin', '/wp-login.php'));
```

---

## 📝 Next Steps

1. ✅ **Create Fixed Versions** of both failed tests
2. ✅ **Test Locally** to verify fixes work
3. ✅ **Run on Staging** to ensure environment independence
4. ✅ **Update Other Tests** to use similar resilient patterns
5. ✅ **Add to CI/CD** once stable

---

## 🏆 Success Criteria

After fixes, tests should:
- ✅ Pass consistently (90%+ success rate)
- ✅ Work in multiple environments (local, staging, production)
- ✅ Provide clear error messages when they do fail
- ✅ Be maintainable (easy to update when UI changes)
- ✅ Execute in reasonable time (<60s per test)

---

**Analysis Completed**: February 21, 2026  
**Investigated By**: QA Automation System  
**Status**: Ready for fix implementation
