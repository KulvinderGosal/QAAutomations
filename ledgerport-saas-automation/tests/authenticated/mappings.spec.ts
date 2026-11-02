/**
 * LedgerPort SaaS — Mappings page (authenticated)
 * Target: /mappings (auto-appends ?storefront=<id>)
 *
 * Maps storefront entities to QuickBooks records across tabs: Products,
 * Variations, Customers, Payment Methods. Supports search, status filtering,
 * page size, refresh, automap, and clear mappings.
 *
 * Toolbar filters render as Radix Select triggers (role=combobox). Automap uses
 * a Dialog; Clear Mappings uses an AlertDialog.
 *
 * IDs: LP-MAP-001 → LP-MAP-0xx
 * @destructive tests (Automap / Clear Mappings) only commit when LP_RUN_MUTATIONS=1.
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto, mainTable, waitForRows, toolbarCombo, overlay, dismissOverlay, mutationsAllowed } from '../helpers/app';

const TABS = ['Products', 'Variations', 'Customers', 'Payment Methods'];

test.describe('Mappings page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.mappings);
  });

  test('LP-MAP-001 | Loads with a storefront context', async ({ page }) => {
    await expect(page).toHaveURL(/\/mappings(\?storefront=\d+)?/);
    await expect(page.getByRole('heading', { level: 1, name: /^Mapping$/i })).toBeVisible();
    await expect(page).toHaveTitle(/Mapping \| LedgerPort/i);
  });

  test('LP-MAP-002 | All four entity tabs are present', async ({ page }) => {
    for (const tab of TABS) {
      await expect(page.getByRole('tab', { name: tab }).or(page.getByRole('button', { name: tab }))).toBeVisible();
    }
  });

  test('LP-MAP-003 | Products tab shows the expected table columns', async ({ page }) => {
    for (const col of ['Product', 'SKU', 'QuickBooks Product', 'Status']) {
      await expect(mainTable(page).getByText(col, { exact: true }).first()).toBeVisible();
    }
  });

  test('LP-MAP-004 | Products table renders rows', async ({ page }) => {
    await waitForRows(page);
    expect(await mainTable(page).locator('tbody tr').count()).toBeGreaterThan(0);
  });

  for (const tab of TABS) {
    test(`LP-MAP-010 | Switching to "${tab}" tab loads its content`, async ({ page }) => {
      const tabLoc = page.getByRole('tab', { name: tab }).or(page.getByRole('button', { name: tab }));
      await tabLoc.first().click();
      await page.waitForTimeout(800);
      await expect(mainTable(page)).toBeVisible();
    });
  }

  test('LP-MAP-020 | Search filters the table', async ({ page }) => {
    await waitForRows(page);
    const search = page.getByPlaceholder(/search by name or sku/i);
    await expect(search).toBeVisible();
    await search.fill('zzz-no-such-product-zzz');
    await search.press('Enter');
    await expect(page.getByText(/no .*(match|found|results)/i).first()).toBeVisible();
    await search.clear();
  });

  test('LP-MAP-021 | Status filter opens a menu', async ({ page }) => {
    const status = toolbarCombo(page, 'Status:');
    await expect(status).toBeVisible();
    await status.click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('LP-MAP-022 | Page-size control is present', async ({ page }) => {
    await expect(toolbarCombo(page, 'Show')).toBeVisible();
  });

  test('LP-MAP-023 | Refresh reloads the list without error', async ({ page }) => {
    await page.getByRole('button', { name: /^refresh$/i }).click();
    await waitForRows(page);
    await expect(mainTable(page)).toBeVisible();
  });

  test('LP-MAP-030 | @destructive Automap confirms before running', async ({ page }) => {
    await page.getByRole('button', { name: /^automap$/i }).click();
    const dlg = overlay(page);
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^automap$/i })).toBeVisible();
    if (!mutationsAllowed()) return void (await dismissOverlay(page));
    await dlg.getByRole('button', { name: /^automap$/i }).click();
    await expect(dlg).toBeHidden({ timeout: 20_000 });
  });

  test('LP-MAP-031 | @destructive Clear Mappings confirms before clearing', async ({ page }) => {
    await page.getByRole('button', { name: /clear mappings/i }).click();
    const dlg = overlay(page);
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: /clear mappings/i })).toBeVisible();
    if (!mutationsAllowed()) return void (await dismissOverlay(page));
    await dlg.getByRole('button', { name: /clear mappings/i }).click();
    await expect(dlg).toBeHidden({ timeout: 20_000 });
  });
});
