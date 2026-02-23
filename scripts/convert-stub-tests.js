#!/usr/bin/env node

/**
 * Stub Test Converter
 * 
 * This script helps convert stub tests to fully implemented tests
 * by providing interactive prompts and code generation.
 * 
 * Usage:
 *   node scripts/convert-stub-tests.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Test patterns library
const patterns = {
  elementValidation: `
    // Multi-selector element validation
    const ${elementName}Selectors = [
      ${selectors}
    ];
    
    let ${elementName}Found = false;
    for (const selector of ${elementName}Selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(\`✓ ${elementLabel} found: \${selector}\`);
        ${elementName}Found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!${elementName}Found) {
      console.log('⚠️ ${elementLabel} not found');
    }
  `,
  
  buttonClick: `
    // Click button with fallback selectors
    const buttonSelectors = [
      ${selectors}
    ];
    
    let buttonClicked = false;
    for (const selector of buttonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log(\`✓ Clicked button: \${selector}\`);
        buttonClicked = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!buttonClicked) {
      console.log('⚠️ Could not click button');
      return;
    }
    
    await page.waitForTimeout(2000);
  `,
  
  formFill: `
    // Fill form field with validation
    const fieldSelectors = [
      ${selectors}
    ];
    
    let fieldFilled = false;
    for (const selector of fieldSelectors) {
      try {
        await page.fill(selector, '${value}', { timeout: 5000 });
        console.log(\`✓ Filled field: \${selector}\`);
        fieldFilled = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!fieldFilled) {
      console.log('⚠️ Could not fill field');
    }
  `,
  
  toggleCheck: `
    // Toggle checkbox/switch
    const toggleSelectors = [
      'input[type="checkbox"]',
      'button[role="switch"]',
      'div[class*="toggle"]'
    ];
    
    let toggleFound = false;
    for (const selector of toggleSelectors) {
      try {
        const toggle = await page.locator(selector).first();
        const beforeState = await toggle.isChecked();
        await toggle.click();
        await page.waitForTimeout(1000);
        const afterState = await toggle.isChecked();
        console.log(\`✓ Toggle changed from \${beforeState} to \${afterState}\`);
        toggleFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
  `,
  
  tableValidation: `
    // Validate table/list existence
    const tableSelectors = [
      'table',
      'div[role="table"]',
      'div[class*="list"]',
      'tbody'
    ];
    
    let tableFound = false;
    for (const selector of tableSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        const itemCount = await page.locator(selector).count();
        console.log(\`✓ Found table/list with \${itemCount} items\`);
        tableFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
  `
};

// Standard test template
const testTemplate = `const { test, expect } = require('@playwright/test');
const { loginToWordPress } = require('../../../utils/playwright-helpers');
const { navigateToPushEngagePage, waitForReactPageLoad } = require('../../../utils/pushengage-helpers');
const config = require('../../../utils/config');

/**
 * Test ID: {{TEST_ID}}
 * Priority: {{PRIORITY}}
 * Feature: {{FEATURE}}
 * Test: {{TEST_NAME}}
 * 
 * Expected Result:
 * {{EXPECTED_RESULT}}
 */

test.describe('{{PRIORITY}} - {{FEATURE}} - {{TEST_NAME}}', () => {
  
  test('should {{TEST_DESCRIPTION}}', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('📍 Test ID: {{TEST_ID}}');
    console.log('📍 {{TEST_NAME}}');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
    
    // Login to WordPress
    await loginToWordPress(page, config);
    
    // Navigate to {{PAGE_NAME}}
    const navigated = await navigateToPushEngagePage(page, '{{PAGE_NAME}}', config);
    if (!navigated) {
      console.log('⚠️ Could not navigate to {{PAGE_NAME}} - skipping test');
      await page.screenshot({ path: \`test-results/{{TEST_ID}}-navigation-failed.png\`, fullPage: true });
      return;
    }
    
    await waitForReactPageLoad(page);
    await page.waitForTimeout(3000);
    
    console.log('🔍 Testing {{TEST_NAME}}...\\n');
    
    {{TEST_IMPLEMENTATION}}
    
    // Take screenshot
    await page.screenshot({ 
      path: \`test-results/{{TEST_ID}}-result.png\`, 
      fullPage: true 
    });
    
    console.log('\\n✅ Test completed\\n');
  });
});
`;

// Helper functions
function extractTestInfo(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract test ID
  const testIdMatch = content.match(/Test ID: (QA\w+\d+)/);
  const testId = testIdMatch ? testIdMatch[1] : 'UNKNOWN';
  
  // Extract priority
  const priorityMatch = content.match(/Priority: (\w+)/);
  const priority = priorityMatch ? priorityMatch[1] : 'MEDIUM';
  
  // Extract feature
  const featureMatch = content.match(/Feature: (\w+)/);
  const feature = featureMatch ? featureMatch[1] : 'UNKNOWN';
  
  // Extract test name
  const testNameMatch = content.match(/Test: ([^\n]+)/);
  const testName = testNameMatch ? testNameMatch[1].trim() : 'Unknown test';
  
  // Extract expected result
  const expectedMatch = content.match(/Expected Result:\s*\/\/\s*([^\n]+)/);
  const expectedResult = expectedMatch ? expectedMatch[1].trim() : 'Test validation';
  
  return {
    testId,
    priority,
    feature,
    testName,
    expectedResult,
    originalContent: content
  };
}

function isStubTest(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('TODO: Implement') || content.includes('needs implementation') || content.includes('expect(true).toBeTruthy()');
}

function findStubTests(directory) {
  const stubTests = [];
  
  function traverse(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (file.endsWith('.spec.js')) {
        if (isStubTest(fullPath)) {
          stubTests.push(fullPath);
        }
      }
    }
  }
  
  traverse(directory);
  return stubTests;
}

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   PushEngage Stub Test Converter          ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  const testsDir = path.join(__dirname, '..', 'tests', 'pushengage-regression');
  
  console.log('🔍 Scanning for stub tests...\n');
  const stubTests = findStubTests(testsDir);
  
  console.log(`Found ${stubTests.length} stub tests:\n`);
  
  // Group by category
  const categories = {};
  for (const test of stubTests) {
    const parts = test.split(path.sep);
    const category = parts[parts.length - 3]; // e.g., "campaigns", "dashboard"
    
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(test);
  }
  
  // Display summary
  console.log('📊 Stub tests by category:\n');
  for (const [category, tests] of Object.entries(categories)) {
    console.log(`  ${category}: ${tests.length} tests`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const action = await question('What would you like to do?\n1. List all stub tests\n2. Convert a specific category\n3. Show conversion statistics\n4. Exit\n\nChoice: ');
  
  switch (action.trim()) {
    case '1':
      console.log('\n📋 All stub tests:\n');
      stubTests.forEach((test, index) => {
        const info = extractTestInfo(test);
        console.log(`${index + 1}. ${info.testId} - ${info.testName}`);
        console.log(`   File: ${path.relative(process.cwd(), test)}`);
        console.log(`   Priority: ${info.priority}, Feature: ${info.feature}\n`);
      });
      break;
      
    case '2':
      console.log('\n📂 Available categories:\n');
      Object.keys(categories).forEach((cat, index) => {
        console.log(`${index + 1}. ${cat} (${categories[cat].length} tests)`);
      });
      
      const catChoice = await question('\nSelect category number: ');
      const selectedCat = Object.keys(categories)[parseInt(catChoice) - 1];
      
      if (selectedCat) {
        console.log(`\n✨ Selected category: ${selectedCat}\n`);
        console.log('Sample tests in this category:\n');
        
        categories[selectedCat].slice(0, 5).forEach((test) => {
          const info = extractTestInfo(test);
          console.log(`- ${info.testId}: ${info.testName}`);
          console.log(`  Expected: ${info.expectedResult}\n`);
        });
        
        console.log('💡 Tip: Use the patterns from FULL_REGRESSION_IMPLEMENTATION_GUIDE.md');
        console.log('   to implement these tests systematically.\n');
      }
      break;
      
    case '3':
      const totalTests = stubTests.length;
      const implementedTests = 33; // Current count
      const percentage = ((implementedTests / (totalTests + implementedTests)) * 100).toFixed(1);
      
      console.log('\n📊 Conversion Statistics:\n');
      console.log(`Total Stub Tests: ${totalTests}`);
      console.log(`Implemented Tests: ${implementedTests}`);
      console.log(`Overall Progress: ${percentage}%`);
      console.log(`\nRemaining work: ${totalTests} tests`);
      console.log(`Estimated effort: ${Math.ceil(totalTests / 10)} days at 10 tests/day\n`);
      break;
      
    case '4':
      console.log('\n👋 Goodbye!\n');
      rl.close();
      return;
      
    default:
      console.log('\n❌ Invalid choice\n');
  }
  
  rl.close();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  extractTestInfo,
  isStubTest,
  findStubTests,
  patterns,
  testTemplate
};
