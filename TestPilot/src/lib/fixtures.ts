// D4 — client for the read-only fixture registry view (server/fixtures.ts).
// GET /api/fixtures returns identifier fields only (siteKey masked); there is no
// write route — the registry is edited by hand in ~/QA-Automations/config/fixtures.json.

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
  placeholder: boolean;
  blockedMessage: string | null;
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

export async function fetchFixtures(): Promise<FixturesResponse> {
  const r = await fetch("/api/fixtures", { cache: "no-store" });
  const b = (await r.json().catch(() => ({}))) as FixturesResponse & { error?: string };
  if (!r.ok) throw new Error(b.error || `fixtures ${r.status}`);
  return b;
}
