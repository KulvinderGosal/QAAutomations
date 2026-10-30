// Client-side Asana helpers: fetch from our same-origin /api/asana/* proxy and
// map real Asana tasks onto TestPilot's Task model. No token ever lives here.
import type { Dev, Product, Task } from "@/types";
import { fetchWithNonce } from "./session";

export type RawAsanaTask = {
  gid: string;
  name: string;
  notes: string;
  url: string;
  completed: boolean;
  dueOn: string | null;
  assignee: string | null;
  createdBy: string | null;
  project: string;
  createdAt: string | null;
};

export type AsanaTasksResp =
  | { connected: false; reason?: string; error?: string }
  | {
      connected: true;
      user: { gid: string; name: string };
      workspace: string;
      tasks: RawAsanaTask[];
    };

export type AsanaStatusResp =
  | { connected: false; reason?: string; error?: string }
  | { connected: true; user: { gid: string; name: string; email?: string } };

export async function fetchAsanaStatus(): Promise<AsanaStatusResp> {
  const r = await fetch("/api/asana/me");
  return (await r.json()) as AsanaStatusResp;
}

export async function fetchAsanaTasks(): Promise<AsanaTasksResp> {
  const r = await fetch("/api/asana/tasks");
  return (await r.json()) as AsanaTasksResp;
}

/** Post a comment to an Asana task; `mention` (a name) is @-linked when resolvable. */
export async function postAsanaComment(
  gid: string,
  text: string,
  mention?: string,
): Promise<{ storyGid?: string; mentioned?: boolean; error?: string }> {
  const r = await fetchWithNonce("/api/asana/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gid, text, mention }),
  });
  const b = (await r.json().catch(() => ({}))) as { storyGid?: string; mentioned?: boolean; error?: string };
  if (!r.ok) return { error: b.error || `Request failed (${r.status})` };
  return b;
}

/** Mark an Asana task complete (real write-back on close). */
export async function completeAsanaTask(gid: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetchWithNonce("/api/asana/complete-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gid }),
  });
  const b = (await r.json().catch(() => ({}))) as { completed?: boolean; error?: string };
  if (!r.ok) return { ok: false, error: b.error || `Request failed (${r.status})` };
  return { ok: true };
}

// Best-effort: pick the product whose brand / type / name best matches the
// Asana project + task title. Falls back to the first product.
export function inferProductId(text: string, products: Product[]): string {
  const hay = text.toLowerCase();
  let best = products[0]?.id ?? "";
  let bestScore = 0;
  for (const p of products) {
    const tokens = [p.brand, p.type, ...p.name.split(/\s+/)].map((s) => s.toLowerCase());
    let score = 0;
    for (const tok of tokens) {
      if (tok.length >= 3 && hay.includes(tok)) score += tok === p.brand.toLowerCase() ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p.id;
    }
  }
  return best;
}

function inferType(name: string): Task["type"] {
  const n = name.toLowerCase();
  if (/\b(bug|fix|regression|broken|error|crash|fails?)\b/.test(n)) return "Bug fix";
  if (/\b(refactor|cleanup|migrate)\b/.test(n)) return "Refactor";
  if (/\b(chore|bump|upgrade|deps|dependency)\b/.test(n)) return "Chore";
  return "Feature";
}

// Devs commonly name the QA task after the PR ("QA: PR #268 — …") or drop a
// GitHub PR link in the notes. Pull out the number and, when a FULL github link
// is present, the real PR + repo URLs — so we link the ACTUAL PR instead of a
// fabricated one. When only a bare "PR #268" is given we don't know the repo,
// so the URLs stay empty (better a missing link than a 404).
function inferPrLink(text: string): { pr: number; prUrl: string; repoUrl: string } {
  const link = text.match(/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/i);
  if (link) return { pr: Number(link[2]), prUrl: link[0], repoUrl: `https://github.com/${link[1]}` };
  const bare = text.match(/\bPR\s*#?(\d+)\b/i);
  return { pr: bare ? Number(bare[1]) : 0, prUrl: "", repoUrl: "" };
}

export function asanaToTask(raw: RawAsanaTask, products: Product[], devs: Dev[]): Task {
  const productId = inferProductId(`${raw.project} ${raw.name}`, products);
  const prInfo = inferPrLink(`${raw.name} ${raw.notes}`);
  // Attribute the task to the dev who CREATED / assigned it in Asana (created_by),
  // NOT the assignee — the assignee is the QA person (you). No silent fallback to
  // the first dev; unknown creators are added to the dev list upstream in the store.
  const creator = raw.createdBy?.trim() || null;
  const dev = creator
    ? devs.find((d) => d.name.toLowerCase() === creator.toLowerCase())
    : undefined;
  const createdAt = raw.createdAt ?? new Date().toISOString();

  return {
    id: `asana-${raw.gid}`,
    title: raw.name,
    description: raw.notes,
    acceptanceCriteria: "",
    type: inferType(raw.name),
    priority: "Medium",
    productId,
    pr: prInfo.pr,
    branch: "",
    environment: "staging",
    devId: dev?.id ?? "",
    createdAt,
    status: raw.completed ? "verified" : "assigned",
    failIndex: null,
    tests: [],
    activity: [
      {
        id: `a-asana-${raw.gid}`,
        icon: "assign",
        html: `Imported from <b>Asana</b>${creator ? ` · created by ${creator}` : ""}`,
        at: createdAt,
      },
    ],
    issue: null,
    devResponded: null,
    run: { running: false, progress: 0, currentTestId: null },
    ownership: "unclaimed",
    pickedUpAt: null,
    clearedAt: null,
    testArtifacts: { plan: false, scenarios: false, cases: false },
    origin: "asana",
    asana: { gid: raw.gid, url: raw.url, project: raw.project, completed: raw.completed },
    // Only real GitHub URLs when the dev linked a PR; otherwise blank so the
    // task-detail Links list drops them (the Asana permalink is the source link).
    links: {
      pullRequest: prInfo.prUrl,
      branchUrl: "",
      repository: prInfo.repoUrl,
    },
  };
}
