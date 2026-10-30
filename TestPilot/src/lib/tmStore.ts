// Client for the server-side TM store (`/api/tm/*`). The Test-Management state
// (suites/cases/plans/…) now lives in a shared, durable SQLite DB instead of a
// per-browser localStorage blob. Same-origin fetch (the tmApi plugin guards writes
// with an Origin check). See server/tmStore.ts + tmApi() in vite.config.ts.

export type TmSaveResult = {
  ok: boolean;
  savedAt?: string;
  cases?: number;
  suites?: number;
  backedUp?: boolean;
  warning?: string;
};
export type TmBackup = { id: number; cases: number; suites: number; reason: string | null; savedAt: string };

// GET the current server state. `state` is null when the DB is empty (fresh
// install → caller migrates/seeds). Returns null on network/server failure so the
// caller can fall back to the localStorage cache (degraded, still usable).
export async function fetchTmState(): Promise<{ state: unknown | null; cases: number; suites: number } | null> {
  try {
    const r = await fetch("/api/tm/state");
    if (!r.ok) return null;
    return (await r.json()) as { state: unknown | null; cases: number; suites: number };
  } catch {
    return null;
  }
}

// Persist the whole state blob. Throws on failure (caller keeps the localStorage
// mirror as the fallback). Returns counts + an optional `warning` on a big drop.
export async function saveTmState(state: unknown, reason?: string): Promise<TmSaveResult> {
  const r = await fetch("/api/tm/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, reason }),
  });
  if (!r.ok) throw new Error(`tm save failed: ${r.status}`);
  return (await r.json()) as TmSaveResult;
}

// Server-atomic key allocation (unused in v1 — keys stay client-local until
// Phase-2 multi-user auth; kept for that step). Returns null if unavailable.
export async function nextSeqRemote(kind: string): Promise<number | null> {
  try {
    const r = await fetch("/api/tm/seq/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { value: number }).value;
  } catch {
    return null;
  }
}

export async function seedSeqRemote(seq: Record<string, number>): Promise<void> {
  try {
    await fetch("/api/tm/seq/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seq }),
    });
  } catch {
    /* best-effort */
  }
}

export async function listTmBackups(): Promise<TmBackup[]> {
  try {
    const r = await fetch("/api/tm/backups");
    if (!r.ok) return [];
    return ((await r.json()) as { backups: TmBackup[] }).backups;
  } catch {
    return [];
  }
}

export async function restoreTmBackup(id: number): Promise<{ ok: boolean; cases: number; suites: number }> {
  const r = await fetch("/api/tm/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!r.ok) throw new Error(`tm restore failed: ${r.status}`);
  return (await r.json()) as { ok: boolean; cases: number; suites: number };
}
