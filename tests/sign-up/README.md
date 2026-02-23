# PushEngage Sign-Up Tests

## 📋 Overview

This folder contains automated tests for the PushEngage sign-up and registration flows.

---

## 🧪 Test Files

### `pushengage-free-plan-signup.spec.js`

Comprehensive signup test suite for PushEngage's free plan.

#### Tests Included:

1. **SIGNUP-001**: Complete Free Plan Signup Flow
   - Navigate to pricing page
   - Click "Start For Free" button
   - Fill out registration form
   - Submit form
   - Verify signup success

2. **SIGNUP-002**: Form Validation Test
   - Verify required field validation
   - Test empty form submission
   - Check validation messages

---

## 🚀 Running the Tests

### Run All Sign-Up Tests

```bash
# Run all tests in sign-up folder
npx playwright test tests/sign-up/

# Run with visible browser
npx playwright test tests/sign-up/ --headed

# Run in debug mode
npx playwright test tests/sign-up/ --debug
```

### Run Specific Test

```bash
# Run only the signup flow test
npx playwright test tests/sign-up/pushengage-free-plan-signup.spec.js

# Run only the validation test
npx playwright test tests/sign-up/pushengage-free-plan-signup.spec.js -g "validate required fields"
```

### Run with Different Browsers

```bash
# Chrome
npx playwright test tests/sign-up/ --project=chromium

# Firefox
npx playwright test tests/sign-up/ --project=firefox

# Safari
npx playwright test tests/sign-up/ --project=webkit
```

---

## 📊 Test Coverage

### Features Tested

- ✅ Pricing page navigation
- ✅ Free plan selection
- ✅ Registration form fields (email, password, name, website)
- ✅ Form submission
- ✅ Success/error message detection
- ✅ URL navigation after signup
- ✅ Form validation
- ✅ Required field validation
- ✅ Terms and conditions acceptance

### Validation Checks

- Email field populated
- Password field populated
- Form submission completed
- Success indicators detected
- Error messages captured
- URL change verification

---

## 🔧 Test Configuration

### Timeout Settings

- Overall test timeout: 180 seconds (3 minutes)
- Form validation timeout: 120 seconds (2 minutes)

### Test Data

The test automatically generates unique test data:
- Email: `kgosal+qaautomation{timestamp}@awesomemotive.com`
- Password: `TestPass123!{timestamp}`
- Name: `Test User {timestamp}`
- Website: `https://qastaging.pushengage.com`

---

## 📸 Screenshots

Tests automatically capture screenshots at key points:

- `signup-001-pricing-page.png` - Initial pricing page
- `signup-001-signup-form.png` - Empty signup form
- `signup-001-form-filled.png` - Filled signup form
- `signup-001-result.png` - Signup result
- `signup-002-validation.png` - Form validation errors

All screenshots are saved to: `test-results/`

---

## ✅ Expected Results

### SIGNUP-001: Complete Signup Flow

**Success Criteria:**
1. Pricing page loads successfully
2. "Start For Free" button is found and clicked
3. Signup form is displayed
4. All required fields are filled
5. Form is submitted successfully
6. One of the following occurs:
   - Success message displayed
   - URL changes to dashboard/verification page
   - "Verify email" message shown

**Note**: Email verification is typically required after signup. The test passes if the signup form is submitted successfully, even if email verification is pending.

### SIGNUP-002: Form Validation

**Success Criteria:**
1. Signup form loads
2. Empty form submission triggers validation
3. Validation messages are displayed (if implemented)

---

## 🐛 Troubleshooting

### Issue: "Start For Free" button not found

**Cause**: Button selector may have changed or page structure is different.

**Solution**:
- Check if pricing page URL is correct
- Run test with `--headed` to see page visually
- Test includes fallback to direct signup URL navigation

### Issue: Form fields not found

**Cause**: Signup form structure may differ from expected selectors.

**Solution**:
- Run with `--headed` and `--debug` to inspect form
- Check screenshot in `test-results/` folder
- Update selectors in test file if needed

### Issue: Form submission fails

**Cause**: 
- Additional required fields not filled
- Captcha may be present
- Email domain restrictions

**Solution**:
- Check console logs for specific error
- Review screenshot of failed submission
- May need to use different email domain

### Issue: Test passes but account not created

**Cause**: Email verification required but not completed.

**Solution**:
- This is expected behavior
- Test verifies signup flow, not email verification
- Manual email verification needed for full account activation

---

## 📝 Adding New Sign-Up Tests

To add a new signup test:

1. **Create test case**:
```javascript
test('should [describe what test does]', async ({ page }) => {
  test.setTimeout(120000);
  
  // Your test implementation
});
```

2. **Follow the pattern**:
   - Navigate to page
   - Find elements using multi-selector strategy
   - Perform actions
   - Verify results
   - Take screenshots
   - Log progress

3. **Use helper patterns**:
   - Multi-selector arrays for resilience
   - Descriptive console logging
   - Screenshot capture
   - Error handling

---

## 🔍 Test Maintenance

### When to Update Tests

Update tests when:
- PushEngage changes signup flow
- Form fields are added/removed
- Button text or selectors change
- URL structure changes

### How to Update

1. Run test with `--headed` to see current page
2. Inspect elements in browser DevTools
3. Update selectors in test file
4. Add new selectors to arrays (don't remove old ones)
5. Test locally before committing

---

## 📊 Success Metrics

### Test Quality Indicators

- ✅ Test passes consistently (95%+ pass rate)
- ✅ Clear error messages when failing
- ✅ Screenshots captured at each step
- ✅ Comprehensive logging
- ✅ Handles edge cases (button not found, etc.)

### Coverage Metrics

- Email field: ✅ Tested
- Password field: ✅ Tested
- Name field: ✅ Tested (if present)
- Website field: ✅ Tested (if present)
- Terms checkbox: ✅ Tested (if present)
- Form submission: ✅ Tested
- Validation: ✅ Tested
- Success verification: ✅ Tested

---

## 🎯 Integration with CI/CD

These tests can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Sign-Up Tests
  run: npx playwright test tests/sign-up/
  
- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: signup-test-results
    path: test-results/
```

---

## 📞 Support

For issues with these tests:

1. Check the troubleshooting section above
2. Review screenshots in `test-results/`
3. Run tests with `--debug` flag
4. Check console logs for detailed error messages

---

## 📅 Last Updated

**Date**: February 23, 2026  
**Test Files**: 1  
**Test Cases**: 2  
**Status**: ✅ Production Ready

---

## 🔗 Related Documentation

- [Main README](../../README.md)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [PushEngage Pricing Page](https://www.pushengage.com/wordpress-pricing/)
