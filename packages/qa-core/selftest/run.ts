/**
 * qa-core self-test. Offline: no network, no real sessions, synthetic tokens only.
 *   ../../TestPilot/node_modules/.bin/tsx selftest/run.ts
 */
import { results } from './harness';
import { runTargetTests, TARGET_CASES } from './targets.selftest';
import { runClientTests } from './clients.selftest';
import { runProbeFixtureTests } from './probe-fixtures.selftest';

(async () => {
  await runTargetTests();
  await runClientTests();
  await runProbeFixtureTests();
  const failed = results.filter((r) => !r.ok);
  const allow = TARGET_CASES.filter((c) => c[2]).length;
  for (const r of results) {
    if (!r.ok || process.env.VERBOSE) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.err ? `\n      ${r.err}` : ''}`);
  }
  console.log(`\nqa-core selftest: ${results.length - failed.length}/${results.length} passed (target cases: ${allow} allow, ${TARGET_CASES.length - allow} deny)`);
  process.exit(failed.length ? 1 : 0);
})();
