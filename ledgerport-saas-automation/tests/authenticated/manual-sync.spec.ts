/**
 * LedgerPort SaaS — Manual Sync page (authenticated)
 * Target: /manual-sync (auto-appends ?storefront=<id>)
 *
 * Lets users push storefront entities to QuickBooks on demand across tabs:
 * Products, Variations, Orders, Customers, Payments. Supports search, status &
 * date filtering (Radix Select / role=combobox), page size, refresh, row
 * selection (Radix checkbox / role=checkbox), pagination, and "Push to
 * QuickBooks".
 *
 * IDs: LP-SYNC-001 → LP-SYNC-0xx
 * @destructive "Push to QuickBooks" only commits when LP_RUN_MUTATIONS=1.
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto, mainTable, waitForRows, toolbarCombo, overlay } from '../helpers/app';

const TABS = ['Products', 'Variations', 'Orders', 'Customers', 'Payments'];

test.describe('Manual Sync page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.manualSync);
  });

  test('LP-SYNC-001 | Loads with a storefront context', async ({ page }) => {
    await expect(page).toHaveURL(/\/manual-sync(\?storefront=\d+)?/);
    await expect(page.getByRole('heading', { level: 1, name: /^Manual Sync$/i })).toBeVisible();
    await expect(page).toHaveTitle(/Manual Sync \| LedgerPort/i);
  });

  test('LP-SYNC-002 | All five entity tabs are present', async ({ page }) => {
    for (const tab of TABS) {
      await expect(
        page.getByRole('tab', { name: tab }).or(page.getByRole('button', { name: tab })),
      ).toBeVisible();
    }
  });

  test('LP-SYNC-003 | Products table shows the expected columns', async ({ page }) => {
    for (const col of ['Product', 'SKU', 'Sync Status']) {
      await expect(mainTable(page).getByText(col, { exact: true }).first()).toBeVisible();
    }
  });

  test('LP-SYNC-004 | Products table renders rows', async ({ page }) => {
    await waitForRows(page);
    expect(await mainTable(page).locator('tbody tr').count()).toBeGreaterThan(0);
  });

  for (const tab of TABS) {
    test(`LP-SYNC-010 | Switching to "${tab}" tab loads its content`, async ({ page }) => {
      const tabLoc = page.getByRole('tab', { name: tab }).or(page.getByRole('button', { name: tab }));
      await tabLoc.first().click();
      await page.waitForTimeout(800);
      await expect(mainTable(page)).toBeVisible();
    });
  }

  test('LP-SYNC-020 | Search filters the list', async ({ page }) => {
    await waitForRows(page);
    const search = page.getByPlaceholder(/search by name or sku/i);
    await expect(search).toBeVisible();
    await search.fill('zzz-no-such-item-zzz');
    await search.press('Enter');
    await expect(page.getByText(/no .*(match|found|results)/i).first()).toBeVisible();
    await search.clear();
  });

  test('LP-SYNC-021 | Status filter opens', async ({ page }) => {
    const status = toolbarCombo(page, 'Status:');
    await expect(status).toBeVisible();
    await status.click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('LP-SYNC-022 | Date filter opens', async ({ page }) => {
    const date = toolbarCombo(page, 'Date:');
    await expect(date).toBeVisible();
    await date.click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('LP-SYNC-023 | Page-size control is present', async ({ page }) => {
    await expect(toolbarCombo(page, 'Show')).toBeVisible();
  });

  test('LP-SYNC-024 | Refresh reloads the list', async ({ page }) => {
    await page.getByRole('button', { name: /^refresh$/i }).click();
    await waitForRows(page);
    await expect(mainTable(page)).toBeVisible();
  });

  test('LP-SYNC-025 | Pagination advances to the next page', async ({ page }) => {
    await waitForRows(page);
    const next = page.getByRole('button', { name: /next page|^next$/i });
    if ((await next.count()) === 0 || !(await next.isEnabled())) test.skip(true, 'Only one page of results');
    await next.click();
    await waitForRows(page);
    await expect(mainTable(page)).toBeVisible();
  });

  test('LP-SYNC-030 | @destructive Selecting a row reveals Push to QuickBooks', async ({ page }) => {
    await waitForRows(page);

    // Select the first row (Radix checkbox renders as role=checkbox, not <input>).
    const firstCheckbox = mainTable(page).locator('tbody tr [role="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.click();

    // The "Push to QuickBooks" action surfaces only once rows are selected.
    const push = page.getByRole('button', { name: /push.*quickbooks|^push/i });
    await expect(push).toBeVisible();

    if (!mutationsAllowedNote(test)) return;

    await push.click();
    const dlg = overlay(page);
    if (await dlg.isVisible().catch(() => false)) {
      await dlg.getByRole('button', { name: /push|confirm|yes|sync/i }).click();
    }
    await expect(page.getByText(/success|queued|syncing|pushed/i).first()).toBeVisible({ timeout: 20_000 });
  });
});

function mutationsAllowedNote(t: typeof test): boolean {
  const allowed = process.env.LP_RUN_MUTATIONS === '1';
  if (!allowed) {
    t.info().annotations.push({
      type: 'note',
      description: 'Push not committed — set LP_RUN_MUTATIONS=1 to push to QuickBooks for real.',
    });
  }
  return allowed;
}
