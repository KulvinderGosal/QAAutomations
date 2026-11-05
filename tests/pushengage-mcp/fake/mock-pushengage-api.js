/**
 * A stand-in for the PushEngage dashboard API (the /d/v1 routes the MCP calls), so the REAL
 * @pushengage/mcp build can be exercised offline. Point the MCP at it with
 * PUSHENGAGE_API_URL=http://127.0.0.1:<port> and a token file whose api_url matches.
 *
 * Every request is recorded, so a test can prove whether a notification was POSTed and with what body.
 * Site 51041 has: Sports Fans (active), Tech News (active), Old Promo (paused, status 0),
 * Dup Name x2, attribute "plan", and a few countries/devices.
 */
const http = require('http');

const SITE = 51041;
const SEGMENTS = [
  { segment_id: 101, segment_name: 'Sports Fans', status: 1, subscribers: 40 },
  { segment_id: 102, segment_name: 'Tech News', status: 1, subscribers: 25 },
  { segment_id: 103, segment_name: 'Old Promo', status: 0, subscribers: 10 },
  { segment_id: 104, segment_name: 'Dup Name', status: 1, subscribers: 1 },
  { segment_id: 105, segment_name: 'Dup Name', status: 1, subscribers: 2 },
];
const ATTRIBUTES = [{ id: 1, key: 'plan', name: 'Plan', status: 1 }];
const GEO = {
  country: { India: 120, 'United States': 80 },
  state: { Maharashtra: 50 },
  city: { Pune: 30 },
  device: { mobile: 150, desktop: 50 },
  device_type: { chrome: 140, firefox: 60 },
};

function start() {
  const requests = [];
  const notifications = [];
  let nextId = 9000;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const parsed = body ? safeJson(body) : undefined;
      requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: parsed });
      const send = (status, obj) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      const p = url.pathname.replace(/^\/d\/v1/, '');

      if (req.method === 'GET' && p === '/users/me') return send(200, { data: { user_id: 1, email: 'qa@example.com' } });
      if (req.method === 'GET' && p === '/users/1/sites') return send(200, { data: [{ site_id: SITE, site_name: 'QA Staging' }], total: 1, lastPage: 1 });
      if (req.method === 'GET' && p === `/sites/${SITE}`) return send(200, { data: { site_id: SITE, site_name: 'QA Staging', timezone: 'Asia/Kolkata' } });
      if (req.method === 'GET' && p === `/sites/${SITE}/segments`) {
        return send(200, { data: SEGMENTS, total: SEGMENTS.length, page: 1, perPage: 100, lastPage: 1 });
      }
      if (req.method === 'GET' && p === `/sites/${SITE}/subscriber-attributes`) {
        return send(200, { data: ATTRIBUTES, total: 1, page: 1, perPage: 100, lastPage: 1 });
      }
      if (req.method === 'GET' && p === `/sites/${SITE}/geo-segments`) {
        const types = (url.searchParams.get('type_data') || 'country').split(',');
        return send(200, { data: Object.fromEntries(types.map((t) => [t, GEO[t] || {}])) });
      }
      if (req.method === 'POST' && p === `/sites/${SITE}/notifications`) {
        const n = { notification_id: nextId++, notification_title: parsed?.notification_title || parsed?.title, body: parsed };
        notifications.unshift(n);
        return send(200, { data: { notification_id: n.notification_id } });
      }
      if (req.method === 'GET' && p === `/sites/${SITE}/notifications`) {
        return send(200, { data: notifications.map((n) => ({ notification_id: n.notification_id, notification_title: n.notification_title })), total: notifications.length, lastPage: 1 });
      }
      return send(404, { message: `mock: no route for ${req.method} ${p}` });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        notifications,
        notificationPosts: () => requests.filter((r) => r.method === 'POST' && /\/notifications$/.test(r.path)),
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

module.exports = { start, SITE };
