const { test, expect } = require('@playwright/test');

test('Diagnose signup form fields', async ({ page }) => {
  test.setTimeout(120000);
  
  console.log('🔍 Diagnosing PushEngage signup form fields...\n');
  
  // Navigate to signup page
  await page.goto('https://staging.pushengage.com/signup/?planName=free');
  await page.waitForTimeout(3000);
  
  console.log('📋 Analyzing all input fields on the page:\n');
  
  // Get all input fields
  const fields = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    const fieldInfo = [];
    
    inputs.forEach((input, index) => {
      const info = {
        index,
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        className: input.className,
        value: input.value,
        visible: input.offsetParent !== null
      };
      fieldInfo.push(info);
    });
    
    return fieldInfo;
  });
  
  console.log('Total input fields found:', fields.length);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  fields.forEach(field => {
    if (field.visible) {
      console.log(`Field #${field.index}:`);
      console.log(`  Type: ${field.type}`);
      console.log(`  Name: ${field.name || '(none)'}`);
      console.log(`  ID: ${field.id || '(none)'}`);
      console.log(`  Placeholder: ${field.placeholder || '(none)'}`);
      console.log(`  Class: ${field.className || '(none)'}`);
      console.log('');
    }
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Take screenshot
  await page.screenshot({ 
    path: 'test-results/form-diagnosis.png', 
    fullPage: true 
  });
  
  console.log('✓ Screenshot saved to test-results/form-diagnosis.png');
});
