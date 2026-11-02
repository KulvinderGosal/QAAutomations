/**
 * Shared helpers for the authenticated LedgerPort SaaS dashboard suite.
 *
 * The app exposes no data-testid hooks, so locators here are built from stable
 * anchors: sidebar link hrefs, page H1 text, role-based controls, and the known
 * table column headers (captured from the live app).
 */
import { Page, expect, Locator } from '@playwright/test';

/** Canonical routes, in sidebar order. */
export const ROUTES = {
  connections: '/connections',
  mappings: '/mappings',
  manualSync: '/manual-sync',
  auditLog: '/audit-log',
  manageAccount: '/manage-account',
  manageBusiness: '/manage-business',
  manageUsers: '/manage-users',
  billing: '/billing',
} as const;

/** Sidebar link label + destination, as rendered in the live app. */
export const SIDEBAR = [
  { label: 'Connections', href: '/connections' },
  { label: 'Mappings', href: '/mappings' },
  { label: 'Manual Sync', href: '/manual-sync' },
  { label: 'Audit Log', href: '/audit-log' },
  { label: 'Manage Accounts', href: '/manage-account' },
  { label: 'Manage Businesses', href: '/manage-business' },
  { label: 'Manage Users', href: '/manage-users' },
  { label: 'Billing', href: '/billing' },
] as const;

/** Page <h1> text keyed by route (used to confirm a page actually rendered). */
export const PAGE_HEADING: Record<string, RegExp> = {
  '/connections': /^Connections$/i,
  '/mappings': /^Mapping$/i,
  '/manual-sync': /^Manual Sync$/i,
  '/audit-log': /^Audit Log$/i,
  '/manage-account': /^Manage Accounts$/i,
  '/manage-business': /^Manage Businesses$/i,
  '/manage-users': /^Manage Users$/i,
  '/billing': /^Billing & Subscription$/i,
};

/**
 * Whether destructive/data-mutating steps may COMMIT (final confirm click).
 * Off by default — @destructive tests still exercise the flow up to the
 * confirmation dialog, but only finalize when explicitly opted in:
 *   LP_RUN_MUTATIONS=1 npm test
 */
export function mutationsAllowed(): boolean {
  return process.env.LP_RUN_MUTATIONS === '1';
}

/**
 * Navigate to a route and wait for the app to be interactive.
 *
 * The dashboard keeps persistent connections open (websockets/polling), so
 * `networkidle` never fires — we wait for `domcontentloaded` then for the
 * sidebar to render as the readiness signal.
 */
export async function goto(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('link', { name: 'Connections', exact: true })
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => {});
}

/** The sidebar link locator for a given label. */
export function sidebarLink(page: Page, label: string): Locator {
  return page.getByRole('link', { name: label, exact: true });
}

/** Assert we're on a route (path match) and its H1 is visible. */
export async function expectOnPage(page: Page, route: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(route.replace(/[/]/g, '\\/')));
  const h1 = PAGE_HEADING[route];
  if (h1) {
    await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
  }
}

/** The primary data table on list pages. */
export function mainTable(page: Page): Locator {
  return page.locator('table').first();
}

/** Waits for the data table to have rendered at least one body row. */
export async function waitForRows(page: Page): Promise<void> {
  await expect(mainTable(page).locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
}

/**
 * A confirmation/modal overlay. The app uses Radix Dialog (`role=dialog`) for
 * forms and Radix AlertDialog (`role=alertdialog`) for destructive confirms.
 */
export function overlay(page: Page): Locator {
  return page.locator('[role="dialog"],[role="alertdialog"]').last();
}

/**
 * A toolbar dropdown rendered as a Radix Select trigger (`role=combobox`),
 * matched by its visible label prefix — e.g. "Status: All", "Date: All time",
 * "Show 20". Row-level selects are excluded by anchoring on the label text.
 */
export function toolbarCombo(page: Page, labelPrefix: string): Locator {
  return page.getByRole('combobox').filter({ hasText: new RegExp(`^${labelPrefix}`, 'i') });
}

/** Dismisses any open overlay without committing (Cancel/Close, else Escape). */
export async function dismissOverlay(page: Page): Promise<void> {
  const o = overlay(page);
  const cancel = o.getByRole('button', { name: /cancel|close|no/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click();
  else await page.keyboard.press('Escape');
}

/** Collects console errors during a callback; returns the list. */
export async function collectConsoleErrors(
  page: Page,
  action: () => Promise<void>,
): Promise<string[]> {
  const errors: string[] = [];
  const handler = (m: { type: () => string; text: () => string }) => {
    if (m.type() === 'error') errors.push(m.text());
  };
  page.on('console', handler as any);
  await action();
  page.off('console', handler as any);
  return errors;
}
