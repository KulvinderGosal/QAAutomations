# Playwright MCP Integration Guide

## Overview

This guide explains how to integrate Playwright MCP (Model Context Protocol) server tools with your existing Playwright tests.

## What is the Playwright MCP Server?

The Playwright MCP server provides 22 browser automation tools that can be accessed through the Model Context Protocol. These tools complement your existing Playwright tests by providing:

- **Accessibility snapshots** with element references
- **Enhanced debugging** capabilities  
- **Console and network monitoring**
- **AI-assisted test development**
- **Interactive testing** workflows

## Important: MCP vs Native Playwright

### When to Use Native Playwright (Recommended for Most Tests)

✅ **Use Playwright for:**
- Automated CI/CD tests
- Regression test suites
- Fast, reliable execution
- Repeatable test automation
- Production test runs

### When to Use MCP Tools (Supplementary)

✅ **Use MCP for:**
- Interactive debugging sessions
- Manual exploratory testing
- Accessibility analysis
- AI-assisted test development
- Post-failure deep debugging
- Learning page structure

## Key Differences

| Feature | Playwright (Native) | MCP Server |
|---------|-------------------|------------|
| **Execution** | Automated, no approval needed | Requires user approval per action |
| **Speed** | Fast | Slower (approval overhead) |
| **CI/CD** | ✅ Perfect for CI/CD | ❌ Not suitable for CI/CD |
| **Use Case** | Production automation | Interactive/manual testing |
| **Output** | Standard test results | Enhanced accessibility data |

## Available MCP Tools

### Navigation & Page Control
- `browser_navigate` - Navigate to a URL
- `browser_navigate_back` - Navigate back
- `browser_close` - Close browser
- `browser_tabs` - Manage browser tabs

### Page Interaction
- `browser_click` - Click elements
- `browser_type` - Type text
- `browser_fill_form` - Fill form fields
- `browser_hover` - Hover over elements
- `browser_press_key` - Press keyboard keys
- `browser_drag` - Drag and drop
- `browser_select_option` - Select dropdown options
- `browser_file_upload` - Upload files

### Page Analysis
- `browser_snapshot` - Capture accessibility snapshot
- `browser_take_screenshot` - Take screenshots
- `browser_console_messages` - Get console logs
- `browser_network_requests` - Monitor network
- `browser_evaluate` - Execute JavaScript
- `browser_run_code` - Run custom code

### Utilities
- `browser_wait_for` - Wait for conditions
- `browser_resize` - Resize browser
- `browser_handle_dialog` - Handle alerts/confirms

## Integration Patterns

### Pattern 1: Pure Playwright (Standard - No Changes)

**Use this for your automated tests:**

```javascript
const { test, expect } = require('@playwright/test');

test('Standard Playwright test', async ({ page }) => {
  // This is your baseline - keep using this!
  await page.goto('https://example.com');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.success')).toBeVisible();
});
```

**Benefits:**
- Fast execution
- No user approval needed
- Perfect for CI/CD
- Reliable and repeatable

### Pattern 2: Hybrid Approach (Recommended for Development)

**Use Playwright for automation, MCP for optional analysis:**

```javascript
const { test, expect } = require('@playwright/test');
const { mcpSnapshot, mcpDebugFailure } = require('./utils/mcp-helpers');

const MCP_ENABLED = process.env.MCP_ENABLED === 'true';

test('Hybrid test with optional MCP', async ({ page }) => {
  // ✅ Always use Playwright for the actual test
  await page.goto('https://example.com');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  
  // ✅ Optionally use MCP for enhanced analysis
  if (MCP_ENABLED) {
    try {
      await mcpSnapshot(callMcpTool, 'form-submitted.md');
      console.log('✓ MCP snapshot captured');
    } catch (error) {
      console.log('⚠️ MCP skipped (requires approval)');
    }
  }
  
  await expect(page.locator('.success')).toBeVisible();
});
```

**Benefits:**
- Test runs normally with Playwright
- MCP provides optional enhanced data
- No impact if MCP is disabled
- Great for development and debugging

### Pattern 3: MCP for Post-Failure Debugging

**Use MCP to capture detailed debug info when tests fail:**

```javascript
const { test, expect } = require('@playwright/test');
const { mcpDebugFailure } = require('./utils/mcp-helpers');

test('Test with MCP debugging', async ({ page }) => {
  try {
    // Your test code
    await page.goto('https://example.com');
    await page.click('button.submit');
    
  } catch (error) {
    // Standard Playwright fallback
    await page.screenshot({ 
      path: 'test-results/failure.png',
      fullPage: true 
    });
    
    // Enhanced MCP debugging (optional)
    if (process.env.MCP_ENABLED === 'true') {
      try {
        await mcpDebugFailure(page, callMcpTool, error);
        console.log('✓ Enhanced debug info captured via MCP');
      } catch (mcpError) {
        console.log('⚠️ MCP debug skipped');
      }
    }
    
    throw error; // Re-throw to fail the test
  }
});
```

**Benefits:**
- Standard screenshot always captured
- MCP provides additional context
- Helpful for debugging flaky tests
- No impact if MCP disabled

## Adding MCP to Your PushEngage Tests

### Step 1: Import MCP Helpers

Add to the top of your test file:

```javascript
const { mcpSnapshot, mcpDebugFailure } = require('../utils/mcp-helpers');
const MCP_ENABLED = process.env.MCP_ENABLED === 'true';
```

### Step 2: Add Optional Snapshots

After key steps in your test:

```javascript
// After navigation
await page.goto('https://www.pushengage.com/wordpress-pricing/');

// Optional MCP snapshot
if (MCP_ENABLED) {
  try {
    await mcpSnapshot(callMcpTool, 'test-results/pricing-page-snapshot.md');
  } catch (e) {
    console.log('⚠️ MCP snapshot skipped');
  }
}

// Continue with test...
```

### Step 3: Add MCP Debugging

In your error handling:

```javascript
if (errorFound) {
  console.log(`⚠️ Error: ${errorMessage}`);
  
  // Standard screenshot
  await page.screenshot({ 
    path: 'test-results/error-screenshot.png',
    fullPage: true 
  });
  
  // Enhanced MCP debugging
  if (MCP_ENABLED) {
    try {
      await mcpDebugFailure(page, callMcpTool, new Error(errorMessage));
    } catch (e) {
      console.log('⚠️ MCP debug skipped');
    }
  }
}
```

## Example: Modifying Your Signup Test

Here's how to add MCP to your `pushengage-free-plan-signup.spec.js`:

```javascript
// At the top of the file
const { test, expect } = require('@playwright/test');
const { mcpSnapshot, mcpDebugFailure } = require('../utils/mcp-helpers');

const MCP_ENABLED = process.env.MCP_ENABLED === 'true';

test.describe('PushEngage Free Plan Signup', () => {
  test('should successfully sign up for free plan', async ({ page }) => {
    test.setTimeout(180000);
    
    console.log('📍 Test ID: SIGNUP-001');
    
    // Step 1: Navigate to pricing page
    await page.goto('https://www.pushengage.com/wordpress-pricing/');
    await page.waitForTimeout(3000);
    console.log('✓ Pricing page loaded');
    
    // Standard Playwright screenshot
    await page.screenshot({ 
      path: 'test-results/signup-001-pricing-page.png', 
      fullPage: true 
    });
    
    // Optional: MCP accessibility snapshot
    if (MCP_ENABLED) {
      try {
        await mcpSnapshot(callMcpTool, 'test-results/signup-001-pricing-snapshot.md');
        console.log('✓ MCP accessibility snapshot captured');
      } catch (e) {
        console.log('⚠️ MCP snapshot skipped (optional)');
      }
    }
    
    // ... rest of your test ...
    
    // In error handling section
    if (errorFound) {
      console.log(`⚠️ Error: ${errorMessage}`);
      
      // Standard debugging
      await page.screenshot({ 
        path: 'test-results/signup-001-error.png',
        fullPage: true 
      });
      
      // Enhanced MCP debugging
      if (MCP_ENABLED) {
        try {
          await mcpDebugFailure(page, callMcpTool, new Error(errorMessage));
          console.log('✓ Enhanced debug info captured');
        } catch (e) {
          console.log('⚠️ MCP debug skipped');
        }
      }
    }
  });
});
```

## Running Tests with MCP

### Standard Test Run (No MCP)
```bash
npm test
```

### With MCP Enabled (Interactive)
```bash
MCP_ENABLED=true npm test
```

### Single Test with MCP
```bash
MCP_ENABLED=true npm run test:signup:headed
```

## MCP Helper Functions Reference

### mcpSnapshot(callMcpTool, filename?)
Captures accessibility snapshot with element references.

```javascript
// Return snapshot in response
const snapshot = await mcpSnapshot(callMcpTool);

// Save to file
await mcpSnapshot(callMcpTool, 'page-snapshot.md');
```

### mcpDebugFailure(page, callMcpTool, error)
Captures comprehensive debug information on test failure.

```javascript
try {
  await testAction(page);
} catch (error) {
  await mcpDebugFailure(page, callMcpTool, error);
  throw error;
}
```

### mcpConsoleMessages(callMcpTool)
Get all console messages from the page.

```javascript
const logs = await mcpConsoleMessages(callMcpTool);
```

### mcpNetworkRequests(callMcpTool)
Get all network requests and responses.

```javascript
const requests = await mcpNetworkRequests(callMcpTool);
```

### mcpScreenshot(callMcpTool, options)
Take a screenshot via MCP.

```javascript
await mcpScreenshot(callMcpTool, {
  path: 'screenshot.png',
  fullPage: true
});
```

## Best Practices

### ✅ DO

1. **Keep Playwright as your primary automation tool**
   - Use Playwright for all automated tests
   - Use MCP as an optional enhancement

2. **Use environment variables to control MCP**
   ```javascript
   const MCP_ENABLED = process.env.MCP_ENABLED === 'true';
   ```

3. **Wrap MCP calls in try-catch**
   ```javascript
   if (MCP_ENABLED) {
     try {
       await mcpSnapshot(callMcpTool, 'snapshot.md');
     } catch (e) {
       console.log('MCP skipped');
     }
   }
   ```

4. **Always have Playwright fallbacks**
   ```javascript
   // Always take Playwright screenshot
   await page.screenshot({ path: 'result.png' });
   
   // Optionally enhance with MCP
   if (MCP_ENABLED) {
     await mcpSnapshot(callMcpTool, 'result.md');
   }
   ```

### ❌ DON'T

1. **Don't replace Playwright with MCP**
   ```javascript
   // ❌ BAD - Don't do this
   await mcpNavigate(callMcpTool, url);
   await mcpClick(callMcpTool, ref);
   
   // ✅ GOOD - Use Playwright
   await page.goto(url);
   await page.click('button');
   ```

2. **Don't use MCP in CI/CD without environment checks**
   ```javascript
   // ❌ BAD - This will fail in CI
   await mcpSnapshot(callMcpTool);
   
   // ✅ GOOD - Check environment
   if (process.env.MCP_ENABLED === 'true') {
     await mcpSnapshot(callMcpTool);
   }
   ```

3. **Don't make tests depend on MCP**
   ```javascript
   // ❌ BAD - Test fails if MCP disabled
   const snapshot = await mcpSnapshot(callMcpTool);
   expect(snapshot).toBeTruthy();
   
   // ✅ GOOD - MCP is optional
   let snapshot = null;
   if (MCP_ENABLED) {
     try {
       snapshot = await mcpSnapshot(callMcpTool);
     } catch (e) {}
   }
   // Test continues regardless
   ```

## Troubleshooting

### "User rejected MCP" Error

This is normal - MCP tools require user approval for security.

**Solution:** Set `MCP_ENABLED=true` and approve actions, or leave MCP disabled for automated runs.

### MCP Slows Down Tests

This is expected - MCP requires user interaction.

**Solution:** Only enable MCP for development/debugging, not for automated test runs.

### Want to Use MCP in CI/CD

MCP is not designed for CI/CD as it requires user approval.

**Solution:** Use native Playwright for CI/CD. Use MCP only for local development and debugging.

## Summary

**Key Takeaways:**

1. ✅ **Keep using Playwright** for automated tests
2. ✅ **Add MCP optionally** for enhanced debugging
3. ✅ **Use environment variables** to control MCP
4. ✅ **Wrap MCP in try-catch** blocks
5. ✅ **MCP is for development**, not production

**The Hybrid Approach:**
```javascript
// Playwright for automation (always)
await page.goto(url);
await page.click('button');
expect(await page.locator('.success').isVisible()).toBeTruthy();

// MCP for analysis (optional)
if (MCP_ENABLED) {
  try {
    await mcpSnapshot(callMcpTool, 'analysis.md');
  } catch (e) {}
}
```

## Additional Resources

- **Example Tests:** `tests/examples/mcp-integration-example.spec.js`
- **Helper Functions:** `tests/utils/mcp-helpers.js`
- **MCP Server Tools:** `/Users/kulvindersingh/.cursor/projects/Users-kulvindersingh-QA-Automation/mcps/user-playwright/tools/`

## Questions?

For questions or issues, contact:
- **Author:** Kulvinder Singh
- **Email:** kgosal@awesomemotive.com
