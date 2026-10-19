/**
 * Group O — Backend shared-module regressions
 * Plan cases O1–O10. Source: Onboarding Wizard QA Plan (artifact 8efe9d52).
 *
 * DIRECT API SPEC (companion to 01-api-contracts.spec.js). This group covers the
 * blast radius of the shared-module changes: the workflow HTTP-Request endpoint
 * blocklist / SSRF guard, the duplicate-node-id check on create, that the AI
 * credit ledger is untouched, the detect-site-type value set, a sub-user smoke
 * across normal routes, and the boot / route table.
 *
 * These exercise the workflow, GenerativeAi, installation-details and
 * detect-site-type endpoints, plus `node ace` route dumps and a mailer job — none
 * of whose paths/commands are pinned down by the plan's API reference (only the
 * five onboarding-ai routes are). Rather than invent endpoints or response
 * shapes, each case is preserved as a test.fixme() carrying the exact steps and
 * expected results for a faithful manual run. Lift a fixme once its endpoint /
 * fixture / shell access is wired up.
 *
 * Extra env var (optional, not yet in onboarding-config): PE_SUBUSER_TOKEN — a
 * NON-admin sub-user's dashboard bearer token, needed for O8.
 */
const { test, expect, request } = require('@playwright/test');
const cfg = require('../utils/onboarding-config');

const SUBUSER_TOKEN = process.env.PE_SUBUSER_TOKEN || '';

test.describe('O · Backend shared-module regressions', () => {
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

  test('O1 @P0 workflow HTTP Request node endpoint blocklist', async () => {
    test.fixme(
      true,
      [
        'MANUAL (workflow save endpoint + pre-release DB query):',
        '1. Before release, query production workflow nodes for HTTP Request',
        '   endpoints with dotless hosts or hosts ending .local / .internal / .home.arpa.',
        '2. Open an existing workflow with an HTTP Request node to a public https',
        '   host; Save → saves as before.',
        '3. Set the endpoint to http://internal-hook/notify, http://api.local/x,',
        '   http://2130706433/ ; Save each.',
        'EXPECTED: the three unusual hosts → 400 "HTTP request endpoint host is not',
        '  allowed." Any production rows matching the query are customers who can no',
        '  longer re-save their workflow — escalate before shipping.',
      ].join('\n')
    );
  });

  test('O2 @P1 workflow builder "Test" HTTP request', async () => {
    test.fixme(
      true,
      [
        'MANUAL (workflow builder Test-request endpoint):',
        '1. Use the Test button with a public URL, then with http://intranet/x.',
        'EXPECTED: public works as before; blocked host returns',
        '  {success:false, status:404, data:"Endpoint URL is not valid"}.',
      ].join('\n')
    );
  });

  test('O3 @P0 duplicate node ids on create', async () => {
    test.fixme(
      true,
      [
        'MANUAL (workflow create/update endpoint):',
        '1. Clone an existing workflow in the dashboard; create a workflow from a',
        '   template → both succeed (node ids re-minted).',
        '2. POST create with two nodes sharing an id, plus a cycle.',
        'EXPECTED: the bad payload → 400 with details[0].type = "duplicate_node_ids"',
        '  reported FIRST (not the cycle error). Update behaves identically.',
      ].join('\n')
    );
  });

  test('O4 @P0 AI credits untouched', async () => {
    test.fixme(
      true,
      [
        'MANUAL (metered AI text endpoints + credit ledger):',
        '1. Generate notification text with AI; generate a broadcast from a URL;',
        '   note `remaining_credit` and `credit_usage_histories`.',
        '2. Exhaust credits and retry.',
        '3. Hit onboarding-ai endpoints 10 times.',
        'EXPECTED: each metered call debits exactly once with the right `ai_model`',
        '  and `usages_type`; zero credit → 400 "No AI credit remaining. Please',
        '  purchase AI credits." Onboarding calls write NO usage rows and do not',
        '  change `remaining_credit`.',
      ].join('\n')
    );
  });

  test('O5 @P1 URL-to-notification fetch semantics', async () => {
    test.fixme(
      true,
      [
        'MANUAL (broadcast-from-URL endpoint):',
        '1. Generate a broadcast from a public https product URL with both A and',
        '   AAAA records.',
        '2. From http://localhost:3000/ and from an unresolvable host.',
        'EXPECTED: public URL fetches and generates; blocked → the existing "blocked"',
        '  user message; unresolvable → the existing "host not found" message. Credit',
        '  handling on failure unchanged.',
      ].join('\n')
    );
  });

  test('O6 @P1 GET installation-details detection', async () => {
    test.fixme(
      true,
      [
        'MANUAL (installation-details endpoint + special pages):',
        '1. Call for Site 1 (installed), Site 2 (none), a GTM/consent-plugin site',
        '   with the snippet split or base64-encoded, and a test page with an',
        '   unrelated /assets/core/<siteId>.js script.',
        'EXPECTED: installed true / false / true / (false-positive: true — file as a',
        '  finding with the page). Detection no longer depends on CLIENT_BASE_URL.',
      ].join('\n')
    );
  });

  test('O7 @P1 GET detect-site-type new values', async () => {
    test.fixme(
      true,
      [
        'MANUAL (detect-site-type endpoint):',
        '1. Call for WordPress, Shopify, Wix, Squarespace, Webflow, Magento,',
        '   PrestaShop, a HubSpot-hosted site, a WordPress site carrying a HubSpot',
        '   tracking embed, and an unreachable URL.',
        'EXPECTED: each returns its platform; WP + HubSpot embed → "wordpress";',
        '  unreachable → "https"/"http". Frontend consumers of `site_type` handle the',
        '  seven new values without a broken branch.',
      ].join('\n')
    );
  });

  test('O8 @P1 sub-user smoke across normal routes', async () => {
    // Needs PE_SUBUSER_TOKEN (a non-admin sub-user's dashboard bearer token) plus
    // the normal list/create route paths (notifications, segments, audience
    // groups, workflows), which the plan does not pin down.
    test.fixme(
      true,
      [
        'MANUAL (sub-user token via PE_SUBUSER_TOKEN + normal dashboard routes):',
        '1. As the sub-user, list notifications, segments, audience groups,',
        '   workflows; create a segment.',
        'EXPECTED: all 200 — the new `dashboardIsAdmin` middleware is applied nowhere',
        '  else (only the five onboarding-ai routes).',
      ].join('\n')
    );
  });

  test('O9 @P2 weekly analytics email', async () => {
    test.fixme(
      true,
      [
        'MANUAL (mailer job trigger on staging):',
        '1. Trigger the account-analytics email job.',
        'EXPECTED: email renders with the AI report section as before.',
      ].join('\n')
    );
  });

  test('O10 @P2 boot and route table', async () => {
    test.fixme(
      true,
      [
        'MANUAL (shell: start the API and dump routes, e.g. node ace list:routes):',
        '1. Start the API; dump routes.',
        'EXPECTED: boots without a middleware namespace error; five `onboarding-ai`',
        '  routes present under `sites/:siteId/` (site-analysis, app-analysis,',
        '  popup-copy, recommendations, adjust-workflow).',
      ].join('\n')
    );
  });
});

// `expect` and PE_SUBUSER_TOKEN are referenced here to match the suite
// convention and document O8's dependency; live assertions land in these cases
// once their endpoints / fixtures are confirmed and the fixmes lifted.
void expect;
void SUBUSER_TOKEN;
