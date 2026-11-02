/**
 * LedgerPort SaaS — Manage Users page (authenticated)
 * Target: /manage-users
 *
 * Lists team members (User / Status / Last Active / Actions) and supports
 * inviting new users.
 *
 * IDs: LP-USER-001 → LP-USER-0xx
 * @destructive "Invite User" only sends an invite when LP_RUN_MUTATIONS=1.
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto, mainTable, overlay, dismissOverlay, mutationsAllowed } from '../helpers/app';

test.describe('Manage Users page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.manageUsers);
  });

  test('LP-USER-001 | Loads with correct heading and title', async ({ page }) => {
    await expect(page).toHaveURL(/\/manage-users/);
    await expect(page.getByRole('heading', { level: 1, name: /^Manage Users$/i })).toBeVisible();
    await expect(page).toHaveTitle(/Manage Users \| LedgerPort/i);
  });

  test('LP-USER-002 | Table shows the expected columns', async ({ page }) => {
    for (const col of ['USER', 'STATUS', 'LAST ACTIVE', 'ACTIONS']) {
      await expect(mainTable(page).getByText(col, { exact: true }).first()).toBeVisible();
    }
  });

  test('LP-USER-003 | At least one user is listed', async ({ page }) => {
    expect(await mainTable(page).locator('tbody tr').count()).toBeGreaterThan(0);
  });

  test('LP-USER-004 | The signed-in user appears in the list', async ({ page }) => {
    await expect(mainTable(page).getByText(/kgosal\+lpwp@awesomemotive\.com/).first()).toBeVisible();
  });

  test('LP-USER-005 | "Invite User" action is available', async ({ page }) => {
    await expect(page.getByRole('button', { name: /invite user/i })).toBeVisible();
  });

  test('LP-USER-006 | @destructive Invite User opens an invite form', async ({ page }) => {
    await page.getByRole('button', { name: /invite user/i }).click();
    const dialog = overlay(page);
    await expect(dialog).toBeVisible();
    // An email field should be present in the invite form.
    await expect(dialog.getByRole('textbox').first()).toBeVisible();

    if (!mutationsAllowed()) return void (await dismissOverlay(page));
    const email = dialog.locator('input[type="email"]').first().or(dialog.getByRole('textbox').first());
    await email.fill((process.env.QA_EMAIL || 'qa@example.com').replace('@', `+lpinvite-${Date.now()}@`));
    await dialog.getByRole('button', { name: /send|invite|add/i }).click();
    await expect(page.getByText(/invite sent|invited|success/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
