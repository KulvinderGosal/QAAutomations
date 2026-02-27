const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../utils/auth');

test.describe('PushEngage Critical Smoke Tests', () => {
  test.use({ actionTimeout: 10000 });

  test('01 - WordPress Login', async ({ page }) => {
    await loginToWordPress(page);
    await expect(page.locator('#wpadminbar')).toBeVisible();
  });

  test('02 - PushEngage Menu Visible', async ({ page }) => {
    await loginToWordPress(page);
    await expect(page.locator('text=PushEngage')).toBeVisible();
  });

  test('03 - Dashboard Loads', async ({ page }) => {
    await loginToWordPress(page);
    await page.click('text=PushEngage');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/pushengage/);
  });

  test('04 - Create Push Broadcast', async ({ page }) => {
    await loginToWordPress(page);
    await page.click('text=PushEngage');
    await page.click('text=Push Broadcasts');
    await page.click('button:has-text("Add New")');
    
    const title = `Smoke Test ${Date.now()}`;
    await page.fill('[data-testid*="Title"], input[placeholder*="title" i]', title);
    await page.fill('#notification-message, textarea', 'Smoke test message');
    await page.fill('div.pe-notification-url input, input[placeholder*="URL"]', 'https://example.com');
    
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);
    
    // Verify it was saved
    await page.goto('https://qastaging.pushengage.com/wp-admin/admin.php?page=pushengage#/campaigns/notifications');
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('05 - Create Segment', async ({ page }) => {
    await loginToWordPress(page);
    await page.click('text=PushEngage');
    await page.click('text=Audience');
    
    // Find and click create button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add New")').first();
    await createButton.click();
    
    const segmentName = `Smoke Segment ${Date.now()}`;
    await page.fill('input[type="text"]', segmentName);
    await page.click('button:has-text("Create"), button:has-text("Save")');
    await page.waitForTimeout(2000);
    
    // Verify segment exists
    await expect(page.locator(`text=${segmentName}`).first()).toBeVisible({ timeout: 10000 });
  });
});
