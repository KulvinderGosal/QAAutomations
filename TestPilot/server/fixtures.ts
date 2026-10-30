// D4 — read-only view of the QA fixture registry (<QA-Automations>/config/fixtures.json).
//
// Loads through qa-core's `loadFixtures` so TestPilot sees exactly what the
// frameworks see: the same refusal of secret-shaped keys/values, duplicate ids and
// destructive production fixtures. The registry is identifiers-only by contract,
// but this view is defence-in-depth on top of that:
//   - only an ALLOWLIST of fields is returned (unknown keys are dropped; their
//     NAMES are listed in `extraKeys` so the UI can say something was hidden),
//   - `siteKey` is masked to its first 8 chars (the verifyHint style "3bd8264e-…"),
//   - the outgoing payload is re-checked with qa-core `assertNoSecrets` and refused
//     (500, no content) if anything secret-shaped slipped through.
// Never writes. No network. Placeholders (`status: "TODO…"`) are returned with
// `placeholder: true` + the BLOCKED{FIXTURE/not-provisioned} text getFixture() would throw.
import path from "node:path";
import { assertNoSecrets, findFixturesFile, loadFixtures, FIXTURES_PATH_ENV, type Fixture } from "../../packages/qa-core/fixtures/load";
import { formatBlockedMessage, isBlockedError } from "../../packages/qa-core/errors";

const QA_ROOT = process.env.QA_ROOT || path.resolve(process.cwd(), "..");

/** Explicit registry path: QA_FIXTURES_PATH, else <QA_ROOT>/config/fixtures.json. */
export function fixturesPath(): string {
  return process.env[FIXTURES_PATH_ENV] || path.join(QA_ROOT, "config", "fixtures.json");
}

export type FixtureView = {
  id: string;
  env: string;
  product: string;
  purpose: string;
  capabilities: string[];
  ownerPersona: string | null;
  plan: string | null;
  realmId: string | null;
  store: string | null;
  siteId: string | null;
  accountId: string | null;
  businessId: string | null;
  identityLabel: string | null;
  siteKeyPrefix: string | null;
  sharedWith: string[];
  destructiveOk: boolean;
  singleUse: boolean;
  verifyHint: string;
  status: string | null;
  notes: string | null;
  /** status starts with "TODO" — getFixture() refuses it (BLOCKED{FIXTURE/not-provisioned}). */
  placeholder: boolean;
  /** The exact BLOCKED line getFixture() throws for a placeholder. */
  blockedMessage: string | null;
  /** Names (never values) of keys in the file that this view does not return. */
  extraKeys: string[];
};

export type FixturesResponse = {
  file: string;
  version: number | null;
  updated: string | null;
  loadedAt: string;
  fixtures: FixtureView[];
  counts: { total: number; placeholders: number; destructiveOk: number; singleUse: number; production: number };
};

export class FixturesError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const KNOWN = new Set([
  "id", "env", "product", "purpose", "capabilities", "ownerPersona", "plan", "realmId", "store", "siteId",
  "accountId", "businessId", "identityLabel", "siteKey", "sharedWith", "destructiveOk", "singleUse",
  "verifyHint", "status", "notes",
]);

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const isPlaceholder = (f: Fixture) => typeof f.status === "string" && /^TODO/i.test(f.status);

function toView(f: Fixture): FixtureView {
  const placeholder = isPlaceholder(f);
  const siteKey = str(f.siteKey);
  return {
    id: String(f.id),
    env: String(f.env ?? ""),
    product: String(f.product ?? ""),
    purpose: str(f.purpose) ?? "",
    capabilities: strList(f.capabilities),
    ownerPersona: str(f.ownerPersona),
    plan: str(f.plan),
    realmId: str(f.realmId),
    store: str(f.store),
    siteId: str(f.siteId),
    accountId: str(f.accountId),
    businessId: str(f.businessId),
    identityLabel: str(f.identityLabel),
    siteKeyPrefix: siteKey ? `${siteKey.slice(0, 8)}…` : null,
    sharedWith: strList(f.sharedWith),
    destructiveOk: f.destructiveOk === true,
    singleUse: f.singleUse === true,
    verifyHint: str(f.verifyHint) ?? "",
    status: str(f.status),
    notes: str(f.notes),
    placeholder,
    // Same wording as qa-core getFixture() (kept in step with packages/qa-core/fixtures/load.ts).
    blockedMessage: placeholder
      ? formatBlockedMessage({
          cls: "FIXTURE",
          code: "not-provisioned",
          reason: `fixture "${f.id}" is a placeholder (${f.status})`,
          humanAction:
            'Provision it as described in its purpose/verifyHint, then fill in its identifiers and remove "status" in config/fixtures.json.',
        })
      : null,
    extraKeys: Object.keys(f).filter((k) => !KNOWN.has(k)),
  };
}

/** Path shown to the client: relative to QA_ROOT, or just the file name when outside it. */
function displayPath(file: string): string {
  const rel = path.relative(QA_ROOT, file);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : path.basename(file);
}

/** Read-only registry view. Throws FixturesError (404 missing file / 422 refused by the loader / 500). */
export function listFixturesView(): FixturesResponse {
  const explicit = fixturesPath();
  const file = findFixturesFile(explicit);
  if (!file) {
    throw new FixturesError(
      404,
      "no-fixtures-file",
      `config/fixtures.json not found (looked at ${FIXTURES_PATH_ENV} and ${displayPath(explicit)})`,
    );
  }
  let data;
  try {
    data = loadFixtures(file);
  } catch (e) {
    if (isBlockedError(e)) throw new FixturesError(404, e.code || "blocked", e.message);
    const rel = displayPath(file);
    // V8's JSON.parse messages can quote a snippet of the source text
    // (`Unexpected token 'h', "hunter2…" is not valid JSON`) — never echo that.
    // Keep only the position, if any.
    if (e instanceof SyntaxError) {
      const pos = /at position \d+(?: \(line \d+ column \d+\))?/.exec(e.message)?.[0];
      throw new FixturesError(422, "invalid-json", `${rel}: not valid JSON${pos ? ` (${pos})` : ""}`);
    }
    // Loader refusals (secret-shaped key/value, duplicate id, destructive prod fixture)
    // name the path/id/key only — never the offending value. Absolute path → relative.
    throw new FixturesError(422, "refused", String((e as Error).message).split(file).join(rel));
  }
  const fixtures = data.fixtures.map(toView);
  const out: FixturesResponse = {
    file: displayPath(file),
    version: typeof data.version === "number" ? data.version : null,
    updated: str(data.updated),
    loadedAt: new Date().toISOString(),
    fixtures,
    counts: {
      total: fixtures.length,
      placeholders: fixtures.filter((f) => f.placeholder).length,
      destructiveOk: fixtures.filter((f) => f.destructiveOk).length,
      singleUse: fixtures.filter((f) => f.singleUse).length,
      production: fixtures.filter((f) => f.env === "production").length,
    },
  };
  try {
    assertNoSecrets(out, "GET /api/fixtures");
  } catch {
    throw new FixturesError(500, "secret-shaped-output", "fixture view refused: secret-shaped content in the output");
  }
  return out;
}
