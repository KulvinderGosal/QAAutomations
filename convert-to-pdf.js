#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const htmlPdf = require('html-pdf-node');

async function convertHTMLtoPDF() {
  const htmlPath = path.join(__dirname, 'test-results', 'regression-report-2026-02-27.html');
  const pdfPath = htmlPath.replace('.html', '.pdf');
  
  console.log('Converting HTML to PDF...');
  
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  const options = {
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      bottom: '20mm',
      left: '15mm',
      right: '15mm'
    }
  };
  
  const file = { content: htmlContent };
  
  try {
    const pdfBuffer = await htmlPdf.generatePdf(file, options);
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`✅ PDF generated successfully: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

convertHTMLtoPDF().catch(console.error);
