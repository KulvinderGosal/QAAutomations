/**
 * LedgerPort SaaS — Manage Businesses page (authenticated)
 * Target: /manage-business
 *
 * Lists businesses (Business / Currency / Default / Actions) and supports
 * creating a new business.
 *
 * IDs: LP-BIZ-001 → LP-BIZ-0xx
 * @destructive "Create Business" only commits when LP_RUN_MUTATIONS=1.
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto, mainTable, overlay, dismissOverlay, mutationsAllowed } from '../helpers/app';

test.describe('Manage Businesses page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.manageBusiness);
  });

  test('LP-BIZ-001 | Loads with correct heading and title', async ({ page }) => {
    await expect(page).toHaveURL(/\/manage-business/);
    await expect(page.getByRole('heading', { level: 1, name: /^Manage Businesses$/i })).toBeVisible();
    await expect(page).toHaveTitle(/Manage Businesses \| LedgerPort/i);
  });

  test('LP-BIZ-002 | Table shows the expected columns', async ({ page }) => {
    for (const col of ['BUSINESS', 'CURRENCY', 'DEFAULT', 'ACTIONS']) {
      await expect(mainTable(page).getByText(col, { exact: true }).first()).toBeVisible();
    }
  });

  test('LP-BIZ-003 | At least one business is listed', async ({ page }) => {
    expect(await mainTable(page).locator('tbody tr').count()).toBeGreaterThan(0);
  });

  test('LP-BIZ-004 | "Create Business" action is available', async ({ page }) => {
    await expect(page.getByRole('button', { name: /create business/i })).toBeVisible();
  });

  test('LP-BIZ-005 | @destructive Create Business opens a form dialog', async ({ page }) => {
    await page.getByRole('button', { name: /create business/i }).click();
    const dialog = overlay(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox').first()).toBeVisible();

    if (!mutationsAllowed()) return void (await dismissOverlay(page));
    // Fill the name field and submit (opt-in only).
    await dialog.getByRole('textbox').first().fill(`QA-Auto-Biz-${Date.now()}`);
    await dialog.getByRole('button', { name: /create|save|add/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });
});
