// QA test stores — the Shopify-embedded apps the team set up for exploring/
// testing PushEngage & LedgerPort across staging + production. All start on the
// Free plan; subscriptions can be upgraded when a test needs a paid plan.
// (Reference bookmarks — the apps live behind Shopify admin login.)

export type TestStore = {
  id: string;
  brand: "PushEngage" | "LedgerPort";
  product: string;
  env: "staging" | "production";
  storeHandle: string;
  url: string;
  plan: string;
};

export const TEST_STORES: TestStore[] = [
  {
    id: "ledgerport-shopify-staging",
    brand: "LedgerPort",
    product: "Shopify App",
    env: "staging",
    storeHandle: "ledgerport-staging-qa",
    url: "https://admin.shopify.com/store/ledgerport-staging-qa/apps/staging-ledgerport/app/dashboard",
    plan: "Free",
  },
  {
    id: "ledgerport-shopify-production",
    brand: "LedgerPort",
    product: "Shopify App",
    env: "production",
    storeHandle: "ledgerport",
    url: "https://admin.shopify.com/store/ledgerport/apps/ledgerport/app/dashboard",
    plan: "Free",
  },
  {
    id: "pushengage-shopify-staging",
    brand: "PushEngage",
    product: "Shopify App",
    env: "staging",
    storeHandle: "pushengage-staging-qa",
    url: "https://admin.shopify.com/store/pushengage-staging-qa/apps/staging-pushengage/app/home",
    plan: "Free",
  },
  {
    id: "pushengage-shopify-production",
    brand: "PushEngage",
    product: "Shopify App",
    env: "production",
    storeHandle: "pushengage-production-qa",
    url: "https://admin.shopify.com/store/pushengage-production-qa/apps/pushengage-1/app/home",
    plan: "Free",
  },
];

/** Shopify Partner dashboard listing all of the above test stores. */
export const PARTNER_STORES_URL = "https://dev.shopify.com/dashboard/129388888/stores";
