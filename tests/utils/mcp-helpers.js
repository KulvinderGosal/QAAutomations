/**
 * MCP (Model Context Protocol) Helpers for Playwright Tests
 * 
 * This module provides wrapper functions to use Playwright MCP server tools
 * alongside standard Playwright tests. The MCP server provides browser automation
 * capabilities that can complement or enhance your existing test code.
 * 
 * IMPORTANT: MCP tools require user approval for each browser operation.
 * They are best used for:
 * - Interactive debugging sessions
 * - Manual testing workflows
 * - AI-assisted test exploration
 * - Accessibility snapshot analysis
 * 
 * For standard automated tests, continue using native Playwright APIs.
 */

/**
 * MCP Server Configuration
 */
const MCP_SERVER = 'user-playwright';

/**
 * Navigate to a URL using MCP browser
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} url - The URL to navigate to
 * @returns {Promise<Object>} Navigation result
 * 
 * @example
 * const result = await mcpNavigate(callMcpTool, 'https://example.com');
 */
async function mcpNavigate(callMcpTool, url) {
  console.log(`🌐 [MCP] Navigating to: ${url}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_navigate',
    arguments: { url }
  });
}

/**
 * Capture accessibility snapshot of current page
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} [filename] - Optional filename to save snapshot
 * @returns {Promise<Object>} Snapshot result
 * 
 * @example
 * // Get snapshot in response
 * const snapshot = await mcpSnapshot(callMcpTool);
 * 
 * // Save snapshot to file
 * await mcpSnapshot(callMcpTool, 'page-snapshot.md');
 */
async function mcpSnapshot(callMcpTool, filename = null) {
  console.log('📸 [MCP] Capturing page snapshot...');
  
  const args = filename ? { filename } : {};
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_snapshot',
    arguments: args
  });
}

/**
 * Click an element on the page
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} ref - Element reference from snapshot
 * @param {Object} options - Click options
 * @param {string} [options.element] - Human-readable element description
 * @param {boolean} [options.doubleClick] - Whether to double click
 * @param {string} [options.button] - Button to click (left/right/middle)
 * @param {Array<string>} [options.modifiers] - Modifier keys
 * @returns {Promise<Object>} Click result
 * 
 * @example
 * await mcpClick(callMcpTool, 'button-ref-123', {
 *   element: 'Submit button',
 *   button: 'left'
 * });
 */
async function mcpClick(callMcpTool, ref, options = {}) {
  console.log(`🖱️  [MCP] Clicking element: ${options.element || ref}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_click',
    arguments: {
      ref,
      ...options
    }
  });
}

/**
 * Type text into an element
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} ref - Element reference from snapshot
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 * @param {string} [options.element] - Human-readable element description
 * @param {number} [options.delay] - Delay between keystrokes
 * @returns {Promise<Object>} Type result
 * 
 * @example
 * await mcpType(callMcpTool, 'input-ref-456', 'test@example.com', {
 *   element: 'Email input field',
 *   delay: 50
 * });
 */
async function mcpType(callMcpTool, ref, text, options = {}) {
  console.log(`⌨️  [MCP] Typing into element: ${options.element || ref}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_type',
    arguments: {
      ref,
      text,
      ...options
    }
  });
}

/**
 * Fill a form field (clears and types)
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {Object} formData - Form field data
 * @returns {Promise<Object>} Fill result
 * 
 * @example
 * await mcpFillForm(callMcpTool, {
 *   'email-input': 'test@example.com',
 *   'password-input': 'password123'
 * });
 */
async function mcpFillForm(callMcpTool, formData) {
  console.log('📝 [MCP] Filling form fields...');
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_fill_form',
    arguments: { formData }
  });
}

/**
 * Take a screenshot of the page
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {Object} options - Screenshot options
 * @param {string} [options.path] - Path to save screenshot
 * @param {boolean} [options.fullPage] - Capture full page
 * @param {Object} [options.clip] - Clip region {x, y, width, height}
 * @returns {Promise<Object>} Screenshot result
 * 
 * @example
 * await mcpScreenshot(callMcpTool, {
 *   path: 'test-results/screenshot.png',
 *   fullPage: true
 * });
 */
async function mcpScreenshot(callMcpTool, options = {}) {
  console.log('📷 [MCP] Taking screenshot...');
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_take_screenshot',
    arguments: options
  });
}

/**
 * Get console messages from the page
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @returns {Promise<Object>} Console messages
 * 
 * @example
 * const logs = await mcpConsoleMessages(callMcpTool);
 */
async function mcpConsoleMessages(callMcpTool) {
  console.log('📋 [MCP] Getting console messages...');
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_console_messages',
    arguments: {}
  });
}

/**
 * Get network requests from the page
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @returns {Promise<Object>} Network requests
 * 
 * @example
 * const requests = await mcpNetworkRequests(callMcpTool);
 */
async function mcpNetworkRequests(callMcpTool) {
  console.log('🌐 [MCP] Getting network requests...');
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_network_requests',
    arguments: {}
  });
}

/**
 * Execute JavaScript in the page context
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} script - JavaScript code to execute
 * @returns {Promise<Object>} Evaluation result
 * 
 * @example
 * const title = await mcpEvaluate(callMcpTool, 'document.title');
 */
async function mcpEvaluate(callMcpTool, script) {
  console.log('⚙️  [MCP] Evaluating JavaScript...');
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_evaluate',
    arguments: { script }
  });
}

/**
 * Wait for a condition or element
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {Object} options - Wait options
 * @param {string} [options.selector] - CSS selector to wait for
 * @param {string} [options.state] - State to wait for (visible/hidden/stable)
 * @param {number} [options.timeout] - Timeout in milliseconds
 * @returns {Promise<Object>} Wait result
 * 
 * @example
 * await mcpWaitFor(callMcpTool, {
 *   selector: '.success-message',
 *   state: 'visible',
 *   timeout: 5000
 * });
 */
async function mcpWaitFor(callMcpTool, options) {
  console.log(`⏳ [MCP] Waiting for: ${options.selector || 'condition'}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_wait_for',
    arguments: options
  });
}

/**
 * List open browser tabs
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @returns {Promise<Object>} List of tabs
 * 
 * @example
 * const tabs = await mcpListTabs(callMcpTool);
 */
async function mcpListTabs(callMcpTool) {
  console.log('📑 [MCP] Listing browser tabs...');
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_tabs',
    arguments: { action: 'list' }
  });
}

/**
 * Close the browser
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @returns {Promise<Object>} Close result
 * 
 * @example
 * await mcpCloseBrowser(callMcpTool);
 */
async function mcpCloseBrowser(callMcpTool) {
  console.log('🚪 [MCP] Closing browser...');
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_close',
    arguments: {}
  });
}

/**
 * Hover over an element
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} ref - Element reference from snapshot
 * @param {Object} options - Hover options
 * @param {string} [options.element] - Human-readable element description
 * @returns {Promise<Object>} Hover result
 * 
 * @example
 * await mcpHover(callMcpTool, 'menu-ref-789', {
 *   element: 'Dropdown menu'
 * });
 */
async function mcpHover(callMcpTool, ref, options = {}) {
  console.log(`👆 [MCP] Hovering over element: ${options.element || ref}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_hover',
    arguments: {
      ref,
      ...options
    }
  });
}

/**
 * Select option from dropdown
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} ref - Element reference from snapshot
 * @param {Object} options - Select options
 * @param {string} [options.value] - Value to select
 * @param {string} [options.label] - Label to select
 * @param {number} [options.index] - Index to select
 * @returns {Promise<Object>} Select result
 * 
 * @example
 * await mcpSelectOption(callMcpTool, 'select-ref-123', {
 *   label: 'United States'
 * });
 */
async function mcpSelectOption(callMcpTool, ref, options = {}) {
  console.log(`📋 [MCP] Selecting option: ${options.label || options.value || options.index}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_select_option',
    arguments: {
      ref,
      ...options
    }
  });
}

/**
 * Press a keyboard key
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} key - Key to press (e.g., 'Enter', 'Escape', 'Tab')
 * @returns {Promise<Object>} Key press result
 * 
 * @example
 * await mcpPressKey(callMcpTool, 'Enter');
 */
async function mcpPressKey(callMcpTool, key) {
  console.log(`⌨️  [MCP] Pressing key: ${key}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_press_key',
    arguments: { key }
  });
}

/**
 * Upload a file to input element
 * 
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {string} ref - Element reference from snapshot
 * @param {string} filePath - Path to file to upload
 * @returns {Promise<Object>} Upload result
 * 
 * @example
 * await mcpFileUpload(callMcpTool, 'file-input-ref', '/path/to/file.pdf');
 */
async function mcpFileUpload(callMcpTool, ref, filePath) {
  console.log(`📤 [MCP] Uploading file: ${filePath}`);
  
  return await callMcpTool({
    server: MCP_SERVER,
    toolName: 'browser_file_upload',
    arguments: {
      ref,
      filePath
    }
  });
}

/**
 * Hybrid approach: Combine Playwright with MCP for enhanced testing
 * 
 * This demonstrates using MCP tools for accessibility analysis
 * while still using Playwright for the actual test automation.
 * 
 * @param {Page} page - Playwright page object
 * @param {Function} callMcpTool - MCP tool caller function
 * @returns {Promise<Object>} Snapshot and analysis
 * 
 * @example
 * const analysis = await hybridAccessibilityCheck(page, callMcpTool);
 */
async function hybridAccessibilityCheck(page, callMcpTool) {
  console.log('\n🔍 [HYBRID] Running accessibility check...');
  
  // Use Playwright to navigate and interact
  const currentUrl = page.url();
  console.log(`Current page: ${currentUrl}`);
  
  // Use MCP to get accessibility snapshot for analysis
  try {
    const snapshot = await mcpSnapshot(callMcpTool);
    console.log('✓ Accessibility snapshot captured');
    return {
      url: currentUrl,
      snapshot,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.log(`⚠️ MCP snapshot failed (requires user approval): ${error.message}`);
    return null;
  }
}

/**
 * Integration example: Use MCP for debugging failed tests
 * 
 * @param {Page} page - Playwright page object
 * @param {Function} callMcpTool - MCP tool caller function
 * @param {Error} error - The error that occurred
 * @returns {Promise<void>}
 * 
 * @example
 * try {
 *   await someTestAction(page);
 * } catch (error) {
 *   await mcpDebugFailure(page, callMcpTool, error);
 *   throw error;
 * }
 */
async function mcpDebugFailure(page, callMcpTool, error) {
  console.log('\n🐛 [MCP DEBUG] Test failed, capturing debug info...');
  
  try {
    // Capture snapshot for analysis
    await mcpSnapshot(callMcpTool, `debug-failure-${Date.now()}.md`);
    
    // Get console logs
    const consoleLogs = await mcpConsoleMessages(callMcpTool);
    console.log('Console logs:', consoleLogs);
    
    // Get network requests
    const networkRequests = await mcpNetworkRequests(callMcpTool);
    console.log('Network activity:', networkRequests);
    
    // Take screenshot
    await mcpScreenshot(callMcpTool, {
      path: `debug-failure-${Date.now()}.png`,
      fullPage: true
    });
    
    console.log('✓ Debug information captured');
  } catch (mcpError) {
    console.log(`⚠️ MCP debug capture failed: ${mcpError.message}`);
  }
}

module.exports = {
  // Core navigation and interaction
  mcpNavigate,
  mcpClick,
  mcpType,
  mcpFillForm,
  mcpHover,
  mcpSelectOption,
  mcpPressKey,
  mcpFileUpload,
  
  // Page analysis
  mcpSnapshot,
  mcpScreenshot,
  mcpConsoleMessages,
  mcpNetworkRequests,
  mcpEvaluate,
  
  // Wait and timing
  mcpWaitFor,
  
  // Browser management
  mcpListTabs,
  mcpCloseBrowser,
  
  // Hybrid approaches
  hybridAccessibilityCheck,
  mcpDebugFailure,
  
  // Constants
  MCP_SERVER,
};
