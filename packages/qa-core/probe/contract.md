# `auth:probe` CLI contract (I1)

Every auth-gated framework implements one npm script:

```
npm run auth:probe -- --persona <framework>:<env>[:<name>] [--live]
```

TestPilot's `probeSession(persona)` spawns it from the framework directory, caches the
result for 10 minutes per persona, and maps it to job state (BLOCKED{SESSION} etc.).

## Persona id

`<framework>:<env>[:<name>]`

| part        | meaning                                                                 | examples                                                |
|-------------|-------------------------------------------------------------------------|---------------------------------------------------------|
| `framework` | TestPilot `FRAMEWORKS[].id` (= the framework directory name)            | `ledgerport-saas-automation`, `pushengage-app-dashboard` |
| `env`       | `staging` \| `production` \| `local` (or a framework env like `wp-env`)  | `staging`                                               |
| `name`      | optional persona within that env (account / store / plan role)          | `silverlisting`, `free-owner`, `7daysfreetrail`         |

Each segment matches `/^[a-z0-9][a-z0-9._-]*$/i`. No name → the framework's default persona.
Fixtures in `config/fixtures.json` reference personas by this id (`ownerPersona`).

## Output — stdout carries EXACTLY ONE line of JSON

```json
{"persona":"ledgerport-saas-automation:staging:silverlisting","env":"staging","ok":false,
 "state":"refreshable","identity":{"email":"…","account":"202"},
 "expected":{"email":"…","account":"202"},
 "expiresAt":"2026-10-12T10:15:00.000Z","refreshExpiresAt":"2026-10-18T09:00:00.000Z",
 "humanAction":"LP_ENV=staging npm run auth:capture in ledgerport-saas-automation",
 "code":"access-expired","checkedAt":"2026-10-12T10:20:00.000Z"}
```

| field              | required | notes                                                                                     |
|--------------------|----------|-------------------------------------------------------------------------------------------|
| `persona`          | yes      | canonical persona id                                                                      |
| `env`              | yes      |                                                                                           |
| `ok`               | yes      | `state === "ok"`                                                                          |
| `state`            | yes      | `ok` \| `refreshable` \| `human-needed` \| `harness-error`                                |
| `identity`         | yes      | `{email?, store?, account?, site?}` read from the saved session — labels, never secrets   |
| `expected`         | yes      | from `.auth/<env>/<name>.meta.json` or `.auth/<env>/meta.json` (`{}` when absent)         |
| `expiresAt`        | no       | ISO expiry of the access token / session cookie                                           |
| `refreshExpiresAt` | no       | ISO expiry of the refresh token (LedgerPort)                                              |
| `humanAction`      | when !ok | the exact command / step for a human                                                      |
| `code`             | no       | sub-code: `ok`, `no-file`, `no-tokens`, `access-expired`, `refresh-expired`, `expired`, `not-jwt`, `wrong-account`, `logged-out`, `waf`, `stale-session-cookie`, `unverified-session-cookie` (cookie sessions — confirm with `--live`), `harness-error` |
| `checkedAt`        | no       | ISO time of the probe                                                                     |

Anything else the probe wants to say goes to **stderr** (`runProbe` reroutes `console.log`).

## Exit codes

| exit | state           | meaning                                                                                   |
|------|-----------------|-------------------------------------------------------------------------------------------|
| 0    | `ok`            | session valid, identity matches meta.json                                                 |
| 10   | `refreshable`   | access token expired but a refresh path exists (LedgerPort refresh token) — automation may refresh |
| 20   | `human-needed`  | missing/expired/wrong-account/WAF — a human must run `humanAction`                       |
| 30   | `harness-error` | the probe itself failed (bad args, crash) — retried once automatically (V1)               |

## Rules

1. **Never print a token, cookie, password or nonce.** Only expiry times and identity labels. `emitProbeResult` runs `redact()` over the line as a last line of defence.
2. **Offline by default.** The probe reads the storageState + meta.json and decodes JWT `exp` locally. `--live` allows ONE authenticated **GET** to an identity endpoint (e.g. LedgerPort `/auth/me`-style, PushEngage `/d/v1/users/me`, WP `/wp-json/wp/v2/users/me`) through the qa-core clients, so `targets.ts` still applies. Never POST, never log in, never refresh inside the probe.
3. **Identity check.** When `meta.json` names `email` / `store` / `account` / `site` and the session disagrees → `human-needed` with `code:"wrong-account"`.
4. **Fast.** Offline probes must finish in < 2 s; `--live` in < 20 s.
5. `meta.json` is written by the capture scripts (I2a): `{email, store?, account?, site?, appHandle?, capturedAt}` — identifiers only.

## Implementing it in a framework

```ts
// <framework>/scripts/auth-probe.ts   (package.json: "auth:probe": "tsx scripts/auth-probe.ts" or ts-node)
import * as path from 'node:path';
import { runProbe } from '../../packages/qa-core/probe/probe-lib';
import { inspectPeSession } from '../../packages/qa-core/api/peApi';

runProbe(async ({ persona, frameworkDir }) =>
  inspectPeSession(path.join(frameworkDir, 'test-results/.auth/app-dashboard-state.json'),
                   persona.env === 'production' ? 'production' : 'staging'));
```

Shopify/WP sessions (cookie-based) build a `SessionSummary` themselves from cookie
`expires` (e.g. `koa.sid`, `_secure_admin_session_id`, `wordpress_logged_in_*`) and the
store/handle from meta.json, then return it — `runProbe` handles the rest.
