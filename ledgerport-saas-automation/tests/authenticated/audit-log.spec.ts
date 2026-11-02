/**
 * LedgerPort SaaS — Audit Log page (authenticated)
 * Target: /audit-log
 *
 * Chronological activity feed (Activity / Type / Time) with search, page size,
 * and pagination across many pages.
 *
 * IDs: LP-AUDIT-001 → LP-AUDIT-0xx
 */
import { test, expect } from '@playwright/test';
import { ROUTES, goto, mainTable, waitForRows, toolbarCombo } from '../helpers/app';

test.describe('Audit Log page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.auditLog);
  });

  test('LP-AUDIT-001 | Loads with correct heading and title', async ({ page }) => {
    await expect(page).toHaveURL(/\/audit-log/);
    await expect(page.getByRole('heading', { level: 1, name: /^Audit Log$/i })).toBeVisible();
    await expect(page).toHaveTitle(/Audit Log \| LedgerPort/i);
  });

  test('LP-AUDIT-002 | Table shows Activity, Type and Time columns', async ({ page }) => {
    for (const col of ['Activity', 'Type', 'Time']) {
      await expect(mainTable(page).getByText(col, { exact: true }).first()).toBeVisible();
    }
  });

  test('LP-AUDIT-003 | Log entries are rendered', async ({ page }) => {
    await waitForRows(page);
    expect(await mainTable(page).locator('tbody tr').count()).toBeGreaterThan(0);
  });

  test('LP-AUDIT-004 | Search box is present and operable', async ({ page }) => {
    await waitForRows(page);
    const search = page.getByPlaceholder(/search in all logs/i);
    await expect(search).toBeVisible();
    await search.fill('zzz-no-such-activity-zzz');
    await search.press('Enter');
    await expect(page.getByText(/no .*(match|found|results)/i).first()).toBeVisible();
    await search.clear();
  });

  test('LP-AUDIT-005 | Page-size control is present', async ({ page }) => {
    await expect(toolbarCombo(page, 'Show')).toBeVisible();
  });

  test('LP-AUDIT-006 | Pagination advances to the next page', async ({ page }) => {
    await waitForRows(page);
    const next = page.getByRole('button', { name: /next page|^next$/i });
    if ((await next.count()) === 0 || !(await next.isEnabled())) test.skip(true, 'Only one page of logs');
    const firstActivityBefore = await mainTable(page).locator('tbody tr').first().textContent();
    await next.click();
    await expect(async () => {
      const after = await mainTable(page).locator('tbody tr').first().textContent();
      expect(after).not.toBe(firstActivityBefore);
    }).toPass({ timeout: 10_000 });
  });

  test('LP-AUDIT-007 | No application console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: /^Audit Log$/i }).waitFor({ timeout: 15_000 });
    const appErrors = errors.filter(
      (e) => !/favicon|analytics|gtag|sentry|telemetry|net::ERR/i.test(e),
    );
    expect(appErrors, appErrors.join('\n')).toHaveLength(0);
  });
});
