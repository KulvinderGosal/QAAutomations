# MCP Quick Reference Card

## What is MCP?

**MCP (Model Context Protocol)** provides browser automation tools that complement Playwright tests with enhanced accessibility snapshots and debugging capabilities.

## Should I Use MCP?

### ✅ YES - Use for:
- Interactive debugging
- Manual testing sessions
- Accessibility analysis
- Learning page structure
- Post-failure debugging

### ❌ NO - Don't use for:
- Automated CI/CD tests
- Production test runs
- Fast test execution
- Regression test suites

## Quick Decision Guide

```
Are you running automated tests in CI/CD?
├── YES → Use Playwright only (skip MCP)
└── NO → Are you debugging a failed test?
    ├── YES → Use Playwright + MCP (hybrid)
    └── NO → Use Playwright only (default)
```

## Available MCP Tools (22 total)

### Most Useful Tools

| Tool | Purpose | Use Case |
|------|---------|----------|
| `browser_snapshot` | Accessibility tree | Page structure analysis |
| `browser_console_messages` | Get console logs | Debug JavaScript errors |
| `browser_network_requests` | Network activity | Debug API calls |
| `browser_take_screenshot` | Visual screenshot | Manual verification |

### Other Tools

**Navigation:** `browser_navigate`, `browser_navigate_back`, `browser_close`, `browser_tabs`

**Interaction:** `browser_click`, `browser_type`, `browser_fill_form`, `browser_hover`, `browser_press_key`, `browser_drag`, `browser_select_option`, `browser_file_upload`

**Analysis:** `browser_evaluate`, `browser_run_code`

**Utilities:** `browser_wait_for`, `browser_resize`, `browser_handle_dialog`, `browser_install`

## Code Patterns

### Pattern 1: Standard Playwright (No MCP)

**Use this for 95% of your tests:**

```javascript
test('my test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.fill('input', 'value');
  await page.click('button');
  expect(await page.locator('.success').isVisible()).toBeTruthy();
});
```

### Pattern 2: Hybrid (Playwright + Optional MCP)

**Use this when developing/debugging:**

```javascript
const { mcpSnapshot } = require('./utils/mcp-helpers');
const MCP_ENABLED = process.env.MCP_ENABLED === 'true';

test('my test', async ({ page }) => {
  // Playwright automation (always runs)
  await page.goto('https://example.com');
  await page.fill('input', 'value');
  
  // Optional MCP snapshot (only if enabled)
  if (MCP_ENABLED) {
    try {
      await mcpSnapshot(callMcpTool, 'snapshot.md');
    } catch (e) {}
  }
  
  await page.click('button');
  expect(await page.locator('.success').isVisible()).toBeTruthy();
});
```

### Pattern 3: MCP for Debugging Failures

**Use this to capture debug info on failures:**

```javascript
const { mcpDebugFailure } = require('./utils/mcp-helpers');

test('my test', async ({ page }) => {
  try {
    await page.goto('https://example.com');
    await page.click('.submit');
  } catch (error) {
    // Standard screenshot
    await page.screenshot({ path: 'failure.png' });
    
    // Enhanced MCP debugging (optional)
    if (process.env.MCP_ENABLED === 'true') {
      try {
        await mcpDebugFailure(page, callMcpTool, error);
      } catch (e) {}
    }
    
    throw error;
  }
});
```

## Running Tests

```bash
# Standard run (no MCP) - use for CI/CD
npm test

# With MCP enabled (interactive) - use for debugging
MCP_ENABLED=true npm test

# Single test with MCP
MCP_ENABLED=true npm run test:signup:headed
```

## Common Tasks

### Capture Accessibility Snapshot

```javascript
const { mcpSnapshot } = require('./utils/mcp-helpers');

if (process.env.MCP_ENABLED === 'true') {
  try {
    await mcpSnapshot(callMcpTool, 'page-snapshot.md');
    console.log('✓ Snapshot captured');
  } catch (e) {
    console.log('⚠️ MCP skipped');
  }
}
```

### Debug Failed Test

```javascript
const { mcpDebugFailure } = require('./utils/mcp-helpers');

try {
  await runTest(page);
} catch (error) {
  await page.screenshot({ path: 'error.png' });
  
  if (process.env.MCP_ENABLED === 'true') {
    await mcpDebugFailure(page, callMcpTool, error);
  }
  
  throw error;
}
```

### Get Console Logs

```javascript
const { mcpConsoleMessages } = require('./utils/mcp-helpers');

if (process.env.MCP_ENABLED === 'true') {
  try {
    const logs = await mcpConsoleMessages(callMcpTool);
    console.log('Console logs:', logs);
  } catch (e) {}
}
```

### Monitor Network Requests

```javascript
const { mcpNetworkRequests } = require('./utils/mcp-helpers');

if (process.env.MCP_ENABLED === 'true') {
  try {
    const requests = await mcpNetworkRequests(callMcpTool);
    console.log('Network activity:', requests);
  } catch (e) {}
}
```

## Best Practices Checklist

- [ ] Use Playwright for primary test automation
- [ ] Add MCP as optional enhancement only
- [ ] Control MCP with `MCP_ENABLED` environment variable
- [ ] Wrap all MCP calls in try-catch blocks
- [ ] Always have Playwright fallbacks
- [ ] Don't make tests depend on MCP
- [ ] Use MCP for development, not CI/CD
- [ ] Document MCP usage in test comments

## Key Files

| File | Purpose |
|------|---------|
| `tests/utils/mcp-helpers.js` | MCP wrapper functions |
| `tests/examples/mcp-integration-example.spec.js` | Example tests |
| `docs/MCP_INTEGRATION_GUIDE.md` | Full documentation |

## MCP Helper Functions

```javascript
const {
  mcpSnapshot,              // Capture accessibility snapshot
  mcpScreenshot,            // Take screenshot
  mcpConsoleMessages,       // Get console logs
  mcpNetworkRequests,       // Get network requests
  mcpDebugFailure,          // Capture debug info on failure
  mcpNavigate,              // Navigate to URL
  mcpClick,                 // Click element
  mcpType,                  // Type text
  mcpFillForm,              // Fill form fields
  mcpEvaluate,              // Run JavaScript
  mcpWaitFor,               // Wait for condition
  hybridAccessibilityCheck  // Playwright + MCP analysis
} = require('./utils/mcp-helpers');
```

## Remember

**MCP complements Playwright, it doesn't replace it!**

```
┌─────────────────────────────────────────┐
│ Your Test Suite                         │
├─────────────────────────────────────────┤
│                                         │
│  Playwright (95%)                       │
│  ├── Fast automated tests               │
│  ├── CI/CD compatible                   │
│  └── Production ready                   │
│                                         │
│  MCP (5%) - Optional                    │
│  ├── Interactive debugging              │
│  ├── Accessibility analysis             │
│  └── Manual testing enhancement         │
│                                         │
└─────────────────────────────────────────┘
```

## Need Help?

- **Full Guide:** `docs/MCP_INTEGRATION_GUIDE.md`
- **Examples:** `tests/examples/mcp-integration-example.spec.js`
- **Contact:** kgosal@awesomemotive.com
