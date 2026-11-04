// @ts-check
/**
 * PushEngage MCP server QA (tests/pushengage-mcp). No browser: tests talk to the MCP over stdio.
 * Runs one case at a time and never retries, because cases can send real pushes.
 */
const { defineConfig } = require('@playwright/test');
require('dotenv').config();

// One run id for every worker, so titles and the report file stay consistent across worker restarts.
process.env.PE_MCP_RUN_ID ||= new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

module.exports = defineConfig({
  testDir: './tests/pushengage-mcp',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 5 * 60 * 1000,
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/pushengage-mcp', open: 'never' }],
    ['json', { outputFile: 'test-results/pushengage-mcp/results.json' }],
  ],
  projects: [{ name: 'mcp' }],
});
