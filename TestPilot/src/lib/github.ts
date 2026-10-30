// Client-side GitHub helpers: fetch from our same-origin /api/github/* proxy and
// map real GitHub issues onto TestPilot's Task model. No token ever lives here.
import type { Dev, Product, Task } from "@/types";
import { fetchWithNonce } from "./session";
import { inferProductId } from "@/lib/asana";

export type RawGithubIssue = {
  id: string;
  number: number;
  repo: string;
  title: string;
  body: string;
  url: string;
  state: string;
  labels: string[];
  assignee: string | null;
  creator: string | null;
  counterpart: string | null;
  lastActor: string | null;
  devComment: { login: string; body: string; at: string } | null;
  comments: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GithubIssuesResp =
  | { connected: false; reason?: string; error?: string }
  | {
      connected: true;
      user: { login: string; name: string | null };
      repo: string;
      issues: RawGithubIssue[];
    };

export type GithubStatusResp =
  | { connected: false; reason?: string; error?: string }
  | { connected: true; user: { login: string; name: string | null } };

// ── Pull requests (for the Test Plans "PR → test plan" builder) ──────────────
export type GithubPrFile = { filename: string; status: string; additions: number; deletions: number };
export type GithubPr = {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  merged: boolean;
  labels: string[];
  author: string | null;
  base: string;
  head: string;
  createdAt: string;
  updatedAt: string;
  changedFiles: number;
  files: GithubPrFile[];
};

/** Parse a PR reference → { repo, number }. Accepts a full github.com PR URL or "owner/repo#123". */
export function parsePrUrl(input: string): { repo: string; number: number } | null {
  const s = (input || "").trim();
  let m = s.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i);
  if (m) return { repo: m[1], number: Number(m[2]) };
  m = s.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
  if (m) return { repo: m[1], number: Number(m[2]) };
  return null;
}

/** Fetch one PR (with its changed files) via the same-origin proxy. */
export async function fetchPr(repo: string, number: number): Promise<GithubPr> {
  const r = await fetch(`/api/github/pr?repo=${encodeURIComponent(repo)}&number=${number}`);
  const j = (await r.json()) as { pr?: GithubPr; error?: string; reason?: string };
  if (!r.ok || !j.pr) throw new Error(j.error || j.reason || `Could not fetch ${repo}#${number}`);
  return j.pr;
}

/** List recent OPEN PRs for a repo (newest first). */
export async function listPrs(repo: string): Promise<GithubPr[]> {
  const r = await fetch(`/api/github/prs?repo=${encodeURIComponent(repo)}`);
  const j = (await r.json()) as { prs?: GithubPr[]; error?: string; reason?: string };
  if (!r.ok || !j.prs) throw new Error(j.error || j.reason || `Could not list PRs for ${repo}`);
  return j.prs;
}

export async function fetchGithubStatus(): Promise<GithubStatusResp> {
  const r = await fetch("/api/github/me");
  return (await r.json()) as GithubStatusResp;
}

// ── Repo-wide issues + close (for the "Bugs for this PR" task-detail view) ─────
export type RepoIssue = {
  number: number;
  title: string;
  url: string;
  state: string; // "open" | "closed"
  labels: string[];
  comments: number;
  assignee: string | null;
  creator: string | null;
  createdAt: string;
  closedAt: string | null;
};

export type RepoIssuesResp =
  | { connected: false; reason?: string; error?: string }
  | { connected: true; repo: string; issues: RepoIssue[] };

export async function fetchRepoIssues(repo: string): Promise<RepoIssuesResp> {
  const r = await fetch(`/api/github/repo-issues?repo=${encodeURIComponent(repo)}`);
  return (await r.json()) as RepoIssuesResp;
}

export async function closeRepoIssue(
  repo: string,
  number: number,
): Promise<{ issue?: { number: number; state: string; url: string }; error?: string }> {
  const r = await fetchWithNonce("/api/github/close-issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, number }),
  });
  return (await r.json()) as { issue?: { number: number; state: string; url: string }; error?: string };
}

// Post a comment on a real GitHub issue (used by the Verify-fix workflow to
// write back "verified & validated" before closing). REAL write — the server
// needs a token with issues:write / repo scope.
export async function commentOnRepoIssue(
  repo: string,
  number: number,
  body: string,
): Promise<{ comment?: { id: number; url: string }; error?: string }> {
  const r = await fetchWithNonce("/api/github/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, number, body }),
  });
  return (await r.json()) as { comment?: { id: number; url: string }; error?: string };
}

// ── Latest commit on a branch (READ-ONLY — for the Test Runner site cards) ─────
export type RepoCommit = { sha: string; message: string; author: string | null; date: string | null; url: string };
export type LatestCommitResp =
  | { connected: false; reason?: string; error?: string }
  | { connected: true; repo: string; branch: string; commit: RepoCommit };

export async function fetchLatestCommit(repo: string, branch = "master"): Promise<LatestCommitResp> {
  const r = await fetch(
    `/api/github/latest-commit?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`,
  );
  return (await r.json()) as LatestCommitResp;
}

export async function fetchGithubIssues(): Promise<GithubIssuesResp> {
  const r = await fetch("/api/github/issues");
  return (await r.json()) as GithubIssuesResp;
}

function inferType(labels: string[], title: string): Task["type"] {
  const hay = `${labels.join(" ")} ${title}`.toLowerCase();
  if (/\b(bug|fix|regression|broken|error|crash|fails?|defect|tabnab|exception)\b/.test(hay)) {
    return "Bug fix";
  }
  if (/\b(refactor|cleanup|dead code|polish)\b/.test(hay)) return "Refactor";
  if (/\b(chore|bump|upgrade|deps|dependency)\b/.test(hay)) return "Chore";
  if (/\b(improvement|enhance)\b/.test(hay)) return "Feature";
  return "Feature";
}

// Priority from labels first (priority:*/P0-P2/severity:*), then a "Severity: X"
// line in the body (the pushengage QA issues use this convention).
function inferPriority(labels: string[], body: string): Task["priority"] {
  const lab = labels.join(" ").toLowerCase();
  if (/\b(p0|p1|critical|high|urgent|blocker)\b/.test(lab)) return "High";
  if (/\b(p3|low|minor|trivial)\b/.test(lab)) return "Low";
  if (/\b(p2|medium|moderate)\b/.test(lab)) return "Medium";
  const m = body.match(/severity[:\s]+\**\s*(critical|high|medium|low)/i);
  if (m) {
    const s = m[1].toLowerCase();
    if (s === "critical" || s === "high") return "High";
    if (s === "low") return "Low";
    return "Medium";
  }
  return "Medium";
}

export function githubIssueToTask(raw: RawGithubIssue, products: Product[], devs: Dev[]): Task {
  const productId = inferProductId(`${raw.repo} ${raw.title} ${raw.labels.join(" ")}`, products);
  // Attribute to the counterpart dev (the party that isn't you). No silent
  // fallback to the first dev — unknown logins are added as synthetic devs
  // upstream in the store.
  const who = raw.counterpart?.trim() || null;
  const dev = who ? devs.find((d) => d.name.toLowerCase() === who.toLowerCase()) : undefined;
  const createdAt = raw.createdAt ?? new Date().toISOString();
  const [owner, name] = raw.repo.split("/");

  // A dev's most recent (non-you) comment reads as their fix/response. Surface
  // it as an activity entry and set `devResponded` so the Verify-fix CTA lights.
  const dc = raw.devComment;
  const activity: Task["activity"] = [
    {
      id: `a-gh-${raw.number}`,
      icon: "assign",
      html: `Imported from <b>GitHub</b> · <b>${raw.repo}</b>#${raw.number}${
        raw.creator ? ` · opened by ${raw.creator}` : ""
      }`,
      at: createdAt,
    },
  ];
  if (dc) {
    const snippet = dc.body.replace(/\s+/g, " ").trim().slice(0, 160);
    activity.push({
      id: `a-gh-${raw.number}-devcomment`,
      icon: "comment",
      html: `💬 <b>${dc.login}</b> commented${snippet ? `: “${snippet}${dc.body.length > 160 ? "…" : ""}”` : ""}`,
      at: dc.at || createdAt,
    });
  }

  return {
    id: `github-${raw.repo.replace(/[^a-z0-9]+/gi, "-")}-${raw.number}`,
    title: raw.title,
    description: raw.body,
    acceptanceCriteria: "",
    type: inferType(raw.labels, raw.title),
    priority: inferPriority(raw.labels, raw.body),
    productId,
    pr: 0,
    branch: "",
    environment: "staging",
    devId: dev?.id ?? "",
    createdAt,
    status: raw.state === "closed" ? "verified" : "assigned",
    failIndex: null,
    tests: [],
    activity,
    issue: {
      number: raw.number,
      repoId: raw.repo,
      title: raw.title,
      body: raw.body,
      labels: raw.labels,
    },
    devResponded: dc?.at ?? null,
    run: { running: false, progress: 0, currentTestId: null },
    ownership: "unclaimed",
    pickedUpAt: null,
    clearedAt: null,
    testArtifacts: { plan: false, scenarios: false, cases: false },
    origin: "github",
    github: {
      repo: raw.repo,
      number: raw.number,
      url: raw.url,
      state: raw.state,
      labels: raw.labels,
      comments: raw.comments,
      assignee: raw.assignee,
      creator: raw.creator,
      devComment: raw.devComment,
    },
    links: {
      pullRequest: raw.url,
      branchUrl: raw.url,
      repository: owner && name ? `https://github.com/${owner}/${name}` : raw.url,
    },
  };
}
