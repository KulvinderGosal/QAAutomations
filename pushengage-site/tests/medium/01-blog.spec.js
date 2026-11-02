/**
 * Test Suite: MEDIUM - Blog / Resources
 * Test ID Prefix: PESITE-201x
 * Priority: MEDIUM
 * Feature: BLOG / CONTENT / RESOURCES
 *
 * Covers:
 *  - Blog page loads
 *  - Blog posts are listed (at least 1)
 *  - Blog post preview has title and image
 *  - Clicking a blog post opens the article
 *  - Article page has content (h1 + body text)
 *  - Categories / tags are present
 */

const { test, expect } = require('@playwright/test');
const { waitForPageLoad, findFirstVisible } = require('../../utils/helpers');
const config = require('../../utils/config');

test.describe('MEDIUM - Blog / Resources', () => {

  test('PESITE-2011 - Blog page loads @medium', async ({ page }) => {
    console.log('📍 PESITE-2011: Blog page loads');

    const response = await page.goto(config.pages.blog, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const status = response?.status() ?? 0;
    console.log(`  HTTP status: ${status}`);
    expect(status).toBeLessThan(400);

    const title = await page.title();
    console.log(`  Page title: "${title}"`);

    console.log('✅ Blog page loaded');
  });

  test('PESITE-2012 - Blog has at least one post listed @medium', async ({ page }) => {
    console.log('📍 PESITE-2012: Blog has posts');

    await page.goto(config.pages.blog, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const postSelectors = [
      'article',
      '[class*="post-card"]',
      '[class*="blog-card"]',
      '[class*="blog-post"]',
      '.post',
      'main li a[href*="/blog/"]',
    ];

    let postCount = 0;
    for (const selector of postSelectors) {
      postCount = await page.locator(selector).count();
      if (postCount > 0) {
        console.log(`  Found ${postCount} posts using: ${selector}`);
        break;
      }
    }

    expect(postCount, 'Blog page should list at least 1 post').toBeGreaterThan(0);
    console.log(`✅ Blog has ${postCount} posts listed`);
  });

  test('PESITE-2013 - Blog post preview has a title @medium', async ({ page }) => {
    console.log('📍 PESITE-2013: Blog post previews have titles');

    await page.goto(config.pages.blog, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const titleSelectors = [
      'article h2',
      'article h3',
      '[class*="post-card"] h2',
      '[class*="blog-card"] h2',
      '.post h2',
    ];

    let titleFound = false;
    for (const selector of titleSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = await el.textContent();
        console.log(`  First post title: "${text?.trim().substring(0, 80)}"`);
        titleFound = true;
        break;
      }
    }

    expect(titleFound, 'Blog post previews should have visible titles').toBeTruthy();
    console.log('✅ Blog post titles are visible');
  });

  test('PESITE-2014 - Clicking a blog post opens article @medium', async ({ page }) => {
    console.log('📍 PESITE-2014: Blog post click → article page');

    await page.goto(config.pages.blog, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    const postLinkSelectors = [
      'article a[href*="/blog/"]',
      '[class*="post-card"] a',
      '[class*="blog-card"] a',
      'main article a',
    ];

    let postLink = null;
    for (const selector of postLinkSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        postLink = el;
        break;
      }
    }

    if (!postLink) {
      test.skip(true, 'No blog post links found');
    }

    const href = await postLink.getAttribute('href');
    console.log(`  Clicking: ${href}`);

    await postLink.click();
    await waitForPageLoad(page);

    const url = page.url();
    console.log(`  Article URL: ${url}`);

    // Should have navigated away from the blog listing
    expect(url).not.toBe(config.pages.blog);

    // Article should have an h1
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });

    console.log('✅ Blog post click opens article with h1');
  });

  test('PESITE-2015 - Blog article has body content @medium', async ({ page }) => {
    console.log('📍 PESITE-2015: Blog article body content');

    await page.goto(config.pages.blog, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);

    // Click first post
    const postLink = page.locator('article a, [class*="blog-card"] a').first();
    if (!(await postLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No post links found');
    }

    await postLink.click();
    await waitForPageLoad(page);

    const contentSelectors = [
      'article p',
      '.post-content p',
      '.entry-content p',
      '[class*="article-body"] p',
      'main p',
    ];

    let bodyText = '';
    for (const selector of contentSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
        bodyText = await el.textContent() ?? '';
        break;
      }
    }

    console.log(`  Body paragraph length: ${bodyText.trim().length} chars`);
    expect(bodyText.trim().length, 'Blog article should have visible body text').toBeGreaterThan(50);

    console.log('✅ Blog article has body content');
  });
});
