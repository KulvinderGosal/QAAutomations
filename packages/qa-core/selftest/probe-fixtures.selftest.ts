import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { assertDestructiveOk, assertNoSecrets, getFixture, listFixtures, loadFixtures } from '../fixtures/load';
import { compareIdentity, parsePersona, PROBE_EXIT, readMeta, resultFromSummary } from '../probe/probe-lib';
import { isBlockedError } from '../errors';
import { check, eq, throws, truthy } from './harness';

const QA_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURES = path.join(QA_ROOT, 'config', 'fixtures.json');
const TSX = path.join(QA_ROOT, 'TestPilot', 'node_modules', '.bin', 'tsx');

export async function runProbeFixtureTests(): Promise<void> {
  await check('fixtures: loads, ids unique, production never destructive, no secrets', () => {
    const data = loadFixtures(FIXTURES);
    truthy(data.fixtures.length >= 20, `only ${data.fixtures.length} fixtures`);
    for (const f of data.fixtures) if (f.env === 'production') eq(f.destructiveOk, false, `${f.id} destructiveOk`);
    const prod = getFixture('pe-prod-site-76524-playground', FIXTURES);
    throws(() => assertDestructiveOk(prod), (e) => isBlockedError(e) && e.cls === 'GUARDRAIL');
    throws(() => getFixture('pe-staging-acct-web-only', FIXTURES), (e) => isBlockedError(e) && e.cls === 'FIXTURE' && e.code === 'not-provisioned');
    throws(() => getFixture('does-not-exist', FIXTURES), (e) => isBlockedError(e) && e.code === 'unknown-fixture');
    eq(listFixtures({ includePlaceholders: true }, FIXTURES).filter((f) => /^TODO/.test(String(f.status))).length, 3, 'rock 1.4 placeholders');
    truthy(listFixtures({ product: 'ledgerport-saas', env: 'staging' }, FIXTURES).length > 0, 'lp staging fixtures');
    throws(() => assertNoSecrets({ fixtures: [{ id: 'x', password: 'nope' }] }), () => true);
  });

  await check('probe: persona parsing + identity mismatch → human-needed/wrong-account', () => {
    eq(parsePersona('ledgerport-saas-automation:staging:silverlisting').name, 'silverlisting');
    eq(parsePersona('pushengage-app-dashboard:staging').id, 'pushengage-app-dashboard:staging');
    throws(() => parsePersona('justone'), () => true);
    throws(() => parsePersona('a:b:c:d'), () => true);
    eq(compareIdentity({ email: 'A@x.test' }, { email: 'a@x.test' }), []);
    const r = resultFromSummary(parsePersona('fw:staging'), { state: 'ok', code: 'ok', identity: { account: '202' } }, { account: '210' });
    eq([r.ok, r.state, r.code], [false, 'human-needed', 'wrong-account']);
  });

  await check('probe: CLI emits exactly ONE JSON line and the contract exit codes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-probe-'));
    fs.mkdirSync(path.join(dir, '.auth', 'staging'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.auth', 'staging', 'meta.json'), JSON.stringify({ email: 'qa@example.test', token: 'should-be-dropped' }));
    const script = path.join(__dirname, 'probe-cli.fixture.ts');
    const expectCodes: Array<[string, number]> = [
      ['ok', PROBE_EXIT.ok],
      ['refreshable', PROBE_EXIT.refreshable],
      ['human-needed', PROBE_EXIT['human-needed']],
      ['crash', PROBE_EXIT['harness-error']],
    ];
    for (const [mode, code] of expectCodes) {
      const r = spawnSync(TSX, [script, '--persona', `selftest-fw:staging`, `--mode=${mode}`], { cwd: dir, encoding: 'utf8', timeout: 30_000 });
      const lines = r.stdout.trim().split('\n').filter(Boolean);
      eq(lines.length, 1, `${mode}: stdout lines (stderr: ${r.stderr.slice(0, 200)})`);
      const j = JSON.parse(lines[0]);
      eq(r.status, code, `${mode}: exit`);
      eq(j.persona, 'selftest-fw:staging');
      truthy(['ok', 'refreshable', 'human-needed', 'harness-error'].includes(j.state));
      eq(j.expected, { email: 'qa@example.test' }, `${mode}: meta.json expected (secret keys dropped)`);
      truthy(!lines[0].includes('eyJ'), 'no JWT on stdout');
    }
    eq(readMeta(dir, 'staging').token, undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}
