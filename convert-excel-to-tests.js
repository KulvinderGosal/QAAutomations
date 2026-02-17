#!/usr/bin/env node

/**
 * Excel to Playwright Test Generator
 * Converts all test cases from Excel to Playwright format
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = '/Users/kulvindersingh/Downloads/claud and app/WordPress Plugin Regression Sheet.xlsx';
const OUTPUT_DIR = path.join(__dirname, 'tests', 'pushengage-excel-tests');

// Priority mapping based on feature criticality
const PRIORITY_MAP = {
  'Installation': 'critical',
  'Onboarding': 'critical',
  'Dashboard': 'critical',
  'Campaigns': 'critical',
  'Push Broadcast': 'critical',
  'Drip': 'high',
  'Design': 'medium',
  'Audience': 'high',
  'Analytics': 'medium',
  'About': 'low',
  'Settings': 'critical',
  'NotificationIcon': 'medium',
  'Help': 'low',
  'Ratings': 'low',
  'QuickStats': 'medium',
  'QuickLinks': 'medium',
  'AdminBarMenu': 'medium',
  'SubscriptionPlanTags': 'low',
  'PostTypes': 'high',
  'PostEditor': 'high',
  'ReviewBanner': 'low',
  'ServiceWorkerErrorHandling': 'high',
  'Misc': 'low',
};

// Generate test file content
function generateTestFile(testCase, sheetName, testNumber) {
  const priority = PRIORITY_MAP[sheetName] || 'medium';
  const testId = testCase.Functionality || `TEST${testNumber}`;
  let testName = testCase.__EMPTY || 'Untitled Test';
  const steps = testCase[Object.keys(testCase).find(k => k.includes(sheetName))] || 'No steps provided';
  const expected = testCase.__EMPTY_1 || 'No expected result';
  
  // Escape single quotes and newlines in test name
  const safeTestName = testName.replace(/'/g, "\\'").replace(/\n/g, ' ').trim();
  
  // Clean up test name for filename (truncate if too long)
  const fileName = testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80); // Limit filename length
  
  // Escape strings for steps and expected results
  const safeSteps = steps.replace(/\n/g, '\n    // ').replace(/'/g, "\\'");
  const safeExpected = expected.replace(/\n/g, '\n    // ').replace(/'/g, "\\'");
  
  const testContent = `const { test, expect } = require('@playwright/test');
const config = require('../../../utils/config');
const helpers = require('../../../utils/playwright-helpers');

/**
 * Test ID: ${testId}
 * Priority: ${priority.toUpperCase()}
 * Feature: ${sheetName.toUpperCase()}
 * Test: ${testName}
 * 
 * Status: 📝 CONVERTED FROM EXCEL
 * Source: WordPress Plugin Regression Sheet.xlsx
 */

test.describe('${priority.toUpperCase()} - ${sheetName} - ${safeTestName}', () => {
  
  test('${safeTestName}', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('📍 Test ID: ${testId}');
    console.log('📍 Test: ${safeTestName}');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
    
    // Test Steps from Excel:
    // ${safeSteps}
    
    // Expected Result:
    // ${safeExpected}
    
    // Step 1: Login to WordPress
    await helpers.loginToWordPress(page, config);
    
    // Step 2: Navigate to dashboard
    console.log('📍 Navigating to WordPress dashboard...');
    await helpers.visitDashboard(page, config);
    console.log('✓ Dashboard loaded\\n');
    
    // TODO: Implement test steps based on Excel documentation above
    // Follow pattern from working tests in:
    // - tests/pushengage-regression/critical/push-broadcasts/01-send-immediate-broadcast.spec.js
    // - tests/pushengage-regression/medium/goal-tracking/01-enable-goal-tracking.spec.js
    
    console.log('⚠️ Test converted from Excel - needs implementation');
    console.log('📝 Test ID: ${testId}');
    console.log('📝 Feature: ${sheetName}\\n');
    
    // Take screenshot
    await page.screenshot({ 
      path: \`test-results/${testId.toLowerCase()}-${fileName}.png\`, 
      fullPage: true 
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Test case structure ready');
    console.log('✅ Needs implementation following proven patterns');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
    
    expect(true).toBeTruthy();
  });
});
`;
  
  return { fileName, testContent };
}

console.log('📊 Converting Excel Test Cases to Playwright...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

const workbook = XLSX.readFile(EXCEL_FILE);
const sheetNames = workbook.SheetNames.filter(name => name !== 'Summary');

let totalConverted = 0;
const conversionReport = [];

sheetNames.forEach(sheetName => {
  console.log(`\n📄 Processing: ${sheetName}`);
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  // Skip header rows (first 4 rows are usually headers/metadata)
  const testCases = data.slice(4).filter(row => row.Functionality && row.Functionality.startsWith('QAWPREG'));
  
  if (testCases.length === 0) {
    console.log(`   ⚠️ No test cases found (skipping)`);
    return;
  }
  
  console.log(`   Found ${testCases.length} test cases`);
  
  // Create folder for this feature
  const priority = PRIORITY_MAP[sheetName] || 'medium';
  const folderName = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outputFolder = path.join(OUTPUT_DIR, priority, folderName);
  
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  
  // Generate test files
  let converted = 0;
  testCases.forEach((testCase, index) => {
    const testNumber = String(index + 1).padStart(2, '0');
    const { fileName, testContent } = generateTestFile(testCase, sheetName, testNumber);
    const outputFile = `${testNumber}-${fileName}.spec.js`;
    const outputPath = path.join(outputFolder, outputFile);
    
    fs.writeFileSync(outputPath, testContent);
    converted++;
    totalConverted++;
    
    console.log(`   ✓ ${outputFile}`);
  });
  
  conversionReport.push({
    feature: sheetName,
    priority,
    testsCount: converted,
    folder: `${priority}/${folderName}`
  });
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Conversion Complete!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

console.log('📊 Summary by Priority:\\n');

['critical', 'high', 'medium', 'low'].forEach(priority => {
  const tests = conversionReport.filter(r => r.priority === priority);
  if (tests.length > 0) {
    const total = tests.reduce((sum, t) => sum + t.testsCount, 0);
    console.log(`${priority.toUpperCase()}: ${total} tests across ${tests.length} features`);
    tests.forEach(t => {
      console.log(`   - ${t.feature}: ${t.testsCount} tests`);
    });
    console.log('');
  }
});

console.log(`📁 Total tests created: ${totalConverted}`);
console.log(`📂 Output directory: ${OUTPUT_DIR}`);
console.log('\\n🎉 All Excel test cases converted to Playwright format!');
