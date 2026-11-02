/**
 * SPIKE A (QA Autonomy Plan I2a) — does the LedgerPort refresh token SLIDE, and
 * does re-using an old refresh token revoke the token family?
 *
 * USER-STARTED ONLY (about 15 minutes). The assistant never runs this script.
 * Staging only. It rotates the saved session's tokens.
 *
 *   npm run auth:spike-a                 # 2 refreshes: slide check + Cloudflare check
 *   npm run auth:spike-a -- --reuse-test # also re-use the OLD refresh token, then
 *                                        # test whether the newest one still works
 *                                        # (this MAY revoke the session → re-capture)
 *   add --no-write-back to leave .auth/staging.json untouched
 *
 * Preconditions: a fresh `npm run auth:capture` (refresh token valid).
 *
 * What it does, through an authenticated page.request (a real browser context
 * loaded from .auth/staging.json, so the request carries the browser's UA and
 * cookie jar):
 *   1. POST {apiBase}/auth/refresh {refreshToken: R0}  → A1, R1
 *   2. POST {apiBase}/auth/refresh {refreshToken: R1}  → A2, R2
 *   3. (--reuse-test) POST refresh with the OLD R0, then POST refresh with the newest
 *      token and GET /me with the newest access token → is the family revoked?
 *   4. Writes the newest still-valid tokens back into .auth/staging.json (unless
 *      --no-write-back), so the suite keeps a working session.
 *
 * Output: ONE JSON object of booleans, HTTP statuses and ISO timestamps only.
 * Tokens never leave this process and are never printed.
 *
 * Decide afterwards (record in the plan):
 *   slides=true  → implement keepSessionFresh with this path + daily 'lp-refresh-keepalive', workers:1.
 *   slides=false → persona is 'weekly human capture'; keepSessionFresh stays a no-op.
 *   reuseRevokesFamily=true → never share one storageState between contexts that refresh (I2b broker).
 */
import 'dotenv/config';
import fs from 'node:fs';
import { chromium, type APIRequestContext } from '@playwright/test';
import { getEnv } from '../config/env';
import { assertAllowedTarget } from '../../packages/qa-core/guards/targets';
import { detectWafChallenge, redact, resolveRunId, RUN_ID_HEADER } from '../../packages/qa-core/api/base';
import { isoFromSeconds, jwtExpSeconds } from '../../packages/qa-core/api/session';
import { LP_AUTH_STATE_KEY } from '../../packages/qa-core/api/lpApi';

const argv = process.argv.slice(2);
const REUSE_TEST = argv.includes('--reuse-test');
const WRITE_BACK = !argv.includes('--no-write-back');

type Tokens = { accessToken: string; refreshToken: string; expiresIn?: number; expiresAt?: number };
type StorageState = { cookies: unknown[]; origins: { origin: string; localStorage: { name: string; value: string }[] }[] };

const env = getEnv('staging'); // hard-pinned: never production
const appOrigin = new URL(env.baseURL).origin;

function readState(): { state: StorageState; entry: { name: string; value: string }; parsed: any; tokens: Tokens } {
  const state: StorageState = JSON.parse(fs.readFileSync(env.authFile, 'utf8'));
  const origin = state.origins?.find((o) => o.origin.replace(/\/+$/, '') === appOrigin);
  const entry = origin?.localStorage?.find((i) => i.name === LP_AUTH_STATE_KEY);
  if (!entry) throw new Error(`no ${LP_AUTH_STATE_KEY} for ${appOrigin} in ${env.authFile} — run npm run auth:capture first`);
  const parsed = JSON.parse(entry.value);
  const tokens = parsed?.state?.tokens as Tokens;
  if (!tokens?.accessToken || !tokens?.refreshToken) throw new Error('saved session has no access/refresh token — run npm run auth:capture first');
  return { state, entry, parsed, tokens };
}

interface CallResult {
  status: number;
  cloudflarePassed: boolean;
  ok: boolean;
  rotated?: boolean;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
  /** New refresh exp later than the previous refresh exp. */
  slid?: boolean;
}

async function refresh(req: APIRequestContext, refreshToken: string, prevRefreshExp: number): Promise<{ r: CallResult; next?: Tokens }> {
  const url = `${env.apiBaseURL}/auth/refresh`;
  assertAllowedTarget(url, 'POST'); // throws unless staging/local
  const res = await req.post(url, {
    data: { refreshToken },
    headers: { 'content-type': 'application/json', accept: 'application/json', [RUN_ID_HEADER]: resolveRunId() },
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  const body = await res.text().catch(() => '');
  const waf = detectWafChallenge(res.status(), res.headers(), body);
  const r: CallResult = { status: res.status(), cloudflarePassed: !waf, ok: res.ok() && !waf };
  if (!r.ok) return { r };
  let data: any = null;
  try {
    data = JSON.parse(body);
  } catch {
    r.ok = false;
    return { r };
  }
  const n = data?.tokens || data?.data?.tokens || data?.data || data;
  if (!n?.accessToken) {
    r.ok = false;
    return { r };
  }
  const next: Tokens = { accessToken: n.accessToken, refreshToken: n.refreshToken || refreshToken, expiresIn: n.expiresIn, expiresAt: n.expiresAt };
  const newRefreshExp = jwtExpSeconds(next.refreshToken);
  r.rotated = next.refreshToken !== refreshToken;
  r.accessExpiresAt = isoFromSeconds(jwtExpSeconds(next.accessToken));
  r.refreshExpiresAt = isoFromSeconds(newRefreshExp);
  r.slid = newRefreshExp > 0 && prevRefreshExp > 0 ? newRefreshExp > prevRefreshExp : undefined;
  return { r, next };
}

async function meStatus(req: APIRequestContext, accessToken: string): Promise<number> {
  const url = `${env.apiBaseURL}/me`;
  assertAllowedTarget(url, 'GET');
  const res = await req.get(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${accessToken}`, [RUN_ID_HEADER]: resolveRunId() },
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  return res.status();
}

async function main() {
  const startedAt = new Date().toISOString();
  const saved = readState();
  const t0 = saved.tokens;
  const r0Exp = jwtExpSeconds(t0.refreshToken);
  const out: Record<string, unknown> = {
    spike: 'A',
    env: env.name,
    startedAt,
    reuseTest: REUSE_TEST,
    savedAccessExpiresAt: isoFromSeconds(jwtExpSeconds(t0.accessToken)),
    savedRefreshExpiresAt: isoFromSeconds(r0Exp),
    savedRefreshValid: r0Exp > Date.now() / 1000,
  };
  if (!out.savedRefreshValid) {
    out.verdict = 'inconclusive';
    out.note = 'saved refresh token already expired — run npm run auth:capture, then re-run the spike';
    return out;
  }

  // An authenticated browser context (storageState) — page.request shares its cookie jar.
  // No app navigation: loading the SPA would trigger its own refresh and spoil the experiment.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: env.authFile });
    const page = await context.newPage();
    const req = page.request;

    const c1 = await refresh(req, t0.refreshToken, r0Exp);
    out.call1 = c1.r;
    let latest: Tokens | undefined = c1.next;
    if (c1.next) {
      const c2 = await refresh(req, c1.next.refreshToken, jwtExpSeconds(c1.next.refreshToken));
      out.call2 = c2.r;
      if (c2.next) latest = c2.next;
    }
    out.cloudflarePassed = [c1.r.cloudflarePassed, (out.call2 as CallResult | undefined)?.cloudflarePassed].filter((x) => x !== undefined).every(Boolean);
    out.refreshRotates = c1.r.rotated ?? null;
    // Slides = a refresh issues a refresh token with a LATER exp than the one it replaced.
    const slidFlags = [c1.r.slid, (out.call2 as CallResult | undefined)?.slid].filter((x) => typeof x === 'boolean');
    out.slides = slidFlags.length ? slidFlags.some(Boolean) : null;

    if (REUSE_TEST && latest && c1.r.rotated) {
      const reuse = await refresh(req, t0.refreshToken, r0Exp);
      out.reuseOldToken = { status: reuse.r.status, accepted: reuse.r.ok, cloudflarePassed: reuse.r.cloudflarePassed };
      const after = await refresh(req, latest.refreshToken, jwtExpSeconds(latest.refreshToken));
      const me = await meStatus(req, after.next?.accessToken || latest.accessToken);
      out.newestAfterReuse = { refreshStatus: after.r.status, refreshAccepted: after.r.ok, meStatus: me };
      out.reuseRevokesFamily = !after.r.ok;
      if (after.next) latest = after.next;
      else if (!after.r.ok) latest = undefined; // family revoked — nothing valid to write back
    } else if (REUSE_TEST) {
      out.reuseOldToken = 'skipped (refresh did not rotate or failed)';
    }

    if (WRITE_BACK && latest) {
      const fresh = readState(); // re-read in case anything else touched the file
      fresh.parsed.state.tokens = {
        ...fresh.tokens,
        accessToken: latest.accessToken,
        refreshToken: latest.refreshToken,
        expiresIn: latest.expiresIn ?? fresh.tokens.expiresIn,
        expiresAt: latest.expiresAt ?? (jwtExpSeconds(latest.accessToken) * 1000 || Date.now() + 900_000),
      };
      fresh.entry.value = JSON.stringify(fresh.parsed);
      fs.writeFileSync(env.authFile, JSON.stringify(fresh.state, null, 0));
      out.wroteBack = true;
    } else {
      out.wroteBack = false;
      if (!latest) out.note = 'no valid token left to save — run npm run auth:capture';
    }
    await context.close();
  } finally {
    await browser.close();
  }

  out.verdict = out.slides === true ? 'sliding' : out.slides === false ? 'absolute' : 'inconclusive';
  out.finishedAt = new Date().toISOString();
  return out;
}

main()
  .then((o) => {
    process.stdout.write(`${redact(JSON.stringify(o, null, 2))}\n`);
  })
  .catch((e) => {
    process.stderr.write(`spike-a failed: ${redact(e instanceof Error ? e.message : String(e)).slice(0, 400)}\n`);
    process.exit(1);
  });
