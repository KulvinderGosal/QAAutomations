# Test Examples

This folder contains example tests demonstrating various patterns and integrations for the PushEngage QA Automation framework.

## Available Examples

### 1. Credit Card Example (`credit-card-example.spec.js`)

Demonstrates credit card form filling patterns.

**Features:**
- Standard credit card field filling
- Stripe iframe handling
- Multiple selector strategies
- Error handling

**Use Cases:**
- Payment form testing
- E-commerce checkout flows
- Subscription signup forms

### 2. MCP Integration Example (`mcp-integration-example.spec.js`)

Comprehensive examples of integrating Playwright MCP server tools with tests.

**Features:**
- Pure Playwright tests (baseline)
- Pure MCP tests (interactive)
- Hybrid Playwright + MCP approach
- Post-failure debugging with MCP
- Console and network monitoring
- PushEngage integration patterns

**Use Cases:**
- Interactive debugging sessions
- Accessibility analysis
- Manual exploratory testing
- AI-assisted test development
- Enhanced error debugging

**Run Examples:**
```bash
# Standard run (Playwright only)
npx playwright test tests/examples/mcp-integration-example.spec.js

# With MCP enabled (interactive)
MCP_ENABLED=true npx playwright test tests/examples/mcp-integration-example.spec.js --headed

# Run specific example
npx playwright test tests/examples/mcp-integration-example.spec.js -g "Example 3"
```

## Example Categories

### Basic Patterns
- Standard test structure
- Login and authentication
- Navigation patterns
- Form filling

### Advanced Patterns
- Credit card form handling
- Iframe interactions
- Dynamic element waiting
- Error recovery

### Integration Patterns
- MCP tool integration
- Hybrid automation approaches
- Enhanced debugging
- Accessibility analysis

## Using These Examples

### Copy-Paste Approach

1. Find the example that matches your use case
2. Copy the relevant code pattern
3. Adapt it to your specific test
4. Test and refine

### Learning Approach

1. Read the example code and comments
2. Run the example to see it in action
3. Experiment with modifications
4. Apply learned patterns to your tests

### Reference Approach

1. Keep examples open as reference
2. Look up specific patterns as needed
3. Compare your code with examples
4. Use as troubleshooting guide

## Example Test Structure

Each example follows this structure:

```javascript
/**
 * Test Description
 * 
 * Explains what the test does, when to use it,
 * and any important notes.
 */

test.describe('Test Suite Name', () => {
  
  test('Test Case Name', async ({ page }) => {
    // Step 1: Setup
    console.log('Setting up test...');
    
    // Step 2: Actions
    await page.goto('https://example.com');
    await page.fill('input', 'value');
    
    // Step 3: Assertions
    expect(await page.locator('.result').isVisible()).toBeTruthy();
    
    // Step 4: Cleanup (if needed)
    console.log('Test completed');
  });
});
```

## Best Practices Demonstrated

### 1. Clear Logging
```javascript
console.log('📍 Step 1: Navigating to page...');
console.log('✓ Page loaded\n');
console.log('⚠️ Warning: Element not found');
console.log('❌ Error occurred');
```

### 2. Error Handling
```javascript
try {
  await page.click('button');
} catch (error) {
  console.log(`⚠️ Click failed: ${error.message}`);
  // Fallback action
  await page.press('input', 'Enter');
}
```

### 3. Multiple Selector Strategies
```javascript
const selectors = [
  'button.submit',
  'input[type="submit"]',
  'button:has-text("Submit")'
];

for (const selector of selectors) {
  try {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 2000 })) {
      await element.click();
      break;
    }
  } catch (e) {
    continue;
  }
}
```

### 4. Helpful Screenshots
```javascript
await page.screenshot({ 
  path: 'test-results/step-name.png', 
  fullPage: true 
});
```

### 5. Clear Test Summaries
```javascript
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Test Summary:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Status: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
```

## Running Examples

### Run All Examples
```bash
npm test tests/examples/
```

### Run Specific Example
```bash
npx playwright test tests/examples/credit-card-example.spec.js
```

### Run with Options
```bash
# With visible browser
npx playwright test tests/examples/ --headed

# In debug mode
npx playwright test tests/examples/ --debug

# Single worker (sequential)
npx playwright test tests/examples/ --workers=1

# Specific browser
npx playwright test tests/examples/ --project=chromium
```

### Run MCP Examples
```bash
# Standard run (no MCP)
npx playwright test tests/examples/mcp-integration-example.spec.js

# With MCP enabled (requires approval)
MCP_ENABLED=true npx playwright test tests/examples/mcp-integration-example.spec.js --headed
```

## Creating New Examples

To add a new example:

1. Create `new-example.spec.js` in this folder
2. Follow the structure shown above
3. Add clear comments and logging
4. Document what the example demonstrates
5. Update this README with the new example

### Template for New Examples

```javascript
const { test, expect } = require('@playwright/test');

/**
 * [Example Name]
 * 
 * Demonstrates: [What this example shows]
 * Use Cases: [When to use this pattern]
 * 
 * Features:
 * - [Feature 1]
 * - [Feature 2]
 */

test.describe('[Example Category]', () => {
  
  test('[Example name]', async ({ page }) => {
    test.setTimeout(60000);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Example Name]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Your example code here
    
    console.log('✅ Example completed\n');
  });
});
```

## Related Documentation

- **[MCP Integration Guide](../docs/MCP_INTEGRATION_GUIDE.md)** - Full MCP integration documentation
- **[MCP Quick Reference](../docs/MCP_QUICK_REFERENCE.md)** - Quick MCP reference
- **[Helper Functions](../utils/mcp-helpers.js)** - MCP helper library
- **[Credit Card Quick Reference](../docs/CREDIT_CARD_QUICK_REFERENCE.md)** - Credit card test data

## Questions?

For questions or issues with examples:
- **Email**: kgosal@awesomemotive.com
- **Phone**: +91 9779290090

## Contributing Examples

To contribute new examples:

1. Create a new example file following the template
2. Add comprehensive comments
3. Include console logging for clarity
4. Test the example thoroughly
5. Update this README
6. Submit a pull request

**Good examples include:**
- Clear purpose and use case
- Comprehensive comments
- Error handling
- Multiple strategies demonstrated
- Real-world scenarios
- Console logging for debugging

---

**Last Updated**: February 24, 2026
