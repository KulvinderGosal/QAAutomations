// Server-side Claude integration for the Manual Test "prompt" field.
// Runs inside the Vite dev server (Node) — the API key (ANTHROPIC_API_KEY) is
// read from .env server-side and NEVER reaches the browser bundle, exactly like
// the Asana/GitHub/Slack tokens. Two jobs:
//   1. interpretForRun — turn a plain-English instruction into config for the
//      existing generic ad-hoc smoke (expect title/text, login URL). No code is
//      generated or executed; it just fills the Manual Test form intelligently.
//   2. generateSpec — author a full, self-contained Playwright spec from the
//      instruction, returned for the user to review / copy / save.
// saveSpec writes a reviewed spec into a framework's own `ai-generated/` folder
// (additive, never overwrites, never committed).
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { FRAMEWORKS } from "./runner";

// Per the claude-api skill default; do not downgrade without the user asking.
export const MODEL = "claude-opus-4-8";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Credentials come from .env (server-side). Any ONE of these enables the AI
// prompt — an explicit key/token here, or an `ant auth login` OAuth profile on
// disk that the SDK's credential chain resolves for a zero-arg client.
export type AiCreds = { apiKey?: string; authToken?: string };
export type CredentialSource = "key" | "token" | "env" | "profile" | "none";

/** Where the `ant` CLI stores its config/credentials — mirrors the SDK's root resolution. */
function configDir(): string {
  if (process.env.ANTHROPIC_CONFIG_DIR) return process.env.ANTHROPIC_CONFIG_DIR;
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"), "Anthropic");
  }
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, "anthropic");
  return path.join(homedir(), ".config", "anthropic");
}

/** The active profile name the SDK will resolve (ANTHROPIC_PROFILE → active_config → "default"). */
function activeProfileName(): string {
  if (process.env.ANTHROPIC_PROFILE) return process.env.ANTHROPIC_PROFILE;
  try {
    const p = path.join(configDir(), "active_config");
    if (existsSync(p)) return readFileSync(p, "utf8").trim() || "default";
  } catch {
    /* ignore */
  }
  return "default";
}

/**
 * True only if the SDK's credential chain can actually resolve a profile — i.e.
 * a resolvable active CONFIG exists (not just an orphan token cache). For a
 * user_oauth profile the SDK needs both configs/<name>.json AND its cached
 * credentials/<name>.json; OIDC federation resolves from env vars instead.
 * (Checking only credentials/*.json false-positived into a "ready but every
 * call 401s" state — see the credential-review finding.)
 */
function hasAntProfile(): boolean {
  try {
    if (process.env.ANTHROPIC_FEDERATION_RULE_ID && process.env.ANTHROPIC_ORGANIZATION_ID) return true;
    const dir = configDir();
    const name = activeProfileName();
    const config = path.join(dir, "configs", `${name}.json`);
    const creds = path.join(dir, "credentials", `${name}.json`);
    return existsSync(config) && existsSync(creds);
  } catch {
    return false;
  }
}

/** Which credential (if any) the AI prompt will use — surfaced to the UI. */
export function credentialSource(creds: AiCreds): CredentialSource {
  if (creds.apiKey) return "key";
  if (creds.authToken) return "token";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "env";
  if (hasAntProfile()) return "profile";
  return "none";
}

export function aiReady(creds: AiCreds): boolean {
  return credentialSource(creds) !== "none";
}

export function client(creds: AiCreds): Anthropic {
  try {
    // Truthy guards matter: an empty ANTHROPIC_API_KEY="" in .env must NOT be
    // passed (it would authenticate with a blank key AND shadow the profile).
    if (creds.apiKey) return new Anthropic({ apiKey: creds.apiKey });
    if (creds.authToken) return new Anthropic({ authToken: creds.authToken });
    // Zero-arg: the SDK credential chain resolves ANTHROPIC_API_KEY /
    // ANTHROPIC_AUTH_TOKEN from the environment, or an `ant auth login` OAuth
    // profile on disk (auto-refreshed) — "use existing Claude", no key to paste.
    return new Anthropic();
  } catch (e) {
    throw new AiError(400, `No Claude credentials found. Add ANTHROPIC_API_KEY to .env, or run \`ant auth login\` in a terminal. (${(e as Error).message})`);
  }
}

/** Pull the first text block out of a Messages response. */
export function firstText(res: Anthropic.Message): string {
  for (const block of res.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

/** A billing/credit or auth error that a *different* credential might not hit. */
function isCredentialFailure(e: unknown): boolean {
  const msg = (e as Error)?.message || String(e);
  return /credit balance is too low|plans? ?& ?billing|purchase credits|insufficient (funds|credit|quota)|resolve authentication|credential|api[_ -]?key|unauthor|\b401\b|\b402\b|\b403\b/i.test(
    msg,
  );
}

/**
 * Send a Messages request, and if an explicit .env key/token fails on a
 * credit/auth error while an `ant auth login` profile is available, retry ONCE
 * with the SDK's default credential chain (which resolves that profile). This
 * stops a stale or unfunded ANTHROPIC_API_KEY in .env from shadowing a working
 * profile — so `ant auth login` makes the AI features work without hand-editing
 * .env. Throws an actionable AiError on failure.
 */
export async function sendMessage(
  creds: AiCreds,
  params: Parameters<Anthropic["messages"]["create"]>[0],
): Promise<Anthropic.Message> {
  try {
    return (await client(creds).messages.create(params)) as Anthropic.Message;
  } catch (e) {
    if (e instanceof AiError) throw e;
    const canFallback = (creds.apiKey || creds.authToken) && hasAntProfile();
    if (canFallback && isCredentialFailure(e)) {
      try {
        // Zero-arg client: no explicit key, so the credential chain resolves the
        // `ant auth login` profile (env has no ANTHROPIC_API_KEY to pick up).
        return (await new Anthropic().messages.create(params)) as Anthropic.Message;
      } catch (e2) {
        throw requestError(e2);
      }
    }
    throw requestError(e);
  }
}

/** Map a Messages-API error to an actionable one — credentials resolve lazily
 *  at first request, so an absent/invalid credential surfaces here, not at construction. */
export function requestError(e: unknown): AiError {
  const msg = (e as Error)?.message || String(e);
  // Out of credits: the key authenticates but the account/workspace has no
  // balance, so every request is rejected. Surface the real fix, not raw JSON.
  if (/credit balance is too low|plans? ?& ?billing|purchase credits|insufficient (funds|credit|quota)/i.test(msg)) {
    return new AiError(
      402,
      "Claude is configured but the Anthropic account behind this key has no credit balance, so requests are rejected. Add credits at https://console.anthropic.com/settings/billing (Plans & Billing) for this key's workspace — or set ANTHROPIC_API_KEY to a key from a funded account — then retry.",
    );
  }
  if (/resolve authentication|credential|api[_ -]?key|unauthor|\b401\b|\b403\b/i.test(msg)) {
    return new AiError(400, "Claude credentials aren't working. Add ANTHROPIC_API_KEY to .env, or run `ant auth login` in a terminal, then restart the dev server.");
  }
  return new AiError(502, `Claude request failed: ${msg}`);
}

// ── 1. Interpret instruction → generic-smoke config ─────────────────────────

export type InterpretResult = {
  summary: string;
  loginUrl?: string;
  expectTitle?: string;
  expectText?: string;
};

const INTERPRET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "One short sentence describing what this smoke check will verify." },
    expectTitle: { type: "string", description: "A short phrase you expect to appear in the page <title>. Omit if the instructions don't imply one." },
    expectText: { type: "string", description: "A short phrase you expect to be visible on the page body. Omit if not implied." },
    loginUrl: { type: "string", description: "A login page URL, only if the instructions clearly require signing in first. Omit otherwise." },
  },
  required: ["summary"],
} as const;

const INTERPRET_SYSTEM = `You configure a GENERIC headless smoke test from a QA engineer's plain-English instructions.
That smoke test can only do a fixed set of things: load a URL, optionally log in first, assert the page <title> contains a phrase and/or that a visible text phrase is present, and capture a screenshot.
Given the target URL and the instructions, extract the most useful expectTitle / expectText / loginUrl to make the smoke meaningful.
Rules:
- Only include a field when the instructions clearly imply it. Prefer omitting over guessing.
- Phrases are matched as case-insensitive substrings, so keep them short and literal (a few words, not a full sentence).
- NEVER invent credentials, tokens, or secrets.
- summary is one plain sentence a QA engineer would read to know what will be checked.`;

export async function interpretForRun(creds: AiCreds, prompt: string, targetUrl: string): Promise<InterpretResult> {
  let res: Anthropic.Message;
  try {
    res = await sendMessage(creds, {
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low", format: { type: "json_schema", schema: INTERPRET_SCHEMA } },
      system: INTERPRET_SYSTEM,
      messages: [{ role: "user", content: `Target URL: ${targetUrl}\n\nInstructions:\n${prompt}` }],
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw requestError(e);
  }
  if (res.stop_reason === "refusal") throw new AiError(422, "Claude declined to interpret this instruction.");
  const text = firstText(res).trim();
  try {
    const parsed = JSON.parse(text) as InterpretResult;
    // Never let the model fabricate credentials into the run.
    return {
      summary: parsed.summary || "Smoke check",
      loginUrl: parsed.loginUrl?.trim() || undefined,
      expectTitle: parsed.expectTitle?.trim() || undefined,
      expectText: parsed.expectText?.trim() || undefined,
    };
  } catch {
    throw new AiError(502, "Claude returned an unparseable response.");
  }
}

// ── 2. Generate a full Playwright spec ──────────────────────────────────────

const GENERATE_SYSTEM = `You are a senior QA automation engineer. Write ONE self-contained Playwright test spec (TypeScript, @playwright/test) that implements the user's instructions against the target site.
STRICT output rules:
- Output ONLY the file contents. No markdown fences, no commentary, no explanation before or after.
- Start with: import { test, expect } from '@playwright/test';
- Read the base URL from process.env.ADHOC_URL ?? '<target url>' so runs can override it.
- If sign-in is needed, read credentials from process.env.ADHOC_USER and process.env.ADHOC_PASS. NEVER hardcode credentials, tokens, cookies, or any secret — no exceptions.
- Prefer resilient, user-facing locators (getByRole, getByLabel, getByText) over brittle CSS/XPath.
- Wrap tests in test.describe; give each test a clear name and include a "@generated" tag in the title.
- Make it runnable as-is: no external page objects, fixtures, or imports beyond @playwright/test.
- Add brief inline comments only where a step is non-obvious.`;

export type GenerateResult = { spec: string; filename: string };

/** Strip a leading/trailing markdown code fence if the model added one anyway. */
export function stripFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:[a-zA-Z]+)?\n([\s\S]*?)\n```$/);
  return (m ? m[1] : t).trim();
}

function slug(prompt: string): string {
  const base = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "generated-test"}.spec.ts`;
}

export async function generateSpec(creds: AiCreds, prompt: string, targetUrl: string): Promise<GenerateResult> {
  let res: Anthropic.Message;
  try {
    res = await sendMessage(creds, {
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: GENERATE_SYSTEM,
      messages: [{ role: "user", content: `Target URL: ${targetUrl}\n\nWrite a Playwright spec that does:\n${prompt}` }],
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw requestError(e);
  }
  if (res.stop_reason === "refusal") throw new AiError(422, "Claude declined to generate a test for this instruction.");
  const spec = stripFence(firstText(res));
  if (!spec) throw new AiError(502, "Claude returned an empty spec.");
  return { spec, filename: slug(prompt) };
}

// ── 3. Save a reviewed spec into a framework's ai-generated/ folder ─────────

export async function saveSpec(frameworkId: string, filename: string, spec: string): Promise<{ path: string }> {
  const fw = FRAMEWORKS.find((f) => f.id === frameworkId);
  if (!fw) throw new AiError(400, "Unknown framework.");
  if (typeof spec !== "string" || !spec.trim()) throw new AiError(400, "Empty spec.");
  // Confine to a single filename inside the framework's ai-generated/ folder.
  let safe = path.basename(filename || "").replace(/[^\w.\-]/g, "_");
  if (!safe.endsWith(".spec.ts")) safe = `${safe || "generated-test"}.spec.ts`;
  const dir = path.join(fw.dir, "ai-generated");
  await mkdir(dir, { recursive: true });
  // Additive: never overwrite an existing file — bump a numeric suffix.
  let target = path.join(dir, safe);
  let n = 1;
  while (existsSync(target)) {
    target = path.join(dir, safe.replace(/\.spec\.ts$/, `-${n}.spec.ts`));
    n++;
  }
  await writeFile(target, spec, "utf8");
  return { path: target };
}
