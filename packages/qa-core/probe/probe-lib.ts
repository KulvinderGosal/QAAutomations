/**
 * qa-core — shared helpers for the `auth:probe` CLI contract (see ./contract.md).
 *
 *   npm run auth:probe -- --persona <framework>:<env>[:<name>]
 *   → stdout: exactly ONE JSON line (ProbeResult)
 *   → exit:   0 ok | 10 refreshable | 20 human-needed | 30 harness-error
 *
 * A framework's scripts/auth-probe.ts is typically:
 *
 *   import { runProbe } from '../../packages/qa-core/probe/probe-lib';
 *   import { inspectLpSession } from '../../packages/qa-core/api/lpApi';
 *   runProbe(async ({ persona, frameworkDir }) =>
 *     inspectLpSession(`${frameworkDir}/.auth/${persona.env}.json`, persona.env as 'staging'));
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isBlockedError, isBlockedSessionError } from '../errors';
import { redact } from '../api/base';
import type { SessionIdentity, SessionSummary } from '../api/session';

export { decodeJwtPayload, jwtExpSeconds, isoFromSeconds } from '../api/session';

export const PROBE_EXIT = { ok: 0, refreshable: 10, 'human-needed': 20, 'harness-error': 30 } as const;
export type ProbeState = keyof typeof PROBE_EXIT;

export interface PersonaId {
  framework: string;
  env: string;
  name?: string;
  /** Canonical string `<framework>:<env>[:<name>]`. */
  id: string;
}

const SEG = /^[a-z0-9][a-z0-9._-]*$/i;

/** Parse `<framework>:<env>[:<name>]`. Throws on malformed input. */
export function parsePersona(raw: string): PersonaId {
  const parts = String(raw || '').trim().split(':');
  if (parts.length < 2 || parts.length > 3 || !parts.every((p) => SEG.test(p))) {
    throw new Error(`invalid persona "${raw}" — expected <framework>:<env>[:<name>], e.g. ledgerport-saas-automation:staging:silverlisting`);
  }
  const [framework, env, name] = parts;
  return { framework, env, name, id: formatPersona({ framework, env, name }) };
}

export function formatPersona(p: { framework: string; env: string; name?: string }): string {
  return [p.framework, p.env, p.name].filter(Boolean).join(':');
}

export interface ProbeArgs {
  persona: PersonaId;
  /** --live: the probe may make ONE authenticated GET (identity endpoint) through qa-core clients. */
  live: boolean;
}

export function parseProbeArgs(argv: readonly string[] = process.argv.slice(2)): ProbeArgs {
  let personaRaw: string | undefined;
  let live = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--persona') personaRaw = argv[++i];
    else if (a.startsWith('--persona=')) personaRaw = a.slice('--persona='.length);
    else if (a === '--live') live = true;
  }
  if (!personaRaw) throw new Error('missing --persona <framework>:<env>[:<name>]');
  return { persona: parsePersona(personaRaw), live };
}

const META_FORBIDDEN = /pass(word)?|secret|token|api_?key|cookie|jwt|bearer|otp|nonce/i;

/**
 * Read the expected identity for a persona: `.auth/<env>/<name>.meta.json` when a
 * name is given and that file exists, else `.auth/<env>/meta.json`. Secret-shaped
 * keys are dropped. Returns {} when absent.
 */
export function readMeta(frameworkDir: string, env: string, name?: string): Record<string, string> {
  const dir = path.join(frameworkDir, '.auth', env);
  const files = [name ? path.join(dir, `${name}.meta.json`) : null, path.join(dir, 'meta.json')].filter(Boolean) as string[];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw || {})) {
        if (META_FORBIDDEN.test(k)) continue;
        if (v == null || typeof v === 'object') continue;
        out[k] = String(v);
      }
      return out;
    } catch {
      /* try next */
    }
  }
  return {};
}

/** Keys compared between the live session identity and meta.json expectations. */
export const IDENTITY_KEYS = ['email', 'store', 'account', 'site'] as const;

export function compareIdentity(identity: SessionIdentity, expected: Record<string, string>): string[] {
  const mismatches: string[] = [];
  for (const k of IDENTITY_KEYS) {
    const want = expected[k];
    const got = identity[k];
    if (want && got && want.trim().toLowerCase() !== String(got).trim().toLowerCase()) mismatches.push(k);
  }
  return mismatches;
}

export interface ProbeResult {
  persona: string;
  env: string;
  ok: boolean;
  state: ProbeState;
  identity: { email?: string; store?: string; account?: string; site?: string };
  expected: Record<string, string>;
  expiresAt?: string;
  refreshExpiresAt?: string;
  humanAction?: string;
  /** Machine sub-code ('ok', 'expired', 'wrong-account', 'no-file', …). */
  code?: string;
  checkedAt: string;
}

/** Build a ProbeResult from a token-free SessionSummary + meta.json expectations. */
export function resultFromSummary(persona: PersonaId, summary: SessionSummary, expected: Record<string, string> = {}): ProbeResult {
  const identity = {
    email: summary.identity.email,
    store: summary.identity.store,
    account: summary.identity.account,
    site: summary.identity.site,
  };
  let state: ProbeState = summary.state;
  let code = summary.code;
  let humanAction = summary.humanAction;
  const mismatches = compareIdentity(summary.identity, expected);
  if (mismatches.length) {
    state = 'human-needed';
    code = 'wrong-account';
    humanAction = `Saved session is for a different ${mismatches.join('/')} than .auth/${persona.env}/meta.json expects — re-capture the right account. ${summary.humanAction || ''}`.trim();
  }
  return {
    persona: persona.id,
    env: persona.env,
    ok: state === 'ok',
    state,
    identity,
    expected,
    expiresAt: summary.expiresAt,
    refreshExpiresAt: summary.refreshExpiresAt,
    humanAction: state === 'ok' ? undefined : humanAction,
    code,
    checkedAt: new Date().toISOString(),
  };
}

export function harnessError(persona: string, env: string, message: string, expected: Record<string, string> = {}): ProbeResult {
  return {
    persona,
    env,
    ok: false,
    state: 'harness-error',
    identity: {},
    expected,
    code: 'harness-error',
    humanAction: `Probe crashed: ${message}`,
    checkedAt: new Date().toISOString(),
  };
}

/** Print exactly one redacted JSON line on stdout and exit with the contract code. */
export function emitProbeResult(result: ProbeResult, opts: { exit?: boolean } = {}): void {
  const line = redact(JSON.stringify(result)).replace(/\n/g, ' ');
  process.stdout.write(`${line}\n`);
  if (opts.exit !== false) process.exit(PROBE_EXIT[result.state] ?? PROBE_EXIT['harness-error']);
}

export interface ProbeContext {
  persona: PersonaId;
  live: boolean;
  /** Framework root (process.cwd() under `npm run`). */
  frameworkDir: string;
  expected: Record<string, string>;
}

/**
 * Run a probe body under the contract: parses args, reads meta.json, routes any
 * console output from the body to stderr (stdout carries ONLY the result line),
 * maps BlockedSessionError → human-needed/refreshable and anything else → harness-error.
 */
export async function runProbe(
  body: (ctx: ProbeContext) => Promise<SessionSummary | ProbeResult>,
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  let persona: PersonaId | null = null;
  const origLog = console.log;
  const origInfo = console.info;
  console.log = (...a: unknown[]) => console.error(...a.map((x) => redact(x)));
  console.info = console.log;
  let result: ProbeResult;
  try {
    const args = parseProbeArgs(argv);
    persona = args.persona;
    const frameworkDir = process.cwd();
    const expected = readMeta(frameworkDir, persona.env, persona.name);
    const out = await body({ persona, live: args.live, frameworkDir, expected });
    result = 'checkedAt' in out ? out : resultFromSummary(persona, out, expected);
  } catch (e) {
    if (persona && isBlockedSessionError(e)) {
      result = resultFromSummary(
        persona,
        { state: e.refreshable ? 'refreshable' : 'human-needed', code: e.code || 'blocked', identity: {}, humanAction: e.humanAction, expiresAt: e.expiresAt },
        readMeta(process.cwd(), persona.env, persona.name),
      );
    } else if (persona && isBlockedError(e) && e.cls === 'ENV') {
      result = resultFromSummary(persona, { state: 'human-needed', code: e.code || 'env', identity: {}, humanAction: e.humanAction }, readMeta(process.cwd(), persona.env, persona.name));
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      result = harnessError(persona?.id || 'unknown', persona?.env || 'unknown', redact(msg).slice(0, 300), persona ? readMeta(process.cwd(), persona.env, persona.name) : {});
    }
  } finally {
    console.log = origLog;
    console.info = origInfo;
  }
  emitProbeResult(result);
}
