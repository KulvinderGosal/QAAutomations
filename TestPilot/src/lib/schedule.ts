// Client helpers for the automation scheduler (/api/schedule/*). The dev
// middleware persists schedules to disk and fires due ones through the runner
// (command mode) while the dev server is running. Types mirror server/scheduler.ts.

export type Cadence =
  | { type: "interval"; everyMinutes: number }
  | { type: "daily"; at: string } // "HH:MM"
  | { type: "weekly"; day: number; at: string }; // 0=Sun … 6=Sat

export type Schedule = {
  id: string;
  framework: string;
  script: string;
  env?: string | null;
  cadence: Cadence;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastRunId: string | null;
  lastStatus: string | null;
  nextRunAt: string | null;
};

export type CreateScheduleInput = {
  framework: string;
  script: string;
  env?: string | null;
  cadence: Cadence;
  enabled?: boolean;
};

async function json<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}

export function fetchSchedules(): Promise<{ schedules: Schedule[] }> {
  return fetch("/api/schedule/list").then((r) => json(r));
}

export function createScheduleReq(body: CreateScheduleInput): Promise<{ schedule: Schedule }> {
  return fetch("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}

export function deleteScheduleReq(id: string): Promise<{ ok: boolean }> {
  return fetch(`/api/schedule/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) => json(r));
}

export function toggleScheduleReq(id: string, enabled: boolean): Promise<{ schedule: Schedule }> {
  return fetch(`/api/schedule/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  }).then((r) => json(r));
}

export function runScheduleReq(id: string): Promise<{ runId: string }> {
  return fetch(`/api/schedule/${encodeURIComponent(id)}/run`, { method: "POST" }).then((r) => json(r));
}

export function describeCadence(c: Cadence): string {
  if (c.type === "interval") return `every ${c.everyMinutes} min`;
  if (c.type === "daily") return `daily at ${c.at}`;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `weekly · ${days[((c.day % 7) + 7) % 7]} at ${c.at}`;
}
