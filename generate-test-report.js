import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate PDF Test Report for Membership Payment System
 * Usage: node generate-test-report.js [backend|frontend|all]
 */

const COLORS = {
  primary: '#1e40af',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  muted: '#6b7280',
  dark: '#111827',
  light: '#f3f4f6',
  white: '#ffffff',
  headerBg: '#1e3a5f',
  sectionBg: '#eff6ff',
  tableBorder: '#d1d5db',
  tableHeader: '#374151',
  tableStripe: '#f9fafb',
};

function drawHeader(doc, title, subtitle) {
  // Header background
  doc.rect(0, 0, doc.page.width, 120).fill(COLORS.headerBg);

  // Shield icon (security symbol)
  doc.fontSize(28).fillColor(COLORS.white).text('🛡️', 50, 25, { width: 40 });

  // Title
  doc.fontSize(22).fillColor(COLORS.white).font('Helvetica-Bold')
    .text(title, 90, 28, { width: 450 });

  // Subtitle
  doc.fontSize(11).fillColor('#93c5fd').font('Helvetica')
    .text(subtitle, 90, 58, { width: 450 });

  // Date & time
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  doc.fontSize(9).fillColor('#93c5fd')
    .text(`Generated: ${dateStr} at ${timeStr}`, 90, 80, { width: 450 });

  // Company badge
  doc.fontSize(9).fillColor('#93c5fd')
    .text('Sunsys Technologies Pvt Ltd', 90, 95, { width: 450 });

  doc.moveDown(3);
  doc.y = 140;
}

function drawSectionTitle(doc, title, icon = '') {
  const y = doc.y;
  if (y > doc.page.height - 100) {
    doc.addPage();
  }
  doc.rect(50, doc.y, doc.page.width - 100, 28).fill(COLORS.primary);
  doc.fontSize(12).fillColor(COLORS.white).font('Helvetica-Bold')
    .text(`${icon}  ${title}`, 62, doc.y + 7, { width: 400 });
  doc.y += 38;
  doc.fillColor(COLORS.dark).font('Helvetica');
}

function drawSummaryCards(doc, data) {
  const cardWidth = 115;
  const cardHeight = 60;
  const startX = 55;
  const y = doc.y;
  const gap = 12;

  const cards = [
    { label: 'Total Tests', value: data.numTotalTests, color: COLORS.primary },
    { label: 'Passed', value: data.numPassedTests, color: COLORS.success },
    { label: 'Failed', value: data.numFailedTests, color: data.numFailedTests > 0 ? COLORS.danger : COLORS.success },
    { label: 'Test Suites', value: data.numTotalTestSuites, color: COLORS.primary },
  ];

  cards.forEach((card, i) => {
    const x = startX + i * (cardWidth + gap);

    // Card background
    doc.roundedRect(x, y, cardWidth, cardHeight, 6).fill(COLORS.light);

    // Card border top
    doc.rect(x, y, cardWidth, 4).fill(card.color);

    // Value
    doc.fontSize(22).fillColor(card.color).font('Helvetica-Bold')
      .text(String(card.value), x, y + 14, { width: cardWidth, align: 'center' });

    // Label
    doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
      .text(card.label, x, y + 40, { width: cardWidth, align: 'center' });
  });

  doc.y = y + cardHeight + 20;
  doc.fillColor(COLORS.dark).font('Helvetica');
}

function drawTestSuiteTable(doc, testResults) {
  const tableX = 50;
  const colWidths = [260, 65, 65, 85];
  const rowHeight = 20;

  // Check page space
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
  }

  // Table header
  const headerY = doc.y;
  doc.rect(tableX, headerY, colWidths.reduce((a, b) => a + b), rowHeight).fill(COLORS.tableHeader);

  doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold');
  let x = tableX + 8;
  ['Test File', 'Tests', 'Status', 'Duration'].forEach((header, i) => {
    doc.text(header, x, headerY + 5, { width: colWidths[i] - 16 });
    x += colWidths[i];
  });

  doc.y = headerY + rowHeight;

  // Table rows
  testResults.forEach((suite, index) => {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
    }

    const rowY = doc.y;
    const bgColor = index % 2 === 0 ? COLORS.white : COLORS.tableStripe;
    doc.rect(tableX, rowY, colWidths.reduce((a, b) => a + b), rowHeight).fill(bgColor);

    // File name
    const fileName = path.basename(suite.name);
    doc.fontSize(8).fillColor(COLORS.dark).font('Helvetica');
    x = tableX + 8;
    doc.text(fileName, x, rowY + 5, { width: colWidths[0] - 16 });
    x += colWidths[0];

    // Tests count
    const testCount = suite.assertionResults?.length || 0;
    doc.text(String(testCount), x, rowY + 5, { width: colWidths[1] - 16, align: 'center' });
    x += colWidths[1];

    // Status
    const statusColor = suite.status === 'passed' ? COLORS.success : COLORS.danger;
    doc.fillColor(statusColor).font('Helvetica-Bold')
      .text(suite.status === 'passed' ? 'PASS' : 'FAIL', x, rowY + 5, { width: colWidths[2] - 16, align: 'center' });
    x += colWidths[2];

    // Duration
    const duration = suite.assertionResults?.reduce((sum, t) => sum + (t.duration || 0), 0) || 0;
    doc.fillColor(COLORS.muted).font('Helvetica')
      .text(`${Math.round(duration)}ms`, x, rowY + 5, { width: colWidths[3] - 16, align: 'right' });

    doc.y = rowY + rowHeight;
  });

  // Table border
  const tableHeight = doc.y - headerY;
  doc.rect(tableX, headerY, colWidths.reduce((a, b) => a + b), tableHeight)
    .stroke(COLORS.tableBorder);

  doc.y += 15;
  doc.fillColor(COLORS.dark).font('Helvetica');
}

function drawTestDetails(doc, testResults) {
  testResults.forEach((suite) => {
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
    }

    const fileName = path.basename(suite.name);
    const statusIcon = suite.status === 'passed' ? '✅' : '❌';

    // Suite header
    doc.rect(50, doc.y, doc.page.width - 100, 22).fill(COLORS.sectionBg);
    doc.fontSize(9).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text(`${statusIcon} ${fileName}`, 60, doc.y + 6, { width: 420 });

    const testCount = suite.assertionResults?.length || 0;
    doc.fillColor(COLORS.muted).font('Helvetica')
      .text(`${testCount} tests`, doc.page.width - 140, doc.y - 16 + 6, { width: 80, align: 'right' });

    doc.y += 28;

    // Group tests by describe block
    const groups = {};
    (suite.assertionResults || []).forEach((test) => {
      const group = test.ancestorTitles?.join(' > ') || 'Root';
      if (!groups[group]) groups[group] = [];
      groups[group].push(test);
    });

    Object.entries(groups).forEach(([groupName, tests]) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
      }

      // Group name
      doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica-Bold')
        .text(`  ${groupName}`, 58, doc.y, { width: 420 });
      doc.y += 14;

      tests.forEach((test) => {
        if (doc.y > doc.page.height - 40) {
          doc.addPage();
        }

        const icon = test.status === 'passed' ? '✓' : '✗';
        const color = test.status === 'passed' ? COLORS.success : COLORS.danger;

        doc.fontSize(7.5).fillColor(color).font('Helvetica')
          .text(`    ${icon}`, 62, doc.y, { continued: true, width: 20 });
        doc.fillColor(COLORS.dark)
          .text(` ${test.title}`, { width: 360 });

        // Duration on right
        if (test.duration) {
          doc.fillColor(COLORS.muted).fontSize(7)
            .text(`${Math.round(test.duration)}ms`, doc.page.width - 120, doc.y - 10, { width: 60, align: 'right' });
        }

        doc.y += 2;
      });

      doc.y += 6;
    });

    doc.y += 8;
  });
}

function drawCoverageTable(doc, coverageSummary) {
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
  }

  const tableX = 50;
  const colWidths = [180, 70, 70, 70, 70];
  const rowHeight = 20;

  // Table header
  const headerY = doc.y;
  doc.rect(tableX, headerY, colWidths.reduce((a, b) => a + b), rowHeight).fill(COLORS.tableHeader);

  doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold');
  let x = tableX + 8;
  ['File', 'Statements', 'Branches', 'Functions', 'Lines'].forEach((header, i) => {
    doc.text(header, x, headerY + 5, { width: colWidths[i] - 16, align: i === 0 ? 'left' : 'center' });
    x += colWidths[i];
  });

  doc.y = headerY + rowHeight;

  // Total row first
  const total = coverageSummary.total;
  drawCoverageRow(doc, tableX, colWidths, rowHeight, 'ALL FILES (Total)', total, true);

  // Individual files
  let index = 1;
  Object.entries(coverageSummary).forEach(([filePath, data]) => {
    if (filePath === 'total') return;

    if (doc.y > doc.page.height - 40) {
      doc.addPage();
    }

    const fileName = path.basename(filePath);
    drawCoverageRow(doc, tableX, colWidths, rowHeight, fileName, data, false, index);
    index++;
  });

  // Table border
  const tableHeight = doc.y - headerY;
  doc.rect(tableX, headerY, colWidths.reduce((a, b) => a + b), tableHeight)
    .stroke(COLORS.tableBorder);

  doc.y += 15;
}

function drawCoverageRow(doc, tableX, colWidths, rowHeight, name, data, isBold, index = 0) {
  const rowY = doc.y;
  const bgColor = isBold ? '#dbeafe' : (index % 2 === 0 ? COLORS.white : COLORS.tableStripe);
  doc.rect(tableX, rowY, colWidths.reduce((a, b) => a + b), rowHeight).fill(bgColor);

  const font = isBold ? 'Helvetica-Bold' : 'Helvetica';
  doc.fontSize(7.5).font(font);

  let x = tableX + 8;

  // File name
  doc.fillColor(COLORS.dark).text(name, x, rowY + 6, { width: colWidths[0] - 16 });
  x += colWidths[0];

  // Coverage values
  ['statements', 'branches', 'functions', 'lines'].forEach((metric, i) => {
    const pct = data[metric]?.pct ?? 0;
    const color = pct >= 80 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.danger;
    doc.fillColor(color)
      .text(`${pct}%`, x, rowY + 6, { width: colWidths[i + 1] - 16, align: 'center' });
    x += colWidths[i + 1];
  });

  doc.y = rowY + rowHeight;
}

function drawSecuritySummary(doc, testResults) {
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
  }

  // Find security test files
  const securitySuites = testResults.filter(s => s.name.includes('security'));

  if (securitySuites.length === 0) return;

  const categories = securitySuites.map(suite => {
    const fileName = path.basename(suite.name);
    const tests = suite.assertionResults || [];
    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;

    let category = 'General';
    if (fileName.includes('auth')) category = 'Authentication & Authorization';
    else if (fileName.includes('injection')) category = 'SQL Injection & XSS';
    else if (fileName.includes('payment')) category = 'Payment Security';
    else if (fileName.includes('input')) category = 'Input Validation';
    else if (fileName.includes('api')) category = 'API Security';
    else if (fileName.includes('xss')) category = 'XSS Prevention';

    return { category, fileName, total: tests.length, passed, failed };
  });

  const tableX = 50;
  const colWidths = [170, 70, 70, 70, 80];
  const rowHeight = 20;

  const headerY = doc.y;
  doc.rect(tableX, headerY, colWidths.reduce((a, b) => a + b), rowHeight).fill(COLORS.tableHeader);

  doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold');
  let x = tableX + 8;
  ['Security Category', 'Total', 'Passed', 'Failed', 'Status'].forEach((header, i) => {
    doc.text(header, x, headerY + 5, { width: colWidths[i] - 16, align: i === 0 ? 'left' : 'center' });
    x += colWidths[i];
  });

  doc.y = headerY + rowHeight;

  categories.forEach((cat, index) => {
    const rowY = doc.y;
    const bgColor = index % 2 === 0 ? COLORS.white : COLORS.tableStripe;
    doc.rect(tableX, rowY, colWidths.reduce((a, b) => a + b), rowHeight).fill(bgColor);

    x = tableX + 8;
    doc.fontSize(8).fillColor(COLORS.dark).font('Helvetica')
      .text(cat.category, x, rowY + 6, { width: colWidths[0] - 16 });
    x += colWidths[0];

    doc.fillColor(COLORS.primary).text(String(cat.total), x, rowY + 6, { width: colWidths[1] - 16, align: 'center' });
    x += colWidths[1];

    doc.fillColor(COLORS.success).text(String(cat.passed), x, rowY + 6, { width: colWidths[2] - 16, align: 'center' });
    x += colWidths[2];

    const failColor = cat.failed > 0 ? COLORS.danger : COLORS.success;
    doc.fillColor(failColor).text(String(cat.failed), x, rowY + 6, { width: colWidths[3] - 16, align: 'center' });
    x += colWidths[3];

    const statusText = cat.failed === 0 ? 'SECURE' : 'ISSUES';
    const statusColor = cat.failed === 0 ? COLORS.success : COLORS.danger;
    doc.fillColor(statusColor).font('Helvetica-Bold')
      .text(statusText, x, rowY + 6, { width: colWidths[4] - 16, align: 'center' });

    doc.y = rowY + rowHeight;
  });

  doc.rect(tableX, headerY, colWidths.reduce((a, b) => a + b), doc.y - headerY)
    .stroke(COLORS.tableBorder);

  doc.y += 15;
  doc.fillColor(COLORS.dark).font('Helvetica');
}

function drawFooter(doc) {
  const pageCount = doc.bufferedPageRange();
  for (let i = 0; i < pageCount.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica');

    // Footer line
    doc.moveTo(50, doc.page.height - 40)
      .lineTo(doc.page.width - 50, doc.page.height - 40)
      .stroke(COLORS.tableBorder);

    doc.text(
      'Membership Payment System - Automated Test Report',
      50, doc.page.height - 30,
      { width: 300 }
    );
    doc.text(
      `Page ${i + 1} of ${pageCount.count}`,
      doc.page.width - 150, doc.page.height - 30,
      { width: 100, align: 'right' }
    );
  }
}

function generateReport(type) {
  const reportDir = type === 'backend'
    ? 'backend/test-report'
    : 'frontend/test-report';

  const jsonPath = path.join(reportDir, 'results.json');
  const coveragePath = path.join(reportDir, 'coverage', 'coverage-summary.json');
  const outputPath = path.join(reportDir, `${type}-test-report.pdf`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ ${jsonPath} not found. Run tests first: npm test`);
    return;
  }

  const testData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let coverageData = null;
  if (fs.existsSync(coveragePath)) {
    coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const label = type === 'backend' ? 'Backend' : 'Frontend';

  // Page 1: Header & Summary
  drawHeader(doc, `${label} Test Report`, `Membership Payment System - Security & Functional Testing`);
  drawSectionTitle(doc, 'TEST SUMMARY', '📊');
  drawSummaryCards(doc, testData);

  // Security Summary (if security tests exist)
  const hasSecurityTests = testData.testResults.some(s => s.name.includes('security'));
  if (hasSecurityTests) {
    drawSectionTitle(doc, 'SECURITY TEST RESULTS', '🛡️');
    drawSecuritySummary(doc, testData.testResults);
  }

  // Test Suite Overview
  drawSectionTitle(doc, 'TEST SUITE OVERVIEW', '📋');
  drawTestSuiteTable(doc, testData.testResults);

  // Coverage Report
  if (coverageData) {
    drawSectionTitle(doc, 'CODE COVERAGE', '📈');
    drawCoverageTable(doc, coverageData);
  }

  // Detailed Test Results
  doc.addPage();
  drawSectionTitle(doc, 'DETAILED TEST RESULTS', '🔍');
  drawTestDetails(doc, testData.testResults);

  // Footer on all pages
  drawFooter(doc);

  doc.end();

  stream.on('finish', () => {
    console.log(`✅ ${label} PDF report generated: ${outputPath}`);
  });
}

// Main
const args = process.argv.slice(2);
const target = args[0] || 'all';

if (target === 'backend' || target === 'all') {
  generateReport('backend');
}
if (target === 'frontend' || target === 'all') {
  generateReport('frontend');
}
