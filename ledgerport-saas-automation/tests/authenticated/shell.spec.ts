/**
 * LedgerPort SaaS — App shell & navigation (authenticated)
 *
 * Covers the persistent chrome shared by every screen: the sidebar nav, the
 * account/business switchers, the plan badge, and routing between sections.
 *
 * IDs: LP-NAV-001 → LP-NAV-0xx
 */
import { test, expect } from '@playwright/test';
import { ROUTES, SIDEBAR, goto, sidebarLink, expectOnPage } from '../helpers/app';

test.describe('App shell & navigation', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, ROUTES.connections);
  });

  test('LP-NAV-001 | Every sidebar link is visible', async ({ page }) => {
    for (const item of SIDEBAR) {
      await expect(sidebarLink(page, item.label)).toBeVisible();
    }
  });

  test('LP-NAV-002 | Sidebar links point to the correct routes', async ({ page }) => {
    for (const item of SIDEBAR) {
      await expect(sidebarLink(page, item.label)).toHaveAttribute('href', item.href);
    }
  });

  for (const item of SIDEBAR) {
    test(`LP-NAV-010 | Navigates to ${item.label}`, async ({ page }) => {
      await sidebarLink(page, item.label).click();
      await expectOnPage(page, item.href);
    });
  }

  test('LP-NAV-020 | Account menu shows the signed-in user', async ({ page }) => {
    await expect(page.getByText('QA Automations').first()).toBeVisible();
    await expect(page.getByText(/kgosal\+lpwp@awesomemotive\.com/).first()).toBeVisible();
  });

  test('LP-NAV-021 | Current plan badge is shown', async ({ page }) => {
    await expect(page.getByText(/Scale Plan/i).first()).toBeVisible();
  });

  test('LP-NAV-022 | Sidebar can be toggled', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /toggle sidebar/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    // Toggling must not navigate away or break the page.
    await expect(page).toHaveURL(/\/connections/);
    await toggle.click();
    await expect(sidebarLink(page, 'Connections')).toBeVisible();
  });

  test('LP-NAV-030 | Deep-linking directly to each route renders its page', async ({ page }) => {
    for (const item of SIDEBAR) {
      await goto(page, item.href);
      await expectOnPage(page, item.href);
    }
  });

  test('LP-NAV-031 | Unknown route does not crash the app', async ({ page }) => {
    const resp = await page.goto('/this-route-does-not-exist', { waitUntil: 'domcontentloaded' });
    // Either a 404 view or a redirect — but the app shell must still be usable.
    expect(resp).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });
});
