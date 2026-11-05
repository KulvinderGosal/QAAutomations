#!/usr/bin/env node
/**
 * Adds a "pushengage-staging" MCP server to Claude Desktop, pointed at PushEngage staging.
 * Run on YOUR computer (not a cloud session):
 *
 *   node scripts/setup-pe-mcp-staging.js
 *   node scripts/setup-pe-mcp-staging.js --build /path/to/pushengage-mcp-1.1.0-qa.1.tgz
 *   node scripts/setup-pe-mcp-staging.js --build @pushengage/mcp@1.1.0-qa.1 --api-url https://<staging api host>
 *
 * What it does:
 *   - backs up claude_desktop_config.json, then adds/replaces only the "pushengage-staging" entry
 *   - keeps the staging login in its own token file (~/.pushengage/mcp-staging.json)
 *   - clears the npx cache so a new build isn't masked by an old one (skip with --keep-cache)
 *   - writes the same settings into QAAutomations/.env for the automated suite
 * Then restart Claude Desktop and follow tests/pushengage-mcp/MANUAL_CHECKLIST.md step 2.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DASHBOARD_URL = 'https://staging-app-dashboard2.pushengage.com';
// Best guess from DNS; confirm with the developer. Production is https://dashboard-public-api.pushengage.com
const DEFAULT_API_URL = 'https://staging-dashboard-public-api.pushengage.com';
const SITE_ID = '51041';
const SITE_NAME = 'QA Staging';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

function claudeConfigPath() {
  if (process.env.CLAUDE_DESKTOP_CONFIG) return process.env.CLAUDE_DESKTOP_CONFIG;
  const home = os.homedir();
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

function upsertEnvFile(file, values) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, '\n')}${line}\n`;
  }
  fs.writeFileSync(file, text);
}

function main() {
  const build = arg('build', '@pushengage/mcp@latest');
  const apiUrl = arg('api-url', DEFAULT_API_URL);
  const tokenFile = path.join(os.homedir(), '.pushengage', 'mcp-staging.json');
  const cfgFile = claudeConfigPath();

  let cfg = {};
  if (fs.existsSync(cfgFile)) {
    const raw = fs.readFileSync(cfgFile, 'utf8');
    try {
      cfg = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      console.error(`✖ ${cfgFile} is not valid JSON. Fix or move it, then rerun.`);
      process.exit(1);
    }
    const backup = `${cfgFile}.bak-${Date.now()}`;
    fs.copyFileSync(cfgFile, backup);
    console.log(`• Backed up Claude Desktop config to ${backup}`);
  } else {
    fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
  }

  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers['pushengage-staging'] = {
    command: 'npx',
    args: ['-y', build],
    env: {
      PUSHENGAGE_DASHBOARD_URL: DASHBOARD_URL,
      PUSHENGAGE_API_URL: apiUrl,
      PE_MCP_CONFIG_PATH: tokenFile,
      PE_MCP_CLIENT_NAME: 'Claude Desktop (QA Staging)',
    },
  };
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`✔ Added "pushengage-staging" to ${cfgFile}`);
  console.log(`  build:   ${build}`);
  console.log(`  api url: ${apiUrl}${apiUrl === DEFAULT_API_URL ? '   (best guess; confirm with the developer)' : ''}`);

  if (!flag('keep-cache')) {
    const npx = path.join(os.homedir(), '.npm', '_npx');
    if (fs.existsSync(npx)) {
      fs.rmSync(npx, { recursive: true, force: true });
      console.log('• Cleared the npx cache (~/.npm/_npx)');
    }
  }

  const repoEnv = path.join(__dirname, '..', '.env');
  upsertEnvFile(repoEnv, {
    PE_MCP_COMMAND: 'npx',
    PE_MCP_ARGS: `-y ${build}`,
    PUSHENGAGE_DASHBOARD_URL: DASHBOARD_URL,
    PUSHENGAGE_API_URL: apiUrl,
    PE_MCP_CONFIG_PATH: tokenFile,
    PE_MCP_SITE_ID: SITE_ID,
    PE_MCP_SITE_NAME: SITE_NAME,
  });
  console.log(`✔ Wrote the same settings to ${repoEnv} for the automated suite`);

  console.log(`
Next:
  1. Quit Claude Desktop completely and reopen it.
  2. In a new chat:  "Log me into PushEngage"   → log in to STAGING in the browser → Authorize
  3.                 "Use site ${SITE_ID}"
  4.                 "Show my PushEngage auth status"   → must say ${SITE_NAME} (${SITE_ID})
  5.                 "List your PushEngage tools"       → must include pushengage_list_audience_filter_values
     (missing = not the PR #287 build: rerun with --build <PR build>)`);
}

main();
