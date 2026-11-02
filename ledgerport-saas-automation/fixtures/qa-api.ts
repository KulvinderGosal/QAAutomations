/**
 * In-process authenticated LedgerPort API client for specs (QA Autonomy Plan I3).
 *
 *   import { test, expect } from '../../fixtures/qa-api';
 *   test('me @case:LP-API-ME', async ({ lpApi }) => {
 *     const me = await lpApi.getJson<{ data: { user: { email: string } } }>('me');
 *     expect(me.data.user.email).toContain('@');
 *   });
 *
 * - Worker-scoped, keyed by the project's `metadata.persona`
 *   (`ledgerport-saas-automation:<env>[:<name>]`, see playwright.config.ts).
 *   Session file: .auth/<env>.json, or .auth/<env>/<name>.json for a named persona.
 * - The token is read from the saved storageState INSIDE this process by
 *   qa-core lpApi and sent only to the LedgerPort API origin. It is never
 *   logged, attached or written anywhere.
 * - Every request goes through qa-core guards/targets.ts (staging: any method;
 *   production: GET/HEAD to listed paths only) and carries X-QA-Run-Id on staging.
 * - An expired/missing session throws BlockedSessionError
 *   ("[BLOCKED:SESSION/…] … -- human action: …") instead of failing like a bug.
 * - `refresh` is wired to keepSessionFresh(), which is a NO-OP until Spike A
 *   (tests/helpers/session.ts), so an expired access token reports
 *   BLOCKED{SESSION/access-expired, refreshable} rather than rotating tokens.
 *
 * Uses this framework's own @playwright/test; qa-core never imports it at runtime.
 */
import path from 'path';
import { test as base, expect, request as pwRequest } from '@playwright/test';
import { createLpApi, type LpApi } from '../../packages/qa-core/api/lpApi';
import { parsePersona, type PersonaId } from '../../packages/qa-core/probe/probe-lib';
import { ACTIVE, getEnv, type EnvName } from '../config/env';
import { keepSessionFresh } from '../tests/helpers/session';

export const FRAMEWORK_ID = 'ledgerport-saas-automation';
export const DEFAULT_PERSONA = `${FRAMEWORK_ID}:${ACTIVE.name}`;

/** Resolve a persona id to its env config + storageState path. */
export function personaSession(raw: string = DEFAULT_PERSONA): { persona: PersonaId; envName: EnvName; storageState: string } {
  const persona = parsePersona(raw);
  if (persona.framework !== FRAMEWORK_ID) throw new Error(`persona ${persona.id} does not belong to ${FRAMEWORK_ID}`);
  if (persona.env !== 'staging' && persona.env !== 'production') throw new Error(`persona env must be staging|production (got ${persona.env})`);
  const env = getEnv(persona.env);
  const storageState = persona.name ? path.join(path.dirname(env.authFile), env.name, `${persona.name}.json`) : env.authFile;
  return { persona, envName: env.name, storageState };
}

type WorkerFixtures = { lpApi: LpApi };

export const test = base.extend<{}, WorkerFixtures>({
  lpApi: [
    async ({}, use, workerInfo) => {
      const raw = String((workerInfo.project.metadata as Record<string, unknown> | undefined)?.persona ?? DEFAULT_PERSONA);
      const { persona, envName, storageState } = personaSession(raw);
      const env = getEnv(envName);
      const ctx = await pwRequest.newContext();
      try {
        await use(
          createLpApi({
            request: ctx,
            env: envName,
            storageState,
            apiBase: env.apiBaseURL,
            appOrigin: new URL(env.baseURL).origin,
            persona: persona.id,
            refresh: () => keepSessionFresh(env),
          }),
        );
      } finally {
        await ctx.dispose();
      }
    },
    { scope: 'worker' },
  ],
});

export { expect };
