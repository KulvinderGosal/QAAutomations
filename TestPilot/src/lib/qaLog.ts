// Durable QA sign-off log — a persisted record of every task QA verified & closed.
// Unlike task status (which is in-memory and reloads fresh from the connectors),
// this is written to localStorage so the record survives reloads/restarts. It's
// the audit trail of what QA closed, who closed it, when, and whether the
// origin (e.g. Asana) was updated for real.

export type QaLogEntry = {
  id: string;
  taskId: string;
  title: string;
  origin: "asana" | "github" | "slack" | "manual";
  pr: number | null;
  closedBy: string;
  closedAt: string; // ISO
  /** Result of the origin write-back on close. */
  asana: "completed" | "failed" | "none";
  /** Present when a GitHub issue was verified & closed via the Verify-fix flow. */
  github?: { repo: string; number: number; action: "verified-closed"; commentUrl?: string };
};

const KEY = "testpilot.qaLog";

export function readQaLog(): QaLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as QaLogEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeQaLog(list: QaLogEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 300)));
  } catch {
    /* localStorage unavailable — in-memory only */
  }
}
