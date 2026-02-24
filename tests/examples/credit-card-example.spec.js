const { test, expect } = require('@playwright/test');
const config = require('../utils/config');
const helpers = require('../utils/playwright-helpers');

/**
 * Example Test: Credit Card Form Filling
 * 
 * This test demonstrates how to use the credit card test data
 * and helper functions to fill payment forms.
 */

test.describe('Example: Credit Card Form Filling', () => {
  
  test('example: fill standard credit card form', async ({ page }) => {
    test.setTimeout(60000);
    
    console.log('📍 Example: Filling Credit Card Form');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Access credit card data from config
    const cardData = config.testCreditCard;
    
    console.log('💳 Test Credit Card Data:');
    console.log(`   Name: ${cardData.cardholderName}`);
    console.log(`   Number: ${cardData.cardNumber}`);
    console.log(`   Expiry: ${cardData.expiryDate}`);
    console.log(`   CVV: ${cardData.cvv}\n`);
    
    // Example 1: Using the helper function (recommended)
    // await helpers.fillCreditCardForm(page, config);
    
    // Example 2: Accessing individual fields
    console.log('✓ Credit card data available for use in tests');
    console.log('✓ Use helpers.fillCreditCardForm(page, config) to auto-fill forms');
    console.log('✓ Use helpers.fillStripeCardForm(page, config) for Stripe iframes\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Example test - demonstrates credit card data usage');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    expect(cardData.cardholderName).toBe('Kulvinder Singh');
    expect(cardData.cardNumber).toBe('4242424242424242');
    expect(cardData.expiryDate).toBe('12/44');
    expect(cardData.cvv).toBe('123');
  });
  
  test('example: access credit card data fields', async ({ page }) => {
    const cardData = config.testCreditCard;
    
    // Verify all fields are available
    expect(cardData).toHaveProperty('cardholderName');
    expect(cardData).toHaveProperty('cardNumber');
    expect(cardData).toHaveProperty('expiryDate');
    expect(cardData).toHaveProperty('cvv');
    expect(cardData).toHaveProperty('expiryMonth');
    expect(cardData).toHaveProperty('expiryYear');
    expect(cardData).toHaveProperty('expiryYear4Digit');
    
    console.log('✅ All credit card data fields are available\n');
  });
});
