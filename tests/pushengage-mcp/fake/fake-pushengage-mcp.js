#!/usr/bin/env node
/**
 * A stand-in PushEngage MCP server for the harness self-test. NOT the real server.
 * It mimics the shape the real one is expected to have (send tool with subscriber_filter,
 * list/get notification tools, the new filter-values tool) so the harness can be checked offline.
 *
 * FAKE_BUG=b9  reproduces the bug PR #287 guards against: an unknown segment is dropped
 *              and the push goes to All Subscribers.
 */
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const SEGMENTS = ['Sports Fans', 'Tech News'];
const COUNTRIES = ['US', 'IN'];
const notifications = [];
let nextId = 1000;

const tools = [
  {
    name: 'pushengage_send_notification',
    description: 'Send a push notification. Omit subscriber_filter to send to all subscribers.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        message: { type: 'string' },
        url: { type: 'string' },
        subscriber_filter: {
          type: 'object',
          properties: {
            segments: { type: 'array', items: { type: 'string' } },
            countries: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['title', 'message', 'url'],
    },
  },
  {
    name: 'pushengage_list_notifications',
    description: 'List recent notifications.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
  },
  {
    name: 'pushengage_get_notification',
    description: 'Get one notification, including its audience.',
    inputSchema: { type: 'object', properties: { notification_id: { type: 'number' } }, required: ['notification_id'] },
  },
  {
    name: 'pushengage_list_audience_filter_values',
    description: 'List values usable in subscriber_filter.',
    inputSchema: { type: 'object', properties: { filter: { type: 'string', enum: ['segments', 'countries'] } } },
  },
  {
    name: 'pushengage_delete_segment',
    description: 'Delete a segment (should be blocked by the harness).',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
];

const text = (obj, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], isError });

function send(args) {
  const f = args.subscriber_filter || {};
  const unknown = (f.segments || []).filter((s) => !SEGMENTS.includes(s));
  let audience;
  if (unknown.length && process.env.FAKE_BUG !== 'b9') {
    return text({ error: `Unknown segment(s): ${unknown.join(', ')}. Nothing was sent.` }, true);
  }
  const segments = (f.segments || []).filter((s) => SEGMENTS.includes(s));
  if (!segments.length && !(f.countries || []).length) audience = { send_to: 'all_subscribers' };
  else audience = { send_to: 'custom', criteria: { segments, countries: f.countries || [] } };
  const n = { notification_id: nextId++, title: args.title, audience };
  notifications.unshift(n);
  return text({ notification_id: n.notification_id, status: 'sent' });
}

const server = new Server({ name: 'fake-pushengage', version: '0.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  switch (name) {
    case 'pushengage_send_notification':
      return send(args);
    case 'pushengage_list_notifications':
      return text({ notifications: notifications.slice(0, args.limit || 20).map(({ notification_id, title }) => ({ notification_id, title })) });
    case 'pushengage_get_notification': {
      const n = notifications.find((x) => x.notification_id === Number(args.notification_id));
      return n ? text(n) : text({ error: 'not found' }, true);
    }
    case 'pushengage_list_audience_filter_values':
      return text(args.filter === 'countries' ? { countries: COUNTRIES } : { segments: SEGMENTS });
    default:
      return text({ error: `unexpected call to ${name}` }, true);
  }
});

server.connect(new StdioServerTransport());
