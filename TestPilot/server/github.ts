// Server-side GitHub REST client.
// Runs inside the Vite dev server (Node) — never in the browser — so the
// personal access / OAuth token stays on this side of the wire and is never
// bundled into client code. Mirrors server/asana.ts.
const BASE = "https://api.github.com";

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GitHubError";
  }
}

async function ghGet<T = unknown>(token: string, path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        // GitHub rejects requests without a User-Agent.
        "User-Agent": "TestPilot-QA",
      },
    });
  } catch (e) {
    throw new GitHubError(502, `Could not reach GitHub: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (body?.message as string) ||
      (res.status === 401 ? "Invalid or expired GitHub token" : res.statusText) ||
      "GitHub request failed";
    throw new GitHubError(res.status, msg);
  }
  return body as T;
}

export type GitHubUser = { login: string; name: string | null; avatar_url?: string };

export type NormalizedGitHubIssue = {
  id: string;
  number: number;
  repo: string; // "owner/repo"
  title: string;
  body: string;
  url: string;
  state: string;
  labels: string[];
  assignee: string | null; // login
  creator: string | null; // login
  // The "other side" of the issue relative to the viewer — used for the
  // "Assigned by" attribution in TestPilot. Prefers a non-viewer assignee, then
  // a non-viewer creator, then the last non-viewer commenter (e.g. the dev who
  // commented the fix). For self-filed QA issues, that last case is what makes
  // the responsible dev — not you — show up.
  counterpart: string | null;
  // Login of the most recent commenter who isn't the viewer (best-effort).
  lastActor: string | null;
  // The most recent non-viewer comment (the dev's response/fix note) — powers
  // the "dev responded → Verify fix" flow in TestPilot. null if none.
  devComment: { login: string; body: string; at: string } | null;
  comments: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type RawIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  comments: number;
  created_at: string | null;
  updated_at: string | null;
  closed_at?: string | null;
  pull_request?: unknown;
  user?: { login?: string } | null;
  assignee?: { login?: string } | null;
  assignees?: { login?: string }[] | null;
  labels?: ({ name?: string } | string)[] | null;
  repository_url?: string;
};

export async function getViewer(token: string): Promise<GitHubUser> {
  const u = await ghGet<GitHubUser>(token, "/user");
  return { login: u.login, name: u.name ?? null, avatar_url: u.avatar_url };
}

function labelNames(labels: RawIssue["labels"]): string[] {
  return (labels ?? [])
    .map((l) => (typeof l === "string" ? l : l?.name))
    .filter((n): n is string => !!n);
}

function repoFromUrl(item: RawIssue, fallback: string): string {
  // repository_url is present on search results ("…/repos/owner/repo").
  const m = item.repository_url?.match(/repos\/([^/]+\/[^/]+)$/);
  if (m) return m[1];
  // html_url: https://github.com/owner/repo/issues/123
  const h = item.html_url?.match(/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\//);
  return h ? h[1] : fallback;
}

// Prefer a non-viewer assignee, then a non-viewer creator, then the last
// non-viewer commenter (the dev working the issue on a self-filed QA ticket).
function computeCounterpart(
  assignee: string | null,
  creator: string | null,
  lastActor: string | null,
  viewer: string,
): string | null {
  if (assignee && assignee !== viewer) return assignee;
  if (creator && creator !== viewer) return creator;
  if (lastActor && lastActor !== viewer) return lastActor;
  return assignee ?? creator ?? lastActor ?? null;
}

// Best-effort: the login of the most recent commenter who isn't the viewer.
// Comments come back oldest-first, so scan from the end. Returns null on any
// error (attribution simply falls back to assignee/creator).
async function lastDevComment(
  token: string,
  repo: string,
  number: number,
  viewer: string,
): Promise<{ login: string; body: string; at: string } | null> {
  try {
    const comments = await ghGet<{ user?: { login?: string }; body?: string; created_at?: string }[]>(
      token,
      `/repos/${repo}/issues/${number}/comments?per_page=100`,
    );
    for (let i = comments.length - 1; i >= 0; i--) {
      const login = comments[i]?.user?.login;
      if (login && login !== viewer) {
        return { login, body: (comments[i]?.body || "").slice(0, 600), at: comments[i]?.created_at || "" };
      }
    }
  } catch {
    /* ignore — best effort */
  }
  return null;
}

function normalize(item: RawIssue, viewer: string, fallbackRepo: string): NormalizedGitHubIssue {
  const repo = repoFromUrl(item, fallbackRepo);
  const creator = item.user?.login ?? null;
  const assignee = item.assignee?.login ?? item.assignees?.[0]?.login ?? null;
  return {
    id: `${repo}#${item.number}`,
    number: item.number,
    repo,
    title: item.title || "(untitled issue)",
    body: item.body || "",
    url: item.html_url,
    state: item.state,
    labels: labelNames(item.labels),
    assignee,
    creator,
    // Provisional (no comment data yet); finalized during enrichment below.
    counterpart: computeCounterpart(assignee, creator, null, viewer),
    lastActor: null,
    devComment: null,
    comments: item.comments ?? 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

/**
 * Open issues relevant to the viewer:
 *  - if `repo` (owner/repo) is set → issues in that repo authored by OR assigned
 *    to the viewer (two calls, merged & de-duped; PRs filtered out);
 *  - otherwise → a cross-repo search for open issues that involve the viewer.
 */
export async function listMyIssues(
  token: string,
  repo?: string,
): Promise<{ user: GitHubUser; repo: string; issues: NormalizedGitHubIssue[] }> {
  const user = await getViewer(token);
  const viewer = user.login;

  let raw: RawIssue[];
  if (repo) {
    const [created, assigned] = await Promise.all([
      ghGet<RawIssue[]>(token, `/repos/${repo}/issues?state=open&creator=${viewer}&per_page=100`),
      ghGet<RawIssue[]>(token, `/repos/${repo}/issues?state=open&assignee=${viewer}&per_page=100`),
    ]);
    const byNumber = new Map<number, RawIssue>();
    for (const it of [...(created || []), ...(assigned || [])]) {
      if (it.pull_request) continue; // the issues endpoint also returns PRs
      byNumber.set(it.number, it);
    }
    raw = [...byNumber.values()];
  } else {
    const q = encodeURIComponent(`is:issue is:open involves:${viewer}`);
    const search = await ghGet<{ items: RawIssue[] }>(
      token,
      `/search/issues?q=${q}&sort=updated&order=desc&per_page=50`,
    );
    raw = search.items || [];
  }

  const issues = raw.map((it) => normalize(it, viewer, repo || ""));

  // Enrich attribution: for issues with comments, resolve the last non-viewer
  // commenter (e.g. the dev who commented the fix) and re-derive `counterpart`.
  // Runs in parallel; failures fall back to the assignee/creator attribution.
  await Promise.all(
    issues
      .filter((it) => it.comments > 0)
      .map(async (it) => {
        const dc = await lastDevComment(token, it.repo, it.number, viewer);
        it.devComment = dc;
        it.lastActor = dc?.login ?? null;
        it.counterpart = computeCounterpart(it.assignee, it.creator, it.lastActor, viewer);
      }),
  );

  // Newest-updated first.
  issues.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return { user, repo: repo || "(involves:me)", issues };
}

// ── Repo-wide issue list + close (for the "Bugs for this PR" task-detail view) ──

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

/** All issues (open + closed, PRs excluded) for a repo, up to 300 (3 pages). */
export async function listRepoIssues(token: string, repo: string): Promise<RepoIssue[]> {
  const out: RepoIssue[] = [];
  for (let page = 1; page <= 3; page++) {
    const items = await ghGet<RawIssue[]>(token, `/repos/${repo}/issues?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(items) || items.length === 0) break;
    for (const it of items) {
      if (it.pull_request) continue; // the issues endpoint also returns PRs
      out.push({
        number: it.number,
        title: it.title,
        url: it.html_url,
        state: it.state,
        labels: (it.labels || []).map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean),
        comments: it.comments ?? 0,
        assignee: it.assignee?.login ?? null,
        creator: it.user?.login ?? null,
        createdAt: it.created_at ?? "",
        closedAt: it.closed_at ?? null,
      });
    }
    if (items.length < 100) break;
  }
  return out;
}

export type RepoCommit = {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
};

/** Latest commit on a branch (READ-ONLY — GET /repos/{repo}/commits/{branch}). */
export async function latestCommit(token: string, repo: string, branch = "master"): Promise<RepoCommit> {
  const c = await ghGet<{
    sha: string;
    html_url: string;
    commit: { message?: string; author?: { name?: string; date?: string } };
    author?: { login?: string } | null;
  }>(token, `/repos/${repo}/commits/${encodeURIComponent(branch)}`);
  return {
    sha: c.sha,
    message: (c.commit?.message || "").split("\n")[0].slice(0, 200),
    author: c.author?.login || c.commit?.author?.name || null,
    date: c.commit?.author?.date || null,
    url: c.html_url,
  };
}

// ── Pull requests (READ-ONLY) — used by the Test Plans PR → plan builder ─────
export type PrFile = { filename: string; status: string; additions: number; deletions: number };
export type PullRequest = {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string; // open | closed
  merged: boolean;
  labels: string[];
  author: string | null;
  base: string; // base branch
  head: string; // head branch
  createdAt: string;
  updatedAt: string;
  changedFiles: number;
  files: PrFile[]; // populated for a single PR fetch (empty in the list)
};

type RawPr = {
  number: number;
  title?: string;
  body?: string | null;
  html_url?: string;
  state?: string;
  merged?: boolean;
  merged_at?: string | null;
  labels?: (string | { name?: string })[];
  user?: { login?: string } | null;
  base?: { ref?: string };
  head?: { ref?: string };
  created_at?: string;
  updated_at?: string;
  changed_files?: number;
};

function normalizePr(p: RawPr, files: PrFile[] = []): PullRequest {
  return {
    number: p.number,
    title: p.title || "",
    body: (p.body || "").slice(0, 8000),
    url: p.html_url || "",
    state: p.state || "open",
    merged: !!(p.merged || p.merged_at),
    labels: (p.labels || []).map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean),
    author: p.user?.login ?? null,
    base: p.base?.ref ?? "",
    head: p.head?.ref ?? "",
    createdAt: p.created_at ?? "",
    updatedAt: p.updated_at ?? "",
    changedFiles: p.changed_files ?? files.length,
    files,
  };
}

/** One PR with its changed files (GET /repos/{repo}/pulls/{n} + /files). */
export async function getPullRequest(token: string, repo: string, number: number): Promise<PullRequest> {
  const pr = await ghGet<RawPr>(token, `/repos/${repo}/pulls/${number}`);
  const raw = await ghGet<{ filename: string; status: string; additions: number; deletions: number }[]>(
    token,
    `/repos/${repo}/pulls/${number}/files?per_page=100`,
  ).catch(() => []);
  const files: PrFile[] = (Array.isArray(raw) ? raw : []).map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
  }));
  return normalizePr(pr, files);
}

/** Recent OPEN PRs for a repo, newest first (GET /repos/{repo}/pulls). */
export async function listPullRequests(token: string, repo: string): Promise<PullRequest[]> {
  const items = await ghGet<RawPr[]>(token, `/repos/${repo}/pulls?state=open&sort=created&direction=desc&per_page=15`);
  return (Array.isArray(items) ? items : []).map((p) => normalizePr(p));
}

/** Close a single issue (real write). Needs a token with issues:write / repo scope. */
export async function closeIssue(token: string, repo: string, number: number): Promise<{ number: number; state: string; url: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/repos/${repo}/issues/${number}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "TestPilot-QA",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: "closed" }),
    });
  } catch (e) {
    throw new GitHubError(502, `Could not reach GitHub: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new GitHubError(res.status, (body?.message as string) || `Could not close issue #${number}`);
  }
  return { number, state: (body.state as string) || "closed", url: (body.html_url as string) || "" };
}

/** Post a comment on an issue (real write). Needs a token with issues:write / repo scope. */
export async function commentOnIssue(
  token: string,
  repo: string,
  number: number,
  commentBody: string,
): Promise<{ id: number; url: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/repos/${repo}/issues/${number}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "TestPilot-QA",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: commentBody }),
    });
  } catch (e) {
    throw new GitHubError(502, `Could not reach GitHub: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new GitHubError(res.status, (body?.message as string) || `Could not comment on issue #${number}`);
  }
  return { id: (body.id as number) ?? 0, url: (body.html_url as string) || "" };
}
