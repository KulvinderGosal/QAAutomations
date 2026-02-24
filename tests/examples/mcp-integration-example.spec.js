const { test, expect } = require('@playwright/test');
const {
  mcpNavigate,
  mcpSnapshot,
  mcpClick,
  mcpType,
  mcpScreenshot,
  mcpConsoleMessages,
  mcpNetworkRequests,
  hybridAccessibilityCheck,
  mcpDebugFailure,
} = require('../utils/mcp-helpers');

/**
 * MCP Integration Example Test
 * 
 * This test demonstrates how to integrate Playwright MCP server tools
 * with your existing Playwright tests.
 * 
 * IMPORTANT NOTES:
 * 1. MCP tools require user approval for each browser operation
 * 2. MCP tools are best used for interactive/manual testing, not CI/CD
 * 3. For automated tests, continue using native Playwright APIs
 * 4. This example shows hybrid approaches where MCP complements Playwright
 * 
 * USE CASES FOR MCP:
 * - Interactive debugging sessions
 * - Manual exploratory testing
 * - Accessibility snapshot analysis
 * - AI-assisted test development
 * - Post-failure debugging and analysis
 */

test.describe('MCP Integration Examples', () => {
  
  /**
   * Example 1: Pure Playwright Test (Standard Approach)
   * This is your baseline - continue using this for automated tests
   */
  test('Example 1: Standard Playwright Test', async ({ page }) => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Example 1: Standard Playwright Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Standard Playwright operations
    await page.goto('https://example.com');
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    await page.screenshot({ path: 'test-results/example-standard.png' });
    
    expect(title).toBeTruthy();
    console.log('✅ Standard test passed\n');
  });
  
  /**
   * Example 2: Pure MCP Test (Interactive Approach)
   * This requires user approval for each step
   * Best for manual/interactive testing sessions
   */
  test('Example 2: Pure MCP Test (requires approval)', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes for approvals
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Example 2: Pure MCP Test');
    console.log('This will require user approval for each operation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Note: In this test, we're NOT using the page object from Playwright
    // MCP manages its own browser instance
    
    // MCP Navigation (requires approval)
    try {
      await mcpNavigate(async (params) => {
        // This would normally call the MCP tool
        // For this example, we're showing the structure
        console.log('MCP Navigate would be called here');
        console.log('Params:', params);
      }, 'https://example.com');
      
      // MCP Snapshot (requires approval)
      await mcpSnapshot(async (params) => {
        console.log('MCP Snapshot would be called here');
        console.log('Params:', params);
      });
      
      console.log('✅ MCP operations completed (if approved)\n');
    } catch (error) {
      console.log(`⚠️ MCP operations require user approval: ${error.message}\n`);
    }
  });
  
  /**
   * Example 3: Hybrid Approach - Playwright + MCP for Accessibility
   * Use Playwright for test automation, MCP for enhanced analysis
   */
  test('Example 3: Hybrid - Playwright + MCP Accessibility', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Example 3: Hybrid Approach - Playwright + MCP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Use Playwright for test automation
    console.log('🎭 Using Playwright for navigation...');
    await page.goto('https://example.com');
    await page.waitForTimeout(2000);
    
    const title = await page.title();
    console.log(`✓ Page loaded: ${title}`);
    
    // Use Playwright for assertions
    const heading = await page.locator('h1').first().textContent();
    console.log(`✓ Heading found: ${heading}`);
    
    expect(title).toContain('Example');
    expect(heading).toBeTruthy();
    
    // Use MCP for accessibility analysis (optional, requires approval)
    console.log('\n🔍 Attempting MCP accessibility check...');
    try {
      const analysis = await hybridAccessibilityCheck(page, async (params) => {
        console.log('MCP tool would be called here for accessibility snapshot');
        console.log('This provides enhanced accessibility tree information');
        console.log('Params:', params);
        
        // Return mock data for demonstration
        return {
          snapshot: 'Accessibility tree snapshot would be here',
          elements: ['button', 'link', 'heading'],
          ariaLabels: ['Submit', 'Learn more', 'Welcome']
        };
      });
      
      if (analysis) {
        console.log('✓ Accessibility analysis captured');
        console.log('  URL:', analysis.url);
        console.log('  Timestamp:', analysis.timestamp);
      }
    } catch (error) {
      console.log(`⚠️ MCP accessibility check skipped (requires approval)`);
    }
    
    console.log('\n✅ Hybrid test completed\n');
  });
  
  /**
   * Example 4: MCP for Post-Failure Debugging
   * When a test fails, use MCP to capture detailed debug info
   */
  test('Example 4: MCP for Debugging Failed Tests', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Example 4: MCP for Post-Failure Debugging');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
      // Normal test flow
      console.log('🎭 Running test with Playwright...');
      await page.goto('https://example.com');
      
      // Simulate a test that might fail
      const buttonExists = await page.locator('button.non-existent').count() > 0;
      
      if (!buttonExists) {
        throw new Error('Expected button not found on page');
      }
      
    } catch (error) {
      console.log(`\n❌ Test failed: ${error.message}`);
      
      // Use MCP for enhanced debugging
      console.log('\n🐛 Capturing debug information with MCP...');
      
      try {
        await mcpDebugFailure(page, async (params) => {
          console.log('MCP debug tool called:', params.toolName);
          
          // MCP would capture:
          // - Accessibility snapshot with element refs
          // - Console logs with full stack traces
          // - Network requests and responses
          // - Full-page screenshot
          
          return {
            captured: true,
            tools: ['snapshot', 'console', 'network', 'screenshot']
          };
        }, error);
        
        console.log('✓ Debug information captured via MCP');
        console.log('  - Page snapshot saved');
        console.log('  - Console logs captured');
        console.log('  - Network activity recorded');
        console.log('  - Screenshot taken');
        
      } catch (mcpError) {
        console.log(`⚠️ MCP debug capture skipped (requires approval)`);
      }
      
      // Take standard Playwright screenshot as fallback
      await page.screenshot({ 
        path: 'test-results/failure-fallback.png',
        fullPage: true 
      });
      
      console.log('\n✅ Failure handled with debugging info captured\n');
      
      // Don't fail the test for this example
      // In real tests, you would: throw error;
    }
  });
  
  /**
   * Example 5: Integration Pattern for Your PushEngage Tests
   * Shows how to add MCP to your existing signup test pattern
   */
  test('Example 5: PushEngage Pattern with Optional MCP', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Example 5: PushEngage Test Pattern with MCP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Standard Playwright test flow (always runs)
    console.log('🎭 Step 1: Navigate to page...');
    await page.goto('https://www.pushengage.com/wordpress-pricing/');
    await page.waitForTimeout(2000);
    
    console.log('✓ Page loaded\n');
    
    // Standard Playwright screenshot
    await page.screenshot({ 
      path: 'test-results/example-pushengage-1.png',
      fullPage: true 
    });
    
    // Optional: MCP accessibility snapshot for enhanced analysis
    const MCP_ENABLED = process.env.MCP_ENABLED === 'true';
    
    if (MCP_ENABLED) {
      console.log('🔍 MCP enabled - capturing accessibility snapshot...');
      try {
        // MCP snapshot provides element references for AI-assisted debugging
        await mcpSnapshot(async (params) => {
          console.log('MCP snapshot captured with element references');
          return { snapshot: 'accessibility-tree-data' };
        }, 'test-results/example-pushengage-snapshot.md');
        
        console.log('✓ MCP snapshot saved\n');
      } catch (error) {
        console.log('⚠️ MCP snapshot skipped (optional feature)\n');
      }
    }
    
    // Continue with standard test
    console.log('🔍 Step 2: Looking for elements...');
    const buttons = await page.locator('a:has-text("Start For Free")').count();
    console.log(`✓ Found ${buttons} "Start For Free" button(s)\n`);
    
    expect(buttons).toBeGreaterThan(0);
    
    console.log('✅ Test passed\n');
    console.log('💡 TIP: Set MCP_ENABLED=true to enable MCP features\n');
  });
  
  /**
   * Example 6: Console and Network Monitoring with MCP
   * MCP can capture console logs and network requests
   */
  test('Example 6: Console & Network Monitoring', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Example 6: Console & Network Monitoring with MCP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Standard Playwright test
    console.log('🎭 Loading page...');
    await page.goto('https://example.com');
    await page.waitForTimeout(2000);
    
    // Standard Playwright console listener
    const playwrightLogs = [];
    page.on('console', msg => {
      playwrightLogs.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    
    console.log('✓ Playwright console listener attached\n');
    
    // Optional: MCP console and network monitoring
    const MCP_ENABLED = process.env.MCP_ENABLED === 'true';
    
    if (MCP_ENABLED) {
      console.log('🔍 Capturing console logs with MCP...');
      try {
        const consoleLogs = await mcpConsoleMessages(async (params) => {
          // MCP provides enhanced console log capture
          return {
            logs: [
              { level: 'info', message: 'Page loaded', timestamp: Date.now() },
              { level: 'log', message: 'App initialized', timestamp: Date.now() }
            ]
          };
        });
        console.log('✓ MCP console logs captured\n');
      } catch (error) {
        console.log('⚠️ MCP console capture skipped\n');
      }
      
      console.log('🌐 Capturing network requests with MCP...');
      try {
        const networkData = await mcpNetworkRequests(async (params) => {
          // MCP provides detailed network request/response data
          return {
            requests: [
              { url: 'https://example.com', method: 'GET', status: 200 },
              { url: 'https://example.com/style.css', method: 'GET', status: 200 }
            ]
          };
        });
        console.log('✓ MCP network data captured\n');
      } catch (error) {
        console.log('⚠️ MCP network capture skipped\n');
      }
    }
    
    console.log(`📋 Playwright captured ${playwrightLogs.length} console messages`);
    console.log('✅ Test completed\n');
  });
});

/**
 * INTEGRATION GUIDE
 * 
 * How to add MCP to your existing tests:
 * 
 * 1. KEEP YOUR EXISTING PLAYWRIGHT TESTS
 *    - Don't replace Playwright with MCP
 *    - MCP is complementary, not a replacement
 * 
 * 2. ADD MCP AS OPTIONAL ENHANCEMENT
 *    - Use environment variable to enable: MCP_ENABLED=true
 *    - Wrap MCP calls in try-catch (they require user approval)
 *    - Use MCP for: accessibility analysis, debugging, manual testing
 * 
 * 3. HYBRID PATTERN (RECOMMENDED)
 *    ```javascript
 *    // Playwright for automation (always runs)
 *    await page.goto(url);
 *    await page.fill('input', 'value');
 *    await page.click('button');
 *    expect(await page.locator('.success').isVisible()).toBeTruthy();
 *    
 *    // MCP for analysis (optional, requires approval)
 *    if (process.env.MCP_ENABLED === 'true') {
 *      try {
 *        await mcpSnapshot(callMcpTool, 'analysis.md');
 *      } catch (e) {
 *        console.log('MCP skipped');
 *      }
 *    }
 *    ```
 * 
 * 4. DEBUGGING PATTERN
 *    ```javascript
 *    try {
 *      // Your test code
 *      await runTest(page);
 *    } catch (error) {
 *      // Standard Playwright debugging
 *      await page.screenshot({ path: 'failure.png' });
 *      
 *      // Enhanced MCP debugging (optional)
 *      await mcpDebugFailure(page, callMcpTool, error);
 *      
 *      throw error; // Re-throw to fail test
 *    }
 *    ```
 * 
 * 5. WHEN TO USE MCP vs PLAYWRIGHT
 * 
 *    Use Playwright (native) for:
 *    - Automated CI/CD tests
 *    - Regression testing
 *    - Fast execution
 *    - Reliable, repeatable tests
 * 
 *    Use MCP (optional) for:
 *    - Interactive debugging sessions
 *    - Manual exploratory testing
 *    - Accessibility snapshot analysis
 *    - AI-assisted test development
 *    - Post-failure deep debugging
 *    - Learning and understanding page structure
 * 
 * 6. EXAMPLE: ADDING TO PUSHENGAGE SIGNUP TEST
 *    
 *    In your pushengage-free-plan-signup.spec.js:
 *    
 *    ```javascript
 *    // At the top
 *    const { mcpSnapshot, mcpDebugFailure } = require('../utils/mcp-helpers');
 *    const MCP_ENABLED = process.env.MCP_ENABLED === 'true';
 *    
 *    // After navigation
 *    if (MCP_ENABLED) {
 *      try {
 *        await mcpSnapshot(callMcpTool, `signup-step-${stepNumber}.md`);
 *      } catch (e) {}
 *    }
 *    
 *    // In error handling
 *    if (errorFound && MCP_ENABLED) {
 *      await mcpDebugFailure(page, callMcpTool, new Error(errorMessage));
 *    }
 *    ```
 */
