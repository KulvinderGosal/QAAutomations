/**
 * Human-in-the-loop verification / OTP code handoff.
 *
 * Signup smoke needs the email verification code that only a human can read.
 * This lets the operator inject it WHILE the smoke is running, without pausing
 * on stdin (which Playwright's runner can't service).
 *
 * Resolution order:
 *   1. env `SIGNUP_OTP` (or `VERIFICATION_CODE`) — set before the run.
 *   2. a file the operator writes DURING the run. Default:
 *      <os.tmpdir()>/lp-signup-otp.txt  (override with env `OTP_FILE`).
 *      Polled until it holds a numeric-ish code, then consumed (deleted).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export function otpFilePath(): string {
  return process.env.OTP_FILE || path.join(os.tmpdir(), 'lp-signup-otp.txt');
}

function clean(raw: string | undefined): string {
  return (raw || '').replace(/\s+/g, '').trim();
}

export interface OtpOpts {
  label?: string;
  timeoutMs?: number;
  pollMs?: number;
  minLen?: number;
}

export async function waitForVerificationCode(opts: OtpOpts = {}): Promise<string | null> {
  const { label = 'verification code', timeoutMs = 300000, pollMs = 2000, minLen = 4 } = opts;
  const valid = (v: string) => !!v && v.replace(/[^0-9a-z]/gi, '').length >= minLen;

  const envCode = clean(process.env.SIGNUP_OTP || process.env.VERIFICATION_CODE);
  if (envCode) {
    console.log(`🔑 Using ${label} from env (SIGNUP_OTP).`);
    return envCode;
  }

  const file = otpFilePath();
  try { fs.unlinkSync(file); } catch { /* not present — fine */ }

  const bar = '='.repeat(72);
  const isTty = !!(process.stdin && process.stdin.isTTY);
  console.log(`\n${bar}`);
  console.log(`⏳ ${label.toUpperCase()} NEEDED — the signup is paused, waiting up to ${Math.round(timeoutMs / 1000)}s.`);
  console.log('   Supply the code any of these ways:');
  if (isTty) console.log('     • type it here and press Enter');
  console.log(`     • echo <code> > "${file}"`);
  console.log('     • or set SIGNUP_OTP=<code> before the run');
  console.log(`${bar}\n`);

  // Race: interactive stdin (only if a TTY) vs. the polled hand-off file, with a
  // deadline. First valid code wins.
  return await new Promise<string | null>((resolve) => {
    let done = false;
    let rl: import('readline').Interface | null = null;
    const timer = setInterval(() => {
      try {
        const v = clean(fs.readFileSync(file, 'utf8'));
        if (valid(v)) { try { fs.unlinkSync(file); } catch { /* consumed */ } finish(v); }
      } catch { /* not written yet */ }
    }, pollMs);
    const deadline = setTimeout(() => finish(null), timeoutMs);

    if (isTty) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const readline = require('readline');
        rl = readline.createInterface({ input: process.stdin });
        rl!.on('line', (line: string) => { const v = clean(line); if (valid(v)) finish(v); });
      } catch { /* stdin unavailable — file/env still work */ }
    }

    function finish(v: string | null) {
      if (done) return;
      done = true;
      clearInterval(timer); clearTimeout(deadline);
      if (rl) { try { rl.close(); } catch { /* ignore */ } }
      if (v) console.log(`🔑 Received ${label}: ${v}`);
      else console.log(`⌛ No ${label} received within ${Math.round(timeoutMs / 1000)}s.`);
      resolve(v);
    }
  });
}
