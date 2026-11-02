/**
 * LedgerPort SaaS — Manage Accounts page (authenticated)
 * Target: /manage-account
 *
 * Lists the account(s) the user belongs to with subscription, member and
 * business counts, plus row actions.
 *
 * IDs: LP-ACCT-001 → LP-ACCT-0xx
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto, mainTable } from '../helpers/app';

test.describe('Manage Accounts page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.manageAccount);
  });

  test('LP-ACCT-001 | Loads with correct heading and title', async ({ page }) => {
    await expect(page).toHaveURL(/\/manage-account/);
    await expect(page.getByRole('heading', { level: 1, name: /^Manage Accounts$/i })).toBeVisible();
    await expect(page).toHaveTitle(/Manage Accounts \| LedgerPort/i);
  });

  test('LP-ACCT-002 | Table shows the expected columns', async ({ page }) => {
    for (const col of ['ACCOUNT', 'SUBSCRIPTION', 'MEMBERS', 'BUSINESSES', 'ACTIONS']) {
      await expect(mainTable(page).getByText(col, { exact: true }).first()).toBeVisible();
    }
  });

  test('LP-ACCT-003 | At least one account row is listed', async ({ page }) => {
    expect(await mainTable(page).locator('tbody tr').count()).toBeGreaterThan(0);
  });

  test('LP-ACCT-004 | The signed-in account is shown', async ({ page }) => {
    await expect(mainTable(page).getByText(/QA/).first()).toBeVisible();
  });

  test('LP-ACCT-005 | Row has an actions control', async ({ page }) => {
    const firstRow = mainTable(page).locator('tbody tr').first();
    await expect(firstRow.getByRole('button').or(firstRow.getByRole('link')).first()).toBeVisible();
  });
});
