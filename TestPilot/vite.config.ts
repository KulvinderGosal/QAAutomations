import { defineConfig, loadEnv } from 'vite'
import type { PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { mountAll, attachRunnerLifecycle, startSchedulerWithAlerts } from './server/api'

// Every /api/* route (Asana/GitHub/Slack proxies, runner, scheduler, reports,
// pipelines, AI, QA authoring, flaky, SKB docs, device runs, TM SQLite store,
// perf) lives in ONE place — server/api.ts — and is mounted here AND by the
// production server (server/index.ts) through the same mountAll(). Add new routes
// in server/api.ts, never inline here. Tokens come from .env (never VITE_-prefixed,
// so they never reach the client bundle) and are only read server-side.
function testpilotApi(env: Record<string, string>): PluginOption {
  return {
    name: 'testpilot-api',
    apply: 'serve',
    configureServer(server) {
      // Kill any in-flight Playwright child when Vite shuts down or restarts
      // (config/.env edits restart the dev server and would orphan browsers).
      // The process-exit hook lives in server/runner.ts (deduped per process).
      attachRunnerLifecycle(server.httpServer)
      // Wire failure alerts to Slack + start the 30s ticker (dev-server-hosted —
      // fires only while `npm run dev` is up; the ticker is deduped per process).
      startSchedulerWithAlerts(env, 'http://localhost:5173')
      // G3: the request guard inside mountAll allows only localhost / 127.0.0.1 /
      // [::1] on this port (plus the socket's real port if Vite moved off 5173).
      mountAll((mw) => server.middlewares.use(mw), env, { ports: [Number(process.env.PORT) || 5173] })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Honor a harness-assigned PORT (autoPort) so the dev server can move off a
    // busy 5173; falls back to 5173 for a plain `npm run dev`.
    server: {
      port: Number(process.env.PORT) || 5173,
      // G3: loopback only. 'localhost' is Vite's default made explicit (on this
      // host it resolves to IPv6 ::1, so http://localhost:5173 keeps working).
      // NEVER set this to true / '0.0.0.0' — the API has no server-side auth.
      host: 'localhost',
      // The runner/scheduler/pipeline persist state into the project root
      // (.testpilot-runs.json, .testpilot-schedules.json). Vite watches dotfiles
      // by default, so every completed run wrote one of these and triggered a
      // full page reload — wiping the live RunPanel mid-run. Ignore them.
      watch: { ignored: ['**/.testpilot-*.json'] },
    },
    plugins: [react(), tailwindcss(), testpilotApi(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
