# TestPilot — QA Automation Cockpit

Internal dashboard that tracks every QA surface across the products, wiring
Asana tasks and GitHub issues into a single automation pipeline view.

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **Zustand** (state) + **TanStack Query** (data) + **React Router**
- **Radix UI** primitives, **lucide-react** icons
- **oxlint** for linting

## Getting started

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
```

Other scripts:

```bash
npm run build    # tsc -b && vite build
npm run preview  # preview the production build
npm run lint     # oxlint
```

## Configuration

Copy the token values into `.env` (gitignored, stays on your machine). These are
read **only server-side** by the Vite dev middleware and are never bundled to the
client:

| Variable              | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `ASANA_ACCESS_TOKEN`  | Asana Personal Access Token (server-side proxy)          |
| `ASANA_WORKSPACE_GID` | Optional — pin to one Asana workspace                    |
| `GITHUB_TOKEN`        | GitHub token for the server-side proxy                   |
| `GITHUB_REPO`         | Optional — scope to one `owner/repo`                     |
| `SLACK_BOT_TOKEN`     | Slack bot token (`xoxb-…`) for the QA-channel watcher    |
| `SLACK_QA_CHANNEL`    | Optional — channel to watch (default `qa-automation`)    |

The browser calls `/api/asana/*`, `/api/github/*` and `/api/slack/*`; the Vite
dev server (`vite.config.ts`) proxies those to Asana / GitHub / the Slack Web
API with the tokens above, so no token ever reaches the client bundle. Any
connector without a token degrades gracefully to sample data.

The Slack bot needs the scopes `channels:read`, `channels:history`,
`users:read` (add `groups:*` for private channels) and must be `/invite`d to
the QA channel.

## What it does

TestPilot keeps one QA queue **auto-synced** from three sources — Asana tasks,
GitHub issues, and QA hand-offs devs post in a Slack channel — then drives each
task through its Playwright test phases, files issues on failure, and reports
verification back.

## Test Runner

The **Test Runner** screen (`/runner`) executes the six local Playwright QA
frameworks that live next to this app in `~/QA-Automations/`:

| Framework | Smoke preset | Full-regression preset |
| --- | --- | --- |
| pushengage-site | `--grep @smoke` | whole suite |
| pushengage-app-dashboard | `--grep @smoke` | whole suite |
| pushengage-shopify-revamped | `tests/smoke` | `tests/regression` |
| pushengage-wp-plugin | `smoke/` dir | `regression/` dir |
| ledgerport-saas-automation | `--grep @smoke` | all except `@destructive` |
| ledgerport-wp-plugin | `tests/smoke/` | its 7 area directories |

Pick a framework → browse the live spec tree (from `playwright test --list`) →
run a **single test** (Cypress-style ▶), a **spec file**, **Smoke**, or **Full
regression**, with environment/project pickers, live output streaming, cancel,
and a pass/fail summary. Runs spawn each framework's own Playwright binary in
its own folder — one run at a time; results JSON goes to the OS temp dir so
nothing is ever written into the framework folders.

## Manual Test

The **Manual Test** screen (`/manual`) smoke-tests **any URL** on demand: enter
a URL, environment, browser, optional credentials (+ login URL) and optional
expected title/text, and a headless browser checks it loads (HTTP status,
redirects, title, console errors, expected text) and captures a screenshot —
with a best-effort login first when creds are given. It runs TestPilot's own
bundled Playwright (`@playwright/test`, added as a devDependency) against the
generic `adhoc/` project, defaulting to your system Chrome (`channel:"chrome"`,
so no browser download). **Credentials are used for that single run only** —
passed to the browser process via env, never written to disk, the page URL, or
the client bundle. (firefox/webkit need `npx playwright install` if you pick them.)

## Layout

- `src/screens/` — routes: Overview, QA Queue, Task Detail, Test Runner, Issues, Integrations
- `src/components/` — layout shell, modals, origin badges, UI primitives
- `src/store/` — Zustand store (`loadAsana` / `loadGithub` / `loadSlack` / runner slice)
- `src/lib/` — Asana/GitHub/Slack adapters onto the `Task` model + runner API client
- `server/` — Asana/GitHub/Slack API clients + the Playwright runner used by the Vite dev middleware
