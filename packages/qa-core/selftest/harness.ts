/** Minimal assertion harness for qa-core self-tests (no test-runner dependency). */
export const results: { name: string; ok: boolean; err?: string }[] = [];

export async function check(name: string, fn: () => unknown | Promise<unknown>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e instanceof Error ? e.message : String(e) });
  }
}

export function eq(actual: unknown, expected: unknown, msg = ''): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

export function truthy(v: unknown, msg = 'expected truthy'): void {
  if (!v) throw new Error(msg);
}

export async function throwsAsync(fn: () => Promise<unknown>, pred: (e: unknown) => boolean, msg = 'expected throw'): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (pred(e)) return;
    throw new Error(`${msg}: wrong error ${e instanceof Error ? e.message : String(e)}`);
  }
  throw new Error(`${msg}: did not throw`);
}

export function throws(fn: () => unknown, pred: (e: unknown) => boolean, msg = 'expected throw'): void {
  try {
    fn();
  } catch (e) {
    if (pred(e)) return;
    throw new Error(`${msg}: wrong error ${e instanceof Error ? e.message : String(e)}`);
  }
  throw new Error(`${msg}: did not throw`);
}

/** Synthetic unsigned JWT for tests (NOT a real credential). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'none', typ: 'JWT' })}.${b(payload)}.c2VsZnRlc3Q`;
}
