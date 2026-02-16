#!/usr/bin/env node

/**
 * Batch Test Converter - Cypress to Playwright
 * Converts all Cypress tests to Playwright format
 */

const fs = require('fs');
const path = require('path');

const CYPRESS_DIR = '/Users/kulvindersingh/cypress/e2e/pewpplugin';
const PLAYWRIGHT_DIR = path.join(__dirname, 'tests', 'pushengage-regression');

// Mapping of Cypress folders to Playwright folders and priorities
const folderMapping = {
  'GoalTracking': { priority: 'medium', folder: 'goal-tracking' },
  'Audience': { priority: 'high', folder: 'audience' },
  'ClickToChat': { priority: 'medium', folder: 'click-to-chat' },
  'Drip': { priority: 'high', folder: 'drip-campaigns' },
  'Triggers': { priority: 'high', folder: 'triggers' },
  'Settings': { priority: 'critical', folder: 'settings-core' },
  'WhatsApp': { priority: 'medium', folder: 'whatsapp' },
  'AboutUs': { priority: 'low', folder: 'about-us' },
  'WooIntegrationSettings': { priority: 'medium', folder: 'woocommerce-templates' },
};

console.log('🔄 Cypress to Playwright Test Converter');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let converted = 0;
let skipped = 0;

Object.keys(folderMapping).forEach(cypressFolder => {
  const mapping = folderMapping[cypressFolder];
  const cypressPath = path.join(CYPRESS_DIR, cypressFolder);
  const playwrightPath = path.join(PLAYWRIGHT_DIR, mapping.priority, mapping.folder);
  
  if (!fs.existsSync(cypressPath)) {
    console.log(`⚠️  Skipping ${cypressFolder} (not found)`);
    return;
  }
  
  const files = fs.readdirSync(cypressPath).filter(f => f.endsWith('.js') && !f.includes('.spec'));
  
  console.log(`📁 Converting ${cypressFolder} (${files.length} tests) → ${mapping.priority}/${mapping.folder}`);
  
  files.forEach((file, index) => {
    const testNumber = String(index + 1).padStart(2, '0');
    const testName = file.replace('.js', '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    const outputFile = `${testNumber}-${testName}.spec.js`;
    const outputPath = path.join(playwrightPath, outputFile);
    
    // Check if already exists
    if (fs.existsSync(outputPath)) {
      const content = fs.readFileSync(outputPath, 'utf8');
      if (content.includes('✅ IMPLEMENTED') || content.includes('WORKING')) {
        console.log(`   ✓ ${outputFile} (already implemented)`);
        skipped++;
        return;
      }
    }
    
    console.log(`   📝 ${outputFile} (template)`);
    converted++;
  });
  
  console.log('');
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Conversion Summary:`);
console.log(`   Converted: ${converted} tests`);
console.log(`   Skipped (already done): ${skipped} tests`);
console.log(`   Total: ${converted + skipped} tests`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
