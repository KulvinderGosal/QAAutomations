/**
 * Group N — Plan quotas and the free-plan migration
 * Plan cases N1–N10. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * DIRECT API SPEC (companion to 01-api-contracts.spec.js). Every case in this
 * group exercises either an Adonis `node ace` migration, a raw SQL/Redis check,
 * or the dashboard's segment / audience-group / admin plan-permission endpoints.
 *
 * Those dashboard/admin endpoint paths are NOT pinned down anywhere in the plan
 * (the plan's "API reference table" only covers the five onboarding-ai routes),
 * and the behaviours are owner-wide, stateful and lock/time-sensitive. Rather
 * than invent request shapes or endpoints, each case is preserved as a
 * test.fixme() carrying the exact commands / queries / expected messages so the
 * manual run is faithful. Lift a fixme once its endpoint + fixtures are wired.
 *
 * Prereqs: free-plan migration applied (N1); Account A = Free owner; Account B =
 * Business+ owner; a Shopify-connected account (N7).
 *
 * Extra env var (optional, not yet in onboarding-config): a free-plan owner
 * token via PE_ADMIN_TOKEN, or a dedicated one, is what most of these need.
 */
const { test, expect, request } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');

test.describe('N · Plan quotas and the free-plan migration', () => {
  test.skip(!cfg.backendUrl || !cfg.adminToken, 'PE_BACKEND_URL / PE_ADMIN_TOKEN not configured');

  let api;

  test.beforeAll(async () => {
    api = await request.newContext({
      baseURL: cfg.backendUrl,
      extraHTTPHeaders: {
        Authorization: `Bearer ${cfg.adminToken}`,
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    if (api) await api.dispose();
  });

  test('N1 @P0 run the migration on staging', async () => {
    test.fixme(
      true,
      [
        'MANUAL (Adonis ace command + DB snapshot):',
        '1. Snapshot `permission_groups` and `subscription_plans`.',
        '2. Run: node ace migrate:free_plan_segments   (save the output).',
        '3. Run it again.',
        'EXPECTED: output "Free plan segments enabled: N permission group(s) capped,',
        '  M plan row(s) given segment_limit 5, K shared group(s) skipped." with K = 0',
        '  (otherwise split the shared group and re-run). Free-only groups gain',
        '  `segments:1` and `audience_groups.limit:5`; free plan rows get',
        '  `segment_limit = 5`; paid rows untouched. The second run changes nothing.',
      ].join('\n')
    );
  });

  test('N2 @P0 free account stops at exactly 5 + 5', async () => {
    test.fixme(
      true,
      [
        'MANUAL (free owner token + dashboard segment / audience-group create endpoints):',
        '1. On account A create segments via Audiences until refused; same for',
        '   audience groups (both dashboard UI and wizard).',
        'EXPECTED: 5 succeed; 6th segment → 400 "Your account segment limit exceeded";',
        '  6th group → 400 "Your account audience group limit exceeded". Counts are',
        '  owner-wide across ALL active sites.',
      ].join('\n')
    );
  });

  test('N3 @P0 paid account is uncapped and fast', async () => {
    test.fixme(
      true,
      [
        'MANUAL (Account B / Business+ token + audience-group create endpoint):',
        '1. On account B create the 6th and 20th audience group; watch response time.',
        'EXPECTED: all succeed with no extra owner-lock latency (no `audience_groups`',
        '  key on the paid permission group → unlimited, no count query).',
      ].join('\n')
    );
  });

  test('N4 @P1 plans with no permission_groups row', async () => {
    test.fixme(
      true,
      [
        'MANUAL (SQL, run before release):',
        "  SELECT p.plan_id, p.plan_type FROM subscription_plans p",
        "  LEFT JOIN permission_groups g ON g.permission_id = p.permission_id",
        "  WHERE p.type='plan' AND g.permission_id IS NULL;",
        'EXPECTED: returns NO rows. Any row listed would now be capped at 5 audience',
        '  groups by the code fallback — escalate.',
      ].join('\n')
    );
  });

  test('N5 @P1 admin plan-permission editor round-trip', async () => {
    test.fixme(
      true,
      [
        'MANUAL (admin panel plan-permissions endpoint):',
        "1. Open a free plan's permission group in the admin panel; Save with no edits.",
        '2. Set `audience_groups.limit` to 0, then to 10001.',
        'EXPECTED: the `audience_groups` key survives an unedited save. 0 = unlimited;',
        '  10001 → 400 (max 10000).',
      ].join('\n')
    );
  });

  test('N6 @P1 owner override can cap a paid account', async () => {
    test.fixme(
      true,
      [
        'MANUAL (admin account plan-permissions endpoint + Account B):',
        '1. POST admin account plan-permissions for account B with',
        '   `audience_groups.limit: 2`.',
        '2. Create a 3rd audience group on B.',
        'EXPECTED: 400 audience group limit exceeded. Remove the override → unlimited',
        '  again. Confirm the admin UI never sends this key by accident.',
      ].join('\n')
    );
  });

  test('N7 @P1 Shopify default groups bypass the quota', async () => {
    test.fixme(
      true,
      [
        'MANUAL (Shopify-connected free/fallback account):',
        '1. Connect a Shopify store so default audience groups are seeded.',
        '2. Create one manual group.',
        'EXPECTED: seeding succeeds regardless of count; the manual create then 400s',
        '  if the seeded groups already reach 5. Document the seeded count.',
      ].join('\n')
    );
  });

  test('N8 @P1 failed group insert releases the per-site lock', async () => {
    test.fixme(
      true,
      [
        'MANUAL (audience-group create endpoint):',
        '1. Create a group with a duplicate name (fails).',
        '2. Immediately retry with a NEW name.',
        'EXPECTED: the retry succeeds immediately (on master the per-site lock was',
        '  held ~18 min after a failure).',
      ].join('\n')
    );
  });

  test('N9 @P1 concurrent creates across sites of one owner', async () => {
    test.fixme(
      true,
      [
        'MANUAL (audience-group create endpoint, two sites of account A):',
        '1. Account A at 4 groups; fire two creates on two different sites',
        '   simultaneously.',
        'EXPECTED: exactly one succeeds; the other returns the limit error or',
        '  "Failed to create the audience group right now. Please try again". A serial',
        '  retry after ~10 s behaves normally.',
      ].join('\n')
    );
  });

  test('N10 @P1 pre-migration free account (documented failure mode)', async () => {
    test.fixme(
      true,
      [
        'MANUAL (an environment WITHOUT the free-plan migration applied):',
        '1. Run the wizard Audiences step on a free account.',
        'EXPECTED: creates fail with 403 "Your account does not have access to this',
        '  feature…" and the step holds with the message inline. Confirms the',
        '  deploy-order requirement; NOT a code bug.',
      ].join('\n')
    );
  });
});

// `expect` is imported to match the suite convention; live assertions land here
// once the dashboard/admin endpoints above are confirmed and the fixmes lifted.
void expect;
