# TestPilot — Hosting Readiness & Hardening Plan

**Verdict (2026-08-17): NOT safe to expose on a public domain as-is.**
Doing so today would leak the org's GitHub/Asana/Slack/Anthropic tokens and hand
anyone on the internet remote code execution on this Mac. Keep it internal until
the blockers below are closed. This doc is the plan to get there.

---

## Why it's not ready — the blockers

| # | Blocker | Detail | Severity |
|---|---------|--------|----------|
| 1 | **Backend is Vite _dev-server_ middleware** | Every `/api/*` route lives in `vite.config.ts` `configureServer` plugins. They exist only while `vite` (dev) runs — a production `vite build` / `vite preview` has **no** `/api/*` at all. So a "real" static deploy loses Asana, GitHub, Slack, runner, schedule, reports, AI, QA, and SKB. | Blocker |
| 2 | **No auth on any API route** | `/api/github|asana|slack/*` use the org tokens from `.env` with **zero** authentication. Anyone who can reach the origin can read/close GitHub issues, post comments, complete Asana tasks, and read Slack — as us. | Critical |
| 3 | **Local RCE / file surface** | `/api/runner/*` spawns Playwright processes; `/api/schedule` installs launchd jobs; `/api/reports/smoke/file` reads local files; `/api/qa`, `/api/skb/create`, `/api/devrun/save` write files / call external services. Exposed publicly = remote code execution + arbitrary file read/write on the host. | Critical |
| 4 | **Auth is client-side only** | The login gate + roles run in the browser against `localStorage`; the password hash is verified client-side and is bypassable via dev-tools. Good enough as an in-app gate, **not** as a security boundary. (The "any password" hole was fixed 2026-08-17; it's still client-side.) | High |
| 5 | **It's a dev server** | Runs as the `com.testpilot.dev` LaunchAgent (`vite`) on `localhost:5173` — no HTTPS, no process hardening, not built for public traffic. | High |

---

## Options

### A. Keep internal (current choice) ✅
Do **not** put it on a public domain. Teammates who need it either run it locally
or reach it over a private network. Fix bugs against the existing dev-server model
(as done for login + SKB). Zero exposure risk.

### B. Private-network access (fast, low-risk) — recommended next step if teammates need it now
Expose the existing dev server **only** over a private network, never the public
internet:
- **Tailscale** (simplest): `tailscale up` on this Mac; teammates on the tailnet hit
  `http://<machine>:5173`. No public DNS, no inbound firewall change.
- **or** a reverse proxy (Caddy/nginx) on a trusted host with **HTTPS + HTTP Basic
  auth** in front of `:5173`, reachable only via VPN.

This does **not** fix blockers 2–4 — it just limits the audience to trusted,
authenticated network peers. Acceptable for a small internal team; **not** for a
public domain.

### C. Real public hosting (large, multi-session project)
Only this makes a public domain safe. Scope:
1. **Extract the backend.** Move every `vite.config.ts` middleware into a real
   server (Express/Fastify or Vite SSR `configurePreviewServer`) that runs in
   production, not just dev. Serve the built SPA as static assets from it.
2. **Real authn/authz.** Server-side sessions (or SSO / an identity provider),
   `httpOnly` cookies, and a per-route role check on **every** `/api/*` handler —
   the same `ROUTE_ROLES` model, enforced on the server, not the client.
3. **Lock down the exec surface.** `/api/runner`, `/api/schedule`, `/api/devrun`,
   `/api/reports/*/file` either removed from the hosted build, or gated behind
   admin-only auth **and** sandboxed (no arbitrary path reads, no host launchd
   writes). Treat these as the highest-risk endpoints.
4. **Secrets.** Keep org tokens server-side behind auth; consider per-user tokens
   (each teammate connects their own GitHub/Asana) instead of one shared `.env`
   token that every authenticated user can drive.
5. **Transport + ops.** HTTPS, a process manager, logging, rate limiting, CORS
   locked to the app origin (some middleware already do a same-origin POST check —
   extend that everywhere).

---

## Recommendation
Stay on **A** now; move to **B (Tailscale)** the moment teammates need hands-on
access. Schedule **C** as a proper project before any public domain — it is the
only path that makes public hosting safe, and it is not a quick change.
