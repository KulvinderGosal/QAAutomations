/**
 * Talks to the PushEngage MCP server over stdio, the same way Claude Desktop / Claude Code do.
 *
 * The server is whatever PE_MCP_COMMAND + PE_MCP_ARGS start, e.g.
 *   PE_MCP_COMMAND=node  PE_MCP_ARGS=/path/to/pushengage-mcp/dist/index.js
 *   PE_MCP_COMMAND=npx   PE_MCP_ARGS=-y ./pushengage-mcp-0.4.0-qa.3.tgz
 *
 * Tool names are discovered from the server, not hard-coded:
 *   - send tools   = tools whose input schema has a `subscriber_filter` property
 *   - list tool    = a "list notifications" tool (used to diff before/after a send)
 *   - get tool     = a "get notification" tool (used to read back the saved audience)
 * Override with PE_MCP_LIST_TOOL / PE_MCP_GET_TOOL when the auto-detection picks wrong.
 */
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { resultJson, extractNotificationIds, findNotification } = require('./checks');

const FILTER_VALUES_TOOL = 'pushengage_list_audience_filter_values';

/** Tools the agent may call without PE_MCP_ALLOW_SEND. Anything else is blocked by the harness. */
const READ_ONLY_NAME = /(^|_)(list|get|search|describe|fetch|read|count|stats?|status)(_|$)/i;

function parseArgs(raw) {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  return trimmed.split(/\s+/);
}

class McpSession {
  constructor({ command, args, env, cwd } = {}) {
    this.command = command || process.env.PE_MCP_COMMAND;
    this.args = args || parseArgs(process.env.PE_MCP_ARGS);
    // The SDK only forwards a few safe vars by default; the server needs its API key etc.
    this.env = env || { ...process.env };
    this.cwd = cwd || process.env.PE_MCP_CWD || undefined;
    this.client = null;
    this.tools = [];
  }

  static isConfigured() {
    return Boolean(process.env.PE_MCP_COMMAND);
  }

  async connect() {
    if (!this.command) throw new Error('PE_MCP_COMMAND is not set. See tests/pushengage-mcp/README.md.');
    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: this.env,
      cwd: this.cwd,
      stderr: 'pipe',
    });
    this.stderr = '';
    this.client = new Client({ name: 'pushengage-mcp-qa-harness', version: '1.0.0' });
    await this.client.connect(this.transport);
    if (this.transport.stderr) {
      this.transport.stderr.on('data', (d) => {
        this.stderr = (this.stderr + d.toString()).slice(-20000);
      });
    }
    const { tools } = await this.client.listTools();
    this.tools = tools;
    return this;
  }

  async close() {
    if (this.client) await this.client.close().catch(() => {});
  }

  toolNames() {
    return this.tools.map((t) => t.name);
  }

  getTool(name) {
    return this.tools.find((t) => t.name === name);
  }

  /** Tools that accept subscriber_filter. Every one of them can send a push. */
  sendTools() {
    return this.tools.filter((t) => t.inputSchema?.properties?.subscriber_filter);
  }

  isSendTool(name) {
    return this.sendTools().some((t) => t.name === name) || /send|broadcast|schedule/i.test(name);
  }

  isReadOnlyTool(name) {
    return !this.isSendTool(name) && READ_ONLY_NAME.test(name);
  }

  listNotificationsTool() {
    if (process.env.PE_MCP_LIST_TOOL) return this.getTool(process.env.PE_MCP_LIST_TOOL);
    return this.tools.find((t) => /list.*notifications|notifications.*list/i.test(t.name) && noRequired(t));
  }

  getNotificationTool() {
    if (process.env.PE_MCP_GET_TOOL) return this.getTool(process.env.PE_MCP_GET_TOOL);
    return this.tools.find(
      (t) => /get.*notification(?!s)|notification.*(detail|info|get)/i.test(t.name) && requiredKeys(t).length === 1,
    );
  }

  async call(name, args = {}) {
    return this.client.callTool({ name, arguments: args });
  }

  /** Ids of the most recent notifications, or null when no list tool exists. */
  async recentNotificationIds() {
    const tool = this.listNotificationsTool();
    if (!tool) return null;
    const res = await this.call(tool.name, listArgs(tool));
    if (res.isError) throw new Error(`${tool.name} failed: ${JSON.stringify(res.content).slice(0, 500)}`);
    return extractNotificationIds(resultJson(res));
  }

  /**
   * Read one notification back through the MCP. Returns { json, raw, via } or null when it can't.
   * Uses a get-notification tool when there is one; otherwise finds the entry in the list tool's
   * output (pushengage_list_notifications returns each notification's `criteria`).
   */
  async getNotification(id) {
    const tool = this.getNotificationTool();
    if (!tool) {
      const list = this.listNotificationsTool();
      if (!list) return null;
      const raw = await this.call(list.name, listArgs(list));
      const json = findNotification(resultJson(raw), id);
      return json ? { json, raw, via: list.name } : null;
    }
    const [key] = requiredKeys(tool);
    const type = tool.inputSchema.properties?.[key]?.type;
    const value = type === 'number' || type === 'integer' ? Number(id) : String(id);
    const raw = await this.call(tool.name, { [key]: value });
    return { json: resultJson(raw), raw, via: tool.name };
  }
}

function requiredKeys(tool) {
  return tool.inputSchema?.required || [];
}

function noRequired(tool) {
  return requiredKeys(tool).length === 0;
}

/** Ask for a generous page when the list tool takes a limit-like argument. */
function listArgs(tool) {
  const props = tool.inputSchema?.properties || {};
  const args = {};
  for (const key of ['limit', 'per_page', 'page_size', 'count']) {
    if (props[key]) {
      args[key] = 50;
      break;
    }
  }
  return args;
}

module.exports = { McpSession, FILTER_VALUES_TOOL, parseArgs };
