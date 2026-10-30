// Client helpers for the SKB Docs feature — talk to the same-origin
// /api/skb/* middleware (server/skbDocs.ts) which reads the Heroic KB, runs
// Claude to analyze a PR + draft articles, and creates drafts on
// skb.pushengage.com. Types mirror the server shapes.

export type SkbStatus = { aiReady: boolean; skbReady: boolean; ghRepo: string; base: string };

export type KbArticle = { id: number | null; title: string; url: string; categories: string[] };
export type KbIndex = {
  articles: KbArticle[];
  categories: string[];
  source: "xmlrpc" | "public" | "cache";
  cachedAt: string;
};

export type PrFile = { filename: string; status: string; additions: number; deletions: number };
export type PullRequest = {
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
  changedFiles: number;
  files: PrFile[];
};

export type DocPlanItem = {
  title: string;
  category: string;
  reason: string;
  audience: "customer" | "internal";
  relatesTo?: string;
};
export type PrAnalysis = {
  summary: string;
  product: string;
  existing: (DocPlanItem & { url: string; action: "update" | "review" })[];
  toCreate: DocPlanItem[];
  impacted: DocPlanItem[];
  heuristic?: boolean;
};

export type ComposedDoc = {
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
  contentHtml: string;
  screenshotSlots: string[];
  heuristic?: boolean;
};

export type CreateResult = { postId: number; editUrl: string; previewUrl: string; uploaded: number };

/** A screenshot to embed: base64 data URL + a human label (placed at <!--SHOT:i-->). */
export type DocShot = { name: string; label: string; dataUrl: string };

export type ApiError = Error & { status?: number };

async function json<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
    const err: ApiError = new Error(body.error || `Request failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return body;
}

export function fetchSkbStatus(): Promise<SkbStatus> {
  return fetch("/api/skb/status").then((r) => json(r));
}

export function fetchSkbIndex(refresh = false): Promise<KbIndex> {
  return fetch(`/api/skb/index${refresh ? "?refresh=1" : ""}`).then((r) => json(r));
}

export function analyzeSkbPr(pr: string): Promise<{ pr: PullRequest; analysis: PrAnalysis }> {
  return fetch("/api/skb/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pr }),
  }).then((r) => json(r));
}

export function composeSkbDoc(input: {
  pr: string;
  item: DocPlanItem;
  highlights: string;
  screenshotLabels: string[];
  mode?: "pr" | "area";
  area?: string;
}): Promise<{ doc: ComposedDoc }> {
  return fetch("/api/skb/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => json(r));
}

// ─── Feature-area catalog ──────────────────────────────────────────────────────
// Document a whole feature AREA (all its features), independent of any single PR.
// Each area expands to a set of DocPlanItems that flow through the same compose /
// create pipeline. Add new areas here as products grow.
export type FeatureArea = { key: string; label: string; product: string; docs: DocPlanItem[] };

const IAM_DOCS = (platform: "iOS" | "Android"): DocPlanItem[] => [
  { title: `Create an In-App Message campaign (${platform})`, category: "App Push", audience: "customer", reason: `How to create and activate an In-App Message from the PushEngage dashboard for the ${platform} app.` },
  { title: "In-App Message display styles & positions", category: "App Push", audience: "customer", reason: "Top Banner, Bottom Banner, Center Modal and Full Screen — when to use each and how to switch." },
  { title: "Target your audience for In-App Messages", category: "App Push", audience: "customer", reason: "Audience rules (platform, OS version, country, custom attributes) that decide who sees a message." },
  { title: "Trigger In-App Messages with events", category: "App Push", audience: "customer", reason: "App-open vs custom-event triggers, and matching event parameters." },
  { title: "Frequency capping & scheduling for In-App Messages", category: "App Push", audience: "customer", reason: "Show-once / N-times caps, display delay, and start/end date windows." },
  { title: "Buttons & actions in In-App Messages", category: "App Push", audience: "customer", reason: "Open-URL, dismiss and custom-action buttons and how the SDK handles each." },
  { title: "In-App Message analytics", category: "App Push", audience: "customer", reason: "Impressions, clicks and closes — where to read them and how offline events are flushed." },
  { title: "Troubleshoot In-App Messages not showing", category: "App Push Troubleshooting", audience: "customer", reason: "Sync timing, audience/date/frequency gates and event-name mismatches that stop a message appearing." },
];

export const FEATURE_AREAS: FeatureArea[] = [
  { key: "ios-iam", label: "iOS — In-App Messaging", product: "PushEngage iOS SDK (App Push)", docs: IAM_DOCS("iOS") },
  { key: "android-iam", label: "Android — In-App Messaging", product: "PushEngage Android SDK (App Push)", docs: IAM_DOCS("Android") },
];

export function createSkbDraft(input: {
  title: string;
  contentHtml: string;
  category: string;
  tags: string[];
  excerpt: string;
  images: { name: string; dataUrl: string }[];
}): Promise<{ result: CreateResult }> {
  return fetch("/api/skb/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => json(r));
}
