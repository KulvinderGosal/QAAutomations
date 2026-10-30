// Client for the V2a Asana → Test Cases import (POST /api/tm/import/asana/:gid).
// Types mirror server/qaLoop/intake.ts (the client never imports server code).
// Preview is read-only on both sides; confirm upserts into the TM DB server-side and
// returns the touched suites/cases, which the store merges (useTm.applyAsanaImport).
// Everything in a pack is DATA from Asana — the UI renders it as plain text only.
import { fetchWithNonce } from "@/lib/session";
import type { TmCase, TmSuite, TmActivity } from "@/tm/types";

export type IntakeCase = {
  caseKey: string | null;
  title: string;
  gid: string;
  url: string;
  completed: boolean;
  priority: "low" | "normal" | "high" | "critical" | null;
  preconditions: string[];
  steps: string[];
  expected: string[];
  pass: string[];
  fail: string[];
  devices: string[];
  environment: string[];
  doNotFile: string[];
  notes: string;
};

export type FlaggedImperative = { text: string; rule: string; source: string };
export type ScopeGap = { kind: string; reason: string; source: string; url?: string };

export type IntakePack = {
  taskGid: string;
  title: string;
  url: string;
  completed: boolean;
  suiteGid: string;
  suiteName: string;
  projects: string[];
  author: string | null;
  productGuess: { productId: string | null; why: string };
  cases: IntakeCase[];
  knownBehaviours: string[];
  flaggedImperatives: FlaggedImperative[];
  scopeIncomplete: ScopeGap[];
  questionForAuthor: string | null;
  attachments: { gid: string; name: string; host: string; createdAt: string | null; nearStoryGid: string | null }[];
  warnings: string[];
  stats: { subtasks: number; cases: number; keyed: number; comments: number; attachments: number };
};

export type PlannedAction = {
  gid: string;
  caseKey: string | null;
  title: string;
  action: "create" | "update" | "bind";
  tmCaseId: string;
  tmKey: string;
  tmSuiteId: string;
  note?: string;
};

export type ImportPlan = {
  actions: PlannedAction[];
  suite: { id: string; name: string; parentId: string | null; exists: boolean; productId: string | null };
  counts: { create: number; update: number; bind: number };
};

export type ImportPreview = {
  mode: "preview";
  pack: IntakePack;
  plan: ImportPlan;
  productId: string | null;
  productOptions: { suiteId: string; name: string; productId: string }[];
  previewHash: string;
};

export type ImportApplied = {
  mode: "applied";
  counts: ImportPlan["counts"];
  suite: ImportPlan["suite"];
  cases: TmCase[];
  suites: TmSuite[];
  seq: Record<string, number>;
  activity: TmActivity | null;
  savedAt: string;
  warning?: string;
};

/** Pull a gid out of a pasted Asana URL or a bare gid ("…/0/123/456" → the LAST number). */
export function parseAsanaGid(input: string): string | null {
  const s = (input || "").trim();
  if (/^\d{6,32}$/.test(s)) return s;
  const nums = s.match(/\d{6,32}/g);
  return nums?.length ? nums[nums.length - 1] : null;
}

async function post<T>(gid: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetchWithNonce(`/api/tm/import/asana/${encodeURIComponent(gid)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!r.ok) {
    const err = new Error(j.error || `Asana import failed (${r.status})`) as Error & { status?: number; code?: string };
    err.status = r.status;
    err.code = j.code;
    throw err;
  }
  return j;
}

/** Read-only: fetch + parse the Asana task and plan the upsert. Writes nothing. */
export function previewAsanaImport(gid: string, productId?: string | null): Promise<ImportPreview> {
  return post<ImportPreview>(gid, productId === undefined ? {} : { productId });
}

/** Upsert the previewed pack. The server re-reads Asana and refuses (409 "changed")
 *  if it no longer matches `previewHash`. */
export function confirmAsanaImport(gid: string, productId: string | null, previewHash: string, actor: string): Promise<ImportApplied> {
  return post<ImportApplied>(gid, { confirm: true, productId, previewHash, actor });
}
