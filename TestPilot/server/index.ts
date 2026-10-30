// TestPilot production server (INC-1 of public hosting — see HOSTING.md + the
// Phase-2 plan). Serves the built SPA from dist/ AND mounts every /api/* route
// through the shared handlers in ./api — the same handlers the Vite dev server
// uses, so dev and prod behave identically. Run with:
//
//   npm run build            # tsc -b && vite build  → dist/
//   npm start                # node --experimental-sqlite --import tsx server/index.ts
//
// Env: PORT (default 5199), HOST (default 127.0.0.1), APP_URL (for Slack alert
// links), TP_SCHEDULER=0 to NOT fire scheduled jobs from this process.
//
// ⚠️  There is NO server-side auth yet (INC-2). Until that lands, this server must
// stay bound to localhost / a private interface — it refuses to bind a public
// address unless TP_ALLOW_INSECURE=1 is set explicitly.
import express from 'express'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { mountAll, attachRunnerLifecycle, startSchedulerWithAlerts, type Middleware } from './api'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..') // TestPilot/
const DIST = join(ROOT, 'dist')
const INDEX_HTML = join(DIST, 'index.html')

const PORT = Number(process.env.PORT) || 5199
const HOST = process.env.HOST || '127.0.0.1'
const env = process.env

// INC-2: server-side auth is ON by default here (disable only with TP_AUTH=0).
// When it's on, every /api/* is gated by a session + role, so a non-local bind no
// longer leaks the runner/exec/token endpoints. We still refuse a public bind if
// auth is explicitly disabled, unless TP_ALLOW_INSECURE=1 is set knowingly.
const authOn = env.TP_AUTH !== '0'
const isLocal = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1'
if (!isLocal && !authOn && env.TP_ALLOW_INSECURE !== '1') {
  console.error(
    `\n✋ Refusing to bind ${HOST}:${PORT} with TP_AUTH=0 — unauthenticated /api/* would expose the\n` +
      `   runner/exec/token endpoints. Drop TP_AUTH=0 to enable server-side auth, keep it on localhost,\n` +
      `   or set TP_ALLOW_INSECURE=1 once you understand the risk.\n`,
  )
  process.exit(1)
}

if (!existsSync(INDEX_HTML)) {
  console.error(`\n✋ ${INDEX_HTML} not found — run \`npm run build\` first.\n`)
  process.exit(1)
}

const app = express()
app.disable('x-powered-by')

// 1) API — the same connect-style handlers used in dev. No body parser in front:
//    each handler reads the raw body itself (preserving size limits + 413s).
//    mountAll fronts everything with the G3 request guard (Host allowlist on
//    localhost/127.0.0.1/[::1]:PORT + Origin-required writes) before any route.
mountAll((mw) => app.use(mw as unknown as express.RequestHandler), env, { ports: [PORT], auth: authOn })

// 2) Static SPA assets (hashed files under dist/assets are safe to cache hard).
app.use(
  express.static(DIST, {
    index: false,
    setHeaders(res, path) {
      if (path.includes(`${'/assets/'}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }),
)

// 3) SPA fallback — any non-/api GET returns index.html so client routing works.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  if ((req.url || '').startsWith('/api/')) return next()
  res.sendFile(INDEX_HTML)
})

const appUrl = env.APP_URL || `http://${HOST}:${PORT}`
if (env.TP_SCHEDULER !== '0') startSchedulerWithAlerts(env, appUrl)

const server = createServer(app)
attachRunnerLifecycle(server)
server.listen(PORT, HOST, () => {
  console.log(`▶ TestPilot production server → http://${HOST}:${PORT}  (serving ${DIST})`)
  if (env.TP_SCHEDULER === '0') console.log('  scheduler: OFF (TP_SCHEDULER=0)')
})
