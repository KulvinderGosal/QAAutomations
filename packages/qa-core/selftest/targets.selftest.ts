import { assertAllowedTarget, checkTarget } from '../guards/targets';
import { isBlockedError } from '../errors';
import { check, eq, throws } from './harness';

type Case = [method: string, url: string, allowed: boolean, tier: string, code?: string];

export const TARGET_CASES: Case[] = [
  // local
  ['POST', 'http://localhost:5173/api/tm/state', true, 'local'],
  ['DELETE', 'http://127.0.0.1:8888/wp-json/wp/v2/posts/1', true, 'local'],
  ['PUT', 'http://[::1]:5173/api/x', true, 'local'],
  ['POST', 'http://mysite.localhost/wp-admin/', true, 'local'],
  ['POST', 'http://shop.test/', true, 'local'],
  // staging allowlist (any method)
  ['PATCH', 'https://staging-app.pushengage.com/d/v1/sites/51041', true, 'staging'],
  ['POST', 'https://staging-app-dashboard2.pushengage.com/login', true, 'staging'],
  ['POST', 'https://staging-app-dashboard3.pushengage.com/', true, 'staging'],
  ['GET', 'https://staging-app-dashboard.pushengage.com/in-app-campaigns', true, 'staging'],
  ['GET', 'https://staging-dexter2.pushengage.com/p/v1/iam/campaigns/metadata', true, 'staging'],
  ['POST', 'https://qastaging.pushengage.com/wp-json/wp/v2/posts', true, 'staging'],
  ['POST', 'https://api-staging.ledgerport.com/api/v1/auth/refresh', true, 'staging'],
  ['GET', 'https://app-staging.ledgerport.com/connections', true, 'staging'],
  ['GET', 'https://staging-shopify-app.ledgerport.com/', true, 'staging'],
  ['GET', 'https://staging.ledgerport.com/pricing', true, 'staging'],
  ['POST', 'https://billingpagetesting-2.myshopify.com/admin/api/2025-01/graphql.json', true, 'staging'],
  ['POST', 'https://silverlisting.myshopify.com/cart/add', true, 'staging'],
  ['GET', 'https://admin.shopify.com/store/freetrial7daysfixes/apps/staging-pushengage/app', true, 'staging'],
  ['GET', 'https://STAGING-APP.pushengage.com./d/v1/users/me', true, 'staging'],
  // production: GET/HEAD to listed paths only
  ['GET', 'https://pushengage.com/pricing/', true, 'production'],
  ['HEAD', 'https://www.pushengage.com/', true, 'production'],
  ['GET', 'https://ledgerport.com/', true, 'production'],
  ['GET', 'https://api.ledgerport.com/api/v1/plans', true, 'production'],
  ['GET', 'https://api.ledgerport.com/api/v1/plans?interval=year', true, 'production'],
  ['GET', 'https://dashboard-public-api.pushengage.com/d/v1/users/me', true, 'production'],
  ['GET', 'https://dashboard-public-api.pushengage.com/d/v1/sites/76524/in-app-campaigns', true, 'production'],
  ['GET', 'https://qaprod.pushengage.com/wp-admin/', true, 'production'],
  ['GET', 'https://admin.shopify.com/store/ledgerport/apps', true, 'production'],
  ['POST', 'https://dashboard-public-api.pushengage.com/d/v1/sites/76524/in-app-campaigns', false, 'production', 'production-write'],
  ['PATCH', 'https://dashboard-public-api.pushengage.com/d/v1/sites/76524', false, 'production', 'production-write'],
  ['GET', 'https://dashboard-public-api.pushengage.com/d/v1/sites/765240', false, 'production', 'production-path-not-listed'],
  ['GET', 'https://dashboard-public-api.pushengage.com/d/v1/sites/76524/../../accounts/1', false, 'production', 'production-path-not-listed'],
  ['GET', 'https://dashboard-public-api.pushengage.com/d/v1/sites/76524/%2e%2e/%2e%2e/accounts', false, 'production', 'production-path-not-listed'],
  ['GET', 'https://dashboard-public-api.pushengage.com/d/v1/accounts/6569/billing', false, 'production', 'production-path-not-listed'],
  ['GET', 'https://api.ledgerport.com/api/v1/businesses', false, 'production', 'production-path-not-listed'],
  ['POST', 'https://api.ledgerport.com/api/v1/plans', false, 'production', 'production-write'],
  ['POST', 'https://app.pushengage.com/login', false, 'production', 'production-write'],
  ['DELETE', 'https://app.ledgerport.com/x', false, 'production', 'production-write'],
  ['OPTIONS', 'https://pushengage.com/', false, 'production', 'production-write'],
  ['GET', 'https://api.pushengage.com/apiv1/notifications', false, 'production', 'production-path-not-listed'],
  ['POST', 'https://ledgerport.myshopify.com/admin/api/2025-01/graphql.json', false, 'production', 'production-write'],
  ['POST', 'https://admin.shopify.com/store/ledgerport/orders/new', false, 'production', 'production-write'],
  // unknown / malformed → deny
  ['GET', 'https://example.com/', false, 'unknown', 'unknown-host'],
  ['GET', 'https://evil-staging-app.pushengage.com.attacker.io/', false, 'unknown', 'unknown-host'],
  ['GET', 'https://staging-app.pushengage.com.evil.io/d/v1', false, 'unknown', 'unknown-host'],
  ['GET', 'https://random-store.myshopify.com/', false, 'unknown', 'unknown-host'],
  ['GET', 'https://admin.shopify.com/store/someone-else/apps', false, 'unknown', 'shopify-admin-unknown-store'],
  ['GET', 'https://admin.shopify.com/', false, 'unknown', 'shopify-admin-unknown-store'],
  ['GET', 'https://sandbox.qbo.intuit.com/app/homepage', false, 'unknown', 'unknown-host'],
  ['GET', 'ftp://staging-app.pushengage.com/', false, 'unknown', 'bad-protocol'],
  ['GET', 'https://user:pw@staging-app.pushengage.com/', false, 'unknown', 'credentials-in-url'],
  ['GET', '/relative/path', false, 'unknown', 'bad-url'],
  ['GET', 'https://skb.pushengage.com/wp-admin/', false, 'production', 'production-path-not-listed'],
];

export async function runTargetTests(): Promise<void> {
  for (const [method, url, allowed, tier, code] of TARGET_CASES) {
    await check(`targets ${allowed ? 'ALLOW' : 'DENY '} ${method} ${url}`, () => {
      const d = checkTarget(url, method);
      eq(d.allowed, allowed, 'allowed');
      eq(d.tier, tier, 'tier');
      if (code) eq(d.code, code, 'code');
      if (allowed) {
        assertAllowedTarget(url, method);
      } else {
        throws(() => assertAllowedTarget(url, method), (e) => isBlockedError(e) && e.cls === 'TARGET', 'assertAllowedTarget');
      }
    });
  }
}
