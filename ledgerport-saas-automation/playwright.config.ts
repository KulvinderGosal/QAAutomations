import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { ACTIVE } from './config/env';

/**
 * One id per run, shared by the runner and its workers (workers inherit env):
 * outputDir is test-results/<RUN_ID>, and qa-core lpApi sends the same id as
 * X-QA-Run-Id on staging requests. TestPilot/CI may pass RUN_ID or QA_RUN_ID.
 */
const RUN_ID = (process.env.RUN_ID =
  process.env.RUN_ID ||
  process.env.QA_RUN_ID ||
  `run-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')}-${process.pid}`);
process.env.QA_RUN_ID = process.env.QA_RUN_ID || RUN_ID;

/**
 * Traces/videos are OFF unless PW_TRACE is set (then retain-on-failure), and
 * always OFF for login/setup/shopify-admin projects: recording on a login page
 * has broken bot-challenged logins before, and traces would capture tokens.
 * Traces stay on local disk only — never upload them.
 */
const AUTH_FLOW_PROJECT = /login|setup|shopify-admin/i;
const recording = (projectName: string) => {
  const mode = process.env.PW_TRACE && !AUTH_FLOW_PROJECT.test(projectName) ? 'retain-on-failure' : 'off';
  return { trace: mode, video: mode } as const;
};

/** qa-core persona id (TestPilot FRAMEWORKS[].id : env) — keys fixtures/qa-api.ts. */
const PERSONA = `ledgerport-saas-automation:${ACTIVE.name}`;

/**
 * Single suite, two targets — choose with LP_ENV (default: staging):
 *   LP_ENV=staging    npm test
 *   LP_ENV=production npm test
 *
 * Public specs (login page) run with no session. Authenticated specs reuse the
 * captured session for the active environment (.auth/staging.json or
 * .auth/production.json).
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  outputDir: `test-results/${RUN_ID}`,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['./reporters/coverage-reporter.ts', { tester: process.env.QA_TESTER || process.env.USER || 'automation' }],
  ],
  use: {
    baseURL: ACTIVE.baseURL,
    headless: process.env.HEADED !== '1',
    ...recording(''),
    screenshot: 'only-on-failure',
  },
  projects: [
    // Unauthenticated suite — the public login page. No stored session.
    {
      name: `public-${ACTIVE.name}`,
      testMatch: /public\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...recording(`public-${ACTIVE.name}`) },
    },
    // Authenticated suite — everything behind login. Reuses the saved session
    // for the active environment.
    {
      name: `authenticated-${ACTIVE.name}`,
      testMatch: /authenticated\/.*\.spec\.ts/,
      metadata: { persona: PERSONA },
      use: { ...devices['Desktop Chrome'], storageState: ACTIVE.authFile, ...recording(`authenticated-${ACTIVE.name}`) },
    },
    // Cross-browser mirrors of the authenticated suite. storageState is
    // browser-agnostic, so Firefox and WebKit reuse the SAME captured session
    // (ACTIVE.authFile) as the Chrome project above. Same testMatch/use, only
    // the browser device and the project name differ.
    {
      name: `firefox-${ACTIVE.name}`,
      testMatch: /authenticated\/.*\.spec\.ts/,
      metadata: { persona: PERSONA },
      use: { ...devices['Desktop Firefox'], storageState: ACTIVE.authFile, ...recording(`firefox-${ACTIVE.name}`) },
    },
    {
      name: `webkit-${ACTIVE.name}`,
      testMatch: /authenticated\/.*\.spec\.ts/,
      metadata: { persona: PERSONA },
      use: { ...devices['Desktop Safari'], storageState: ACTIVE.authFile, ...recording(`webkit-${ACTIVE.name}`) },
    },
  ],
});
