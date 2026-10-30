// Server-side Asana REST client.
// Runs inside the Vite dev server (Node) — never in the browser — so the
// personal access token stays on this side of the wire and is never bundled
// into client code.
const BASE = "https://app.asana.com/api/1.0";

export class AsanaError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AsanaError";
  }
}

async function asanaGet<T = unknown>(token: string, path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (e) {
    throw new AsanaError(502, `Could not reach Asana: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (!res.ok) {
    const msg =
      body?.errors?.[0]?.message ||
      (res.status === 401 ? "Invalid or expired Asana token" : res.statusText) ||
      "Asana request failed";
    throw new AsanaError(res.status, msg);
  }
  return body.data as T;
}

export type AsanaUser = {
  gid: string;
  name: string;
  email?: string;
  workspaces?: { gid: string; name: string }[];
};

export type NormalizedAsanaTask = {
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

export async function getMe(token: string): Promise<AsanaUser> {
  return asanaGet<AsanaUser>(token, "/users/me?opt_fields=name,email,workspaces.name");
}

/** Mark an Asana task complete (their "closed"). Real write — needs a token with
 *  write access to the task. Reversible in Asana (can be re-opened). */
export async function completeTask(token: string, gid: string): Promise<{ gid: string; completed: boolean }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/tasks/${gid}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ data: { completed: true } }),
    });
  } catch (e) {
    throw new AsanaError(502, `Could not reach Asana: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as {
    data?: { gid: string; completed: boolean };
    errors?: { message: string }[];
  };
  if (!res.ok) {
    const msg =
      body?.errors?.[0]?.message ||
      (res.status === 401 ? "Invalid or expired Asana token" : res.statusText) ||
      "Could not complete the Asana task";
    throw new AsanaError(res.status, msg);
  }
  return { gid, completed: body.data?.completed ?? true };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Resolve a user gid by matching a name against the task's creator + followers. */
async function resolveMentionGid(token: string, taskGid: string, name: string): Promise<string | null> {
  try {
    const t = await asanaGet<{
      created_by?: { gid: string; name: string };
      followers?: { gid: string; name: string }[];
    }>(token, `/tasks/${taskGid}?opt_fields=created_by.gid,created_by.name,followers.gid,followers.name`);
    const n = name.trim().toLowerCase();
    const cands = [t.created_by, ...(t.followers || [])].filter(Boolean) as { gid: string; name: string }[];
    return cands.find((u) => u.name?.toLowerCase().includes(n))?.gid ?? null;
  } catch {
    return null;
  }
}

/** Post a comment (story) to a task. `mention` (a name) is @-linked if it maps
 *  to the task's creator/follower; otherwise it's added as plain text. Real write. */
export async function addComment(
  token: string,
  taskGid: string,
  text: string,
  mention?: string,
): Promise<{ storyGid: string; mentioned: boolean }> {
  const mentionGid = mention ? await resolveMentionGid(token, taskGid, mention) : null;
  const prefix = mentionGid ? `<a data-asana-gid="${mentionGid}"/> ` : mention ? `${escapeHtml(mention)} ` : "";
  const htmlText = `<body>${prefix}${escapeHtml(text)}</body>`;
  let res: Response;
  try {
    res = await fetch(`${BASE}/tasks/${taskGid}/stories`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ data: { html_text: htmlText } }),
    });
  } catch (e) {
    throw new AsanaError(502, `Could not reach Asana: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as { data?: { gid: string }; errors?: { message: string }[] };
  if (!res.ok) {
    throw new AsanaError(res.status, body?.errors?.[0]?.message || res.statusText || "Could not post the comment");
  }
  return { storyGid: body.data?.gid ?? "", mentioned: !!mentionGid };
}

export async function listMyTasks(
  token: string,
  workspaceGid?: string,
): Promise<{ user: AsanaUser; workspace: string; tasks: NormalizedAsanaTask[] }> {
  const user = await getMe(token);
  const workspace = workspaceGid || user.workspaces?.[0]?.gid;
  if (!workspace) throw new AsanaError(400, "No Asana workspace is available for this token");

  const fields = [
    "name",
    "notes",
    "permalink_url",
    "completed",
    "due_on",
    "assignee.name",
    "created_by.name",
    "projects.name",
    "created_at",
  ].join(",");

  // Incomplete tasks assigned to the token owner in this workspace.
  const raw = await asanaGet<Record<string, unknown>[]>(
    token,
    `/tasks?assignee=me&workspace=${workspace}&completed_since=now&limit=100&opt_fields=${encodeURIComponent(fields)}`,
  );

  const tasks: NormalizedAsanaTask[] = (raw || []).map((t) => {
    const assignee = t.assignee as { name?: string } | null;
    const createdBy = t.created_by as { name?: string } | null;
    const projects = t.projects as { name?: string }[] | undefined;
    return {
      gid: String(t.gid),
      name: (t.name as string) || "(untitled Asana task)",
      notes: (t.notes as string) || "",
      url: (t.permalink_url as string) || `https://app.asana.com/0/0/${t.gid}`,
      completed: !!t.completed,
      dueOn: (t.due_on as string) || null,
      assignee: assignee?.name || null,
      createdBy: createdBy?.name || null,
      project: projects?.[0]?.name || "Asana",
      createdAt: (t.created_at as string) || null,
    };
  });

  return { user, workspace, tasks };
}

// ── V2a read-only intake (task by gid + subtasks + stories + attachments) ─────
// Everything below is GET-only. What comes back from Asana is DATA for the
// intake parser (server/qaLoop/intake.ts) — never instructions to act on.

const GID_RE = /^\d{1,32}$/;

/** True when `gid` looks like an Asana gid (digits only). Guards path building. */
export function isAsanaGid(gid: string): boolean {
  return GID_RE.test(gid);
}

function assertGid(gid: string): void {
  if (!isAsanaGid(gid)) throw new AsanaError(400, "Invalid Asana gid (digits only)");
}

type AsanaPage<T> = { data: T[]; next_page?: { offset?: string } | null };

async function asanaGetPage<T>(token: string, path: string): Promise<AsanaPage<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (e) {
    throw new AsanaError(502, `Could not reach Asana: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as AsanaPage<T> & { errors?: { message: string }[] };
  if (!res.ok) {
    const msg =
      body?.errors?.[0]?.message ||
      (res.status === 401 ? "Invalid or expired Asana token" : res.statusText) ||
      "Asana request failed";
    throw new AsanaError(res.status, msg);
  }
  return { data: body.data || [], next_page: body.next_page ?? null };
}

/** Follow Asana's next_page.offset cursor until exhausted (hard cap: 50 pages). */
async function asanaGetAll<T>(token: string, basePath: string): Promise<T[]> {
  const out: T[] = [];
  let offset: string | undefined;
  for (let page = 0; page < 50; page++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const path = `${basePath}${sep}limit=100${offset ? `&offset=${encodeURIComponent(offset)}` : ""}`;
    const r = await asanaGetPage<T>(token, path);
    out.push(...r.data);
    offset = r.next_page?.offset || undefined;
    if (!offset) break;
  }
  return out;
}

export type AsanaNamed = { gid: string; name?: string };
export type AsanaCustomField = { gid: string; name?: string; display_value?: string | null };
export type AsanaMembership = { project?: AsanaNamed | null; section?: AsanaNamed | null };

/** A task with the fields the intake parser reads. */
export type AsanaTaskFull = {
  gid: string;
  name: string;
  notes: string;
  html_notes: string;
  completed: boolean;
  permalink_url: string;
  parent: AsanaNamed | null;
  memberships: AsanaMembership[];
  custom_fields: AsanaCustomField[];
  assignee: AsanaNamed | null;
  created_by: AsanaNamed | null;
  created_at: string | null;
  modified_at: string | null;
  num_subtasks?: number;
};

export type AsanaStory = {
  gid: string;
  created_at: string;
  created_by: AsanaNamed | null;
  resource_subtype: string;
  type: string;
  text: string;
};

export type AsanaAttachment = {
  gid: string;
  name: string;
  resource_subtype: string;
  host: string;
  created_at: string | null;
  /** The story (comment) posted closest in time to the upload, if any (≤ 10 min). */
  nearStoryGid?: string | null;
};

const TASK_FIELDS = [
  "name",
  "notes",
  "html_notes",
  "completed",
  "permalink_url",
  "parent.name",
  "memberships.project.name",
  "memberships.section.name",
  "custom_fields.name",
  "custom_fields.display_value",
  "assignee.name",
  "created_by.name",
  "created_at",
  "modified_at",
  "num_subtasks",
].join(",");

function normalizeTask(t: Record<string, unknown>): AsanaTaskFull {
  return {
    gid: String(t.gid),
    name: (t.name as string) || "(untitled Asana task)",
    notes: (t.notes as string) || "",
    html_notes: (t.html_notes as string) || "",
    completed: !!t.completed,
    permalink_url: (t.permalink_url as string) || `https://app.asana.com/0/0/${t.gid}`,
    parent: (t.parent as AsanaNamed | null) ?? null,
    memberships: (t.memberships as AsanaMembership[]) || [],
    custom_fields: ((t.custom_fields as AsanaCustomField[]) || []).map((f) => ({
      gid: f.gid,
      name: f.name,
      display_value: f.display_value ?? null,
    })),
    assignee: (t.assignee as AsanaNamed | null) ?? null,
    created_by: (t.created_by as AsanaNamed | null) ?? null,
    created_at: (t.created_at as string) || null,
    modified_at: (t.modified_at as string) || null,
    num_subtasks: typeof t.num_subtasks === "number" ? t.num_subtasks : undefined,
  };
}

/** GET one task with notes/html_notes/custom_fields/memberships/parent/permalink/completed. */
export async function getTaskFull(token: string, gid: string): Promise<AsanaTaskFull> {
  assertGid(gid);
  const t = await asanaGet<Record<string, unknown>>(token, `/tasks/${gid}?opt_fields=${encodeURIComponent(TASK_FIELDS)}`);
  return normalizeTask(t);
}

/** GET every direct subtask (paged), with the same fields as getTaskFull. */
export async function listSubtasks(token: string, gid: string): Promise<AsanaTaskFull[]> {
  assertGid(gid);
  const raw = await asanaGetAll<Record<string, unknown>>(token, `/tasks/${gid}/subtasks?opt_fields=${encodeURIComponent(TASK_FIELDS)}`);
  return raw.map(normalizeTask);
}

/** GET every story on a task (paged). Comments carry type "comment". */
export async function listStories(token: string, gid: string): Promise<AsanaStory[]> {
  assertGid(gid);
  const fields = "created_at,created_by.name,resource_subtype,type,text";
  const raw = await asanaGetAll<Record<string, unknown>>(token, `/tasks/${gid}/stories?opt_fields=${encodeURIComponent(fields)}`);
  return raw.map((s) => ({
    gid: String(s.gid),
    created_at: (s.created_at as string) || "",
    created_by: (s.created_by as AsanaNamed | null) ?? null,
    resource_subtype: (s.resource_subtype as string) || "",
    type: (s.type as string) || "",
    text: (s.text as string) || "",
  }));
}

/** GET the attachment LIST of a task (names/hosts only — nothing is downloaded,
 *  and no signed download/view URL is requested). `stories`, when given, maps
 *  each attachment to the closest-in-time comment (≤ 10 min). */
export async function listAttachments(token: string, gid: string, stories: AsanaStory[] = []): Promise<AsanaAttachment[]> {
  assertGid(gid);
  const fields = "name,resource_subtype,host,created_at";
  const raw = await asanaGetAll<Record<string, unknown>>(token, `/attachments?parent=${gid}&opt_fields=${encodeURIComponent(fields)}`);
  const comments = stories.filter((s) => s.type === "comment" && s.created_at);
  return raw.map((a) => {
    const at = (a.created_at as string) || null;
    let nearStoryGid: string | null = null;
    if (at && comments.length) {
      const t = Date.parse(at);
      let best = Infinity;
      for (const c of comments) {
        const d = Math.abs(Date.parse(c.created_at) - t);
        if (d < best) {
          best = d;
          nearStoryGid = c.gid;
        }
      }
      if (best > 10 * 60_000) nearStoryGid = null;
    }
    return {
      gid: String(a.gid),
      name: (a.name as string) || "(unnamed attachment)",
      resource_subtype: (a.resource_subtype as string) || "",
      host: (a.host as string) || "",
      created_at: at,
      nearStoryGid,
    };
  });
}
