// Durable store for IAM on-device run reports (TMS "Run on device"). Each run —
// a single case or a bulk "Run selected" — is saved as one JSON file (with the
// pass/fail per case + the captured screenshots as data URLs) under a durable
// dir, so the reporting section keeps every run + its screenshots across
// reloads. Screenshots are big, so localStorage never holds them (see
// src/tm/store.ts save()); this is the source of truth. Server-only.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DIR = join(homedir(), "QA-Automations", "testpilot-device-reports");

export type DeviceRunResult = {
  caseId: string;
  key: string;
  title: string;
  status: string; // passed | failed | skipped | blocked
  screenshot?: string | null; // data URL
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

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}
const safeId = (id: string) => (id || "").replace(/[^\w-]/g, "");

export function saveDeviceReport(r: DeviceRun): { id: string } {
  ensureDir();
  const id = safeId(r.id) || `devrun-${Date.now()}`;
  writeFileSync(join(DIR, `${id}.json`), JSON.stringify({ ...r, id }));
  return { id };
}

/** Light list (no screenshot data) for the reporting index. */
export function listDeviceReports(): (Omit<DeviceRun, "results"> & { results: (Omit<DeviceRunResult, "screenshot"> & { hasShot: boolean })[] })[] {
  ensureDir();
  const out = [];
  for (const f of readdirSync(DIR).filter((n) => n.endsWith(".json"))) {
    try {
      const r = JSON.parse(readFileSync(join(DIR, f), "utf8")) as DeviceRun;
      out.push({
        id: r.id,
        at: r.at,
        by: r.by,
        label: r.label,
        total: r.total,
        passed: r.passed,
        failed: r.failed,
        results: (r.results || []).map((x) => ({ caseId: x.caseId, key: x.key, title: x.title, status: x.status, hasShot: !!x.screenshot })),
      });
    } catch {
      /* skip a corrupt file */
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Full report including screenshot data URLs. */
export function readDeviceReport(id: string): DeviceRun {
  ensureDir();
  const p = join(DIR, `${safeId(id)}.json`);
  if (!existsSync(p)) throw new Error("report not found");
  return JSON.parse(readFileSync(p, "utf8")) as DeviceRun;
}
