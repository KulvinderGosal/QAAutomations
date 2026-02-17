#!/usr/bin/env node

/**
 * Excel Test Case Generator
 * Reads Excel file and generates Playwright test cases
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = '/Users/kulvindersingh/Downloads/claud and app/WordPress Plugin Regression Sheet.xlsx';
const OUTPUT_DIR = path.join(__dirname, 'tests', 'pushengage-regression');

console.log('📊 Reading Excel file...');
console.log(`   File: ${EXCEL_FILE}\n`);

// Read the Excel file
const workbook = XLSX.readFile(EXCEL_FILE);

// Get all sheet names
const sheetNames = workbook.SheetNames;
console.log(`📋 Found ${sheetNames.length} sheet(s):`);
sheetNames.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
console.log('');

// Process each sheet
let totalTests = 0;
let createdTests = 0;

sheetNames.forEach(sheetName => {
  console.log(`\n📄 Processing sheet: "${sheetName}"`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`   Found ${data.length} rows\n`);
  
  // Print first few rows to see structure
  if (data.length > 0) {
    console.log('   Columns found:');
    Object.keys(data[0]).forEach(key => {
      console.log(`   - ${key}`);
    });
    console.log('');
    
    // Print first 3 test cases as sample
    console.log('   Sample test cases:');
    data.slice(0, 3).forEach((row, i) => {
      console.log(`\n   Test ${i + 1}:`);
      Object.keys(row).forEach(key => {
        const value = String(row[key]).substring(0, 100);
        console.log(`     ${key}: ${value}${String(row[key]).length > 100 ? '...' : ''}`);
      });
    });
  }
  
  totalTests += data.length;
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Summary:');
console.log(`   Total test cases found: ${totalTests}`);
console.log(`   Sheets processed: ${sheetNames.length}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Export data as JSON for easier inspection
const exportPath = path.join(__dirname, 'excel-test-data.json');
const allData = {};
sheetNames.forEach(sheetName => {
  const worksheet = workbook.Sheets[sheetName];
  allData[sheetName] = XLSX.utils.sheet_to_json(worksheet);
});

fs.writeFileSync(exportPath, JSON.stringify(allData, null, 2));
console.log(`✅ Exported data to: ${exportPath}`);
console.log(`   Review this file to see the complete structure\n`);
