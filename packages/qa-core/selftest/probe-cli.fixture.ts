/** Spawned by probe-fixtures.selftest.ts to exercise the auth:probe CLI contract end-to-end. */
import { runProbe } from '../probe/probe-lib';
import { BlockedSessionError } from '../errors';
import { fakeJwt } from './harness';

const mode = (process.argv.find((a) => a.startsWith('--mode=')) || '').slice('--mode='.length);

runProbe(async () => {
  console.log('noise that must go to stderr', fakeJwt({ exp: 1 }));
  if (mode === 'ok') return { state: 'ok', code: 'ok', identity: { email: 'qa@example.test' }, expiresAt: new Date(Date.now() + 3600e3).toISOString() };
  if (mode === 'refreshable') return { state: 'refreshable', code: 'access-expired', identity: {}, humanAction: 'refresh me' };
  if (mode === 'human-needed') throw new BlockedSessionError({ code: 'expired', reason: 'expired', humanAction: 'npm run auth:capture' });
  throw new Error(`boom ${fakeJwt({ exp: 2 })}`);
});
