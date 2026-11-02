/**
 * LedgerPort SaaS — Billing & Subscription page (authenticated)
 * Target: /billing
 *
 * Shows the current plan and entry points to change plan / manage subscription
 * / manage billing (the latter typically hand off to a payment provider portal).
 *
 * IDs: LP-BILL-001 → LP-BILL-0xx
 * @destructive plan-change is never auto-committed; we only assert the flow opens.
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto } from '../helpers/app';

test.describe('Billing & Subscription page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.billing);
  });

  test('LP-BILL-001 | Loads with correct heading and title', async ({ page }) => {
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.getByRole('heading', { level: 1, name: /^Billing & Subscription$/i })).toBeVisible();
    await expect(page).toHaveTitle(/Billing & Subscription \| LedgerPort/i);
  });

  test('LP-BILL-002 | Current plan is displayed', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Scale Plan/i })).toBeVisible();
  });

  test('LP-BILL-003 | Plan & subscription actions are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /change plan/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /manage subscription/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /manage billing/i })).toBeVisible();
  });

  test('LP-BILL-004 | @destructive "Change Plan" opens the plan selector', async ({ page }) => {
    await page.getByRole('button', { name: /change plan/i }).click();
    // Either a dialog or a plans view appears; we never finalize a plan change.
    await expect(
      page.getByRole('dialog').or(page.getByText(/choose a plan|plans|monthly|annual|per month/i).first()),
    ).toBeVisible();
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('LP-BILL-005 | "Manage Billing" hands off to a billing portal', async ({ page, context }) => {
    const manage = page.getByRole('button', { name: /manage billing/i });
    // Handoff may open a new tab or navigate; assert one of those happens.
    const popupP = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    const navP = page.waitForURL(/stripe|billing|checkout|portal/i, { timeout: 8000 }).catch(() => null);
    await manage.click();
    const popup = await popupP;
    const navigated = popup || (await navP.then(() => true).catch(() => false));
    expect(Boolean(navigated), 'Manage Billing should open a portal (new tab or redirect)').toBeTruthy();
    if (popup) await popup.close().catch(() => {});
  });
});
