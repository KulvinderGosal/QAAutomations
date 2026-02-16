#!/usr/bin/env node

/**
 * Test Suite Generator for PushEngage Regression Tests
 * 
 * This script generates all test file templates based on the regression test plan.
 * It creates properly organized test files with priority levels and feature categories.
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'tests', 'pushengage-regression');

// Test suite structure
const testSuites = {
  critical: {
    'push-broadcasts': [
      { file: '01-send-immediate-broadcast', desc: 'Send immediate push broadcast', status: 'DONE' },
      { file: '02-schedule-future-broadcast', desc: 'Schedule broadcast for future date/time' },
      { file: '03-create-recurring-broadcast', desc: 'Create recurring notification' },
      { file: '04-ab-test-broadcast', desc: 'Create A/B test broadcast' },
      { file: '05-send-to-segment', desc: 'Send broadcast to specific segment' },
      { file: '06-send-to-audience-group', desc: 'Send broadcast to audience group' },
      { file: '07-duplicate-broadcast', desc: 'Duplicate existing broadcast' },
      { file: '08-export-broadcast', desc: 'Export broadcast data' },
      { file: '09-view-broadcast-analytics', desc: 'View broadcast analytics and stats' },
      { file: '10-edit-draft-broadcast', desc: 'Edit draft broadcast' },
      { file: '11-delete-broadcast', desc: 'Delete broadcast' },
      { file: '12-broadcast-history', desc: 'Verify broadcast appears in history' },
      { file: '13-resend-broadcast', desc: 'Resend existing broadcast' },
    ],
    'settings-core': [
      { file: '01-connect-site', desc: 'Connect WordPress site to PushEngage' },
      { file: '02-disconnect-site', desc: 'Disconnect site from PushEngage' },
      { file: '03-dashboard-signin', desc: 'Verify dashboard sign-in flow' },
      { file: '04-enable-auto-push', desc: 'Enable auto push settings' },
      { file: '05-disable-auto-push', desc: 'Disable auto push settings' },
      { file: '06-configure-post-types', desc: 'Configure enabled post types' },
      { file: '07-use-site-icon', desc: 'Use site icon for notifications' },
      { file: '08-upload-notification-icon', desc: 'Upload custom notification icon' },
      { file: '09-save-settings', desc: 'Save settings and verify' },
    ],
    'smoke': [
      { file: '01-wordpress-login', desc: 'Login to WordPress admin', status: 'DONE' },
      { file: '02-dashboard-load', desc: 'WordPress dashboard loads', status: 'DONE' },
      { file: '03-pushengage-menu-visible', desc: 'PushEngage menu visible in sidebar', status: 'DONE' },
      { file: '04-pushengage-menu-click', desc: 'Click PushEngage menu', status: 'DONE' },
      { file: '05-frontend-reachable', desc: 'Frontend site is reachable', status: 'DONE' },
    ],
  },
  high: {
    'drip-campaigns': [
      { file: '01-create-basic-drip', desc: 'Create basic drip campaign' },
      { file: '02-create-drip-for-audience', desc: 'Create drip for specific audience' },
      { file: '03-duplicate-drip', desc: 'Duplicate existing drip campaign' },
      { file: '04-edit-drip', desc: 'Edit drip campaign' },
      { file: '05-export-drip', desc: 'Export drip campaign' },
      { file: '06-delete-drip', desc: 'Delete drip campaign' },
    ],
    'triggers': [
      { file: '01-create-custom-trigger', desc: 'Create custom trigger' },
      { file: '02-create-inventory-trigger', desc: 'Create inventory trigger' },
      { file: '03-create-price-drop-trigger', desc: 'Create price drop trigger' },
      { file: '04-create-cart-abandonment-trigger', desc: 'Create cart abandonment trigger' },
      { file: '05-edit-trigger', desc: 'Edit existing trigger' },
      { file: '06-add-notification-to-trigger', desc: 'Add notification to trigger' },
      { file: '07-export-trigger', desc: 'Export trigger data' },
      { file: '08-duplicate-trigger', desc: 'Duplicate trigger' },
      { file: '09-disable-trigger', desc: 'Disable trigger' },
      { file: '10-enable-trigger', desc: 'Enable trigger' },
      { file: '11-delete-trigger', desc: 'Delete trigger' },
    ],
    'audience': [
      { file: '01-create-segment', desc: 'Create new audience segment' },
      { file: '02-delete-segment', desc: 'Delete audience segment' },
      { file: '03-create-audience-group', desc: 'Create audience group' },
      { file: '04-delete-audience-group', desc: 'Delete audience group' },
    ],
    'woocommerce-core': [
      { file: '01-new-order-notification', desc: 'Configure new order notification' },
      { file: '02-cancelled-order-notification', desc: 'Configure cancelled order notification' },
      { file: '03-failed-order-notification', desc: 'Configure failed order notification' },
      { file: '04-pending-order-notification', desc: 'Configure pending order notification' },
      { file: '05-processing-order-notification', desc: 'Configure processing order notification' },
      { file: '06-onhold-order-notification', desc: 'Configure on-hold order notification' },
      { file: '07-completed-order-notification', desc: 'Configure completed order notification' },
      { file: '08-refunded-order-notification', desc: 'Configure refunded order notification' },
    ],
  },
  medium: {
    'click-to-chat': [
      { file: '01-enable-click-to-chat', desc: 'Enable click to chat widget' },
      { file: '02-disable-click-to-chat', desc: 'Disable click to chat widget' },
      { file: '03-configure-chat-style', desc: 'Configure chat widget style' },
      { file: '04-verify-frontend-widget', desc: 'Verify chat widget on frontend' },
    ],
    'whatsapp': [
      { file: '01-configure-whatsapp-settings', desc: 'Configure WhatsApp settings' },
      { file: '02-configure-whatsapp-cloud', desc: 'Configure WhatsApp Cloud settings' },
      { file: '03-enable-whatsapp-notifications', desc: 'Enable WhatsApp notifications' },
      { file: '04-configure-whatsapp-templates', desc: 'Configure WhatsApp message templates' },
      { file: '05-test-whatsapp-integration', desc: 'Test WhatsApp integration' },
    ],
    'goal-tracking': [
      { file: '01-enable-goal-tracking', desc: 'Enable goal tracking' },
      { file: '02-disable-goal-tracking', desc: 'Disable goal tracking' },
    ],
    'woocommerce-templates': [
      { file: '01-order-templates-overview', desc: 'Navigate to WooCommerce order templates' },
      { file: '02-enable-template-notifications', desc: 'Enable template notifications' },
      { file: '03-disable-template-notifications', desc: 'Disable template notifications' },
      // Note: 70+ template-specific tests can be generated dynamically
    ],
  },
  low: {
    'about-us': [
      { file: '01-verify-documentation-links', desc: 'Verify help and documentation links' },
    ],
  },
};

// Test template generator
function generateTestTemplate(priority, feature, testInfo) {
  const isDone = testInfo.status === 'DONE';
  
  return `const { test, expect } = require('@playwright/test');
const config = require('../../../utils/config');

/**
 * Priority: ${priority.toUpperCase()}
 * Feature: ${feature.replace(/-/g, ' ').toUpperCase()}
 * Test: ${testInfo.desc}
 * 
 * Status: ${isDone ? '✅ IMPLEMENTED' : '📝 TODO'}
 */

test.describe('${priority.toUpperCase()} - ${feature} - ${testInfo.desc}', () => {
  
  test('${testInfo.desc}', async ({ page }) => {
    test.setTimeout(120000);
    
    ${isDone ? '// This test is already implemented' : '// TODO: Implement this test'}
    ${isDone ? '// See: tests/pushengage/auto-send-broadcast.spec.js for reference' : ''}
    
    // Step 1: Login to WordPress
    console.log('📍 Logging in to WordPress...');
    await page.goto('http://productionautomation.local/wp-login.php', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    if (currentUrl.includes('wp-login.php')) {
      console.log('🔐 Logging in...');
      await page.fill('input[name="log"]', 'admin');
      await page.fill('input[name="pwd"]', 'admin@123=');
      await page.click('input[type="submit"]');
      await page.waitForTimeout(3000);
      console.log('✓ Logged in\\n');
    } else {
      console.log('✓ Already logged in\\n');
    }
    
    // Step 2: Navigate to WordPress dashboard
    console.log('📍 Going to WordPress dashboard...');
    await page.goto('http://productionautomation.local/wp-admin/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
    
    // Step 3: Navigate to PushEngage
    const baseUrl = config.wpAdminUrl.replace('/wp-admin', '');
    console.log('📍 Navigating to PushEngage ${feature}...');
    
    ${isDone ? '' : `// TODO: Navigate to the correct page for ${testInfo.desc}`}
    ${isDone ? '' : `// TODO: Implement test steps for: ${testInfo.desc}`}
    ${isDone ? '' : `// TODO: Add assertions to verify the functionality`}
    ${isDone ? '' : `// TODO: Take screenshots for verification`}
    ${isDone ? '' : `// TODO: Add success/failure logging`}
    
    ${isDone ? '' : `console.log('⚠️ Test not yet implemented');`}
    ${isDone ? '' : `console.log('📝 TODO: ${testInfo.desc}');`}
    
    // Placeholder assertion
    expect(true).toBeTruthy();
  });
});
`;
}

// Generate README for each priority level
function generateReadme(priority, features) {
  const featureList = Object.keys(features).map(feature => {
    const tests = features[feature];
    const completed = tests.filter(t => t.status === 'DONE').length;
    const total = tests.length;
    const percentage = Math.round((completed / total) * 100);
    
    return `### ${feature.replace(/-/g, ' ').toUpperCase()} (${completed}/${total} - ${percentage}%)

${tests.map((t, i) => 
  `${i + 1}. [${t.status === 'DONE' ? 'x' : ' '}] ${t.desc}`
).join('\n')}`;
  }).join('\n\n');
  
  return `# ${priority.toUpperCase()} Priority Tests

## Overview

This directory contains ${priority.toUpperCase()} priority regression tests for PushEngage plugin.

## Test Coverage

${featureList}

## Running Tests

\`\`\`bash
# Run all ${priority} priority tests
npm run test:${priority}

# Run specific feature tests
npm run test:${priority}:push-broadcasts
npm run test:${priority}:settings-core
\`\`\`

## Status Legend

- [x] Implemented and working
- [ ] Not yet implemented (TODO)

## Priority Definition

**${priority.toUpperCase()}**: ${
  priority === 'critical' ? 'Must pass before any release. Core functionality that breaks the product if it fails.' :
  priority === 'high' ? 'Important features that significantly impact user experience.' :
  priority === 'medium' ? 'Standard features that should work but are not critical.' :
  'Nice-to-have features and edge cases.'
}
`;
}

// Main execution
console.log('🚀 Generating PushEngage Regression Test Suite...\n');

let totalTests = 0;
let completedTests = 0;

// Generate test files and READMEs
Object.keys(testSuites).forEach(priority => {
  const priorityDir = path.join(BASE_DIR, priority);
  
  Object.keys(testSuites[priority]).forEach(feature => {
    const featureDir = path.join(priorityDir, feature);
    const tests = testSuites[priority][feature];
    
    // Create feature directory if it doesn't exist
    if (!fs.existsSync(featureDir)) {
      fs.mkdirSync(featureDir, { recursive: true });
    }
    
    // Generate test files
    tests.forEach(testInfo => {
      const filename = `${testInfo.file}.spec.js`;
      const filepath = path.join(featureDir, filename);
      
      totalTests++;
      if (testInfo.status === 'DONE') {
        completedTests++;
        console.log(`✅ ${priority}/${feature}/${filename} - DONE`);
      } else {
        const content = generateTestTemplate(priority, feature, testInfo);
        fs.writeFileSync(filepath, content);
        console.log(`📝 ${priority}/${feature}/${filename} - Generated`);
      }
    });
  });
  
  // Generate README for priority level
  const readmePath = path.join(priorityDir, 'README.md');
  const readmeContent = generateReadme(priority, testSuites[priority]);
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`📄 ${priority}/README.md - Generated\n`);
});

console.log('\n✅ Test Suite Generation Complete!\n');
console.log(`📊 Statistics:`);
console.log(`   Total Tests: ${totalTests}`);
console.log(`   Completed: ${completedTests} (${Math.round((completedTests/totalTests)*100)}%)`);
console.log(`   Remaining: ${totalTests - completedTests}`);
console.log(`\n📁 Test files created in: ${BASE_DIR}`);
console.log(`\n🎯 Next steps:`);
console.log(`   1. Review generated test templates`);
console.log(`   2. Implement TODO tests one by one`);
console.log(`   3. Run: npm run test:critical to verify`);
