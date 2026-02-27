const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

class RegressionTestReport {
  constructor() {
    this.results = {
      critical: null,
      high: null,
      medium: null,
      low: null,
      signUp: null
    };
    this.timestamp = new Date().toLocaleString();
  }

  loadResults(priority, filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        this.results[priority] = JSON.parse(data);
        return true;
      }
    } catch (error) {
      console.error(`Error loading ${priority} results:`, error.message);
    }
    return false;
  }

  generatePDF(outputPath) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title Page
    this.addTitlePage(doc);
    doc.addPage();

    // Executive Summary
    this.addExecutiveSummary(doc);
    doc.addPage();

    // Detailed Results by Priority
    const priorities = ['critical', 'high', 'medium', 'low', 'signUp'];
    priorities.forEach((priority, index) => {
      if (this.results[priority]) {
        this.addPrioritySection(doc, priority);
        if (index < priorities.length - 1) doc.addPage();
      }
    });

    // Failure Analysis
    doc.addPage();
    this.addFailureAnalysis(doc);

    // Recommendations
    doc.addPage();
    this.addRecommendations(doc);

    doc.end();
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  addTitlePage(doc) {
    doc.fontSize(28).font('Helvetica-Bold')
       .text('PushEngage QA Staging', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(24).text('Full Regression Test Report', { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(12).font('Helvetica')
       .text(`Test Environment: qastaging.pushengage.com`, { align: 'center' });
    doc.text(`Report Generated: ${this.timestamp}`, { align: 'center' });
    doc.text(`Framework: Playwright v1.58.2`, { align: 'center' });
    doc.moveDown(3);

    // Logo placeholder
    doc.fontSize(14).font('Helvetica-Bold')
       .text('CONFIDENTIAL', { align: 'center' });
    doc.fontSize(10).font('Helvetica')
       .text('Internal QA Document', { align: 'center' });
  }

  addExecutiveSummary(doc) {
    doc.fontSize(20).font('Helvetica-Bold')
       .text('Executive Summary', { underline: true });
    doc.moveDown();

    const totalStats = this.calculateTotalStats();
    
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Tests Executed: ${totalStats.total}`);
    doc.text(`Passed: ${totalStats.passed} (${this.percentage(totalStats.passed, totalStats.total)}%)`, { color: 'green' });
    doc.text(`Failed: ${totalStats.failed} (${this.percentage(totalStats.failed, totalStats.total)}%)`, { color: 'red' });
    doc.text(`Skipped: ${totalStats.skipped}`, { color: 'gray' });
    doc.text(`Duration: ${this.formatDuration(totalStats.duration)}`);
    doc.moveDown();

    // Test Distribution
    doc.fontSize(14).font('Helvetica-Bold').text('Test Distribution:');
    doc.fontSize(11).font('Helvetica');
    Object.entries(this.results).forEach(([priority, data]) => {
      if (data && data.stats) {
        const stats = data.stats;
        const total = (stats.expected || 0) + (stats.unexpected || 0) + (stats.skipped || 0);
        doc.text(`  ${this.capitalize(priority)}: ${total} tests (${stats.expected || 0} passed, ${stats.unexpected || 0} failed)`);
      }
    });

    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text('Overall Status: ');
    const passRate = this.percentage(totalStats.passed, totalStats.total);
    let status = 'CRITICAL';
    let statusColor = 'red';
    if (passRate >= 95) {
      status = 'EXCELLENT';
      statusColor = 'green';
    } else if (passRate >= 85) {
      status = 'GOOD';
      statusColor = 'blue';
    } else if (passRate >= 70) {
      status = 'ACCEPTABLE';
      statusColor = 'orange';
    }
    doc.fillColor(statusColor).text(status, { continued: true }).fillColor('black');
  }

  addPrioritySection(doc, priority) {
    const data = this.results[priority];
    if (!data) return;

    doc.fontSize(18).font('Helvetica-Bold')
       .text(`${this.capitalize(priority)} Priority Tests`, { underline: true });
    doc.moveDown();

    const stats = data.stats || {};
    const total = (stats.expected || 0) + (stats.unexpected || 0) + (stats.skipped || 0);
    
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Tests: ${total}`);
    doc.text(`Passed: ${stats.expected || 0}`);
    doc.text(`Failed: ${stats.unexpected || 0}`);
    doc.text(`Skipped: ${stats.skipped || 0}`);
    doc.text(`Duration: ${this.formatDuration(stats.duration || 0)}`);
    doc.moveDown();

    // List failed tests
    if (stats.unexpected > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Failed Tests:');
      doc.fontSize(10).font('Helvetica');
      
      const failures = this.extractFailures(data);
      failures.slice(0, 20).forEach((failure, index) => {
        doc.text(`${index + 1}. ${failure.title}`);
        doc.fontSize(9).fillColor('gray')
           .text(`   Error: ${failure.error.substring(0, 100)}...`, { indent: 10 })
           .fillColor('black');
        doc.fontSize(10);
      });

      if (failures.length > 20) {
        doc.text(`... and ${failures.length - 20} more failures`);
      }
    }
  }

  addFailureAnalysis(doc) {
    doc.fontSize(18).font('Helvetica-Bold')
       .text('Failure Analysis', { underline: true });
    doc.moveDown();

    const allFailures = [];
    Object.values(this.results).forEach(data => {
      if (data) {
        allFailures.push(...this.extractFailures(data));
      }
    });

    // Categorize failures
    const categories = {
      timeout: [],
      selector: [],
      navigation: [],
      assertion: [],
      other: []
    };

    allFailures.forEach(failure => {
      const error = failure.error.toLowerCase();
      if (error.includes('timeout')) categories.timeout.push(failure);
      else if (error.includes('selector') || error.includes('locator')) categories.selector.push(failure);
      else if (error.includes('navigation') || error.includes('goto')) categories.navigation.push(failure);
      else if (error.includes('expect') || error.includes('assertion')) categories.assertion.push(failure);
      else categories.other.push(failure);
    });

    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Failures: ${allFailures.length}`);
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Failure Categories:');
    doc.fontSize(11).font('Helvetica');
    Object.entries(categories).forEach(([category, failures]) => {
      if (failures.length > 0) {
        doc.text(`  ${this.capitalize(category)}: ${failures.length} (${this.percentage(failures.length, allFailures.length)}%)`);
      }
    });
  }

  addRecommendations(doc) {
    doc.fontSize(18).font('Helvetica-Bold')
       .text('Recommendations', { underline: true });
    doc.moveDown();

    const totalStats = this.calculateTotalStats();
    const passRate = this.percentage(totalStats.passed, totalStats.total);

    doc.fontSize(12).font('Helvetica');

    if (passRate >= 95) {
      doc.text('✓ Test suite is in excellent condition');
      doc.text('✓ Continue monitoring for regressions');
      doc.text('✓ Consider expanding test coverage');
    } else if (passRate >= 85) {
      doc.text('⚠ Test suite shows good stability with room for improvement');
      doc.text('• Investigate and fix remaining failures');
      doc.text('• Review timeout settings for slow tests');
      doc.text('• Update selectors for failing UI tests');
    } else if (passRate >= 70) {
      doc.text('⚠ Test suite requires attention');
      doc.text('• Priority: Fix critical test failures immediately');
      doc.text('• Review application changes that broke tests');
      doc.text('• Update test data and selectors');
      doc.text('• Consider test maintenance sprint');
    } else {
      doc.text('❌ CRITICAL: Test suite health is poor');
      doc.text('• IMMEDIATE ACTION REQUIRED');
      doc.text('• Halt feature development until tests are fixed');
      doc.text('• Review recent application changes');
      doc.text('• Consider test suite overhaul');
    }

    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Next Steps:');
    doc.fontSize(11).font('Helvetica');
    doc.text('1. Review and triage all failed tests');
    doc.text('2. Create tickets for test failures');
    doc.text('3. Update selectors and test data');
    doc.text('4. Re-run failed tests after fixes');
    doc.text('5. Schedule follow-up regression run');
  }

  calculateTotalStats() {
    let total = 0, passed = 0, failed = 0, skipped = 0, duration = 0;

    Object.values(this.results).forEach(data => {
      if (data && data.stats) {
        passed += data.stats.expected || 0;
        failed += data.stats.unexpected || 0;
        skipped += data.stats.skipped || 0;
        duration += data.stats.duration || 0;
      }
    });

    total = passed + failed + skipped;
    return { total, passed, failed, skipped, duration };
  }

  extractFailures(data) {
    const failures = [];
    if (data.suites) {
      data.suites.forEach(suite => {
        this.extractFailuresFromSuite(suite, failures);
      });
    }
    return failures;
  }

  extractFailuresFromSuite(suite, failures) {
    if (suite.specs) {
      suite.specs.forEach(spec => {
        spec.tests.forEach(test => {
          test.results.forEach(result => {
            if (result.status === 'failed' || result.status === 'timedOut') {
              failures.push({
                title: spec.title,
                error: result.error?.message || 'Unknown error',
                file: spec.file,
                line: spec.line
              });
            }
          });
        });
      });
    }
    if (suite.suites) {
      suite.suites.forEach(subSuite => this.extractFailuresFromSuite(subSuite, failures));
    }
  }

  percentage(part, whole) {
    if (whole === 0) return 0;
    return Math.round((part / whole) * 100);
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Main execution
async function generateReport() {
  console.log('Generating Regression Test Report...');
  
  const report = new RegressionTestReport();
  
  // Load results from JSON files
  const resultsDir = path.join(__dirname, 'test-results');
  report.loadResults('critical', path.join(resultsDir, 'critical-results.json'));
  report.loadResults('high', path.join(resultsDir, 'high-results.json'));
  report.loadResults('medium', path.join(resultsDir, 'medium-results.json'));
  report.loadResults('low', path.join(resultsDir, 'low-results.json'));
  report.loadResults('signUp', path.join(resultsDir, 'signup-results.json'));
  
  const outputPath = path.join(resultsDir, `regression-report-${Date.now()}.pdf`);
  
  try {
    await report.generatePDF(outputPath);
    console.log(`✓ Report generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { RegressionTestReport, generateReport };
