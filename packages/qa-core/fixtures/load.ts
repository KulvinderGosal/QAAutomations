/**
 * qa-core — fixture registry loader (D4).
 *
 * Source of truth: <QA-Automations>/config/fixtures.json (identifiers only — no
 * passwords, tokens or keys; emails appear only as identity labels).
 * Resolution order for the file: explicit path → env QA_FIXTURES_PATH → walk up
 * from process.cwd() looking for config/fixtures.json.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BlockedError } from '../errors';

export interface Fixture {
  id: string;
  env: 'staging' | 'production' | 'local' | string;
  product: string;
  purpose: string;
  capabilities: string[];
  ownerPersona: string | null;
  plan: string | null;
  realmId: string | null;
  store: string | null;
  siteId: string | null;
  accountId: string | null;
  businessId: string | null;
  sharedWith: string[];
  destructiveOk: boolean;
  singleUse: boolean;
  verifyHint: string;
  /** Optional free-form status, e.g. 'TODO: user creates'. */
  status?: string;
  notes?: string;
  [k: string]: unknown;
}

export interface FixtureFile {
  $schema?: string;
  version?: number;
  updated?: string;
  fixtures: Fixture[];
}

export const FIXTURES_PATH_ENV = 'QA_FIXTURES_PATH';

/** Fields that must never appear in fixtures.json (G1: identifier-only). */
const FORBIDDEN_KEY = /pass(word)?|secret|token|api_?key|cookie|jwt|bearer|otp|totp|nonce/i;
const SECRET_VALUE = /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.|\bBearer\s+\S{8,}|shpat_[a-f0-9]{16,}|sk_(live|test)_[A-Za-z0-9]{8,}/;

export function findFixturesFile(explicit?: string): string | null {
  const candidates: string[] = [];
  if (explicit) candidates.push(explicit);
  const fromEnv = process.env[FIXTURES_PATH_ENV];
  if (fromEnv) candidates.push(fromEnv);
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(dir, 'config', 'fixtures.json'));
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return candidates.find((c) => fs.existsSync(c)) || null;
}

/** Throws if the registry carries anything secret-shaped (keys or values). */
export function assertNoSecrets(data: unknown, where = 'fixtures.json'): void {
  const walk = (v: unknown, p: string) => {
    if (typeof v === 'string') {
      if (SECRET_VALUE.test(v)) throw new Error(`${where}: secret-shaped value at ${p} — fixtures are identifiers only`);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (FORBIDDEN_KEY.test(k)) throw new Error(`${where}: forbidden key "${k}" at ${p} — fixtures are identifiers only`);
        walk(x, `${p}.${k}`);
      }
    }
  };
  walk(data, '$');
}

let cache: { file: string; mtime: number; data: FixtureFile } | null = null;

export function loadFixtures(filePath?: string): FixtureFile {
  const file = findFixturesFile(filePath);
  if (!file) {
    throw new BlockedError({
      cls: 'HARNESS',
      code: 'no-fixtures-file',
      reason: 'config/fixtures.json not found (looked at QA_FIXTURES_PATH and up from the cwd)',
      humanAction: 'Run from inside ~/QA-Automations or set QA_FIXTURES_PATH to the fixtures.json path.',
    });
  }
  const mtime = fs.statSync(file).mtimeMs;
  if (cache && cache.file === file && cache.mtime === mtime) return cache.data;
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as FixtureFile;
  if (!data || !Array.isArray(data.fixtures)) throw new Error(`${file}: expected {"fixtures": [...]}`);
  assertNoSecrets(data, file);
  const seen = new Set<string>();
  for (const f of data.fixtures) {
    if (!f.id) throw new Error(`${file}: fixture without id`);
    if (seen.has(f.id)) throw new Error(`${file}: duplicate fixture id ${f.id}`);
    seen.add(f.id);
    if (f.env === 'production' && f.destructiveOk) throw new Error(`${file}: production fixture ${f.id} must have destructiveOk:false`);
  }
  cache = { file, mtime, data };
  return data;
}

export function getFixture(id: string, filePath?: string): Fixture {
  const f = loadFixtures(filePath).fixtures.find((x) => x.id === id);
  if (!f) {
    throw new BlockedError({
      cls: 'FIXTURE',
      code: 'unknown-fixture',
      reason: `fixture "${id}" is not in config/fixtures.json`,
      humanAction: `Add "${id}" to ~/QA-Automations/config/fixtures.json (identifiers only) or use an existing fixture id.`,
    });
  }
  if (typeof f.status === 'string' && /^TODO/i.test(f.status)) {
    throw new BlockedError({
      cls: 'FIXTURE',
      code: 'not-provisioned',
      reason: `fixture "${id}" is a placeholder (${f.status})`,
      humanAction: `Provision it as described in its purpose/verifyHint, then fill in its identifiers and remove "status" in config/fixtures.json.`,
    });
  }
  return f;
}

export interface FixtureFilter {
  env?: string;
  product?: string;
  capability?: string;
  ownerPersona?: string;
  destructiveOk?: boolean;
  /** Include TODO placeholders (default false). */
  includePlaceholders?: boolean;
}

export function listFixtures(filter: FixtureFilter = {}, filePath?: string): Fixture[] {
  return loadFixtures(filePath).fixtures.filter((f) => {
    if (!filter.includePlaceholders && typeof f.status === 'string' && /^TODO/i.test(f.status)) return false;
    if (filter.env && f.env !== filter.env) return false;
    if (filter.product && f.product !== filter.product) return false;
    if (filter.capability && !(f.capabilities || []).includes(filter.capability)) return false;
    if (filter.ownerPersona && f.ownerPersona !== filter.ownerPersona) return false;
    if (filter.destructiveOk !== undefined && f.destructiveOk !== filter.destructiveOk) return false;
    return true;
  });
}

/** Factories / iam-fixtures call this before ANY create/update/delete against a fixture. */
export function assertDestructiveOk(f: Fixture): Fixture {
  if (!f.destructiveOk || f.env === 'production') {
    throw new BlockedError({
      cls: 'GUARDRAIL',
      code: 'destructive-not-ok',
      reason: `fixture "${f.id}" (${f.env}, ${f.product}) is destructiveOk:false${f.sharedWith?.length ? `; shared with ${f.sharedWith.join(', ')}` : ''}`,
      humanAction: `Use a fixture marked destructiveOk:true (listFixtures({destructiveOk:true, product:'${f.product}'})) or provision a QA-owned one.`,
      details: { fixture: f.id, env: f.env },
    });
  }
  return f;
}
