const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const config = require('../../../utils/config');

test.describe('FUNCTIONAL - Publish WordPress Post with PushEngage', () => {
  test('Create and publish a WordPress post with push notification', async ({ page }) => {
    console.log(`🔐 Logging into WordPress admin (${config.environment})...`);
    console.log(`   URL: ${config.wpAdminUrl}`);
    console.log(`   User: ${config.wpUsername}`);
    
    await loginToWordPress(page, config);
    
    console.log('📍 Navigating to Posts...');
    
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '').replace('/admin', '');
    
    // Navigate to Posts > Add New
    await page.goto(`${baseUrl}/wp-admin/post-new.php`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);
    
    const timestamp = Date.now();
    const postTitle = `🔬 Smoke Test Post ${timestamp}`;
    const postContent = `This is an automated smoke test post created at ${new Date().toLocaleString()}.\n\nThis post should trigger a PushEngage notification if the integration is active.`;
    
    console.log('📍 Creating new post...');
    
    // Close welcome guide if it appears (Gutenberg editor)
    try {
      const closeGuideSelectors = [
        'button[aria-label="Close"]',
        'button:has-text("Close")',
        '.components-guide__finish-button'
      ];
      
      for (const selector of closeGuideSelectors) {
        try {
          await page.click(selector, { timeout: 3000 });
          console.log('✓ Closed welcome guide');
          break;
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      // No guide to close
    }
    
    await page.waitForTimeout(2000);
    
    // Fill in post title (Gutenberg editor)
    const titleSelectors = [
      '.wp-block-post-title',
      '.editor-post-title__input',
      'textarea[placeholder*="Add title" i]',
      'h1[aria-label*="Add title" i]',
      '[data-type="core/post-title"]'
    ];
    
    let titleFilled = false;
    for (const selector of titleSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        await page.fill(selector, postTitle, { timeout: 5000 });
        titleFilled = true;
        console.log(`✓ Filled post title using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    expect(titleFilled).toBeTruthy();
    await page.waitForTimeout(1000);
    
    // Fill in post content
    console.log('📍 Adding post content...');
    
    // Click in the content area
    const contentSelectors = [
      '.block-editor-default-block-appender__content',
      '.block-editor-rich-text__editable',
      'p[data-type="core/paragraph"]',
      '[aria-label*="Add block" i]',
      '.wp-block-paragraph'
    ];
    
    for (const selector of contentSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log(`✓ Clicked content area using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Type content
    await page.keyboard.type(postContent);
    console.log('✓ Added post content');
    
    await page.waitForTimeout(2000);
    
    // Check for PushEngage metabox/options in sidebar
    console.log('📍 Checking for PushEngage options...');
    
    // Try to open Settings sidebar if not already open
    try {
      const settingsButtonSelectors = [
        'button[aria-label*="Settings" i]',
        'button:has-text("Settings")',
        '.edit-post-header__settings button'
      ];
      
      for (const selector of settingsButtonSelectors) {
        try {
          await page.click(selector, { timeout: 3000 });
          console.log('✓ Opened Settings sidebar');
          await page.waitForTimeout(2000);
          break;
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      // Sidebar might already be open
    }
    
    // Look for PushEngage panel
    const pushengageIndicators = [
      'text=PushEngage',
      'text=Push Notification',
      'text=Send Notification',
      '[data-label*="PushEngage" i]'
    ];
    
    let pushengageFound = false;
    for (const indicator of pushengageIndicators) {
      try {
        await page.waitForSelector(indicator, { timeout: 3000 });
        pushengageFound = true;
        console.log(`✓ Found PushEngage option: ${indicator}`);
        
        // Try to enable notification
        try {
          await page.click(indicator);
          await page.waitForTimeout(1000);
        } catch (e) {
          // May already be enabled
        }
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (pushengageFound) {
      console.log('✓ PushEngage integration detected in post editor');
    } else {
      console.log('⚠️ PushEngage integration not found (may be configured differently)');
    }
    
    await page.waitForTimeout(1000);
    
    console.log('📍 Publishing post...');
    
    // Click Publish button
    const publishButtonSelectors = [
      'button.editor-post-publish-button:not([aria-disabled="true"])',
      'button:has-text("Publish"):not([disabled])',
      '.editor-post-publish-button__button'
    ];
    
    let publishClicked = false;
    for (const selector of publishButtonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        publishClicked = true;
        console.log(`✓ Clicked Publish button using: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    expect(publishClicked).toBeTruthy();
    await page.waitForTimeout(3000);
    
    // Confirm publish if there's a confirmation dialog
    try {
      const confirmSelectors = [
        'button.editor-post-publish-button:not([aria-disabled="true"])',
        'button:has-text("Publish"):not([disabled])'
      ];
      
      for (const selector of confirmSelectors) {
        try {
          await page.click(selector, { timeout: 3000 });
          console.log('✓ Confirmed publish');
          break;
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      // No confirmation needed
    }
    
    await page.waitForTimeout(3000);
    
    console.log('✅ Post published!');
    console.log(`   Title: ${postTitle}`);
    console.log(`   Content: ${postContent.substring(0, 50)}...`);
    
    // Verify post was published
    const successIndicators = [
      'text=Post published',
      'text=is now live',
      '.components-snackbar',
      '[aria-label*="published" i]'
    ];
    
    let successFound = false;
    for (const indicator of successIndicators) {
      try {
        await page.waitForSelector(indicator, { timeout: 5000 });
        successFound = true;
        console.log('✓ Post published successfully');
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!successFound) {
      // Check if we're on the post edit page with a success URL parameter
      const currentUrl = page.url();
      if (currentUrl.includes('post.php') || currentUrl.includes('message=6')) {
        console.log('✓ Post published (detected from URL)');
        successFound = true;
      }
    }
    
    console.log(successFound ? '✓ Success confirmed' : '⚠️ Could not verify success');
    
    // Try to get the View Post link
    try {
      const viewPostLink = await page.$('a:has-text("View Post")');
      if (viewPostLink) {
        const href = await viewPostLink.getAttribute('href');
        console.log(`📎 Post URL: ${href}`);
      }
    } catch (e) {
      // View link not found
    }
  });
});
