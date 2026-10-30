// TestPilot API surface — the single source of truth for every /api/* route.
//
// Each factory returns a plain connect-style middleware `(req, res, next)` that
// depends only on node:http types — so the SAME handlers mount under BOTH the
// Vite dev server (`server.middlewares.use`) and the production Express server
// (`app.use`). Previously these lived inline in `vite.config.ts` (dev-only);
// extracting them here is INC-1 of the public-hosting work (see HOSTING.md).
//
// No body parser runs in front of these — each handler reads the raw request
// body itself (preserving the per-route size limits + typed 413 errors), exactly
// as the dev middleware did.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { randomBytes, createHash } from 'node:crypto'
import { basename } from 'node:path'
import { getMe, listMyTasks, completeTask, addComment, AsanaError, getTaskFull, listSubtasks, listStories, listAttachments, isAsanaGid, type AsanaTaskFull } from './asana'
import { buildIntakePack, planAsanaUpsert, productSuiteOptions, scrub, type IntakePack, type LooseTmState } from './qaLoop/intake'
import {
  getViewer,
  listMyIssues,
  listRepoIssues,
  closeIssue,
  commentOnIssue,
  latestCommit,
  getPullRequest,
  listPullRequests,
  GitHubError,
} from './github'
import { getTeam, listQaMessages, SlackError } from './slack'
import {
  RunnerError,
  activeRunId,
  adhocHealth,
  cancelRun,
  frameworkHealth,
  getRun,
  getRunDetail,
  listRunHistory,
  listScripts,
  listSpecs,
  shutdownRunner,
  startAdhocRun,
  startRun,
  type AdhocRequest,
  type RunRequest,
} from './runner'
import { listSmokeReports, readSmokeReport } from './reports'
import { probeSession, sessionsView, SessionError } from './sessions'
import { listFixturesView, FixturesError } from './fixtures'
import { listFlaky, diagnoseFlaky } from './flaky'
import {
  cancelPipeline,
  getPipeline,
  listPipelines,
  stagesFor,
  startPipeline,
  type StartPipelineInput,
} from './pipeline'
import {
  alertStatus,
  configureAlerts,
  configureCanary,
  createSchedule,
  deleteSchedule,
  listSchedules,
  runScheduleNow,
  sendTestAlert,
  startScheduler,
  toggleSchedule,
  type CreateScheduleInput,
} from './scheduler'
import { AiError, aiReady, credentialSource, generateSpec, interpretForRun, saveSpec, type AiCreds } from './aiTest'
import {
  planTask,
  scenariosForTask,
  generateAndSaveCases,
  exportRecord,
  coverageGap,
  resolveRecordPath,
  type PlanInput,
  type TestPlan,
  type TestScenario,
  type CoverageRequirement,
  type CoverageCase,
} from './qaPlanner'
import { runLoadTest, type PerfTarget } from './perf'
import {
  fetchKbIndex,
  parsePrRef,
  fetchPr,
  areaStubPr,
  analyzeWithFallback,
  composeWithFallback,
  createDraft,
  skbReady,
  SkbError,
  type DocPlanItem,
  type SkbCreds,
} from './skbDocs'
import { saveDeviceReport, listDeviceReports, readDeviceReport, type DeviceRun } from './deviceReports'
import { loadState, saveState, nextSeq, seedSeq, currentCounts, listBackups, restoreBackup } from './tmStore'
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  deleteSession,
  findByEmail,
  publicUser,
  resolveSession,
  verifyPassword,
  type Role,
  type ServerUser,
} from './authStore'

type Req = IncomingMessage
type Res = ServerResponse
type Next = (err?: unknown) => void
export type Middleware = (req: Req, res: Res, next: Next) => void
type Env = Record<string, string | undefined>

// Reject cross-origin state-changing requests (CSRF defence). A malicious page in
// the same browser can POST with Content-Type: text/plain (a CORS "simple request"
// — no preflight) and trigger REAL Asana/GitHub writes with the server-side tokens.
// Browsers send Origin on every non-GET/HEAD fetch (same-origin included), so the
// UI always has one. G3 hardening: a non-GET/HEAD request with NO Origin is now
// REJECTED too (it used to be waved through as "curl"); a local script must send
// `-H "Origin: http://localhost:5173"` explicitly. GET/HEAD without Origin stay OK.
function isSameOrigin(req: Req): boolean {
  const raw = req.headers.origin
  if (!raw) return req.method === 'GET' || req.method === 'HEAD'
  const origin = Array.isArray(raw) ? raw[0] : raw
  try {
    const u = new URL(origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return u.host === req.headers.host
  } catch {
    return false
  }
}

// ── G3 request guard: Host allowlist (DNS-rebinding defence) + global Origin ──
// The server binds loopback only (Vite `server.host: 'localhost'`; prod HOST
// 127.0.0.1). A DNS-rebinding page can still reach a loopback port under its OWN
// hostname, so every request's Host header must name a loopback host on one of
// our ports: localhost / 127.0.0.1 / [::1] on the configured port(s) OR the port
// this socket actually accepted on (covers Vite moving off a busy 5173). Extra
// exact `host:port` values (e.g. a private reverse-proxy name) can be added with
// TP_ALLOWED_HOSTS=a.example:443,b:8080 — a deliberate, reviewable config choice.
const LOOPBACK_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/i

export type GuardOptions = { ports?: number[]; extraHosts?: string[] }

function headerOne(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) || ''
}

export function isAllowedHost(hostHeader: string, allowedPorts: Set<number>, extraHosts: Set<string>, socketPort?: number): boolean {
  const host = hostHeader.trim().toLowerCase()
  if (!host) return false
  if (extraHosts.has(host)) return true
  const m = LOOPBACK_HOST_RE.exec(host)
  if (!m) return false
  const port = Number(m[2])
  return allowedPorts.has(port) || (socketPort !== undefined && port === socketPort)
}

export function requestGuard(opts: GuardOptions = {}): Middleware {
  const ports = new Set((opts.ports || []).filter((p) => Number.isInteger(p) && p > 0))
  // Browsers omit the default port from Host (https → no ":443", http → no ":80"),
  // so an entry like "proxy.example:443" also allows the bare "proxy.example".
  const extras = new Set(
    (opts.extraHosts || [])
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
      .flatMap((h) => (/:(443|80)$/.test(h) ? [h, h.replace(/:(443|80)$/, '')] : [h])),
  )
  return (req, res, next) => {
    const url = req.url || ''
    const isApi = url.startsWith('/api/')
    const deny = (status: number, obj: { error: string; code: string }) => {
      res.statusCode = status
      if (isApi) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      } else {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(`${obj.error}\n`)
      }
    }
    const host = headerOne(req.headers.host)
    if (!host) return deny(400, { error: 'Host header required', code: 'host-missing' })
    if (!isAllowedHost(host, ports, extras, req.socket?.localPort)) {
      return deny(421, {
        error: `Host "${host.slice(0, 100)}" is not allowed — open TestPilot at http://localhost:<port>`,
        code: 'host-not-allowed',
      })
    }
    // Every state-changing /api call must be same-origin with an explicit Origin
    // (individual handlers re-check; this covers DELETE + any future route).
    if (isApi && req.method !== 'GET' && req.method !== 'HEAD' && !isSameOrigin(req)) {
      return deny(403, {
        error: req.headers.origin
          ? 'cross-origin request blocked'
          : 'cross-origin request blocked: an Origin header is required for non-GET requests',
        code: req.headers.origin ? 'cross-origin' : 'origin-required',
      })
    }
    next()
  }
}

// ── Per-page-load write nonce (/api/session/nonce) ───────────────────────────
// The four direct third-party WRITE routes (/api/asana/comment, /api/asana/
// complete-task, /api/github/close-issue, /api/github/comment) additionally need
// an X-TP-Nonce header issued by GET /api/session/nonce. The UI fetches one per
// page load (src/lib/session.ts) and its confirm-dialog flows send it. The nonce
// is in-memory only: a server restart invalidates it and the client re-fetches
// once on a `bad-nonce` 403. A custom header also forces a CORS preflight, which
// a cross-origin page cannot pass.
const NONCE_TTL_MS = 24 * 60 * 60 * 1000
const NONCE_MAX = 256
const issuedNonces = new Map<string, number>() // nonce → issuedAt (insertion-ordered)

function issueNonce(): string {
  const now = Date.now()
  for (const [n, at] of issuedNonces) {
    if (now - at > NONCE_TTL_MS || issuedNonces.size >= NONCE_MAX) issuedNonces.delete(n)
    else break
  }
  const nonce = randomBytes(24).toString('base64url')
  issuedNonces.set(nonce, now)
  return nonce
}

function hasValidNonce(req: Req): boolean {
  const n = headerOne(req.headers['x-tp-nonce']).trim()
  if (!n) return false
  const at = issuedNonces.get(n)
  return at !== undefined && Date.now() - at <= NONCE_TTL_MS
}

const BAD_NONCE = {
  error: 'This write needs a fresh TestPilot page nonce (X-TP-Nonce). Reload TestPilot and confirm the action again.',
  code: 'bad-nonce',
}

export function sessionHandler(): Middleware {
  return (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/session/')) return next()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    const [pathname] = url.split('?')
    if (pathname === '/api/session/nonce' && req.method === 'GET') {
      // Same-origin only: if the browser says where this came from, it must be us.
      const site = headerOne(req.headers['sec-fetch-site'])
      if (req.headers.origin && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked', code: 'cross-origin' })
      if (site && site !== 'same-origin' && site !== 'none') return send(403, { error: 'cross-site request blocked', code: 'cross-site' })
      return send(200, { nonce: issueNonce(), ttlMs: NONCE_TTL_MS })
    }
    return send(404, { error: 'not_found' })
  }
}

// Shared raw-body reader — preserves each route's size ceiling + typed 413 error.
function readBody(req: Req, limit: number, makeErr: (msg: string) => Error): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c: Buffer) => {
      body += c.toString('utf8')
      if (body.length > limit) reject(makeErr('Body too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// ── Asana proxy (/api/asana/*) ───────────────────────────────────────────────
export function asanaHandler(token: string, workspaceGid: string): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/asana/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    const writePath = url.split('?')[0]
    if (req.method === 'POST' && (writePath === '/api/asana/complete-task' || writePath === '/api/asana/comment') && !hasValidNonce(req))
      return send(403, BAD_NONCE)
    if (!token) return send(200, { connected: false, reason: 'no_token' })
    try {
      const [pathname] = url.split('?')
      if (url.startsWith('/api/asana/me')) {
        const me = await getMe(token)
        return send(200, { connected: true, user: me })
      }
      // V2a read-only intake: one task by gid / its subtasks (text fields redacted).
      const taskM = /^\/api\/asana\/(task|subtasks)\/([^/]+)$/.exec(pathname)
      if (taskM && req.method === 'GET') {
        if (!isAsanaGid(taskM[2])) return send(400, { error: 'Invalid Asana gid (digits only)' })
        if (taskM[1] === 'task') return send(200, { connected: true, task: scrubTask(await getTaskFull(token, taskM[2])) })
        const subtasks = (await listSubtasks(token, taskM[2])).map(scrubTask)
        return send(200, { connected: true, gid: taskM[2], count: subtasks.length, subtasks })
      }
      if (url.startsWith('/api/asana/tasks')) {
        const r = await listMyTasks(token, workspaceGid || undefined)
        return send(200, { connected: true, user: { gid: r.user.gid, name: r.user.name }, workspace: r.workspace, tasks: r.tasks })
      }
      if (pathname === '/api/asana/complete-task' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000, (m) => new AsanaError(413, m))) || '{}') as { gid?: string }
        if (!b.gid) return send(400, { error: 'gid required' })
        return send(200, await completeTask(token, b.gid))
      }
      if (pathname === '/api/asana/comment' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000, (m) => new AsanaError(413, m))) || '{}') as { gid?: string; text?: string; mention?: string }
        if (!b.gid || !b.text) return send(400, { error: 'gid and text required' })
        return send(200, await addComment(token, b.gid, b.text, b.mention))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof AsanaError ? e.status : 500
      return send(status, { connected: false, error: (e as Error).message })
    }
  }
}

// Asana text is DATA: redact secret-shaped values before it leaves the server.
function scrubTask(t: AsanaTaskFull): AsanaTaskFull {
  return {
    ...t,
    name: scrub(t.name),
    notes: scrub(t.notes),
    html_notes: scrub(t.html_notes),
    custom_fields: t.custom_fields.map((f) => ({ ...f, display_value: f.display_value == null ? f.display_value : scrub(f.display_value) })),
  }
}

// ── V2a Asana → TM import (/api/tm/import/asana/:gid) ─────────────────────────
// POST, same-origin + X-TP-Nonce. Body {productId?, previewHash?, confirm?, actor?}.
// Without confirm:true it is PREVIEW-ONLY (reads Asana, parses, plans the upsert,
// writes nothing). With confirm:true + the previewHash the user saw, it re-reads
// Asana, refuses (409) if the pack changed since the preview, then upserts into the
// TM state via saveState() (which snapshots the prior state first) and returns the
// touched suites/cases so the open client can merge them. Asana is never written.
async function readAsanaPack(token: string, gid: string): Promise<IntakePack> {
  const task = await getTaskFull(token, gid)
  const [subtasks, stories] = await Promise.all([listSubtasks(token, gid), listStories(token, gid)])
  const attachments = await listAttachments(token, gid, stories)
  return buildIntakePack({ task, subtasks, stories, attachments })
}

function packHash(pack: IntakePack, productId: string | null): string {
  return createHash('sha256').update(JSON.stringify({ pack, productId })).digest('hex').slice(0, 32)
}

export function tmImportHandler(token: string): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    const m = /^\/api\/tm\/import\/asana\/([^/?]+)(?:\?.*)?$/.exec(url)
    if (!m) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method !== 'POST') return send(405, { error: 'POST only (preview without confirm:true writes nothing)' })
    if (!isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked', code: 'cross-origin' })
    if (!hasValidNonce(req)) return send(403, BAD_NONCE)
    const gid = m[1]
    if (!isAsanaGid(gid)) return send(400, { error: 'Invalid Asana gid (digits only)' })
    if (!token) return send(503, { error: 'Asana is not connected (no ASANA_ACCESS_TOKEN in TestPilot/.env)', code: 'no_token' })
    try {
      const b = JSON.parse((await readBody(req, 64_000, (msg) => new AsanaError(413, msg))) || '{}') as {
        productId?: string | null
        previewHash?: string
        confirm?: boolean
        actor?: string
      }
      const pack = await readAsanaPack(token, gid)
      const raw = loadState()
      const state = raw ? (JSON.parse(raw) as LooseTmState) : null
      const options = productSuiteOptions(state)
      const productId = b.productId === undefined ? pack.productGuess.productId : b.productId
      if (productId !== null && !options.some((o) => o.productId === productId))
        return send(400, { error: `Unknown productId "${String(productId)}" — pick one of the product suites`, productOptions: options })
      const hash = packHash(pack, productId)
      const at = new Date().toISOString()
      const actor = (typeof b.actor === 'string' && b.actor.trim() ? b.actor.trim() : 'QA').slice(0, 80)
      if (!state || !Array.isArray(state.suites) || !Array.isArray(state.cases))
        return send(409, { error: 'The TM database is empty — open TestPilot once so it seeds, then import', code: 'tm-empty' })
      const plan = planAsanaUpsert(state, pack, { productId, actor, now: at })
      const planOut = { actions: plan.actions, suite: plan.suite, counts: plan.counts }
      if (b.confirm !== true) return send(200, { mode: 'preview', pack, plan: planOut, productId, productOptions: options, previewHash: hash })
      if (b.previewHash !== hash)
        return send(409, { error: 'The Asana task (or the chosen product) changed since the preview — preview again before confirming', code: 'changed', pack, plan: planOut, previewHash: hash })
      const saved = saveState(JSON.stringify(plan.next), `asana-import-${gid}`)
      return send(200, {
        mode: 'applied',
        counts: plan.counts,
        suite: plan.suite,
        cases: plan.touchedCases,
        suites: plan.touchedSuites,
        seq: plan.next.seq,
        activity: plan.next.activity?.[0] ?? null,
        savedAt: saved.savedAt,
        warning: saved.warning,
      })
    } catch (e) {
      const status = e instanceof AsanaError ? e.status : 500
      return send(status, { error: scrub((e as Error).message) })
    }
  }
}

// ── GitHub proxy (/api/github/*) ─────────────────────────────────────────────
export function githubHandler(token: string, repo: string): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/github/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    const writePath = url.split('?')[0]
    if (req.method === 'POST' && (writePath === '/api/github/close-issue' || writePath === '/api/github/comment') && !hasValidNonce(req))
      return send(403, BAD_NONCE)
    if (!token) return send(200, { connected: false, reason: 'no_token' })
    try {
      const [pathname, query] = url.split('?')
      const params = new URLSearchParams(query || '')
      if (url.startsWith('/api/github/me')) {
        const me = await getViewer(token)
        return send(200, { connected: true, user: { login: me.login, name: me.name } })
      }
      if (pathname === '/api/github/repo-issues' && req.method === 'GET') {
        const r = params.get('repo') || repo
        if (!r) return send(400, { error: 'repo required' })
        const issues = await listRepoIssues(token, r)
        return send(200, { connected: true, repo: r, issues })
      }
      if (pathname === '/api/github/latest-commit' && req.method === 'GET') {
        const r = params.get('repo') || repo
        if (!r) return send(400, { error: 'repo required' })
        const branch = params.get('branch') || 'master'
        return send(200, { connected: true, repo: r, branch, commit: await latestCommit(token, r, branch) })
      }
      if (pathname === '/api/github/pr' && req.method === 'GET') {
        const r = params.get('repo') || repo
        const n = Number(params.get('number'))
        if (!r || !n) return send(400, { error: 'repo and number required' })
        return send(200, { connected: true, repo: r, pr: await getPullRequest(token, r, n) })
      }
      if (pathname === '/api/github/prs' && req.method === 'GET') {
        const r = params.get('repo') || repo
        if (!r) return send(400, { error: 'repo required' })
        return send(200, { connected: true, repo: r, prs: await listPullRequests(token, r) })
      }
      if (pathname === '/api/github/close-issue' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000, (m) => new GitHubError(413, m))) || '{}') as { repo?: string; number?: number }
        const r = b.repo || repo
        if (!r || !b.number) return send(400, { error: 'repo and number required' })
        return send(200, { issue: await closeIssue(token, r, Number(b.number)) })
      }
      if (pathname === '/api/github/comment' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000, (m) => new GitHubError(413, m))) || '{}') as { repo?: string; number?: number; body?: string }
        const r = b.repo || repo
        if (!r || !b.number || !b.body) return send(400, { error: 'repo, number and body required' })
        return send(200, { comment: await commentOnIssue(token, r, Number(b.number), String(b.body)) })
      }
      if (url.startsWith('/api/github/issues')) {
        const r = await listMyIssues(token, repo || undefined)
        return send(200, { connected: true, user: { login: r.user.login, name: r.user.name }, repo: r.repo, issues: r.issues })
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof GitHubError ? e.status : 500
      return send(status, { connected: false, error: (e as Error).message })
    }
  }
}

// ── Slack proxy (/api/slack/*) ───────────────────────────────────────────────
export function slackHandler(token: string, channel: string): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/slack/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (!token) return send(200, { connected: false, reason: 'no_token' })
    try {
      if (url.startsWith('/api/slack/me')) {
        const team = await getTeam(token)
        return send(200, { connected: true, team: team.name, channel })
      }
      if (url.startsWith('/api/slack/tasks')) {
        const r = await listQaMessages(token, channel || 'qa-automation')
        return send(200, { connected: true, team: r.team.name, channel: r.channel, messages: r.messages })
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof SlackError ? e.status : 500
      return send(status, { connected: false, error: (e as Error).message })
    }
  }
}

// ── Playwright runner (/api/runner/*) — spawns real test processes ───────────
export function runnerHandler(): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/runner/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname, query] = url.split('?')
      const params = new URLSearchParams(query || '')
      if (pathname === '/api/runner/frameworks' && req.method === 'GET') {
        return send(200, { frameworks: frameworkHealth(), adhoc: adhocHealth(), activeRunId: activeRunId() })
      }
      if (pathname === '/api/runner/adhoc' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 64_000, (m) => new RunnerError(413, m))) || '{}') as AdhocRequest
        return send(201, { run: startAdhocRun(body) })
      }
      if (pathname === '/api/runner/specs' && req.method === 'GET') {
        const framework = params.get('framework') || ''
        const specs = await listSpecs(framework, params.get('refresh') === '1')
        return send(200, { framework, specs })
      }
      if (pathname === '/api/runner/scripts' && req.method === 'GET') {
        const framework = params.get('framework') || ''
        return send(200, { framework, scripts: listScripts(framework) })
      }
      if (pathname === '/api/runner/runs' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 64_000, (m) => new RunnerError(413, m))) || '{}') as RunRequest
        return send(201, { run: startRun(body) })
      }
      if (pathname === '/api/runner/detail' && req.method === 'GET') {
        return send(200, { detail: getRunDetail(params.get('id') || '') })
      }
      const runMatch = pathname.match(/^\/api\/runner\/runs\/([\w-]+)(\/cancel)?$/)
      if (runMatch && runMatch[2] && req.method === 'POST') {
        return send(200, { run: cancelRun(runMatch[1]) })
      }
      if (runMatch && req.method === 'GET') {
        const offset = Number(params.get('offset') || '0')
        return send(200, getRun(runMatch[1], Number.isFinite(offset) ? offset : 0))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof RunnerError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── I1 sessions (/api/sessions*) — persona probe state + canary ──────────────
// GET  /api/sessions[?cached=1]          every persona + its latest probe (stale ones are
//                                         re-probed offline first, unless cached=1) + canary
// POST /api/sessions/:persona/probe       fresh probe; body {live?: true} = ONE read-only GET
//                                         (never for production personas). Same-origin + X-TP-Nonce.
// Probes never return a token — only identity labels and expiry times.
export function sessionsHandler(): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (url !== '/api/sessions' && !url.startsWith('/api/sessions/') && !url.startsWith('/api/sessions?')) return next()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    try {
      const [pathname, query] = url.split('?')
      const params = new URLSearchParams(query || '')
      if (pathname === '/api/sessions' && req.method === 'GET') {
        return send(200, await sessionsView({ cachedOnly: params.get('cached') === '1' }))
      }
      const m = pathname.match(/^\/api\/sessions\/([^/]+)\/probe$/)
      if (m && req.method === 'POST') {
        if (!isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked', code: 'cross-origin' })
        if (!hasValidNonce(req)) return send(403, BAD_NONCE)
        let persona = ''
        try {
          persona = decodeURIComponent(m[1])
        } catch {
          return send(400, { error: 'invalid persona' })
        }
        const body = JSON.parse((await readBody(req, 4_000, (msg) => new SessionError(413, msg))) || '{}') as { live?: boolean }
        const probe = await probeSession(persona, { force: true, live: body.live === true })
        return send(200, { probe })
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof SessionError ? e.status : e instanceof SyntaxError ? 400 : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── D4 fixture registry (/api/fixtures) — read-only ──────────────────────────
// GET /api/fixtures → {file, version, updated, loadedAt, fixtures[], counts} from
// <QA-Automations>/config/fixtures.json via qa-core loadFixtures (server/fixtures.ts).
// Allowlisted identifier fields only, siteKey masked, output re-checked for secret
// shapes. No write route exists — edit the JSON file by hand.
export function fixturesHandler(): Middleware {
  return (req, res, next) => {
    const url = req.url || ''
    if (url !== '/api/fixtures' && !url.startsWith('/api/fixtures?') && !url.startsWith('/api/fixtures/')) return next()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    const [pathname] = url.split('?')
    if (pathname !== '/api/fixtures') return send(404, { error: 'not_found' })
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD')
      return send(405, { error: 'read-only: edit config/fixtures.json by hand', code: 'read-only' })
    }
    try {
      return send(200, listFixturesView())
    } catch (e) {
      if (e instanceof FixturesError) return send(e.status, { error: e.message, code: e.code })
      return send(500, { error: 'fixture registry could not be read', code: 'internal' })
    }
  }
}

// ── Scheduler (/api/schedule*) ───────────────────────────────────────────────
// Starting the ticker + wiring alerts is separate (startSchedulerWithAlerts) so
// the caller controls whether THIS process fires jobs.
export function scheduleHandler(): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/schedule')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method !== 'GET' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname] = url.split('?')
      if (pathname === '/api/schedule/list' && req.method === 'GET') {
        return send(200, { schedules: listSchedules() })
      }
      if (pathname === '/api/schedule/alert-status' && req.method === 'GET') {
        return send(200, alertStatus())
      }
      if (pathname === '/api/schedule/test-alert' && req.method === 'POST') {
        return send(200, await sendTestAlert())
      }
      if (pathname === '/api/schedule' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 64_000, (m) => new RunnerError(413, m))) || '{}') as CreateScheduleInput
        return send(201, { schedule: createSchedule(body) })
      }
      const m = pathname.match(/^\/api\/schedule\/([\w-]+)(\/run|\/toggle)?$/)
      if (m) {
        const id = m[1]
        if (m[2] === '/run' && req.method === 'POST') return send(200, runScheduleNow(id))
        if (m[2] === '/toggle' && req.method === 'POST') {
          const body = JSON.parse((await readBody(req, 64_000, (m2) => new RunnerError(413, m2))) || '{}') as { enabled?: boolean }
          return send(200, { schedule: toggleSchedule(id, body.enabled !== false) })
        }
        if (!m[2] && req.method === 'DELETE') {
          deleteSchedule(id)
          return send(200, { ok: true })
        }
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof RunnerError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── Reports (/api/reports/*) — read-only ─────────────────────────────────────
export function reportsHandler(): Middleware {
  return (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/reports/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    try {
      const [pathname, query] = url.split('?')
      const params = new URLSearchParams(query || '')
      if (pathname === '/api/reports/history' && req.method === 'GET') {
        return send(200, { history: listRunHistory() })
      }
      if (pathname === '/api/reports/smoke' && req.method === 'GET') {
        return send(200, { reports: listSmokeReports() })
      }
      if (pathname === '/api/reports/smoke/file' && req.method === 'GET') {
        return send(200, readSmokeReport(params.get('path') || ''))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof RunnerError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── Flaky diagnostics (/api/flaky/*) ─────────────────────────────────────────
export function flakyHandler(creds: AiCreds): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/flaky/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname] = url.split('?')
      if (pathname === '/api/flaky/list' && req.method === 'GET') {
        return send(200, { flaky: listFlaky(), aiReady: aiReady(creds) })
      }
      if (pathname === '/api/flaky/diagnose' && req.method === 'POST') {
        if (!aiReady(creds)) throw new AiError(400, 'AI is not configured. Add ANTHROPIC_API_KEY to .env, or run `ant auth login`.')
        const b = JSON.parse((await readBody(req, 64_000, (m) => new AiError(413, m))) || '{}') as { runId: string; spec?: string | null; title?: string | null }
        if (!b.runId) throw new AiError(400, 'runId required')
        return send(200, await diagnoseFlaky(creds, b))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof AiError ? e.status : e instanceof RunnerError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── Pipelines (/api/pipeline*) ───────────────────────────────────────────────
export function pipelineHandler(): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/pipeline')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method !== 'GET' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname] = url.split('?')
      if (pathname === '/api/pipeline/list' && req.method === 'GET') return send(200, { pipelines: listPipelines() })
      if (pathname === '/api/pipeline/stages' && req.method === 'GET') {
        const framework = new URLSearchParams(url.split('?')[1] || '').get('framework') || ''
        return send(200, { framework, stages: stagesFor(framework) })
      }
      if (pathname === '/api/pipeline' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 64_000, (m) => new RunnerError(413, m))) || '{}') as StartPipelineInput
        return send(201, { pipeline: startPipeline(body) })
      }
      const m = pathname.match(/^\/api\/pipeline\/([\w-]+)(\/cancel)?$/)
      if (m) {
        if (m[2] === '/cancel' && req.method === 'POST') return send(200, { pipeline: cancelPipeline(m[1]) })
        if (!m[2] && req.method === 'GET') return send(200, { pipeline: getPipeline(m[1]) })
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof RunnerError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── AI prompt (/api/ai/*) ────────────────────────────────────────────────────
export function aiHandler(creds: AiCreds): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/ai/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname] = url.split('?')
      if (pathname === '/api/ai/status' && req.method === 'GET') {
        return send(200, { ready: aiReady(creds), source: credentialSource(creds), model: 'claude-opus-4-8' })
      }
      if (pathname === '/api/ai/interpret' && req.method === 'POST') {
        if (!aiReady(creds)) throw new AiError(400, 'AI is not configured. Add ANTHROPIC_API_KEY to .env, or run `ant auth login`.')
        const b = JSON.parse((await readBody(req, 256_000, (m) => new AiError(413, m))) || '{}') as { prompt?: string; url?: string }
        if (!b.prompt?.trim() || !b.url?.trim()) throw new AiError(400, 'prompt and url are required')
        return send(200, await interpretForRun(creds, b.prompt, b.url))
      }
      if (pathname === '/api/ai/generate' && req.method === 'POST') {
        if (!aiReady(creds)) throw new AiError(400, 'AI is not configured. Add ANTHROPIC_API_KEY to .env, or run `ant auth login`.')
        const b = JSON.parse((await readBody(req, 256_000, (m) => new AiError(413, m))) || '{}') as { prompt?: string; url?: string }
        if (!b.prompt?.trim() || !b.url?.trim()) throw new AiError(400, 'prompt and url are required')
        return send(200, await generateSpec(creds, b.prompt, b.url))
      }
      if (pathname === '/api/ai/save' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 256_000, (m) => new AiError(413, m))) || '{}') as { frameworkId?: string; filename?: string; spec?: string }
        if (!b.frameworkId || !b.spec) throw new AiError(400, 'frameworkId and spec are required')
        return send(200, await saveSpec(b.frameworkId, b.filename || '', b.spec))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof AiError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── AI QA authoring (/api/qa/*) — includes a binary .xlsx download ───────────
export function qaHandler(creds: AiCreds): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/qa/')) return next()
    const [pathname, qs] = url.split('?')

    // Binary download of a generated Excel record — streamed, not JSON.
    if (pathname === '/api/qa/record' && req.method === 'GET') {
      try {
        const params = new URLSearchParams(qs || '')
        const resolved = resolveRecordPath(params.get('path') || '')
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="${basename(resolved)}"`)
        createReadStream(resolved).pipe(res)
      } catch (e) {
        const status = e instanceof AiError ? e.status : 500
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = status
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
      return
    }

    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const requireAi = () => {
        if (!aiReady(creds)) throw new AiError(400, 'AI is not configured. Add ANTHROPIC_API_KEY to .env, or run `ant auth login`.')
      }
      if (pathname === '/api/qa/plan' && req.method === 'POST') {
        requireAi()
        const b = JSON.parse((await readBody(req, 512_000, (m) => new AiError(413, m))) || '{}') as { input?: PlanInput }
        if (!b.input?.title?.trim()) throw new AiError(400, 'input.title is required')
        return send(200, { plan: await planTask(creds, b.input) })
      }
      if (pathname === '/api/qa/scenarios' && req.method === 'POST') {
        requireAi()
        const b = JSON.parse((await readBody(req, 512_000, (m) => new AiError(413, m))) || '{}') as { input?: PlanInput; plan?: TestPlan }
        if (!b.input?.title?.trim() || !b.plan) throw new AiError(400, 'input and plan are required')
        return send(200, { scenarios: await scenariosForTask(creds, b.input, b.plan) })
      }
      if (pathname === '/api/qa/cases' && req.method === 'POST') {
        requireAi()
        const b = JSON.parse((await readBody(req, 512_000, (m) => new AiError(413, m))) || '{}') as {
          input?: PlanInput
          plan?: TestPlan
          scenarios?: TestScenario[]
        }
        if (!b.input?.title?.trim() || !b.plan || !b.scenarios) throw new AiError(400, 'input, plan and scenarios are required')
        return send(200, { specs: await generateAndSaveCases(creds, b.input, b.plan, b.scenarios) })
      }
      if (pathname === '/api/qa/coverage' && req.method === 'POST') {
        requireAi()
        const b = JSON.parse((await readBody(req, 512_000, (m) => new AiError(413, m))) || '{}') as {
          requirement?: CoverageRequirement
          cases?: CoverageCase[]
        }
        if (!b.requirement?.title?.trim()) throw new AiError(400, 'requirement is required')
        return send(200, { gap: await coverageGap(creds, { requirement: b.requirement, cases: b.cases ?? [] }) })
      }
      if (pathname === '/api/qa/export' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 512_000, (m) => new AiError(413, m))) || '{}') as {
          input?: PlanInput
          plan?: TestPlan
          scenarios?: TestScenario[]
          specs?: { filename: string; savedPath?: string }[]
        }
        if (!b.input?.title?.trim() || !b.plan || !b.scenarios) throw new AiError(400, 'input, plan and scenarios are required')
        return send(200, await exportRecord(b.input, b.plan, b.scenarios, b.specs ?? []))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof AiError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── SKB Docs (/api/skb/*) ────────────────────────────────────────────────────
export function skbHandler(aiCreds: AiCreds, ghToken: string, ghRepo: string, skb: SkbCreds): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/skb/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname, qs] = url.split('?')
      if (pathname === '/api/skb/status' && req.method === 'GET') {
        return send(200, { aiReady: aiReady(aiCreds), skbReady: skbReady(skb), ghRepo, base: 'https://skb.pushengage.com' })
      }
      if (pathname === '/api/skb/index' && req.method === 'GET') {
        const force = new URLSearchParams(qs || '').get('refresh') === '1'
        return send(200, await fetchKbIndex(force, skb))
      }
      if (pathname === '/api/skb/analyze' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 24_000_000, (m) => new SkbError(413, m))) || '{}') as { pr?: string }
        if (!b.pr?.trim()) throw new SkbError(400, 'pr (number or URL) is required')
        const pr = await fetchPr(ghToken, parsePrRef(b.pr, ghRepo))
        const index = await fetchKbIndex(false, skb)
        return send(200, { pr, analysis: await analyzeWithFallback(aiCreds, pr, index) })
      }
      if (pathname === '/api/skb/compose' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 24_000_000, (m) => new SkbError(413, m))) || '{}') as {
          pr?: string
          mode?: 'pr' | 'area'
          area?: string
          item?: DocPlanItem
          highlights?: string
          screenshotLabels?: string[]
        }
        if (!b.item?.title) throw new SkbError(400, 'item is required')
        let pr
        if (b.mode === 'area') {
          pr = areaStubPr(b.item, b.area || '')
        } else {
          if (!b.pr?.trim()) throw new SkbError(400, 'pr (number or URL) is required')
          pr = await fetchPr(ghToken, parsePrRef(b.pr, ghRepo))
        }
        return send(200, {
          doc: await composeWithFallback(aiCreds, {
            pr,
            item: b.item,
            highlights: b.highlights || '',
            screenshotLabels: b.screenshotLabels || [],
          }),
        })
      }
      if (pathname === '/api/skb/create' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 24_000_000, (m) => new SkbError(413, m))) || '{}') as {
          title?: string
          contentHtml?: string
          category?: string
          tags?: string[]
          excerpt?: string
          images?: { name: string; dataUrl: string }[]
        }
        if (!b.title?.trim() || !b.contentHtml?.trim() || !b.category?.trim())
          throw new SkbError(400, 'title, contentHtml and category are required')
        return send(200, {
          result: await createDraft(skb, {
            title: b.title,
            contentHtml: b.contentHtml,
            category: b.category,
            tags: b.tags || [],
            excerpt: b.excerpt || '',
            images: b.images || [],
          }),
        })
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      const status = e instanceof SkbError ? e.status : e instanceof AiError ? e.status : 500
      return send(status, { error: (e as Error).message })
    }
  }
}

// ── Device-run reports (/api/devrun/*) ───────────────────────────────────────
export function devrunHandler(): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/devrun/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname, qs] = url.split('?')
      if (pathname === '/api/devrun/list' && req.method === 'GET') return send(200, { reports: listDeviceReports() })
      if (pathname === '/api/devrun/report' && req.method === 'GET') {
        const id = new URLSearchParams(qs || '').get('id') || ''
        return send(200, { report: readDeviceReport(id) })
      }
      if (pathname === '/api/devrun/save' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 48_000_000, (m) => new Error(m))) || '{}') as { report?: DeviceRun }
        if (!b.report?.id) return send(400, { error: 'report is required' })
        return send(200, saveDeviceReport(b.report))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      return send(500, { error: (e as Error).message })
    }
  }
}

// ── Test-Management SQLite store (/api/tm/*) — the shared durable data ────────
export function tmHandler(): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/tm/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname] = url.split('?')
      if (pathname === '/api/tm/state' && req.method === 'GET') {
        const json = loadState()
        return send(200, { state: json ? JSON.parse(json) : null, ...currentCounts() })
      }
      if (pathname === '/api/tm/save' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000_000, (m) => new Error(m))) || '{}') as { state?: unknown; reason?: string }
        if (!b.state || typeof b.state !== 'object') return send(400, { error: 'state object required' })
        return send(200, saveState(JSON.stringify(b.state), b.reason))
      }
      if (pathname === '/api/tm/seq/next' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000, (m) => new Error(m))) || '{}') as { kind?: string }
        if (!b.kind) return send(400, { error: 'kind required' })
        return send(200, { value: nextSeq(b.kind) })
      }
      if (pathname === '/api/tm/seq/seed' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000, (m) => new Error(m))) || '{}') as { seq?: Record<string, number> }
        seedSeq(b.seq || {})
        return send(200, { ok: true })
      }
      if (pathname === '/api/tm/backups' && req.method === 'GET') return send(200, { backups: listBackups() })
      if (pathname === '/api/tm/restore' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64_000, (m) => new Error(m))) || '{}') as { id?: number }
        if (!b.id) return send(400, { error: 'id required' })
        return send(200, restoreBackup(b.id))
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      return send(500, { error: (e as Error).message })
    }
  }
}

// ── Load/perf runner (/api/perf/*) — drives target URLs, returns percentiles ──
// Backed by server/perf.ts (Node global fetch, hard-capped). Same-origin gated.
// Sends REAL requests — point it at staging, never production.
export function perfHandler(): Middleware {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/perf/')) return next()
    res.setHeader('Content-Type', 'application/json')
    const send = (status: number, obj: unknown) => {
      res.statusCode = status
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'POST' && !isSameOrigin(req)) return send(403, { error: 'cross-origin request blocked' })
    try {
      const [pathname] = url.split('?')
      if (pathname === '/api/perf/run' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 2_000_000, (m) => new Error(m))) || '{}') as {
          targets?: unknown
          vus?: unknown
          durationSec?: unknown
        }
        const result = await runLoadTest({
          targets: Array.isArray(b.targets) ? (b.targets as PerfTarget[]) : [],
          vus: Number(b.vus) || 5,
          durationSec: Number(b.durationSec) || 10,
        })
        return send(200, result)
      }
      return send(404, { error: 'not_found' })
    } catch (e) {
      return send(400, { error: (e as Error).message })
    }
  }
}

// ── Composition helpers ──────────────────────────────────────────────────────

// Mount every /api/* handler onto a connect-style `use` sink (Vite's
// server.middlewares.use OR Express's app.use). Does NOT start the scheduler
// ticker — call startSchedulerWithAlerts separately on hosts that should fire jobs.
// The G3 requestGuard (Host allowlist + Origin-required writes) is mounted FIRST so
// it fronts every request on both hosts. `opts.ports` = the port(s) the host is
// configured for (dev: PORT||5173, prod: PORT||5199); the socket's real port is
// always accepted too.
// ── INC-2: server-side authentication + per-route authorization ──────────────
// The REAL security boundary (the client gate in src/lib/users.ts is bypassable).
// Mirrors that model — roles admin|qa|dev, `salt:sha256` hashes, a ROUTE_ROLES
// map — but resolves an httpOnly session cookie and enforces roles on EVERY
// /api/* handler, server-side. Opt-in via opts.auth / TP_AUTH=1: the dev server
// (client-side gate, no cookie) is left unchanged until the client is wired; the
// prod server (server/index.ts) turns it on. HOSTING.md steps 2 + 3.
function parseCookies(req: Req): Record<string, string> {
  const raw = headerOne(req.headers.cookie)
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function cookieAttrs(req: Req, maxAgeMs: number): string {
  // Secure when the request reached us over https (a TLS-terminating proxy sets
  // x-forwarded-proto); plain http on localhost stays non-Secure so dev works.
  const secure = headerOne(req.headers['x-forwarded-proto']).toLowerCase() === 'https'
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

// Route → allowed roles, mirroring src/lib/users.ts ROUTE_ROLES and locking the
// exec / local-file / host-mutating surface to admin (HOSTING.md step 3).
// Longest-prefix match wins, so e.g. /api/reports/smoke/file (admin) beats
// /api/reports (qa), and /api/skb/create (admin) beats /api/skb (qa).
const R_ALL: Role[] = ['admin', 'qa', 'dev']
const R_QA: Role[] = ['admin', 'qa']
const R_ADMIN: Role[] = ['admin']
const API_ROUTE_ROLES: Array<[string, Role[]]> = [
  ['/api/runner', R_ADMIN],
  ['/api/schedule', R_ADMIN],
  ['/api/pipeline', R_ADMIN],
  ['/api/devrun', R_ADMIN],
  ['/api/perf', R_ADMIN],
  ['/api/reports/smoke/file', R_ADMIN],
  ['/api/skb/create', R_ADMIN],
  ['/api/asana', R_ALL],
  ['/api/github', R_ALL],
  ['/api/slack', R_ALL],
  ['/api/reports', R_QA],
  ['/api/skb', R_QA],
  ['/api/qa', R_QA],
  ['/api/ai', R_QA],
  ['/api/flaky', R_QA],
  ['/api/tm', R_QA],
  ['/api/fixtures', R_QA],
  ['/api/sessions', R_QA],
  ['/api/session', R_QA],
]

function rolesFor(pathname: string): Role[] {
  let best: Role[] | null = null
  let bestLen = -1
  for (const [prefix, roles] of API_ROUTE_ROLES) {
    if ((pathname === prefix || pathname.startsWith(prefix + '/')) && prefix.length > bestLen) {
      best = roles
      bestLen = prefix.length
    }
  }
  return best ?? R_QA // unknown /api/* defaults to signed-in QA/admin, never public
}

const authJson = (res: Res, status: number, obj: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(obj))
}

/** Serves /api/auth/login|logout|me. login must be reachable unauthenticated. */
export function authHandler(): Middleware {
  return (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/auth/')) return next()
    const pathname = url.split('?')[0]
    const cookies = parseCookies(req)
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const u = resolveSession(cookies[SESSION_COOKIE], Date.now())
      return u ? authJson(res, 200, { user: publicUser(u) }) : authJson(res, 401, { error: 'not authenticated', code: 'no-session' })
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      deleteSession(cookies[SESSION_COOKIE])
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
      return authJson(res, 200, { ok: true })
    }
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      readBody(req, 4096, (m) => new Error(m))
        .then((raw) => {
          let body: { email?: string; password?: string } = {}
          try {
            body = JSON.parse(raw || '{}')
          } catch {
            return authJson(res, 400, { error: 'invalid JSON body', code: 'bad-body' })
          }
          const email = (body.email || '').trim()
          const password = body.password || ''
          if (!email || !password) return authJson(res, 400, { error: 'email and password are required', code: 'missing-fields' })
          const user = findByEmail(email)
          // Same opaque error whether the email is unknown, inactive, or the
          // password is wrong — don't leak which emails exist.
          if (!user || !user.active || !verifyPassword(user, password)) {
            return authJson(res, 401, { error: 'Incorrect email or password', code: 'bad-credentials' })
          }
          const sess = createSession(user.id, Date.now())
          res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sess.token}; ${cookieAttrs(req, SESSION_TTL_MS)}`)
          authJson(res, 200, { user: publicUser(user) })
        })
        .catch(() => authJson(res, 400, { error: 'could not read request body', code: 'bad-body' }))
      return
    }
    return authJson(res, 404, { error: 'not found', code: 'not-found' })
  }
}

/** Blocks every /api/* (except /api/auth/*) without a valid session, and enforces
 *  the per-route role map. Mounted right after the request guard, before any
 *  resource handler. Attaches the resolved user as req.tpUser. */
export function authGuard(): Middleware {
  return (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/api/')) return next() // SPA / static assets handled downstream
    const pathname = url.split('?')[0]
    if (pathname.startsWith('/api/auth/')) return next() // served by authHandler (login = unauthenticated)
    const user = resolveSession(parseCookies(req)[SESSION_COOKIE], Date.now())
    if (!user) return authJson(res, 401, { error: 'authentication required — sign in', code: 'no-session' })
    const allowed = rolesFor(pathname)
    if (!allowed.includes(user.role)) {
      return authJson(res, 403, { error: `forbidden — this route needs role: ${allowed.join(' or ')}`, code: 'forbidden' })
    }
    ;(req as Req & { tpUser?: ServerUser }).tpUser = user
    next()
  }
}

export function mountAll(mount: (mw: Middleware) => void, env: Env, opts: GuardOptions & { auth?: boolean } = {}): void {
  const aiCreds: AiCreds = { apiKey: (env.ANTHROPIC_API_KEY || '').trim(), authToken: (env.ANTHROPIC_AUTH_TOKEN || '').trim() }
  const ports = opts.ports?.length ? opts.ports : [Number(env.PORT) || 5173]
  const extraHosts = [...(opts.extraHosts || []), ...(env.TP_ALLOWED_HOSTS || '').split(',')]
  mount(requestGuard({ ports, extraHosts }))
  // INC-2: when auth is on (prod, or TP_AUTH=1), serve /api/auth/* and gate every
  // other /api/* behind a valid session + role before any resource handler runs.
  const authOn = opts.auth ?? env.TP_AUTH === '1'
  if (authOn) {
    mount(authHandler())
    mount(authGuard())
  }
  mount(sessionHandler())
  mount(asanaHandler(env.ASANA_ACCESS_TOKEN || '', env.ASANA_WORKSPACE_GID || ''))
  mount(githubHandler(env.GITHUB_TOKEN || '', env.GITHUB_REPO || ''))
  mount(slackHandler(env.SLACK_BOT_TOKEN || '', env.SLACK_QA_CHANNEL || ''))
  mount(runnerHandler())
  mount(sessionsHandler())
  mount(fixturesHandler())
  mount(scheduleHandler())
  mount(reportsHandler())
  mount(pipelineHandler())
  mount(aiHandler(aiCreds))
  mount(qaHandler(aiCreds))
  mount(flakyHandler(aiCreds))
  mount(
    skbHandler(aiCreds, env.GITHUB_TOKEN || '', env.GITHUB_REPO || '', {
      user: (env.SKB_WP_USER || '').trim(),
      appPassword: (env.SKB_WP_APP_PASSWORD || '').trim(),
    }),
  )
  mount(devrunHandler())
  mount(tmImportHandler(env.ASANA_ACCESS_TOKEN || ''))
  mount(tmHandler())
  mount(perfHandler())
}

// Wire Slack failure alerts + start the 30s schedule ticker (the process that
// calls this becomes the one that fires due scheduled runs).
export function startSchedulerWithAlerts(env: Env, appUrl: string): void {
  configureAlerts({ slackToken: env.SLACK_BOT_TOKEN || '', slackChannel: env.SLACK_QA_CHANNEL || 'qa-automation', appUrl })
  // I1 session canary: TP_SESSION_CANARY=0 disables it, TP_CANARY_NOTIFY=0 keeps it but mutes macOS notifications.
  configureCanary({ enabled: env.TP_SESSION_CANARY !== '0', notify: env.TP_CANARY_NOTIFY !== '0' })
  startScheduler()
}

// Kill any in-flight Playwright child when the HTTP server closes (config edits
// / restarts would otherwise orphan browsers). Accepts any server with a 'close'
// event — node:http's Server (prod) or Vite's httpServer (http.Server |
// Http2SecureServer, null in middleware mode → no-op).
type Closable = { on(event: 'close', listener: () => void): unknown }
export function attachRunnerLifecycle(server: Closable | null | undefined): void {
  server?.on('close', shutdownRunner)
}
