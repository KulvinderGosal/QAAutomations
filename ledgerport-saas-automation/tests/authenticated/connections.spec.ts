/**
 * LedgerPort SaaS — Connections page (authenticated)
 * Target: /connections
 *
 * Storefront connections hub: lists WooCommerce/Shopify storefronts and their
 * QuickBooks connection state, with add/connect/disconnect actions.
 *
 * IDs: LP-CONN-001 → LP-CONN-0xx
 * @destructive tests open mutating flows; they only commit when LP_RUN_MUTATIONS=1.
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto, expectOnPage, overlay, dismissOverlay, mutationsAllowed } from '../helpers/app';

test.describe('Connections page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.connections);
  });

  test('LP-CONN-001 | Loads without redirecting to login', async ({ page }) => {
    await expect(page).toHaveURL(/\/connections/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('LP-CONN-002 | Page heading and title are correct', async ({ page }) => {
    await expectOnPage(page, ROUTES.connections);
    await expect(page).toHaveTitle(/Connections \| LedgerPort/i);
  });

  test('LP-CONN-003 | "Storefront Connections" section is present', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Storefront Connections/i })).toBeVisible();
  });

  test('LP-CONN-004 | Add Storefront action is available', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add storefront/i })).toBeVisible();
  });

  test('LP-CONN-005 | Connect options for WooCommerce and Shopify exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: /connect woocommerce store/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /connect shopify store/i })).toBeVisible();
  });

  test('LP-CONN-006 | At least one storefront card is listed', async ({ page }) => {
    // WooCommerce / Shopify provider headings appear per connected storefront.
    // Wait for the section to hydrate before counting.
    await expect(page.getByRole('heading', { name: /Storefront Connections/i })).toBeVisible();
    await expect(page.getByText(/WooCommerce|Shopify/i).first()).toBeVisible();
  });

  test('LP-CONN-007 | "View Logs" links through to the audit log', async ({ page }) => {
    const viewLogs = page.getByRole('button', { name: /view logs/i }).first();
    if (!(await viewLogs.isVisible().catch(() => false))) test.skip(true, 'No connected storefront with logs');
    await viewLogs.click();
    await expect(page).toHaveURL(/audit-log|logs/i);
  });

  test('LP-CONN-008 | No application console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Storefront Connections/i }).waitFor({ timeout: 15_000 });
    const appErrors = errors.filter(
      (e) => !/favicon|analytics|gtag|sentry|telemetry|third-party|net::ERR/i.test(e),
    );
    expect(appErrors, appErrors.join('\n')).toHaveLength(0);
  });

  test('LP-CONN-020 | @destructive Disconnect opens a confirmation before removing', async ({ page }) => {
    const disconnect = page.getByRole('button', { name: /^disconnect$/i }).first();
    if (!(await disconnect.isVisible().catch(() => false))) test.skip(true, 'No connected storefront to disconnect');
    await disconnect.click();
    // A confirmation dialog must guard the destructive action.
    const dialog = overlay(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^disconnect$/i })).toBeVisible();

    if (!mutationsAllowed()) {
      // Back out — do not actually disconnect the QA storefront.
      await dismissOverlay(page);
      return;
    }
    await dialog.getByRole('button', { name: /^disconnect$/i }).click();
    await expect(dialog).toBeHidden();
  });
});
