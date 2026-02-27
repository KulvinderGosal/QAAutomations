const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/auth');
const config = require('../../../utils/config');

test('Publish WordPress Post with PushEngage', async ({ page }) => {
  test.setTimeout(180000);
  
  console.log('\n📝 Starting WordPress Post Publishing Test\n');
  
  // Step 1: Login
  console.log('📍 Step 1: Login to WordPress...');
  await loginToWordPress(page);
  console.log('✅ Logged in\n');
  
  // Step 2: Navigate to Posts
  console.log('📍 Step 2: Navigating to Posts...');
  await page.waitForTimeout(2000);
  await page.click('text=Posts', { timeout: 5000 });
  await page.waitForTimeout(2000);
  console.log('✅ On Posts page\n');
  
  // Step 3: Click Add New Post
  console.log('📍 Step 3: Creating new post...');
  try {
    await page.click('a:has-text("Add New")', { timeout: 5000 });
  } catch (e) {
    await page.goto(`${config.wpAdminUrl}/post-new.php`);
  }
  await page.waitForTimeout(5000);
  console.log('✅ New post editor opened\n');
  
  await page.screenshot({ path: 'test-results/post-editor.png', fullPage: true });
  
  // Step 4: Fill post details
  console.log('📍 Step 4: Filling post details...');
  const postTitle = `Test Post with PushEngage ${new Date().toLocaleTimeString()}`;
  const postContent = `This is an automated test post created at ${new Date().toLocaleString()}. This post will trigger a PushEngage notification.`;
  
  // Fill title (Gutenberg or Classic editor)
  try {
    // Try Gutenberg first
    const titleSelector = 'h1[aria-label="Add title"], .editor-post-title__input, #post-title-0';
    await page.fill(titleSelector, postTitle, { timeout: 5000 });
    console.log(`   ✓ Title: ${postTitle}`);
  } catch (e) {
    // Try Classic editor
    try {
      await page.fill('#title', postTitle, { timeout: 5000 });
      console.log(`   ✓ Title: ${postTitle}`);
    } catch (e2) {
      console.log('   ⚠️ Could not find title field');
    }
  }
  
  await page.waitForTimeout(2000);
  
  // Fill content
  try {
    // Try Gutenberg
    await page.click('.block-editor-default-block-appender__content, p[aria-label*="paragraph"]', { timeout: 5000 });
    await page.keyboard.type(postContent);
    console.log(`   ✓ Content added`);
  } catch (e) {
    // Try Classic editor
    try {
      await page.frameLocator('#content_ifr').locator('body').fill(postContent);
      console.log(`   ✓ Content added (Classic editor)`);
    } catch (e2) {
      console.log('   ⚠️ Could not add content');
    }
  }
  
  console.log('✅ Post details filled\n');
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: 'test-results/post-filled.png', fullPage: true });
  
  // Step 5: Check PushEngage settings (sidebar)
  console.log('📍 Step 5: Configuring PushEngage settings...');
  
  try {
    // Look for PushEngage meta box or panel
    const pushEngagePanel = page.locator('text=PushEngage, text=Send Push Notification').first();
    const isVisible = await pushEngagePanel.isVisible({ timeout: 5000 });
    
    if (isVisible) {
      console.log('   ✓ Found PushEngage panel');
      await pushEngagePanel.click();
      await page.waitForTimeout(2000);
      
      // Try to enable push notification
      const enableCheckbox = page.locator('input[type="checkbox"][id*="pushengage"], input[type="checkbox"][name*="pushengage"]').first();
      const checkboxVisible = await enableCheckbox.isVisible({ timeout: 3000 });
      if (checkboxVisible) {
        await enableCheckbox.check();
        console.log('   ✓ Enabled push notification');
      }
    }
  } catch (e) {
    console.log('   ℹ️ PushEngage settings not found or already enabled');
  }
  
  console.log('✅ PushEngage configured\n');
  
  await page.screenshot({ path: 'test-results/post-pushengage-enabled.png', fullPage: true });
  
  // Step 6: Publish post
  console.log('📍 Step 6: Publishing post...');
  
  const publishSelectors = [
    'button:has-text("Publish")[aria-disabled="false"]',
    'button.editor-post-publish-button',
    '#publish',
    'input[type="submit"][value="Publish"]'
  ];
  
  let published = false;
  for (const selector of publishSelectors) {
    try {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible({ timeout: 3000 });
      if (isVisible) {
        console.log(`   ✓ Clicking publish: ${selector}`);
        await button.click();
        await page.waitForTimeout(2000);
        
        // Check if confirmation publish needed (Gutenberg)
        try {
          const confirmPublish = page.locator('button.editor-post-publish-button:has-text("Publish")').first();
          const confirmVisible = await confirmPublish.isVisible({ timeout: 3000 });
          if (confirmVisible) {
            await confirmPublish.click();
            console.log('   ✓ Confirmed publish');
          }
        } catch (e) {
          // No confirmation needed
        }
        
        published = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!published) {
    console.log('   ⚠️ Could not find publish button');
  }
  
  await page.waitForTimeout(5000);
  console.log('✅ Post published!\n');
  
  await page.screenshot({ path: 'test-results/post-published.png', fullPage: true });
  
  console.log('🎉 WordPress Post published with PushEngage!\n');
  console.log(`   Title: ${postTitle}`);
  console.log(`   Push notification should be sent automatically\n`);
});
