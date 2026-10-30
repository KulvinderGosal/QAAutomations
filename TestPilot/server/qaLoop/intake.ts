// V2a — Asana intake by gid (DATA ONLY) + the idempotent TM upsert.
//
// Pure module (no Node imports) so it is unit-testable (`npm run test:intake`) and
// shared by the /api/tm/import/asana/:gid preview + confirm routes in server/api.ts.
//
// THE RULE: everything that comes from Asana — titles, notes, comments, attachment
// names — is DATA. Nothing here acts on it. Imperative text ("run on prod",
// "approve", "post to", "use this token", "send to <url>") is returned VERBATIM in
// `flaggedImperatives` for a human to read; links we cannot read (Slack DM,
// claude.ai artifact, d.pr / Loom video, Google Doc) mark the pack
// `scopeIncomplete` and draft ONE question for the author (never posted). Every
// string that leaves this module is passed through `scrub()` (high-confidence
// secret shapes: JWTs, Bearer values, gh_/sk-/xox/shpat tokens, ?token= params…) so
// a token pasted into a ticket is never propagated.

// ── Input shapes (structural — the server/asana.ts types satisfy them) ────────
export type IntakeNamed = { gid: string; name?: string };
export type IntakeTask = {
  gid: string;
  name: string;
  notes: string;
  html_notes?: string;
  completed: boolean;
  permalink_url: string;
  parent?: IntakeNamed | null;
  memberships?: { project?: IntakeNamed | null; section?: IntakeNamed | null }[];
  custom_fields?: { gid: string; name?: string; display_value?: string | null }[];
  created_by?: IntakeNamed | null;
  assignee?: IntakeNamed | null;
};
export type IntakeStory = { gid: string; created_at: string; created_by?: IntakeNamed | null; type: string; resource_subtype?: string; text: string };
export type IntakeAttachment = { gid: string; name: string; resource_subtype?: string; host?: string; created_at?: string | null; nearStoryGid?: string | null };

export type IntakeInput = {
  task: IntakeTask;
  subtasks: IntakeTask[];
  stories: IntakeStory[];
  attachments: IntakeAttachment[];
};

// ── Output: the intake pack ───────────────────────────────────────────────────
export type IntakePriority = "low" | "normal" | "high" | "critical";

export type IntakeCase = {
  /** ^[A-Z]{2,6}(-[A-Z0-9]+)+ with at least one digit (e.g. SL-T1-01, LP-252-01, IAM-TRIG-24), or null. */
  caseKey: string | null;
  title: string;
  gid: string;
  url: string;
  completed: boolean;
  priority: IntakePriority | null;
  preconditions: string[];
  steps: string[];
  expected: string[];
  pass: string[];
  fail: string[];
  devices: string[];
  environment: string[];
  doNotFile: string[];
  /** Prose that fell outside any recognised section (redacted, trimmed). */
  notes: string;
};

export type FlaggedImperative = {
  /** The full line, verbatim (secret-shaped values redacted). */
  text: string;
  /** Which rule matched (e.g. "run-on-production", "approve", "post-to"). */
  rule: string;
  /** "task" | "subtask:<KEY|gid>" | "comment:<storyGid> (<author>)" */
  source: string;
};

export type ScopeGap = {
  kind: "slack" | "claude-artifact" | "video" | "google-doc" | "figma" | "conversation-ref" | "video-attachment" | "no-steps";
  reason: string;
  source: string;
  url?: string;
};

export type IntakePack = {
  taskGid: string;
  title: string;
  url: string;
  completed: boolean;
  /** The Asana task whose name the TM suite takes (the imported task, or its parent
   *  when a single keyed subtask is imported). */
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

// ── Text helpers ──────────────────────────────────────────────────────────────
// Prose-safe secret scrubbing. qa-core redact() is tuned for logs/headers and
// rewrites ordinary ticket prose ("token revocation", "no code="); here we redact
// only high-confidence secret SHAPES so the checklist text stays readable.
const SECRET_PATTERNS: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, "[REDACTED_JWT]"],
  [/\b(Bearer|Basic)\s+(?!\[REDACTED)(?=[A-Za-z0-9._~+/=-]*\d)[A-Za-z0-9._~+/=-]{20,}/g, "$1 [REDACTED]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GH_TOKEN]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GH_TOKEN]"],
  [/\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_API_KEY]"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_SLACK_TOKEN]"],
  [/\bshp(?:at|ca|pa|ss)_[A-Fa-f0-9]{20,}\b/g, "[REDACTED_SHOPIFY_TOKEN]"],
  [/\b\d\/[0-9a-f]{20,}:[0-9a-f]{20,}\b/g, "[REDACTED_ASANA_TOKEN]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
  // ?access_token=… / &password=… with a real-looking value (not {{var}} / <x> / ..).
  [/([?&](?:access_token|refresh_token|id_token|token|api_key|apikey|password|pass|secret|cf_clearance|code)=)(?!\{\{|<|\.\.|\[)(?=[^&\s"'#]*\d)[^&\s"'#]{10,}/gi, "$1[REDACTED]"],
  // password: hunter2-ish assignments with a mixed alnum value of 8+ chars.
  [/\b((?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*)(?!\{\{|<|\[)(?=\S*\d)(?=\S*[A-Za-z])[^\s"',;]{8,}/gi, "$1[REDACTED]"],
  [/^(\s*(?:cookie|set-cookie|authorization)\s*:\s*).+$/gim, "$1[REDACTED]"],
];

/** Redact secret-shaped values. Every string that leaves this module goes through this. */
export function scrub(s: string): string {
  let out = s || "";
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep);
  return out;
}

const SECRET_SHAPE = /\[REDACTED[A-Z_]*\]/;


function stripHtml(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const clip = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ── Case key ──────────────────────────────────────────────────────────────────
// Spec regex ^[A-Z]{2,6}(-[A-Z0-9]+)+ anchored at the start of the subtask name
// (after an optional "[" / "(" / "#"), followed by a separator or end. We also
// require at least one digit in the key, so words like "QA-ONLY" / "UI-FIX" do
// not become keys (a keyless subtask is still imported, keyed by its gid).
const CASE_KEY_RE = /^[[(#]?\s*([A-Z]{2,6}(?:-[A-Z0-9]+)+)(?=$|[\s:.,;)\]—–|/]|-\s)/;

export function extractCaseKey(title: string): string | null {
  const m = CASE_KEY_RE.exec((title || "").trim());
  if (!m) return null;
  return /\d/.test(m[1]) ? m[1] : null;
}

/** Keys carried by a Playwright spec: `@case:<KEY>` in its tags or title. */
export function caseKeysFromSpec(title: string, tags: string[] = []): string[] {
  const out = new Set<string>();
  const re = /@case:([A-Z]{2,6}(?:-[A-Z0-9]+)+)/g;
  for (const src of [title || "", ...(tags || [])]) {
    for (const m of src.matchAll(re)) out.add(m[1]);
  }
  return [...out];
}

/** Title with the leading key + separator removed ("SL-T1-01: Foo" → "Foo"). */
function titleWithoutKey(title: string, key: string | null): string {
  if (!key) return title.trim();
  const i = title.indexOf(key);
  if (i < 0) return title.trim();
  const rest = title.slice(i + key.length).replace(/^[\s\])]*[:.\-—–|]?\s*/, "").trim();
  return rest || title.trim();
}

// ── Section parsing ───────────────────────────────────────────────────────────
// Handles both Asana's plain-text rendering of rich notes (a bold label followed
// by 4-space-indented list items: "Steps    first item\n    second item") and
// flat markdown-ish notes ("Steps:\n1. …\n2. …").
type Section = "preconditions" | "steps" | "expected" | "pass" | "fail" | "devices" | "environment" | "doNotFile" | "notes";
type HeaderKind = Section | "reset" | "agent";

const HEADERS: [HeaderKind, RegExp][] = [
  ["reset", /^for\s+(?:the\s+)?(?:testers?|qa|humans?)\b/i],
  ["agent", /^for\s+(?:the\s+)?(?:ai(?:\s+(?:assistants?|agents?))?|assistants?|claude|agents?|llms?|bots?)\b/i],
  ["doNotFile", /^(?:do\s*n[o']t|don'?t|please\s+do\s+not|not\s+to)\s+(?:file|report|log|raise)(?:\s+(?:as\s+)?(?:bugs?|issues?|these))?|^known\s+(?:behaviou?rs?|issues?|limitations?|gaps?)|^by\s+design|^not\s+(?:a\s+)?bugs?|^out\s+of\s+scope|^expected\s*\/\s*by\s+design/i],
  ["preconditions", /^(?:pre-?conditions?|pre-?requisites?|set\s*-?up|given|test\s+data|fixtures?|before\s+you\s+start)/i],
  ["steps", /^(?:test\s+steps|steps(?:\s+to\s+(?:test|reproduce|verify))?|repro(?:duction)?(?:\s+steps)?|how\s+to\s+(?:test|verify|reproduce)|procedure|test\s+procedure|instructions|endpoints?)/i],
  ["expected", /^(?:expected(?:\s+(?:results?|behaviou?r|outcome|output))?|should)/i],
  ["fail", /^(?:fail(?:s|ure)?(?:\s+(?:if|when|criteria))?)/i],
  ["pass", /^(?:pass(?:es)?(?:\s+(?:criteria|if|when|condition))?|acceptance(?:\s+criteria)?|success(?:\s+criteria)?|done\s+when|verify|verification|regression)/i],
  ["devices", /^(?:devices?|platforms?|browsers?|os(?:\s+versions?)?|test\s+on)/i],
  ["environment", /^(?:env(?:ironment)?s?|site|store|account|staging|build|version)/i],
  ["notes", /^(?:notes?|context|background|references?|links?|description|details|summary|why)/i],
];

// A header line: optional markdown (#, **), a recognised label, an optional
// qualifier (", your half" / "(checked …)"), then a separator (":", " - ", a tab or
// 2+ spaces) + optional inline content — OR the label alone on its line.
function matchHeader(rawLine: string): { kind: HeaderKind; inline: string; viaWhitespace: boolean } | null {
  const line = rawLine
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[*_]{1,2}\s*/, "")
    .replace(/^\p{Extended_Pictographic}\s*/u, "");
  for (const [kind, re] of HEADERS) {
    const m = re.exec(line);
    if (!m) continue;
    if (kind === "reset" || kind === "agent") return { kind, inline: "", viaWhitespace: false };
    let rest = line.slice(m[0].length);
    rest = rest.replace(/^\s*[*_]{1,2}/, "").replace(/^\s*\([^)]*\)/, "").replace(/^,[^:\t]{0,40}?(?=[:：\t]|\s{2,}|$)/, "");
    const sep = /^(?:\s*[:：]|\s*[-–—]\s|\t|\s{2,})\s*([*_]{1,2}\s*)?/.exec(rest);
    if (sep) {
      const viaWhitespace = !/[:：\-–—]/.test(sep[0]);
      return { kind, inline: rest.slice(sep[0].length).replace(/[*_]{1,2}\s*$/, "").trim(), viaWhitespace };
    }
    if (!rest.trim() || /^[*_\s]*$/.test(rest)) return { kind, inline: "", viaWhitespace: false };
    return null;
  }
  return null;
}

const BULLET_RE = /^\s*(?:[-*•▪◦·‣]|\d{1,3}[.)]|\(\d{1,3}\)|[a-z][.)]|\[[ xX]\]|☐|☑|✅|❌|✔|✗)\s+/;

function splitItems(text: string): string[] {
  // Asana's plain text joins a label's first list item with 3+ spaces / a tab;
  // "1) Foo. 2) Bar. 3) Baz" on one line is also several items.
  const out: string[] = [];
  for (const chunk of text.split(/\t+|\s{3,}/)) {
    const t = chunk.trim();
    if (!t) continue;
    const markers = t.match(/(?:^|\s)\d{1,2}\)\s/g);
    if (markers && markers.length >= 2)
      out.push(...t.split(/\s(?=\d{1,2}\)\s)/).map((x) => x.replace(/^\d{1,2}\)\s*/, "").trim()).filter(Boolean));
    else out.push(t.replace(BULLET_RE, "").trim());
  }
  return out.filter(Boolean);
}

function splitList(inline: string): string[] {
  return inline
    .split(/\s*[,;]\s*|\s+\/\s+|\s+(?:and|&)\s+|\t+|\s{3,}/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Parsed = Record<Section, string[]> & { sawHeader: boolean; agentSection: boolean };

export function parseNotes(notes: string): Parsed {
  const out: Parsed = {
    preconditions: [], steps: [], expected: [], pass: [], fail: [], devices: [], environment: [], doNotFile: [], notes: [],
    sawHeader: false, agentSection: false,
  };
  let current: Section | null = null;
  // "indented" = Asana rich-text list (items indented; a column-0 line ends the
  // list); "flat" = items at column 0 (an indented line continues the last item).
  let style: "indented" | "flat" | null = null;
  let lastIdx = -1;
  const push = (sec: Section, item: string) => {
    const v = item.trim();
    if (!v) return;
    out[sec].push(v);
    lastIdx = out[sec].length - 1;
  };
  const pushItems = (sec: Section, text: string) => {
    if (sec === "devices" || sec === "environment") for (const d of splitList(text)) push(sec, d);
    else for (const part of splitItems(text)) push(sec, part);
  };
  for (const raw of (notes || "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!raw.trim() || /^\s*[-_=*]{3,}\s*$/.test(raw)) continue;
    const indented = /^(?:\t|\s{2,})\S/.test(raw);
    const h = indented ? null : matchHeader(raw);
    if (h) {
      out.sawHeader = true;
      lastIdx = -1;
      if (h.kind === "reset") {
        current = null;
        style = null;
        continue;
      }
      if (h.kind === "agent") {
        // A section addressed to AI assistants: kept as DATA (notes), flagged by the caller.
        out.agentSection = true;
        current = "notes";
        style = "indented";
        continue;
      }
      current = h.kind;
      style = h.viaWhitespace ? "indented" : null;
      if (h.inline) pushItems(current, h.inline);
      continue;
    }
    const isBullet = BULLET_RE.test(raw);
    const text = raw.replace(BULLET_RE, "").trim();
    if (!current) {
      // No section: list items read as steps, prose as notes.
      if (isBullet || indented) pushItems("steps", text);
      else push("notes", text);
      continue;
    }
    if (indented) {
      if (style === "flat" && !isBullet && lastIdx >= 0 && current !== "devices" && current !== "environment") {
        out[current][lastIdx] = `${out[current][lastIdx]} ${text}`;
        continue;
      }
      if (!style) style = "indented";
      pushItems(current, text);
      continue;
    }
    // Column-0 line.
    if (style === "indented" && !isBullet) {
      // Prose after an indented list ends that list ("Postman alternative: …").
      current = "notes";
      style = "indented";
      push("notes", text);
      continue;
    }
    if (!style) style = "flat";
    pushItems(current, text);
  }
  return out;
}

function priorityOf(text: string): IntakePriority | null {
  const p = /\bP([0-3])\b/.exec(text);
  if (p) return (["critical", "high", "normal", "low"] as const)[Number(p[1])];
  const n = /\bpriority\s*[:=-]\s*(critical|blocker|urgent|high|medium|normal|low)\b/i.exec(text);
  if (!n) return null;
  const v = n[1].toLowerCase();
  return v === "critical" || v === "blocker" || v === "urgent" ? "critical" : v === "high" ? "high" : v === "low" ? "low" : "normal";
}

// ── Imperative flags (shown verbatim, NEVER acted on) ─────────────────────────
const IMPERATIVE_RULES: { rule: string; re: RegExp }[] = [
  { rule: "run-on-production", re: /\b(?:run|test|execute|verify|try|deploy|do|check|repeat|use)\b[^.\n]{0,60}?\b(?:on|against|in|with|from)\s+(?:the\s+)?(?:prod|production|live(?:\s+site|\s+store)?)\b/i },
  { rule: "approve", re: /\b(?:approve|authori[sz]e|grant\s+(?:access|permissions?)|accept\s+(?:the\s+)?(?:terms|consent|agreement|charges?))\b/i },
  { rule: "post-to", re: /\b[Pp]ost(?:ed)?\b(?:\s+(?:it|this|that|them|the\s+\w+|a\s+\w+|results?|an?\s+update))?\s+(?:to|in|on|into)\s+(?:the\s+)?(?:[Ss]lack|[Aa]sana|[Gg]it[Hh]ub|channel|#[\w-]+|task|ticket|issue|thread|PR|https?:)/ },
  { rule: "use-this-secret", re: /\buse\s+(?:this|the\s+following|the|my|our|these|that)\s+(?:\w+\s+){0,2}(?:token|api[ -]?key|key|password|pass|credentials?|creds|jwt|cookie|secret|bearer)\b/i },
  { rule: "send-to", re: /\bsend\b[^.\n]{0,60}?\bto\b[^\n]{0,80}?(?:https?:\/\/|@[\w.-]+|#[\w-]+|\b[\w.+-]+@[\w-]+\.[\w.]+)/i },
  { rule: "mark-complete", re: /\b(?:mark|set|move)\b[^.\n]{0,30}?\b(?:as\s+)?(?:complete|completed|done|closed|resolved)\b|\bclose\s+(?:the\s+|this\s+)?(?:task|ticket|issue|PR)\b/i },
  { rule: "merge-deploy-publish", re: /\b(?:merge|deploy|publish|release|ship)\s+(?:the\s+|this\s+|that\s+|it\b|to\s+prod)/i },
  { rule: "instruction-to-agent", re: /\bignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|rules|guardrails)\b|\b(?:claude|assistant|ai\s+agent|the\s+bot)\b[,:]?\s+(?:please\s+)?(?:run|post|send|approve|delete|merge|use|close|mark)\b/i },
];

function scanImperatives(text: string, source: string, into: FlaggedImperative[]): void {
  for (const raw of (text || "").split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const shown = clip(scrub(line));
    if (SECRET_SHAPE.test(shown) && !SECRET_SHAPE.test(line)) {
      into.push({ text: shown, rule: "secret-shaped-value", source });
    }
    for (const { rule, re } of IMPERATIVE_RULES) {
      if (re.test(line)) into.push({ text: shown, rule, source });
    }
  }
}

// ── Scope gaps (unreadable sources) ───────────────────────────────────────────
const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g;

function classifyLink(url: string): { kind: ScopeGap["kind"]; reason: string } | null {
  let u: URL;
  try {
    u = new URL(url.replace(/[.,;:]+$/, ""));
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (host === "slack.com" || host.endsWith(".slack.com")) {
    const dm = /\/(?:archives|messages|client\/[^/]+)\/D[A-Z0-9]+/i.test(path);
    return { kind: "slack", reason: dm ? "Links to a Slack DM (not readable by TestPilot)" : "Links to a Slack conversation (not readable by TestPilot)" };
  }
  if ((host === "claude.ai" && /artifact|\/public\//i.test(path)) || host.endsWith("claude.site") || host.endsWith("claudeusercontent.com"))
    return { kind: "claude-artifact", reason: "Links to a claude.ai artifact (not readable by intake)" };
  if (((host === "d.pr" || host.endsWith(".d.pr")) && /^\/v\//i.test(path)) || (host.endsWith("supportally.com") && /^\/v\//i.test(path)))
    return { kind: "video", reason: "Links to a d.pr video (not parsed)" };
  if (host.endsWith("loom.com") || host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("vimeo.com"))
    return { kind: "video", reason: "Links to a video (not parsed)" };
  if (host === "docs.google.com" || host === "drive.google.com") return { kind: "google-doc", reason: "Links to a Google Doc/Sheet/Drive file (not readable by intake)" };
  if (host.endsWith("figma.com")) return { kind: "figma", reason: "Links to a Figma file (not readable by intake)" };
  return null;
}

const CONVERSATION_REF_RE = /\b(?:see|per|check|in|from|discussed\s+in|as\s+discussed\s+in|details\s+in|mentioned\s+in)\s+(?:the\s+|my\s+|our\s+)?(?:slack|DM|thread|huddle|call|meeting|loom|video|recording)\b/i;

function scanScope(text: string, source: string, into: ScopeGap[]): void {
  const seen = new Set(into.map((g) => `${g.source}|${g.url ?? g.reason}`));
  for (const m of (text || "").matchAll(URL_RE)) {
    const c = classifyLink(m[0]);
    if (!c) continue;
    const url = scrub(m[0].replace(/[.,;:]+$/, ""));
    const k = `${source}|${url}`;
    if (seen.has(k)) continue;
    seen.add(k);
    into.push({ ...c, source, url });
  }
  for (const raw of (text || "").split(/\n+/)) {
    if (CONVERSATION_REF_RE.test(raw) && !URL_RE.test(raw)) {
      const reason = `References a conversation/video with no readable link: "${clip(scrub(raw.trim()), 200)}"`;
      const k = `${source}|${reason}`;
      if (!seen.has(k)) {
        seen.add(k);
        into.push({ kind: "conversation-ref", reason, source });
      }
    }
    URL_RE.lastIndex = 0;
  }
}

const KNOWN_RE = /\b(?:by\s+design|expected\s+behaviou?r|not\s+a\s+bug|known\s+(?:issue|behaviou?r|limitation)|do\s*n[o']t\s+(?:file|report)|don'?t\s+(?:file|report)|won'?t\s+fix|working\s+as\s+intended)\b/i;

// ── Product guess (user can override in the preview) ──────────────────────────
export function guessProduct(text: string): { productId: string | null; why: string } {
  const t = text || "";
  const lp = /ledger\s*port|quickbooks|\bQBO?\b|omnysync|intuit/i.test(t);
  const pe = /push\s*engage|\bIAM\b|in-app messag|web\s*push|push notification/i.test(t);
  if (lp) {
    if (/silver\s+listing|app\s+store|omnysync|backend|connector|\bapi\b/i.test(t)) return { productId: "lp-api", why: "LedgerPort + backend/connector/App-Store wording" };
    if (/shopify/i.test(t)) return { productId: "lp-shopify", why: "LedgerPort + Shopify" };
    if (/woo|wordpress|\bwp\b/i.test(t)) return { productId: "lp-wp-plugin", why: "LedgerPort + WordPress/Woo" };
    if (/marketing|homepage|pricing\s+page|ledgerport\.com\b/i.test(t)) return { productId: "lp-site", why: "LedgerPort + marketing site" };
    return { productId: "lp-dashboard", why: "LedgerPort (default: dashboard)" };
  }
  if (pe) {
    if (/shopify/i.test(t)) return { productId: "pe-shopify", why: "PushEngage + Shopify" };
    if (/woo|wordpress|\bwp\b/i.test(t)) return { productId: "pe-wp-plugin", why: "PushEngage + WordPress" };
    if (/\bsdk\b|android|\bios\b|react native|flutter/i.test(t)) return { productId: "pe-sdk", why: "PushEngage + SDK/mobile" };
    if (/marketing|homepage|pricing\s+page|pushengage\.com\b/i.test(t)) return { productId: "pe-site", why: "PushEngage + marketing site" };
    return { productId: "pe-app-dashboard", why: "PushEngage (default: app dashboard)" };
  }
  return { productId: null, why: "No product wording found — choose one" };
}

// ── Build the pack ────────────────────────────────────────────────────────────
function toCase(t: IntakeTask, fallbackNotes = ""): IntakeCase {
  const name = scrub(t.name || "");
  const caseKey = extractCaseKey(name);
  const notes = t.notes || fallbackNotes;
  const p = parseNotes(notes);
  const s = (a: string[]) => a.map((x) => clip(scrub(x), 2000));
  return {
    caseKey,
    title: clip(titleWithoutKey(name, caseKey), 300),
    gid: t.gid,
    url: t.permalink_url,
    completed: !!t.completed,
    priority: priorityOf(`${t.name}\n${notes}`),
    preconditions: s(p.preconditions),
    steps: s(p.steps),
    expected: s(p.expected),
    pass: s(p.pass),
    fail: s(p.fail),
    devices: s(p.devices),
    environment: s(p.environment),
    doNotFile: s(p.doNotFile),
    notes: clip(scrub(p.notes.join("\n")), 4000),
  };
}

export function buildIntakePack(input: IntakeInput): IntakePack {
  const { task, subtasks, stories, attachments } = input;
  const flagged: FlaggedImperative[] = [];
  const scope: ScopeGap[] = [];
  const warnings: string[] = [];
  const known: string[] = [];

  // The imported task is the suite; its subtasks are the cases. A single keyed
  // subtask imported on its own becomes one case in its parent's suite.
  const ownKey = extractCaseKey(task.name || "");
  const single = subtasks.length === 0 && !!ownKey && !!task.parent?.gid;
  const caseTasks = single ? [task] : subtasks;
  const suiteGid = single ? task.parent!.gid : task.gid;
  const suiteName = clip(scrub(single ? task.parent?.name || task.name : task.name), 200);

  // Parent task text.
  const taskText = `${task.notes || ""}\n${stripHtml(task.html_notes || "")}`;
  scanImperatives(task.name || "", "task (title)", flagged);
  scanImperatives(task.notes || "", "task", flagged);
  scanScope(taskText, "task", scope);
  if (parseNotes(task.notes || "").agentSection) flagged.push({ text: "For AI assistants (section in the notes)", rule: "addressed-to-ai", source: "task" });
  if (!single) {
    const pp = parseNotes(task.notes || "");
    known.push(...pp.doNotFile.map((x) => clip(scrub(x), 600)));
  }

  // Cases.
  const cases: IntakeCase[] = [];
  const keyCount = new Map<string, number>();
  for (const st of caseTasks) {
    const c = toCase(st);
    cases.push(c);
    const src = `subtask:${c.caseKey ?? st.gid}`;
    scanImperatives(st.name || "", `${src} (title)`, flagged);
    if (parseNotes(st.notes || "").agentSection)
      flagged.push({ text: "For AI assistants (section in the notes)", rule: "addressed-to-ai", source: src });
    if (!single) {
      scanImperatives(st.notes || "", src, flagged);
      scanScope(`${st.notes || ""}\n${stripHtml(st.html_notes || "")}`, src, scope);
    }
    for (const d of c.doNotFile) known.push(`[${c.caseKey ?? st.gid}] ${d}`);
    if (c.caseKey) keyCount.set(c.caseKey, (keyCount.get(c.caseKey) ?? 0) + 1);
  }
  for (const [k, n] of keyCount) if (n > 1) warnings.push(`Case key ${k} appears on ${n} subtasks — only the first binds by key; the others import keyed by gid.`);
  const unkeyed = cases.filter((c) => !c.caseKey);
  if (unkeyed.length && cases.length) warnings.push(`${unkeyed.length} of ${cases.length} subtasks have no case key — they import keyed by Asana gid only.`);
  const noSteps = cases.filter((c) => !c.steps.length && !c.expected.length && !c.pass.length && !c.fail.length);
  if (noSteps.length)
    scope.push({
      kind: "no-steps",
      reason: `${noSteps.length} case${noSteps.length === 1 ? "" : "s"} have no steps/expected/pass bullets in the notes: ${noSteps
        .slice(0, 8)
        .map((c) => c.caseKey ?? c.gid)
        .join(", ")}${noSteps.length > 8 ? ", …" : ""}`,
      source: "subtasks",
    });

  // Comments on the parent (the dev's known-behaviour / do-not-report list often lives here).
  const comments = stories.filter((s) => s.type === "comment");
  for (const c of comments) {
    const src = `comment:${c.gid}${c.created_by?.name ? ` (${scrub(c.created_by.name)})` : ""}`;
    scanImperatives(c.text, src, flagged);
    scanScope(c.text, src, scope);
    for (const line of (c.text || "").split(/\n+/)) if (KNOWN_RE.test(line)) known.push(`[comment] ${clip(scrub(line.trim()), 600)}`);
  }

  // Attachments: listed only (never downloaded here). Videos mark scope incomplete.
  const att = attachments.map((a) => ({
    gid: a.gid,
    name: clip(scrub(a.name), 200),
    host: a.host || "",
    createdAt: a.created_at ?? null,
    nearStoryGid: a.nearStoryGid ?? null,
  }));
  for (const a of attachments) {
    if (/\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(a.name) || /video/i.test(a.resource_subtype || ""))
      scope.push({ kind: "video-attachment", reason: `Video attachment "${clip(scrub(a.name), 120)}" (listed, not parsed)`, source: "attachments" });
  }

  // Dedupe flags (same text + rule + source).
  // Dedupe flags by rule + text; the same line on many subtasks shows once with a count.
  const byText = new Map<string, { f: FlaggedImperative; sources: string[] }>();
  for (const f of flagged) {
    const k = `${f.rule}|${f.text}`;
    const e = byText.get(k);
    if (e) {
      if (!e.sources.includes(f.source)) e.sources.push(f.source);
    } else byText.set(k, { f, sources: [f.source] });
  }
  const flaggedImperatives = [...byText.values()].map(({ f, sources }) => ({
    ...f,
    source: sources.length > 1 ? `${sources[0]} (+${sources.length - 1} more)` : sources[0],
  }));

  const author = task.created_by?.name ? scrub(task.created_by.name) : null;
  const unreadable = scope.filter((g) => g.kind !== "no-steps");
  let questionForAuthor: string | null = null;
  if (scope.length) {
    const parts: string[] = [];
    if (unreadable.length) {
      const kinds = [...new Set(unreadable.map((g) => g.reason.replace(/:.*$/, "").replace(/\s*\(.*\)$/, "")))];
      parts.push(`I can't read ${kinds.slice(0, 4).join("; ").toLowerCase()} from TestPilot`);
    }
    if (noSteps.length) parts.push(`${noSteps.length} case${noSteps.length === 1 ? " has" : "s have"} no steps or expected result in the notes (${noSteps.slice(0, 5).map((c) => c.caseKey ?? c.gid).join(", ")}${noSteps.length > 5 ? ", …" : ""})`);
    questionForAuthor = `Hi${author ? ` ${author.split(/\s+/)[0]}` : ""} — for "${suiteName}": ${parts.join(", and ")}. Could you paste the steps, the expected/pass result and any known-behaviour / do-not-report list into the task description (or the subtasks), so the checklist I test is the one you intend?`;
  }

  const projects = [...new Set((task.memberships || []).map((m) => m.project?.name).filter((x): x is string => !!x))].map((p) => scrub(p));
  const haystack = [task.name, task.parent?.name, ...projects, (task.notes || "").slice(0, 3000), ...subtasks.slice(0, 20).map((s) => s.name)].join("\n");

  return {
    taskGid: task.gid,
    title: clip(scrub(task.name), 300),
    url: task.permalink_url,
    completed: !!task.completed,
    suiteGid,
    suiteName,
    projects,
    author,
    productGuess: guessProduct(haystack),
    cases,
    knownBehaviours: [...new Set(known)],
    flaggedImperatives,
    scopeIncomplete: scope,
    questionForAuthor,
    attachments: att,
    warnings,
    stats: { subtasks: subtasks.length, cases: cases.length, keyed: cases.filter((c) => !!c.caseKey).length, comments: comments.length, attachments: attachments.length },
  };
}

// ── Idempotent TM upsert (preview == apply plan) ──────────────────────────────
// Structural copies of the TmSuite/TmCase fields we read/write (src/tm/types.ts is
// the source of truth; the server must not import from src/).
export type ExternalRef = { system: "asana"; gid: string; parentGid: string; caseKey: string | null; url?: string; completed?: boolean; syncedAt?: string };
type LooseSuite = { id: string; name: string; parentId: string | null; productId?: string | null; order: number };
type LooseCase = {
  id: string;
  key: string;
  title: string;
  description: string;
  suiteId: string;
  priority: string;
  automation: string;
  steps: { step: string; expected: string }[];
  tags: string[];
  review: string;
  frameworkId?: string | null;
  specFile?: string | null;
  lastRunStatus: string;
  lastRunAt?: string | null;
  runs: number;
  source: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  comments: unknown[];
  history: unknown[];
  externalRef?: ExternalRef;
  [k: string]: unknown;
};
export type LooseTmState = {
  suites: LooseSuite[];
  cases: LooseCase[];
  activity?: { id: string; at: string; by: string; icon: string; html: string }[];
  seq?: Record<string, number>;
  [k: string]: unknown;
};

export type PlannedAction = {
  gid: string;
  caseKey: string | null;
  title: string;
  /** create = new TM case; update = refresh an Asana-imported case; bind = attach
   *  externalRef to an existing (e.g. seeded) case with the same key — its curated
   *  title/steps are kept. */
  action: "create" | "update" | "bind";
  tmCaseId: string;
  tmKey: string;
  tmSuiteId: string;
  note?: string;
};

export type ProductSuiteOption = { suiteId: string; name: string; productId: string };

export function productSuiteOptions(state: LooseTmState | null): ProductSuiteOption[] {
  return (state?.suites || [])
    .filter((s) => s.parentId === null && !!s.productId)
    .map((s) => ({ suiteId: s.id, name: s.name, productId: String(s.productId) }));
}

function productRootSuite(state: LooseTmState, productId: string | null): LooseSuite | null {
  if (!productId) return null;
  return state.suites.find((s) => s.id === `suite-${productId}`) ?? state.suites.find((s) => s.parentId === null && s.productId === productId) ?? null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const asanaSuiteId = (gid: string) => `asana-suite-${gid}`;
export const asanaCaseId = (gid: string) => `asana-${gid}`;

function caseDescription(c: IntakeCase): string {
  const lines: string[] = [`Imported from Asana: ${c.url}${c.completed ? " (subtask completed in Asana)" : ""}`];
  if (c.preconditions.length) lines.push("", "Preconditions:", ...c.preconditions.map((x) => `- ${x}`));
  if (c.pass.length) lines.push("", "Pass criteria:", ...c.pass.map((x) => `- ${x}`));
  if (c.fail.length) lines.push("", "Fail if:", ...c.fail.map((x) => `- ${x}`));
  if (c.devices.length) lines.push("", `Devices: ${c.devices.join(", ")}`);
  if (c.environment.length) lines.push("", `Environment: ${c.environment.join(", ")}`);
  if (c.doNotFile.length) lines.push("", "Do not file (known behaviour):", ...c.doNotFile.map((x) => `- ${x}`));
  if (c.notes) lines.push("", c.notes);
  return lines.join("\n");
}

function caseSteps(c: IntakeCase): { step: string; expected: string }[] {
  const expected = [...c.expected, ...c.pass.map((p) => `Pass: ${p}`), ...c.fail.map((f) => `FAIL if: ${f}`)].join("\n");
  if (!c.steps.length) return [{ step: c.preconditions.length ? `Precondition: ${c.preconditions.join(" · ")}` : "Follow the Asana subtask", expected }];
  return c.steps.map((step, i) => ({ step, expected: i === c.steps.length - 1 ? expected : "" }));
}

/** Plan (and, with apply, perform) the upsert of `pack` into `state`. Pure: returns
 *  a NEW state and never mutates the input. Matching, in order: an existing case
 *  whose externalRef.gid is the subtask gid (update) → one whose externalRef.caseKey
 *  or display key equals the case key (bind) → else create `asana-<gid>`. */
export function planAsanaUpsert(
  state: LooseTmState,
  pack: IntakePack,
  opts: { productId: string | null; actor: string; now: string },
): {
  actions: PlannedAction[];
  suite: { id: string; name: string; parentId: string | null; exists: boolean; productId: string | null };
  next: LooseTmState;
  touchedCases: LooseCase[];
  touchedSuites: LooseSuite[];
  counts: { create: number; update: number; bind: number };
} {
  const suites = [...(state.suites || [])];
  const cases = [...(state.cases || [])];
  const seq = { ...(state.seq || {}) };
  const root = productRootSuite(state, opts.productId);
  const suiteId = asanaSuiteId(pack.suiteGid);
  const existingSuite = suites.find((s) => s.id === suiteId) ?? null;
  const touchedSuites: LooseSuite[] = [];
  const touchedCases: LooseCase[] = [];
  const actions: PlannedAction[] = [];
  const usedKeys = new Set<string>();
  const counts = { create: 0, update: 0, bind: 0 };

  for (const pc of pack.cases) {
    let idx = cases.findIndex((c) => c.externalRef?.system === "asana" && c.externalRef.gid === pc.gid);
    let action: PlannedAction["action"] = "update";
    let note: string | undefined;
    const keyFree = !!pc.caseKey && !usedKeys.has(pc.caseKey);
    if (idx < 0 && pc.caseKey && keyFree) {
      idx = cases.findIndex((c) => (c.externalRef?.caseKey === pc.caseKey || c.key === pc.caseKey) && !(c.externalRef?.gid && c.externalRef.gid !== pc.gid));
      action = "bind";
      const clash = cases.find((c) => (c.externalRef?.caseKey === pc.caseKey || c.key === pc.caseKey) && c.externalRef?.gid && c.externalRef.gid !== pc.gid);
      if (idx < 0 && clash) note = `key ${pc.caseKey} is already bound to Asana ${clash.externalRef!.gid} (${clash.id}) — imported under a TC- key`;
    }
    if (pc.caseKey) usedKeys.add(pc.caseKey);
    const ref: ExternalRef = { system: "asana", gid: pc.gid, parentGid: pack.suiteGid, caseKey: pc.caseKey, url: pc.url, completed: pc.completed, syncedAt: opts.now };

    if (idx >= 0) {
      const cur = cases[idx];
      const refreshed: LooseCase =
        cur.source === "asana"
          ? {
              ...cur,
              title: pc.title,
              description: caseDescription(pc),
              steps: caseSteps(pc),
              priority: pc.priority ?? cur.priority,
              tags: [...new Set([...(cur.tags || []), "asana"])],
              externalRef: ref,
              updatedAt: opts.now,
            }
          : { ...cur, tags: [...new Set([...(cur.tags || []), "asana"])], externalRef: ref, updatedAt: opts.now };
      action = cur.source === "asana" ? "update" : "bind";
      cases[idx] = refreshed;
      touchedCases.push(refreshed);
      counts[action]++;
      actions.push({ gid: pc.gid, caseKey: pc.caseKey, title: pc.title, action, tmCaseId: cur.id, tmKey: cur.key, tmSuiteId: cur.suiteId, note });
      continue;
    }

    // Create.
    const keyTaken = !pc.caseKey || !keyFree || cases.some((c) => c.key === pc.caseKey);
    let key = pc.caseKey ?? "";
    if (keyTaken) {
      seq.case = (seq.case ?? 0) + 1;
      key = `TC-${seq.case}`;
    }
    const created: LooseCase = {
      id: asanaCaseId(pc.gid),
      key,
      title: pc.title,
      description: caseDescription(pc),
      suiteId,
      priority: pc.priority ?? "normal",
      automation: "manual",
      steps: caseSteps(pc),
      tags: ["asana"],
      review: "approved",
      frameworkId: null,
      specFile: null,
      lastRunStatus: "unexecuted",
      lastRunAt: null,
      runs: 0,
      source: "asana",
      createdBy: opts.actor,
      createdAt: opts.now,
      updatedAt: opts.now,
      comments: [],
      history: [],
      externalRef: ref,
    };
    // An id collision (a case deleted+recreated elsewhere) is replaced in place.
    const same = cases.findIndex((c) => c.id === created.id);
    if (same >= 0) cases[same] = created;
    else cases.push(created);
    touchedCases.push(created);
    counts.create++;
    actions.push({ gid: pc.gid, caseKey: pc.caseKey, title: pc.title, action: "create", tmCaseId: created.id, tmKey: key, tmSuiteId: suiteId, note });
  }

  // The parent-task suite: created only when at least one case lands in it.
  const suite = existingSuite ?? { id: suiteId, name: pack.suiteName, parentId: root?.id ?? null, productId: opts.productId, order: suites.length };
  if (!existingSuite && counts.create > 0) {
    suites.push(suite);
    touchedSuites.push(suite);
  }

  const next: LooseTmState = { ...state, suites, cases, seq };
  if (counts.create + counts.update + counts.bind > 0) {
    const html = `Imported <b>${counts.create}</b> case${counts.create === 1 ? "" : "s"} from Asana <b>${esc(pack.suiteName)}</b>${counts.update ? ` (updated ${counts.update})` : ""}${counts.bind ? ` (linked ${counts.bind} existing)` : ""}`;
    next.activity = [{ id: `act-asana-${pack.taskGid}-${Date.parse(opts.now) || 0}`, at: opts.now, by: opts.actor, icon: "case", html }, ...(state.activity || [])].slice(0, 200);
  }
  return {
    actions,
    suite: { id: suite.id, name: suite.name, parentId: suite.parentId, exists: !!existingSuite, productId: suite.productId ?? null },
    next,
    touchedCases,
    touchedSuites,
    counts,
  };
}
