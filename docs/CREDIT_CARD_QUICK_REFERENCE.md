# Credit Card Test Data - Quick Reference

## Test Card Information

```
Cardholder Name: Kulvinder Singh
Card Number: 4242 4242 4242 4242
Expiry Date: 12/44
CVV: 123
```

## Quick Usage

### Method 1: Use Helper Functions (Recommended)

```javascript
const config = require('../utils/config');
const helpers = require('../utils/playwright-helpers');

// Auto-fill any credit card form
await helpers.fillCreditCardForm(page, config);

// For Stripe payment forms with iframes
await helpers.fillStripeCardForm(page, config);
```

### Method 2: Access Data Directly

```javascript
const config = require('../utils/config');
const card = config.testCreditCard;

await page.fill('#cardholder-name', card.cardholderName);  // "Kulvinder Singh"
await page.fill('#card-number', card.cardNumber);          // "4242424242424242"
await page.fill('#expiry', card.expiryDate);               // "12/44"
await page.fill('#cvv', card.cvv);                         // "123"
```

## Available Fields

```javascript
config.testCreditCard = {
  cardholderName: 'Kulvinder Singh',
  cardNumber: '4242424242424242',
  expiryDate: '12/44',
  cvv: '123',
  expiryMonth: '12',
  expiryYear: '44',
  expiryYear4Digit: '2044'
}
```

## Documentation

For detailed documentation, examples, and troubleshooting, see:
- [Complete Documentation](./CREDIT_CARD_TEST_DATA.md)
- [Example Test](../tests/examples/credit-card-example.spec.js)

## Files Modified

1. **Config**: `tests/utils/config.js` - Added credit card test data
2. **Helpers**: `tests/utils/playwright-helpers.js` - Added `fillCreditCardForm()` and `fillStripeCardForm()`
3. **Documentation**: `docs/CREDIT_CARD_TEST_DATA.md` - Complete guide
4. **Example**: `tests/examples/credit-card-example.spec.js` - Working example

## Notes

- This is a Stripe test card (4242 4242 4242 4242)
- Safe to use in test/staging environments
- Never use real credit cards in automated tests
