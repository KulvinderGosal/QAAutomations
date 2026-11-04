// @ts-check
/**
 * Step 0 from the brief: confirm you are on the PR build, not a cached one.
 * Also saves every tool's input schema to test-results/pushengage-mcp/tools.json
 * so you can see the real subscriber_filter shape. Read-only; sends nothing.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { McpSession, FILTER_VALUES_TOOL } = require('./lib/mcp-session');

test.describe('PushEngage MCP build check', () => {
  test.skip(!McpSession.isConfigured(), 'PE_MCP_COMMAND is not set; see tests/pushengage-mcp/README.md');

  test('PR #287 build exposes the filter-values tool and subscriber_filter @build', async ({}, testInfo) => {
    const session = await new McpSession().connect();
    try {
      const dir = path.join(__dirname, '..', '..', 'test-results', 'pushengage-mcp');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'tools.json'), JSON.stringify(session.tools, null, 2));

      const summary = {
        tools: session.toolNames(),
        sendTools: session.sendTools().map((t) => t.name),
        listNotificationsTool: session.listNotificationsTool()?.name || null,
        getNotificationTool: session.getNotificationTool()?.name || null,
      };
      await testInfo.attach('tool-summary.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
      console.log(JSON.stringify(summary, null, 2));

      expect(summary.tools, 'cached build? rm -rf ~/.npm/_npx, bump the prerelease version and repack').toContain(FILTER_VALUES_TOOL);
      expect(summary.sendTools.length, 'no tool accepts subscriber_filter').toBeGreaterThan(0);
      // Without these the live run cannot verify anything by itself; it will tell you to check the dashboard.
      if (!summary.listNotificationsTool) testInfo.annotations.push({ type: 'warning', description: 'no list-notifications tool found; set PE_MCP_LIST_TOOL' });
      if (!summary.getNotificationTool) testInfo.annotations.push({ type: 'warning', description: 'no get-notification tool found; set PE_MCP_GET_TOOL' });
    } finally {
      await session.close();
    }
  });
});
