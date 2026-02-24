# Credit Card Test Data

## Test Credit Card Information

For all payment and billing tests, use the following test credit card data:

### Card Details

| Field | Value |
|-------|-------|
| **Cardholder Name** | Kulvinder Singh |
| **Card Number** | 4242 4242 4242 4242 |
| **Expiry Date** | 12/44 |
| **CVV/CVC** | 123 |

### Usage in Tests

The credit card data is available in the config file and can be accessed in any test:

```javascript
const config = require('../utils/config');
const helpers = require('../utils/playwright-helpers');

// Access credit card data
const cardData = config.testCreditCard;
console.log(cardData.cardholderName); // "Kulvinder Singh"
console.log(cardData.cardNumber);     // "4242424242424242"
console.log(cardData.expiryDate);     // "12/44"
console.log(cardData.cvv);            // "123"

// Use helper function to fill credit card forms
await helpers.fillCreditCardForm(page, config);

// For Stripe payment forms (with iframes)
await helpers.fillStripeCardForm(page, config);
```

### Helper Functions

#### `fillCreditCardForm(page, config, options)`

Automatically fills credit card forms. Supports various form layouts and field naming conventions.

**Example:**

```javascript
// Basic usage
await helpers.fillCreditCardForm(page, config);

// With custom selectors
await helpers.fillCreditCardForm(page, config, {
  cardholderName: '#custom-name-field',
  cardNumber: '#custom-card-field',
  expiryDate: '#custom-expiry-field',
  cvv: '#custom-cvv-field'
});
```

#### `fillStripeCardForm(page, config)`

Specialized helper for Stripe Elements which use iframes for credit card fields.

**Example:**

```javascript
await helpers.fillStripeCardForm(page, config);
```

---

## Available Test Card Data Fields

The `config.testCreditCard` object includes:

```javascript
{
  cardholderName: 'Kulvinder Singh',
  cardNumber: '4242424242424242',        // Without spaces
  expiryDate: '12/44',                   // Format: MM/YY
  cvv: '123',
  expiryMonth: '12',                     // For separate month field
  expiryYear: '44',                      // For separate year field (2-digit)
  expiryYear4Digit: '2044'              // For separate year field (4-digit)
}
```

---

## Test Scenarios

Use this credit card data for testing:

1. **Payment Method Addition**
   - Adding a new payment method to account
   - Updating billing information

2. **Plan Upgrades**
   - Upgrading from free to paid plan
   - Changing subscription tiers

3. **Billing Settings**
   - Verifying payment method details
   - Testing payment form validation

4. **Checkout Flows**
   - Complete purchase workflows
   - Payment processing tests

---

## Notes

- This is a **test card number** (Stripe test card: 4242 4242 4242 4242)
- Use only in test/staging environments
- Never use real credit card information in automated tests
- The expiry date (12/44) is intentionally set far in the future to avoid test failures

---

## Examples

### Example 1: Basic Payment Form

```javascript
test('should add payment method', async ({ page }) => {
  const config = require('../utils/config');
  const helpers = require('../utils/playwright-helpers');
  
  // Navigate to billing page
  await helpers.openPushEngageMenuItem(page, 'Settings');
  await page.click('text=Billing');
  await page.click('text=Add payment method');
  
  // Fill credit card form
  await helpers.fillCreditCardForm(page, config);
  
  // Submit
  await page.click('button[type="submit"]');
});
```

### Example 2: Stripe Payment Form

```javascript
test('should complete Stripe checkout', async ({ page }) => {
  const config = require('../utils/config');
  const helpers = require('../utils/playwright-helpers');
  
  // Navigate to upgrade page
  await page.click('text=Upgrade Plan');
  
  // Wait for Stripe form to load
  await page.waitForSelector('iframe[name^="__privateStripeFrame"]');
  
  // Fill Stripe card form
  await helpers.fillStripeCardForm(page, config);
  
  // Complete purchase
  await page.click('text=Subscribe');
});
```

### Example 3: Manual Field Filling

```javascript
test('should fill credit card manually', async ({ page }) => {
  const config = require('../utils/config');
  const cardData = config.testCreditCard;
  
  // Fill each field manually
  await page.fill('#cardholder-name', cardData.cardholderName);
  await page.fill('#card-number', cardData.cardNumber);
  await page.fill('#expiry', cardData.expiryDate);
  await page.fill('#cvv', cardData.cvv);
  
  // Or use separate month/year fields
  await page.selectOption('#exp-month', cardData.expiryMonth);
  await page.selectOption('#exp-year', cardData.expiryYear4Digit);
});
```

---

## Troubleshooting

### Issue: Card form fields not found

**Solution**: Use custom selectors option:

```javascript
await helpers.fillCreditCardForm(page, config, {
  cardNumber: 'input[data-testid="card-number"]',
  // ... other custom selectors
});
```

### Issue: Stripe iframe not loading

**Solution**: Increase timeout and verify iframe is present:

```javascript
await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { 
  timeout: 15000 
});
await helpers.fillStripeCardForm(page, config);
```

### Issue: Form validation errors

**Solution**: Add delays between field fills:

```javascript
const cardData = config.testCreditCard;
await page.fill('#card-number', cardData.cardNumber);
await page.waitForTimeout(500);
await page.fill('#expiry', cardData.expiryDate);
await page.waitForTimeout(500);
```

---

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit real credit card information
- This test data is for test environments only
- The card number 4242 4242 4242 4242 is a well-known Stripe test card
- Always use test API keys in test environments
