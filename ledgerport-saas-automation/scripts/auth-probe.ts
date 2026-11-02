/**
 * auth:probe — session canary for the LedgerPort SaaS persona (I1 contract,
 * packages/qa-core/probe/contract.md).
 *
 *   npm run -s auth:probe -- --persona ledgerport-saas-automation:staging[:<name>] [--live]
 *
 * stdout: exactly ONE JSON line (no tokens — identity labels + expiry times only)
 * exit:   0 ok | 10 refreshable | 20 human-needed | 30 harness-error
 *
 * Session file: .auth/<env>.json (default persona) or .auth/<env>/<name>.json.
 * Expected identity: .auth/<env>/<name>.meta.json or .auth/<env>/meta.json
 *   e.g. {"email":"…","account":"202","businessId":"210"} — identifiers only.
 *
 * Offline by default (decodes JWT exp locally). --live makes ONE read-only
 * GET {apiBase}/me through qa-core lpApi (target guard applies; token stays in
 * this process) and checks the server-side email. --live is skipped for
 * production (/me is not on the production read allowlist). Never POSTs,
 * never refreshes, never logs in.
 */
import 'dotenv/config';
import * as path from 'node:path';
import { request } from '@playwright/test';
import { runProbe, resultFromSummary, type ProbeResult } from '../../packages/qa-core/probe/probe-lib';
import { createLpApi, inspectLpSession } from '../../packages/qa-core/api/lpApi';
import { getEnv } from '../config/env';
import { captureCommand } from '../tests/helpers/session';

const FRAMEWORK = 'ledgerport-saas-automation';

type MeBody = { data?: { user?: { email?: string } } & { email?: string }; user?: { email?: string }; email?: string };

runProbe(async ({ persona, live, frameworkDir, expected }): Promise<ProbeResult> => {
  if (persona.framework !== FRAMEWORK) throw new Error(`persona framework must be ${FRAMEWORK}, got ${persona.framework}`);
  if (persona.env !== 'staging' && persona.env !== 'production') throw new Error(`env must be staging|production, got ${persona.env}`);
  const env = getEnv(persona.env);
  const appOrigin = new URL(env.baseURL).origin;
  const file = persona.name ? path.join(frameworkDir, '.auth', env.name, `${persona.name}.json`) : env.authFile;

  const summary = inspectLpSession(file, env.name, { appOrigin });
  if (summary.state !== 'ok') summary.humanAction = captureCommand(env);

  let check: 'offline' | 'live' = 'offline';
  let liveEmailMismatch = false;
  if (live && summary.state === 'ok') {
    if (env.name === 'production') {
      console.error('[auth-probe] --live skipped for production (identity endpoint is not on the production read allowlist).');
    } else {
      const ctx = await request.newContext();
      try {
        const api = createLpApi({ request: ctx, env: env.name, storageState: file, appOrigin, apiBase: env.apiBaseURL, persona: persona.id });
        const me = await api.getJson<MeBody>('me'); // read-only identity GET (the SPA's own user.api `get("me")`)
        const email = me?.data?.user?.email ?? me?.user?.email ?? me?.data?.email ?? me?.email;
        check = 'live';
        if (email && summary.identity.email && email.trim().toLowerCase() !== summary.identity.email.trim().toLowerCase()) {
          liveEmailMismatch = true;
        }
        if (!email) console.error('[auth-probe] GET /me answered 2xx but without a user email — treating as live-ok.');
      } finally {
        await ctx.dispose();
      }
    }
  }

  const result = resultFromSummary(persona, summary, expected);
  const businessIds = (summary.identity.businesses || '').split(',').filter(Boolean);
  const out = {
    ...result,
    identity: { ...result.identity, ...(businessIds.length ? { businessId: businessIds.join(',') } : {}) },
    check,
  } as ProbeResult & { check: string };

  const wantBusiness = expected.businessId || expected.business;
  const businessMismatch = !!wantBusiness && businessIds.length > 0 && !businessIds.includes(String(wantBusiness));
  if (out.state !== 'harness-error' && (businessMismatch || liveEmailMismatch)) {
    const what = [businessMismatch && 'businessId', liveEmailMismatch && 'server-side email (/me)'].filter(Boolean).join('/');
    out.state = 'human-needed';
    out.ok = false;
    out.code = 'wrong-account';
    out.humanAction = `Saved session does not match the expected ${what} — re-capture the right account: ${captureCommand(env)}`;
  }
  return out;
});
