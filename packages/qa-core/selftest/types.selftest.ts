/**
 * Compile-time only (checked by `tsc -p packages/qa-core`): Playwright's real
 * APIRequestContext must satisfy qa-core's structural ApiRequestLike, so every
 * framework can pass its own `request` fixture. Type-only import — erased at runtime.
 */
import type { APIRequestContext } from '@playwright/test';
import type { ApiRequestLike } from '../api/base';
import { createLpApi } from '../api/lpApi';

export function _playwrightContextIsCompatible(ctx: APIRequestContext): ApiRequestLike {
  return ctx;
}

export function _wiresWithoutCasts(ctx: APIRequestContext) {
  return createLpApi({ request: ctx, env: 'staging', storageState: '.auth/staging.json' });
}
