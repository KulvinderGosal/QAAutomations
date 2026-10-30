// SKB Docs — turn a tested PR into ready-to-publish Support Knowledge Base
// articles at skb.pushengage.com (Heroic KB / KnowAll, post type `ht_kb`).
//
// Flow: read the PR (GitHub) → analyze against the live KB index (which docs
// already exist, which to create, which other products/features are impacted →
// related docs) → draft each article in the Heroic format → optionally create
// it as a DRAFT on skb via XML-RPC + a WP Application Password (paste fallback
// otherwise). Everything here is server-only (Vite dev middleware) and is
// NEVER bundled to the client — the App Password stays in .env.
//
// API reality (probed 2026-08): the standard wp/v2 REST does NOT expose `ht_kb`
// or `ht_kb_category`; Heroic registers read-only namespaces (ht-kb/v1). So the
// index uses the public `ht-kb/v1/category-articles/{term_id}` route, and CREATE
// goes through XML-RPC (`wp.newPost`/`wp.uploadFile`), which is enabled. An
// Application Password is used (login+2FA can't be scripted); it authenticates
// as the method's user/password params, not HTTP Basic.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MODEL, sendMessage, firstText, stripFence, requestError, aiReady, type AiCreds } from "./aiTest";
import { getPullRequest, type PullRequest } from "./github";

export const SKB_BASE = "https://skb.pushengage.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const INDEX_CACHE = join(process.cwd(), ".testpilot-skb-index.json");
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;

export class SkbError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Heroic KB `ht_kb_category` term ids (from the site's admin filter). Used by
// the no-credentials public index path; the XML-RPC path lists terms live.
export const KB_CATEGORIES: { id: number; name: string; slug: string }[] = [
  { id: 20, name: "App Push", slug: "app-push" },
  { id: 15, name: "App Push Troubleshooting", slug: "app-push-troubleshooting" },
  { id: 19, name: "Web Push", slug: "web-push" },
  { id: 12, name: "Web Push Troubleshooting", slug: "web-push-troubleshooting" },
  { id: 5, name: "WordPress Plugin", slug: "wordpress-plugin" },
  { id: 33, name: "WhatsApp", slug: "whatsapp" },
  { id: 30, name: "Migration", slug: "migration" },
  { id: 6, name: "PushEngage API", slug: "pushengage-api" },
  { id: 8, name: "Product Integrations", slug: "product-integrations" },
  { id: 18, name: "Product Wiki", slug: "product-wiki" },
  { id: 17, name: "Internal Dashboard", slug: "internal-dashboard" },
  { id: 4, name: "Billing/Accounts", slug: "billing-accounts" },
  { id: 2, name: "Operations", slug: "operations" },
  { id: 1, name: "Uncategorized", slug: "uncategorized" },
];

export type SkbCreds = { user: string; appPassword: string };
export function skbCreds(): SkbCreds {
  return {
    user: (process.env.SKB_WP_USER || "").trim(),
    appPassword: (process.env.SKB_WP_APP_PASSWORD || "").trim(),
  };
}
export function skbReady(c: SkbCreds): boolean {
  return !!(c.user && c.appPassword);
}

export type KbArticle = { id: number | null; title: string; url: string; categories: string[] };
export type KbIndex = { articles: KbArticle[]; categories: string[]; source: "xmlrpc" | "public" | "cache"; cachedAt: string };

// ─── KB index ────────────────────────────────────────────────────────────────
async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new SkbError(r.status === 403 ? 502 : r.status, `KB fetch ${r.status} for ${url}`);
  return r.json();
}

/** Public index: enumerate published articles per category (parallel).
 * NOTE: server-side this route needs auth (returns 401 without a login cookie),
 * so it only yields data when Heroic later makes it public — kept as a fast,
 * best-effort fallback. Runs all categories concurrently so it's ~1 request of
 * latency, not 14. */
async function publicIndex(): Promise<KbArticle[]> {
  type RawArt = { id?: number; title?: string; permalink?: string; url?: string; link?: string };
  const results = await Promise.all(
    KB_CATEGORIES.map(async (cat) => {
      try {
        const data = (await fetchJson(`${SKB_BASE}/wp-json/ht-kb/v1/category-articles/${cat.id}?per_page=100`)) as {
          articles?: RawArt[];
        };
        const arr: RawArt[] = Array.isArray(data?.articles) ? data.articles : (data as unknown as RawArt[]);
        return { cat, arr: Array.isArray(arr) ? arr : [] };
      } catch {
        return { cat, arr: [] as RawArt[] };
      }
    }),
  );
  const byId = new Map<number, KbArticle>();
  for (const { cat, arr } of results) {
    for (const a of arr) {
      const title = (a.title || "").toString();
      if (!title) continue;
      const id = typeof a.id === "number" ? a.id : null;
      const url = a.permalink || a.url || a.link || "";
      const key = id ?? -Math.abs(hash(title));
      const ex = byId.get(key);
      if (ex) {
        if (!ex.categories.includes(cat.name)) ex.categories.push(cat.name);
      } else {
        byId.set(key, { id, title, url, categories: [cat.name] });
      }
    }
  }
  return [...byId.values()];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const EMPTY_TTL_MS = 10 * 60 * 1000; // re-check an empty index sooner (e.g. after adding creds)

export async function fetchKbIndex(force = false, creds: SkbCreds = skbCreds()): Promise<KbIndex> {
  if (!force && existsSync(INDEX_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(INDEX_CACHE, "utf8")) as KbIndex;
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      const ttl = cached.articles?.length ? INDEX_TTL_MS : EMPTY_TTL_MS;
      if (age < ttl) return cached; // serve cache (incl. a recent empty one — no repeated slow refetch)
    } catch {
      /* fall through to refetch */
    }
  }
  let articles: KbArticle[] = [];
  let source: KbIndex["source"] = "public";
  if (skbReady(creds)) {
    // The real index path: XML-RPC (the whole site is login-gated).
    try {
      articles = await xmlrpcListArticles(creds);
      source = "xmlrpc";
    } catch {
      articles = await publicIndex(); // rare fallback if XML-RPC is blocked
    }
  }
  // Without creds the public REST route 401s server-side, so don't waste time
  // hitting it — return an empty index quickly (the UI tells the user to add the
  // Application Password). A stale non-empty cache still wins over empty.
  if (!articles.length && existsSync(INDEX_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(INDEX_CACHE, "utf8")) as KbIndex;
      if (cached.articles?.length) return { ...cached, source: "cache" };
    } catch {
      /* ignore */
    }
  }
  const index: KbIndex = {
    articles: articles.sort((a, b) => a.title.localeCompare(b.title)),
    categories: KB_CATEGORIES.map((c) => c.name),
    source,
    cachedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(INDEX_CACHE, JSON.stringify(index, null, 2));
  } catch {
    /* cache best-effort */
  }
  return index;
}

// ─── PR fetch ────────────────────────────────────────────────────────────────
export type PrRef = { repo: string; number: number };
export function parsePrRef(input: string, defaultRepo: string): PrRef {
  const s = (input || "").trim();
  const m = s.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i);
  if (m) return { repo: m[1], number: Number(m[2]) };
  const n = s.match(/^#?(\d+)$/);
  if (n) {
    if (!defaultRepo) throw new SkbError(400, "No default repo — paste a full PR URL (github.com/owner/repo/pull/N).");
    return { repo: defaultRepo, number: Number(n[1]) };
  }
  throw new SkbError(400, "Enter a PR number or a github.com/owner/repo/pull/N URL.");
}

export async function fetchPr(ghToken: string, ref: PrRef): Promise<PullRequest> {
  if (!ghToken) throw new SkbError(400, "GITHUB_TOKEN is not configured in .env.");
  return getPullRequest(ghToken, ref.repo, ref.number);
}

// A synthetic PR for the "feature area" compose mode — documenting an existing,
// shipped feature area (e.g. "iOS In-App Messaging") rather than a single PR. The
// composer only reads a handful of PR fields for context; a stub keeps the exact
// same code path (no PR fetch, works offline) while the item + highlights carry
// all the real content.
export function areaStubPr(item: DocPlanItem, area: string): PullRequest {
  const now = new Date(0).toISOString();
  return {
    number: 0,
    title: item.title,
    body: item.reason || "",
    url: `area:${area || item.category}`,
    state: "released",
    merged: true,
    labels: area ? [area] : [],
    author: null,
    base: "",
    head: "",
    createdAt: now,
    updatedAt: now,
    changedFiles: 0,
    files: [],
  };
}

// ─── AI: analyze a PR against the KB ───────────────────────────────────────────
export type DocPlanItem = {
  title: string;
  category: string;
  reason: string;
  audience: "customer" | "internal";
  relatesTo?: string; // impacted product/feature, for the "impacted" bucket
};
export type PrAnalysis = {
  summary: string;
  product: string;
  existing: (DocPlanItem & { url: string; action: "update" | "review" })[];
  toCreate: DocPlanItem[];
  impacted: DocPlanItem[];
  /** true when produced by the no-AI heuristic fallback (AI unfunded/unavailable). */
  heuristic?: boolean;
};

function prContext(pr: PullRequest): string {
  const files = pr.files.slice(0, 60).map((f) => `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`);
  return [
    `PR #${pr.number}: ${pr.title}`,
    `Repo: ${pr.url}`,
    `Labels: ${pr.labels.join(", ") || "none"}`,
    `Branch: ${pr.head} → ${pr.base}`,
    "",
    "Description:",
    pr.body || "(none)",
    "",
    `Changed files (${pr.changedFiles}):`,
    ...files,
  ].join("\n");
}

export async function analyzePr(creds: AiCreds, pr: PullRequest, index: KbIndex): Promise<PrAnalysis> {
  const kbList = index.articles.map((a) => `- ${a.title} [${a.categories.join(", ")}]`).join("\n");
  const prompt = `You are a documentation lead for PushEngage. A pull request has just passed QA and we are about to write Support Knowledge Base (SKB) docs for it.

The SKB has these categories: ${index.categories.join(", ")}.

EXISTING SKB articles (title [categories]):
${kbList || "(index unavailable)"}

The pull request:
${prContext(pr)}

Decide the documentation impact. Return STRICT JSON (no prose, no markdown fence) with this shape:
{
  "summary": "1-2 sentence plain-English summary of what this PR ships",
  "product": "which product this PR belongs to (e.g. Web Push WP Plugin, App Push SDK, Shopify app, App Dashboard, API)",
  "existing": [ { "title": "<exact existing article title from the list above>", "url": "", "category": "<category>", "reason": "why this existing doc is affected", "action": "update" | "review", "audience": "customer" } ],
  "toCreate": [ { "title": "<new article title>", "category": "<one of the categories>", "reason": "why a new doc is needed", "audience": "customer" | "internal" } ],
  "impacted": [ { "title": "<related article title>", "category": "<category>", "reason": "why this OTHER product/feature/PR is impacted and needs a doc", "audience": "customer" | "internal", "relatesTo": "<impacted product or feature>" } ]
}
Rules: "existing" must reference titles that actually appear in the EXISTING list; if none apply, use []. Prefer updating an existing doc over creating a near-duplicate. "impacted" is for OTHER products/features that this change ripples into (e.g. a WP change that also affects the API docs or the Shopify app). Keep titles concise and in the KB's style.`;
  let res;
  try {
    res = await sendMessage(creds, { model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] });
  } catch (e) {
    throw requestError(e);
  }
  const parsed = JSON.parse(stripFence(firstText(res))) as PrAnalysis;
  // backfill existing-article urls from the index
  const byTitle = new Map(index.articles.map((a) => [a.title.toLowerCase(), a]));
  parsed.existing = (parsed.existing || []).map((e) => ({
    ...e,
    url: byTitle.get((e.title || "").toLowerCase())?.url || e.url || "",
  }));
  parsed.toCreate = parsed.toCreate || [];
  parsed.impacted = parsed.impacted || [];
  parsed.heuristic = false;
  return parsed;
}

// Remember a recent AI credit/auth failure so we don't burn ~12s re-trying an
// unfunded key on every analyze; auto-expires so a newly-funded key is retried.
let aiSoftFailAt = 0;
const AI_COOLDOWN_MS = 10 * 60 * 1000;

// Try the AI analysis; on an unfunded/auth failure (or no AI configured at all)
// fall back to a keyword heuristic so the section still produces a usable plan.
export async function analyzeWithFallback(creds: AiCreds, pr: PullRequest, index: KbIndex): Promise<PrAnalysis> {
  const cooling = Date.now() - aiSoftFailAt < AI_COOLDOWN_MS;
  if (aiReady(creds) && !cooling) {
    try {
      return await analyzePr(creds, pr, index);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const msg = (e as Error).message || "";
      const softFail = status === 402 || status === 401 || /credit|balance|billing|unfunded|not configured|auth/i.test(msg);
      if (!softFail) throw e;
      aiSoftFailAt = Date.now();
    }
  }
  return heuristicAnalyze(pr, index);
}

const REPO_PRODUCT: { match: RegExp; product: string; category: string }[] = [
  { match: /android/i, product: "PushEngage Android SDK (App Push)", category: "App Push" },
  { match: /ios/i, product: "PushEngage iOS SDK (App Push)", category: "App Push" },
  { match: /shopify/i, product: "PushEngage Shopify app", category: "Product Integrations" },
  { match: /wp|wordpress|plugin/i, product: "PushEngage WordPress plugin", category: "WordPress Plugin" },
  { match: /sdk/i, product: "PushEngage Web Push SDK", category: "Web Push" },
  { match: /api/i, product: "PushEngage API", category: "PushEngage API" },
];
const STOP = new Set(["the", "and", "for", "with", "into", "from", "that", "this", "add", "adds", "fix", "fixes", "feat", "test", "tests", "support", "pushengage", "update", "updates", "pull", "request", "using", "when", "your"]);
function tokenize(s: string): string[] {
  return (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}
function cleanTitle(t: string): string {
  const s = t.replace(/^\s*(feat|fix|chore|docs|refactor|test)(\([^)]*\))?:\s*/i, "").replace(/\s*\(#\d+\)\s*$/, "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : t;
}

/** No-AI analysis: infer product, keyword-match existing docs, propose one new doc. */
export function heuristicAnalyze(pr: PullRequest, index: KbIndex): PrAnalysis {
  const repo = pr.url.match(/github\.com\/([^/]+\/[^/]+)/)?.[1] || "";
  const hit = REPO_PRODUCT.find((r) => r.match.test(repo)) || { product: "PushEngage", category: "Product Wiki" };
  const key = new Set([...tokenize(pr.title), ...pr.labels.flatMap(tokenize)].filter((t) => t.length > 3 && !STOP.has(t)));
  const existing = index.articles
    .map((a) => ({ a, overlap: tokenize(a.title).filter((t) => key.has(t)).length }))
    .filter((x) => x.overlap >= 2)
    .sort((x, y) => y.overlap - x.overlap)
    .slice(0, 5)
    .map((x) => ({
      title: x.a.title,
      url: x.a.url,
      category: x.a.categories[0] || hit.category,
      reason: `Title shares ${x.overlap} keyword(s) with this PR — review whether it needs an update.`,
      action: "review" as const,
      audience: "customer" as const,
    }));
  return {
    summary: `${cleanTitle(pr.title)} — heuristic plan (AI unavailable; fund the key for a precise, impact-aware analysis).`,
    product: hit.product,
    existing,
    toCreate: [
      {
        title: cleanTitle(pr.title),
        category: hit.category,
        reason: `Documents the feature shipped in PR #${pr.number} (${pr.changedFiles} files). Heuristic suggestion — enable AI for the full plan.`,
        audience: "customer",
      },
    ],
    impacted: [],
    heuristic: true,
  };
}

// ─── AI: compose one article in the Heroic format ──────────────────────────────
export type ComposedDoc = {
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
  contentHtml: string;
  screenshotSlots: string[]; // ordered labels; body carries <!--SHOT:0--> markers
  /** true when produced by the no-AI scaffold fallback (AI unfunded/unavailable). */
  heuristic?: boolean;
};

export async function composeDoc(
  creds: AiCreds,
  input: { pr: PullRequest; item: DocPlanItem; highlights: string; screenshotLabels: string[] },
): Promise<ComposedDoc> {
  const { pr, item, highlights, screenshotLabels } = input;
  const shotList = screenshotLabels.length
    ? screenshotLabels.map((l, i) => `${i}: ${l}`).join("\n")
    : "(none provided — do not invent screenshots)";
  const prompt = `Write a PushEngage Support Knowledge Base article in the Heroic KB house style.

House style (match it exactly):
- An H1-less body (the title is set separately). Open with 1-2 short intro paragraphs saying what the feature is and what the reader will accomplish.
- Use <h2> for major sections and <h3> for step groups ("Step 1: …").
- Use <ol>/<ul> for steps and sub-steps. Write UI navigation as "Settings → Installation → Android SDK".
- Insert screenshots with an HTML comment marker on its own line exactly like <!--SHOT:0--> where the numbered screenshot belongs. Only use markers for screenshots that were provided.
- Add short bold callouts for important notes, e.g. <p><strong>Note:</strong> …</p>.
- Clean, valid HTML only (no <html>/<head>/<body>, no markdown). This becomes the WordPress post content.

Article to write:
- Working title: ${item.title}
- Category: ${item.category}
- Audience: ${item.audience}
- Why it's needed: ${item.reason}${item.relatesTo ? `\n- Related product/feature: ${item.relatesTo}` : ""}

Source PR (what shipped):
${prContext(pr)}

Points the QA/author specifically wants highlighted (weave these in as callouts or dedicated sections):
${highlights?.trim() || "(none specified — cover the feature end to end)"}

Available screenshots (index: label) to place with <!--SHOT:n--> markers:
${shotList}

Return STRICT JSON (no fence):
{ "title": "final article title", "category": "${item.category}", "tags": ["3-6 lowercase tags"], "excerpt": "1-sentence summary for the KB listing", "contentHtml": "the full HTML body with <!--SHOT:n--> markers" }`;
  let res;
  try {
    res = await sendMessage(creds, { model: MODEL, max_tokens: 8000, messages: [{ role: "user", content: prompt }] });
  } catch (e) {
    throw requestError(e);
  }
  const parsed = JSON.parse(stripFence(firstText(res))) as Omit<ComposedDoc, "screenshotSlots">;
  return { ...parsed, tags: parsed.tags || [], screenshotSlots: screenshotLabels, heuristic: false };
}

type ComposeInput = { pr: PullRequest; item: DocPlanItem; highlights: string; screenshotLabels: string[] };

// Try the AI writer; on unfunded/auth failure (or no AI) return a Heroic-format
// SCAFFOLD so the author still gets a correct structure to fill in / paste.
export async function composeWithFallback(creds: AiCreds, input: ComposeInput): Promise<ComposedDoc> {
  const cooling = Date.now() - aiSoftFailAt < AI_COOLDOWN_MS;
  if (aiReady(creds) && !cooling) {
    try {
      return await composeDoc(creds, input);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const msg = (e as Error).message || "";
      const softFail = status === 402 || status === 401 || /credit|balance|billing|unfunded|not configured|auth/i.test(msg);
      if (!softFail) throw e;
      aiSoftFailAt = Date.now();
    }
  }
  return heuristicCompose(input);
}

/** No-AI draft: a valid Heroic-format skeleton with the highlight points as a
 * list and one placeholder step per screenshot (markers placed) to fill in. */
export function heuristicCompose(input: ComposeInput): ComposedDoc {
  const { pr, item, highlights, screenshotLabels } = input;
  const title = cleanTitle(item.title);
  const points = (highlights || "")
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tags = [...new Set([...tokenize(item.title), ...pr.labels.flatMap(tokenize)].filter((t) => t.length > 3 && !STOP.has(t)))].slice(0, 5);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const parts: string[] = [];
  const areaMode = pr.number === 0; // feature-area doc (no real PR)
  parts.push(`<p>This article explains <strong>${esc(title)}</strong> in PushEngage. ${esc(item.reason || "")}</p>`);
  parts.push(`<h2>Overview</h2>`);
  parts.push(
    areaMode
      ? `<p>Describe what ${esc(title.toLowerCase())} does and when a user would reach for it.</p>`
      : `<p>${esc(cleanTitle(pr.title))} shipped in this release. Describe what it does and when a user would reach for it.</p>`,
  );
  if (points.length) {
    parts.push(`<h2>Key points</h2>`);
    parts.push(`<ul>${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`);
  }
  parts.push(`<h2>How to use ${esc(title)}</h2>`);
  if (screenshotLabels.length) {
    screenshotLabels.forEach((label, i) => {
      parts.push(`<h3>Step ${i + 1}: ${esc(label)}</h3>`);
      parts.push(`<p>Describe this step. Write UI navigation as "Settings → …".</p>`);
      parts.push(`<!--SHOT:${i}-->`);
    });
  } else {
    parts.push(`<h3>Step 1</h3><p>Describe the first step (add screenshots in the tray above).</p>`);
  }
  parts.push(
    `<p><strong>Note:</strong> This is a starter scaffold generated without AI. Fill in the prose, then use “Create draft in skb” or “Copy HTML”. Fund the Anthropic key for a fully written first draft.</p>`,
  );
  return {
    title,
    category: item.category,
    tags,
    excerpt: item.reason ? item.reason.slice(0, 140) : `How to use ${title} in PushEngage.`,
    contentHtml: parts.join("\n"),
    screenshotSlots: screenshotLabels,
    heuristic: true,
  };
}

// ─── XML-RPC (create draft + list articles) ────────────────────────────────────
type XmlVal = string | number | boolean | XmlVal[] | { [k: string]: XmlVal } | { __base64: string };

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function xmlValue(v: XmlVal): string {
  if (v === null || v === undefined) return "<value><string></string></value>";
  if (typeof v === "string") return `<value><string>${xmlEscape(v)}</string></value>`;
  if (typeof v === "number") return Number.isInteger(v) ? `<value><int>${v}</int></value>` : `<value><double>${v}</double></value>`;
  if (typeof v === "boolean") return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
  if (Array.isArray(v)) return `<value><array><data>${v.map(xmlValue).join("")}</data></array></value>`;
  if ("__base64" in v) return `<value><base64>${(v as { __base64: string }).__base64}</base64></value>`;
  const members = Object.entries(v)
    .map(([k, val]) => `<member><name>${xmlEscape(k)}</name>${xmlValue(val as XmlVal)}</member>`)
    .join("");
  return `<value><struct>${members}</struct></value>`;
}
function methodCall(method: string, params: XmlVal[]): string {
  return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${params
    .map((p) => `<param>${xmlValue(p)}</param>`)
    .join("")}</params></methodCall>`;
}
async function xmlrpc(method: string, params: XmlVal[]): Promise<string> {
  const r = await fetch(`${SKB_BASE}/xmlrpc.php`, {
    method: "POST",
    headers: { "Content-Type": "text/xml", "User-Agent": UA },
    body: methodCall(method, params),
  });
  const text = await r.text();
  if (!r.ok && !text.includes("<methodResponse")) throw new SkbError(r.status === 403 ? 502 : r.status, `xmlrpc HTTP ${r.status}`);
  const fault = text.match(/<name>faultString<\/name>\s*<value>(?:<string>)?([^<]*)/);
  if (fault) throw new SkbError(502, `WordPress rejected the request: ${fault[1]}`);
  return text;
}

/** wp.getPosts filtered to ht_kb → light article index (auth path). */
async function xmlrpcListArticles(c: SkbCreds): Promise<KbArticle[]> {
  const text = await xmlrpc("wp.getPosts", [
    1,
    c.user,
    c.appPassword,
    { post_type: "ht_kb", post_status: "publish", number: 300 },
    ["post_id", "post_title", "link", "terms"],
  ]);
  // tolerant parse: pair each post_title with its link
  const out: KbArticle[] = [];
  const structs = text.split("<value><struct>").slice(1);
  for (const s of structs) {
    const title = s.match(/<name>post_title<\/name><value><string>([^<]*)/)?.[1];
    const link = s.match(/<name>link<\/name><value><string>([^<]*)/)?.[1] || "";
    const id = s.match(/<name>post_id<\/name><value><string>(\d+)/)?.[1];
    if (title) out.push({ id: id ? Number(id) : null, title: decodeXml(title), url: link, categories: [] });
  }
  return out;
}
function decodeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#8217;/g, "’");
}

export type CreateResult = { postId: number; editUrl: string; previewUrl: string; uploaded: number };

/** Create a DRAFT ht_kb article: upload screenshots, inline them, then newPost. */
export async function createDraft(
  c: SkbCreds,
  doc: { title: string; contentHtml: string; category: string; tags: string[]; excerpt: string; images: { name: string; dataUrl: string }[] },
): Promise<CreateResult> {
  if (!skbReady(c)) throw new SkbError(400, "Set SKB_WP_USER and SKB_WP_APP_PASSWORD in .env (WP → Users → Profile → Application Passwords).");
  let html = doc.contentHtml;
  let uploaded = 0;
  for (let i = 0; i < doc.images.length; i++) {
    const img = doc.images[i];
    const m = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) continue;
    const [, mime, b64] = m;
    const resp = await xmlrpc("wp.uploadFile", [
      1,
      c.user,
      c.appPassword,
      { name: img.name || `screenshot-${i + 1}.png`, type: mime, bits: { __base64: b64 }, overwrite: false },
    ]);
    const url = resp.match(/<name>url<\/name><value><string>([^<]*)/)?.[1];
    if (url) {
      const fig = `<figure class="wp-block-image size-large"><img src="${url}" alt="${xmlEscape(img.name || "screenshot")}"/></figure>`;
      html = html.includes(`<!--SHOT:${i}-->`) ? html.replace(`<!--SHOT:${i}-->`, fig) : html + "\n" + fig;
      uploaded++;
    }
  }
  html = html.replace(/<!--SHOT:\d+-->/g, ""); // drop any unfilled markers
  const resp = await xmlrpc("wp.newPost", [
    1,
    c.user,
    c.appPassword,
    {
      post_type: "ht_kb",
      post_status: "draft",
      post_title: doc.title,
      post_content: html,
      post_excerpt: doc.excerpt || "",
      terms_names: { ht_kb_category: [doc.category], ...(doc.tags.length ? { ht_kb_tag: doc.tags } : {}) },
    },
  ]);
  const postId = Number(resp.match(/<value><string>(\d+)<\/string><\/value>/)?.[1] || resp.match(/<value><int>(\d+)<\/int><\/value>/)?.[1] || 0);
  if (!postId) throw new SkbError(502, "Draft create returned no post id (paste fallback recommended).");
  return {
    postId,
    editUrl: `${SKB_BASE}/wp-admin/post.php?post=${postId}&action=edit`,
    previewUrl: `${SKB_BASE}/?post_type=ht_kb&p=${postId}&preview=true`,
    uploaded,
  };
}
