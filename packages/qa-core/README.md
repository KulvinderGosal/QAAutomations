# qa-core

Shared QA contracts for every framework in `~/QA-Automations` and for TestPilot.

- TypeScript source, used straight from disk with relative imports. There is no build step and no `npm install`.
- No runtime dependencies. It **never imports `@playwright/test` at runtime**. Each framework passes in its own Playwright objects, so the four Playwright versions in the fleet never mix.
- Tokens are read **inside the test or server process** and are never printed. `redact()` is the last line of defence.

| Path | What it is |
|---|---|
| `errors.ts` | `BlockedError` taxonomy: a run with no verdict is never a pass |
| `guards/targets.ts` | Deny-by-default network guard. Pure module, so it also works in the TestPilot UI |
| `api/base.ts` | Base API client: browser User-Agent, `X-QA-Run-Id`, guard on every request and redirect, JSON helpers, `redact()` |
| `api/session.ts` | Reads storageState and decodes JWT `exp` offline. Returns token-free `SessionSummary` |
| `api/lpApi.ts` | LedgerPort SaaS API (`__LEDGERPORT_AUTH_STATE__`) |
| `api/peApi.ts` | PushEngage adonis `/d/v1` (`__PE__token__`) |
| `api/wpRest.ts` | WordPress REST: cookie session + nonce, or an Application Password from env |
| `fixtures/load.ts` | Loads `~/QA-Automations/config/fixtures.json` (identifiers only) |
| `probe/contract.md`, `probe/probe-lib.ts` | The `auth:probe` CLI contract and its helpers |
| `selftest/` | Offline self-test (`npm run check` in this folder) |

---

## 1. Errors: `errors.ts`

```ts
BLOCKED_CLASSES = ['SESSION','ENV','DEPLOY','FIXTURE','ORACLE','DEV','GUARDRAIL','HARNESS','DEVICE','TARGET']
type BlockedClass
interface BlockedInfo { cls; reason; humanAction; code?; persona?; details? }
class BlockedError extends Error          // .cls .reason .humanAction .code .persona .details .isBlocked .toJSON()
class BlockedSessionError extends BlockedError  // cls 'SESSION', + .refreshable .expiresAt
isBlockedError(e) / isBlockedSessionError(e) / isBlockedClass(v)
formatBlockedMessage(info) / parseBlockedMessage(text)
```

The error message always has the form `[BLOCKED:<CLS>[/<code>]] <reason> -- human action: <humanAction>`. It survives Playwright's JSON reporter, which keeps only `error.message`. TestPilot's V1 `deriveVerdict` can therefore call `parseBlockedMessage()` on failed or skipped results.

## 2. Target guard: `guards/targets.ts`

```ts
assertAllowedTarget(url, method = 'GET'): TargetDecision   // throws BlockedError{cls:'TARGET'}
checkTarget(url, method): TargetDecision                    // non-throwing
classifyHost(host): 'local'|'staging'|'production'|'unknown'
isProductionTarget(url) / pathMatchesPrefix(path, prefix)
LOCAL_HOSTS, LOCAL_HOST_SUFFIXES, STAGING_HOSTS, STAGING_HOST_PATTERNS,
QA_SHOPIFY_STORE_HANDLES, PRODUCTION_SHOPIFY_STORE_HANDLES,
PRODUCTION_HOSTS, PRODUCTION_READ_ALLOWLIST, READ_ONLY_METHODS
```

| Tier | Hosts | Methods |
|---|---|---|
| local | `localhost`, `127.0.0.1`, `[::1]`, `*.localhost`, `*.test` (wp-env and the TestPilot dev server) | any |
| staging | `staging-app.pushengage.com`, `staging-app-dashboard*.pushengage.com`, `staging-shopify-app.pushengage.com`, `staging-web-sdk.pushengage.com`, `staging-dexter*.pushengage.com`, `staging.pushengage.com`, `qastaging.pushengage.com`, `app-staging.ledgerport.com`, `api-staging.ledgerport.com`, `staging-shopify-app.ledgerport.com`, `staging.ledgerport.com`, the QA `*.myshopify.com` stores, `admin.shopify.com/store/<QA store>` | any |
| production | `PRODUCTION_READ_ALLOWLIST` (marketing sites, SPA shells, LedgerPort `/api/v1/plans`, PushEngage `/d/v1/users/me` and `/d/v1/sites/76524`, dexter-cdn IAM, qaprod pages, production stores) | **GET/HEAD to listed path prefixes only** |
| anything else | unknown host, non-http(s), `user:pass@` URLs | **refused** |

To widen the policy, edit the exported lists in a reviewed change. There is deliberately no env var or runtime override. TestPilot reuses the guard with `import { assertAllowedTarget } from '../../packages/qa-core/guards/targets'`; tsx ESM named imports were checked and work.

## 3. API clients: `api/*`

All three clients wrap `createApiClient()`:

```ts
interface ApiRequestLike { fetch(url, options?) }   // Playwright's APIRequestContext satisfies this (checked by tsc in selftest/types.selftest.ts)
createApiClient({ request, baseURL, name?, runId?, headers?, authHeaders?, sessionHumanAction?, persona?, timeoutMs?, maxRedirects? }): ApiClient
ApiClient: url() request() get() head() delete() post() put() patch()          // raw: never throw on HTTP status
           getJson() postJson() putJson() patchJson() deleteJson()               // 2xx → body; 401 → BlockedSessionError; Cloudflare → BlockedError{ENV/waf}; else ApiError
BROWSER_HEADERS, DEFAULT_USER_AGENT, RUN_ID_HEADER ('X-QA-Run-Id'), resolveRunId(), joinUrl()
redact(text), redactHeaders(h), SENSITIVE_HEADER_NAMES, detectWafChallenge(), ApiError
```

How the base client behaves:

- **WAF.** It sends a normal browser `User-Agent` and `Accept`, nothing more. There are no automation-hiding flags, fingerprint tricks or challenge solving. A Cloudflare challenge is reported as BLOCKED and is never bypassed.
- **Run id.** `X-QA-Run-Id` (from `QA_RUN_ID` or `RUN_ID`, else one id per process) goes on every local or staging request. It is never sent to production.
- **Redirects.** Redirects are followed manually (`maxRedirects: 0` is passed to Playwright). Every hop is re-checked by the guard, and auth headers are dropped when a hop changes origin.

| Client | Token source (in order) | Base URL | humanAction when blocked |
|---|---|---|---|
| `createLpApi({request, env, storageState, refresh?})` | `LP_QA_API_KEY` (placeholder, sent as `X-QA-Key`), then storageState `__LEDGERPORT_AUTH_STATE__` → `state.tokens.accessToken` on `https://app-staging.ledgerport.com` (or `app.`) | `https://api-staging.ledgerport.com/api/v1` | `LP_ENV=staging npm run auth:capture in ledgerport-saas-automation` (`refreshable: true` while the refresh token is still valid) |
| `createPeApi({request, env, storageState, dashboardOrigin?})` | `PE_QA_API_KEY` (placeholder), then `__PE__token__` on staging-app-dashboard2, staging-app-dashboard or app.pushengage.com | staging `https://staging-app.pushengage.com/d/v1`, production `https://dashboard-public-api.pushengage.com/d/v1` (GET only, listed paths only) | `npm run auth:capture in pushengage-app-dashboard (a human logs in and solves Turnstile)` |
| `createWpRest({request, siteUrl, mode?})` | `WP_APP_USER` and `WP_APP_PASSWORD` (Basic auth), else cookies from the context's storageState plus a nonce from `admin-ajax.php?action=rest-nonce` or `wpApiSettings` | `<siteUrl>/wp-json` | re-login via global-setup (`WP_ADMIN_USER`/`WP_ADMIN_PASS`) or set an Application Password; `waf` on qaprod |

Each client also has `.inspect()` (lpApi, peApi), which returns a token-free `SessionSummary`. The standalone versions are `inspectLpSession()`, `inspectPeSession()` and `summarizeCookieSession()` (for Shopify and WP cookie sessions).

### Wiring in a framework (worker-scoped, keyed by `testInfo.project.metadata.persona`)

```ts
// <framework>/fixtures/api.ts
import { test as base, request as pwRequest } from '@playwright/test';   // the framework's OWN Playwright
import * as path from 'node:path';
import { createLpApi, type LpApi } from '../../packages/qa-core/api/lpApi';
import { parsePersona } from '../../packages/qa-core/probe/probe-lib';

type W = { lpApi: LpApi };
export const test = base.extend<{}, W>({
  lpApi: [async ({}, use, workerInfo) => {
    const persona = parsePersona(String(workerInfo.project.metadata?.persona ?? 'ledgerport-saas-automation:staging'));
    const ctx = await pwRequest.newContext();
    await use(createLpApi({
      request: ctx,
      env: persona.env as 'staging' | 'production',
      storageState: path.resolve(__dirname, '..', '.auth', `${persona.env}.json`),
      persona: persona.id,
      // refresh: () => keepSessionFresh(getEnv(persona.env)),   // I2a hook (optional)
    }));
    await ctx.dispose();
  }, { scope: 'worker' }],
});
export { expect } from '@playwright/test';
```

- For **peApi**, use `createPeApi({ request: ctx, env: 'staging', storageState: 'test-results/.auth/app-dashboard-state.json', dashboardOrigin: 'https://staging-app-dashboard2.pushengage.com' })`.
- For **wpRest** in cookie mode, the context **must** be created with the session: `pwRequest.newContext({ storageState: '.auth/wp-admin.json' })`, then call `createWpRest({ request: ctx, siteUrl: 'https://qastaging.pushengage.com' })`.
- A non-Playwright tool such as iam-fixtures can pass any object that has a matching `fetch(url, {method, headers, data, params, timeout, failOnStatusCode, maxRedirects})`. The tool imports the client in-process and never shells out for a token.

When a test hits an expired session, `BlockedSessionError` is thrown from inside the client. The test fails with the `[BLOCKED:SESSION/...]` marker, and the V1 verdict floor turns that into BLOCKED, not FAILED.

## 4. Persona naming

`<framework>:<env>[:<name>]`. The `framework` part is TestPilot's `FRAMEWORKS[].id`, which is the same as the directory name. Examples:

- `ledgerport-saas-automation:staging:silverlisting`
- `pushengage-app-dashboard:staging:upmodals1`
- `pushengage-shopify-revamped:staging:7daysfreetrail`
- `iam-android:production`

Use `parsePersona()` and `formatPersona()`. Playwright projects carry the id in `metadata.persona`, and fixtures reference it in `ownerPersona`.

## 5. `auth:probe` CLI: `probe/contract.md`

```
npm run auth:probe -- --persona <framework>:<env>[:<name>] [--live]
stdout: ONE JSON line {persona, env, ok, state:'ok'|'refreshable'|'human-needed'|'harness-error',
                        identity:{email?,store?,account?,site?}, expected:{…meta.json}, expiresAt?, refreshExpiresAt?, humanAction?, code?, checkedAt}
exit:   0 ok | 10 refreshable | 20 human-needed | 30 harness-error
```

Helpers: `runProbe(body)`, `parseProbeArgs()`, `parsePersona()`, `formatPersona()`, `readMeta(frameworkDir, env, name?)`, `compareIdentity()`, `resultFromSummary()`, `harnessError()`, `emitProbeResult()`, `PROBE_EXIT`, and the re-exported `decodeJwtPayload`, `jwtExpSeconds` and `isoFromSeconds`. `runProbe` sends any `console.log` output to stderr, so stdout carries only the result line. It also maps `BlockedSessionError` to refreshable or human-needed and a crash to harness-error, and it redacts the line.

## 6. Fixtures: `fixtures/load.ts` and `config/fixtures.json`

```ts
loadFixtures(path?) / getFixture(id) / listFixtures({env, product, capability, ownerPersona, destructiveOk, includePlaceholders})
assertDestructiveOk(f)      // BlockedError{GUARDRAIL} unless destructiveOk:true and env !== 'production'
assertNoSecrets(data)       // refuses secret-shaped keys or values (identifier-only registry)
findFixturesFile(), FIXTURES_PATH_ENV ('QA_FIXTURES_PATH')
```

- `getFixture()` on a placeholder (`status: "TODO: …"`) throws `BlockedError{FIXTURE/not-provisioned}`.
- The loader rejects a production fixture with `destructiveOk: true`.
- Factories and iam-fixtures **must** call `assertDestructiveOk()` before any create, update or delete.

## 7. Checking this package

```bash
cd ~/QA-Automations/packages/qa-core
npm run typecheck   # TestPilot's tsc, strict, noEmit; also proves Playwright's APIRequestContext fits ApiRequestLike
npm run selftest    # offline: target allow/deny table, clients against a fake request, redaction, fixtures, probe CLI exit codes
```

## Rules for changing qa-core

- Framework work chains must not edit `packages/qa-core`. Report the change you need instead.
- No runtime import of `@playwright/test`; `import type` only.
- No new dependencies.
- Never add `--disable-blink-features` or any other automation-hiding flag here.
