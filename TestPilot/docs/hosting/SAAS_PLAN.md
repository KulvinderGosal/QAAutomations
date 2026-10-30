# TestPilot — SaaS Plan (from the retired TestPilot-HostReady fork)

> **Status 2026-10-30:** the HostReady fork was merged back into `TestPilot/` and retired. Its server-side auth + shared SQLite DB already exist in `TestPilot` as `server/authStore.ts` + `server/tmStore.ts` + `server/index.ts`; this plan is kept for the remaining phases (cloud DB, Runner Agent).

A hostable, multi‑user version of TestPilot. This is a **fresh instance** (clean
copy of the internal tool) — the original `~/QA-Automations/TestPilot` is left
untouched and keeps running as the internal LaunchAgent.

> Read `HOSTING.md` first — it is the blocker analysis this plan executes against.

## Can it be a fully independent SaaS? — Yes, with one hard constraint

The **UI is 100% reusable** (React SPA — Test Management, QA Queue, Overview,
Reports, all screens). The rewrite is entirely **backend + auth + data + the
runner**. The one thing that does *not* move to the cloud cleanly is the **local
Playwright/Maestro runner**: today it spawns each framework's own Playwright in
`~/QA-Automations/<framework>/` on *this* Mac. A cloud server has none of those
repos, browsers, emulators, or device farms. So the runner must become either a
**self‑hosted worker agent** (a box the team runs, with the repos, that connects
back) or be **scoped out of the cloud build** for v1. Everything else (TMS,
connectors, AI, reports metadata) ports normally.

## Recommended architecture

```
Browser (React SPA, built static)
      │  https + httpOnly session cookie
      ▼
API server  (Node/Express — NEW; replaces the Vite dev middleware)
  ├─ auth: server-side sessions + per-route role check (ROUTE_ROLES enforced server-side)
  ├─ /api/asana|github|slack|ai|qa   → server/*.ts clients (REUSED as-is)
  ├─ data: Postgres (or SQLite for a single-team start)  ← replaces localStorage for SHARED data
  └─ runner: queue → dispatch to a self-hosted Runner Agent (optional capability)
                                              │ (only this piece needs the repos + Playwright + devices)
                                              ▼
                                   Runner Agent (self-hosted worker)
```

- **Reused unchanged:** the whole `src/` SPA; `server/asana.ts`, `server/github.ts`,
  `server/slack.ts`, `server/aiTest.ts`, `server/qaPlanner.ts` (API clients — already
  plain Node modules).
- **Rewritten:** `vite.config.ts` middleware → a standalone Express app
  (`server/app.ts`) mounted in **both** dev (Vite `configureServer`) and prod
  (`server/index.ts`); auth; data layer; runner dispatch.

## Phased roadmap

| Phase | Goal | Work |
|---|---|---|
| **P0 — Foundation** *(this instance is created)* | Clean, renamed project; plan + decisions locked | ✅ copy made · pkg renamed `testpilot-hostready` · this plan |
| **P1 — Real backend** ✅ | `/api/*` works in production, not just `vite dev` | ✅ `server/api.ts` (shared connect handlers: health + asana/github/slack connector proxies, cloud‑safe) · ✅ `server/index.ts` Express prod server (serves `dist/` + SPA fallback + API, `/api` 404‑isolated) · ✅ `express`/`compression`/`dotenv`/`tsx` deps + `start`/`serve` scripts · ✅ `Dockerfile` + `.dockerignore` + `.env.example` · ✅ built + smoke‑tested on `:8123`. **Remaining:** consolidate dev (`vite.config.ts`) onto `server/api.ts` to kill the transitional connector duplication; port the remaining cloud‑safe domains once auth lands |
| **P2 — Real auth** ✅ | Security boundary on the server, not the browser | ✅ `server/db.ts` users + sessions (scrypt hashes) · ✅ `server/auth.ts` httpOnly‑cookie sessions + `requireAuth`/`requireRole` + login/logout/me · ✅ auth gate in `server/index.ts` protects every `/api/*` (health + login public) · ✅ first‑boot admin seed · ✅ e2e‑tested (401 unauth → login → authed). **Remaining:** wire the SPA to `/api/auth/*` (replace the localStorage login gate); per‑route role checks; rate limiting |
| **P3 — Shared data** ✅ | Multi‑user, persistent, shared | ✅ `tm_state` table + `GET`/`PUT /api/tm` — the Playwright test cases (+ suites/plans…) are now SHARED, server‑persisted, versioned (optimistic‑concurrency 409). ✅ e2e‑tested (save → persist → conflict). Reuses the client's existing seed (server returns `null` first, client seeds + PUTs). **Remaining:** wire `src/tm/store.ts` to load/save via `/api/tm` instead of `localStorage`; keep per‑user prefs local; later normalize into per‑entity tables + Postgres |
| **P4 — Runner strategy** | Decide + wire the exec surface safely | Per the decision below: BYO Runner Agent (auth’d worker pulls jobs) **or** scope runner/scheduler/pipelines out of the cloud build. Lock down `/api/runner|schedule|reports/*/file` (admin‑only + sandboxed, no arbitrary path reads / host launchd writes) |
| **P5 — Connectors** | Safe token model | Either keep shared org tokens server‑side behind auth, **or** per‑user OAuth (each teammate connects their own GitHub/Asana/Slack) |
| **P6 — Ops** | Production hygiene | HTTPS, process manager, structured logging, backups, CI/CD deploy, CORS locked to app origin |

## Reuse ledger (what we keep vs rebuild)

- ✅ **Keep:** entire React SPA, UI system, TMS store logic, connector API clients, AI/QA authoring server modules, report reporters.
- ♻️ **Rebuild:** API transport (dev‑middleware → real server), auth (client → server), data (localStorage → DB), runner (local spawn → dispatched worker).
- ⛔ **Cloud can’t do natively:** spawn Playwright against local framework repos, install launchd jobs, read arbitrary host files — all move behind the Runner Agent or are dropped.

## Decisions (locked 2026-08-26)

1. **Target** — ✅ **Internal shared team tool** (one shared instance, real accounts, one org's data). Can grow to multi‑tenant later.
2. **Runner** — ✅ **Self‑hosted Runner Agent**: a worker the team runs (with the framework repos + Playwright) authenticates to the cloud and pulls run jobs. Keeps full runner/scheduler/pipeline power; the cloud server never spawns Playwright.
3. **Connector creds** — ✅ **Per‑user OAuth**: each teammate connects their own GitHub/Asana/Slack; actions run as them (better attribution + isolation). Shared org tokens are only the transitional self‑host default until OAuth lands (P5).
4. **Host/stack** — default: Docker on Render/Railway/Fly + Postgres (P3). Confirm target when we reach P3/P6.

_Status: **P0/P1/P2/P3 DONE — backend + client, verified end-to-end in a browser.**_
- _Login runs through the server (`/api/auth/login`, httpOnly session, `/api/auth/me` on boot) — verified: sign-in → app renders → session survives reload._
- _Test cases are shared + server-persisted (`/api/tm`, versioned) — verified: state seeds the DB on first login, and after clearing `localStorage` a reload still loads all 359 cases from the server._
- _Dev parity: `npm run dev` mounts the same auth + TMS routes (`authTmDevApi`), so local dev behaves like prod._

_**Next: P4 (self-hosted Runner Agent) · P5 (per-user OAuth for connectors) · P6 (ops: HTTPS, deploy, backups).** Also polish: per-route role guards on the server, a Users&Team → server user CRUD, and normalizing `tm_state` into per-entity tables when write-contention warrants it._
