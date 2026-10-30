/**
 * qa-core — BLOCKED error taxonomy.
 *
 * A BlockedError means "this test/run could not produce a verdict, and here is
 * the one thing a human (or the harness) must do". It is NEVER a pass and
 * NEVER a product defect. TestPilot (V1 verdict floor) maps it to the
 * BLOCKED{<cls>} job state and shows `humanAction` verbatim.
 *
 * Pure module: no Node, no Playwright imports (safe for TestPilot's browser UI).
 */

export const BLOCKED_CLASSES = [
  'SESSION', // saved login/session missing, expired, wrong account, rejected (401)
  'ENV', // environment unreachable / WAF challenge / DNS / staging down
  'DEPLOY', // the change under test is not deployed to the target yet
  'FIXTURE', // required test data/account/store missing or in the wrong state
  'ORACLE', // no trustworthy way to read the real outcome (e.g. QBO step-up)
  'DEV', // needs a developer (server logs, QA endpoint, plan provisioning)
  'GUARDRAIL', // a safety rule refused the action (destructiveOk:false, etc.)
  'HARNESS', // the test framework itself broke (browser missing, timeout, selector infra)
  'DEVICE', // simulator/emulator/real device unavailable
  'TARGET', // URL/method refused by guards/targets.ts (unknown host, prod write)
] as const;

export type BlockedClass = (typeof BLOCKED_CLASSES)[number];

export interface BlockedInfo {
  cls: BlockedClass;
  /** Why no verdict was possible. Human-readable, must never contain a secret. */
  reason: string;
  /** The exact next step for a human, e.g. "LP_ENV=staging npm run auth:capture in ledgerport-saas-automation". */
  humanAction: string;
  /** Optional machine sub-code, e.g. 'expired', 'unknown-host', 'waf'. */
  code?: string;
  /** Optional persona id (`<framework>:<env>[:<name>]`) the block relates to. */
  persona?: string;
  /** Optional extra, non-secret context (identifiers only). */
  details?: Record<string, string | number | boolean | null | undefined>;
}

/** Marker that survives Playwright's error serialisation (message string only). */
const MARKER_PREFIX = '[BLOCKED:';
const ACTION_SEP = ' -- human action: ';

export function formatBlockedMessage(info: Pick<BlockedInfo, 'cls' | 'code' | 'reason' | 'humanAction'>): string {
  const tag = info.code ? `${info.cls}/${info.code}` : info.cls;
  return `${MARKER_PREFIX}${tag}] ${info.reason}${ACTION_SEP}${info.humanAction}`;
}

export class BlockedError extends Error {
  readonly cls: BlockedClass;
  readonly reason: string;
  readonly humanAction: string;
  readonly code?: string;
  readonly persona?: string;
  readonly details?: BlockedInfo['details'];
  /** Duck-type flag so isBlockedError works across module copies / workers. */
  readonly isBlocked = true as const;

  constructor(info: BlockedInfo) {
    super(formatBlockedMessage(info));
    this.name = 'BlockedError';
    this.cls = info.cls;
    this.reason = info.reason;
    this.humanAction = info.humanAction;
    this.code = info.code;
    this.persona = info.persona;
    this.details = info.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): BlockedInfo & { name: string; message: string } {
    return {
      name: this.name,
      message: this.message,
      cls: this.cls,
      reason: this.reason,
      humanAction: this.humanAction,
      code: this.code,
      persona: this.persona,
      details: this.details,
    };
  }
}

export interface BlockedSessionInfo extends Omit<BlockedInfo, 'cls'> {
  /** True when a refresh token is still valid, so an automated refresh (I2a) can recover without a human. */
  refreshable?: boolean;
  /** ISO time the relevant token expired / expires. Never the token itself. */
  expiresAt?: string;
}

export class BlockedSessionError extends BlockedError {
  readonly refreshable: boolean;
  readonly expiresAt?: string;

  constructor(info: BlockedSessionInfo) {
    super({ ...info, cls: 'SESSION' });
    this.name = 'BlockedSessionError';
    this.refreshable = !!info.refreshable;
    this.expiresAt = info.expiresAt;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toJSON() {
    return { ...super.toJSON(), refreshable: this.refreshable, expiresAt: this.expiresAt };
  }
}

export function isBlockedClass(v: unknown): v is BlockedClass {
  return typeof v === 'string' && (BLOCKED_CLASSES as readonly string[]).includes(v);
}

/** True for BlockedError (and subclasses), including copies from another module instance. */
export function isBlockedError(e: unknown): e is BlockedError {
  if (e instanceof BlockedError) return true;
  if (!e || typeof e !== 'object') return false;
  const o = e as { isBlocked?: unknown; cls?: unknown; humanAction?: unknown };
  return o.isBlocked === true && isBlockedClass(o.cls) && typeof o.humanAction === 'string';
}

export function isBlockedSessionError(e: unknown): e is BlockedSessionError {
  return isBlockedError(e) && e.cls === 'SESSION';
}

/**
 * Recover BlockedInfo from a serialised error message (Playwright JSON report
 * `error.message`, runner stdout). Returns null when the text has no marker.
 */
export function parseBlockedMessage(text: string | undefined | null): Pick<BlockedInfo, 'cls' | 'code' | 'reason' | 'humanAction'> | null {
  if (!text) return null;
  const m = /\[BLOCKED:([A-Z]+)(?:\/([\w.:-]+))?\]\s*([\s\S]*?) -- human action: ([^\n]*)/.exec(text);
  if (!m || !isBlockedClass(m[1])) return null;
  return { cls: m[1], code: m[2], reason: m[3].trim(), humanAction: m[4].trim() };
}
