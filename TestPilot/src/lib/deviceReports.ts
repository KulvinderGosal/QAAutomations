// Client for IAM on-device run reports — same-origin /api/devrun/* middleware
// (server/deviceReports.ts). Reports persist to disk (with screenshots), so
// they survive reloads; localStorage never holds the big screenshot data URLs.

export type DeviceRunResult = {
  caseId: string;
  key: string;
  title: string;
  status: string;
  screenshot?: string | null;
  hasShot?: boolean; // present in the light list
};
export type DeviceRun = {
  id: string;
  at: string;
  by: string;
  label: string;
  total: number;
  passed: number;
  failed: number;
  results: DeviceRunResult[];
};

async function json<T>(r: Response): Promise<T> {
  const b = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(b.error || `Request failed (${r.status})`);
  return b;
}

export function listDeviceReports(): Promise<{ reports: DeviceRun[] }> {
  return fetch("/api/devrun/list").then((r) => json(r));
}
export function fetchDeviceReport(id: string): Promise<{ report: DeviceRun }> {
  return fetch(`/api/devrun/report?id=${encodeURIComponent(id)}`).then((r) => json(r));
}
export function saveDeviceReport(report: DeviceRun): Promise<{ id: string }> {
  return fetch("/api/devrun/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report }),
  }).then((r) => json(r));
}
