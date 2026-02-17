const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration - change these for frontend/backend
const CONFIG = {
  reportDir: process.argv[2] || 'frontend',
  title: process.argv[3] || 'Frontend'
};

const baseDir = path.join(__dirname, CONFIG.reportDir, 'test-report');

// Read test results
const results = JSON.parse(fs.readFileSync(path.join(baseDir, 'results.json'), 'utf-8'));
const coverage = JSON.parse(fs.readFileSync(path.join(baseDir, 'coverage/coverage-summary.json'), 'utf-8'));

// Parse test results
const testFiles = results.testResults || [];
let totalTests = 0, passedTests = 0, failedTests = 0, skippedTests = 0;
let totalDuration = 0;

const testSuites = [];

for (const file of testFiles) {
  const fileName = file.name ? path.basename(file.name) : 'Unknown';
  const suiteTests = [];

  if (file.assertionResults) {
    for (const test of file.assertionResults) {
      totalTests++;
      if (test.status === 'passed') passedTests++;
      else if (test.status === 'failed') failedTests++;
      else skippedTests++;

      suiteTests.push({
        name: test.fullName || test.title || 'Unknown test',
        ancestors: test.ancestorTitles || [],
        status: test.status,
        duration: test.duration ? Math.round(test.duration * 100) / 100 : 0
      });
    }
  }

  const dur = file.endTime && file.startTime ? (file.endTime - file.startTime) : 0;
  totalDuration += dur;

  testSuites.push({
    name: fileName,
    fullPath: file.name || '',
    status: file.status || 'passed',
    tests: suiteTests,
    duration: Math.round(dur)
  });
}

// Format duration nicely
function formatDuration(ms) {
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

// Parse coverage
const coverageRows = [];
for (const [filePath, data] of Object.entries(coverage)) {
  if (filePath === 'total') continue;
  const name = filePath.split('\\').pop().split('/').pop();
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  let folder = '';
  for (const p of ['routes', 'config', 'utils', 'components', 'pages', 'services']) {
    if (parts.includes(p)) { folder = p; break; }
  }
  if (!folder) folder = parts.length > 1 ? parts[parts.length - 2] : '';
  coverageRows.push({
    name,
    folder,
    statements: data.statements.pct,
    branches: data.branches.pct,
    functions: data.functions.pct,
    lines: data.lines.pct
  });
}

const totalCov = coverage.total;

function statusIcon(status) {
  if (status === 'passed') return '<span style="color:#22c55e;font-weight:bold;">&#10004;</span>';
  if (status === 'failed') return '<span style="color:#ef4444;font-weight:bold;">&#10008;</span>';
  return '<span style="color:#eab308;">&#9679;</span>';
}

function covColor(pct) {
  if (pct >= 80) return '#22c55e';
  if (pct >= 50) return '#eab308';
  return '#ef4444';
}

function covBar(pct) {
  return '<div style="display:flex;align-items:center;gap:8px;">' +
    '<div style="width:80px;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">' +
    '<div style="width:' + pct + '%;height:100%;background:' + covColor(pct) + ';border-radius:4px;"></div>' +
    '</div>' +
    '<span style="color:' + covColor(pct) + ';font-weight:600;font-size:12px;">' + pct + '%</span>' +
    '</div>';
}

// Group tests by describe block
function buildTestHTML(tests) {
  const groups = {};
  for (const t of tests) {
    const key = t.ancestors.length > 0 ? t.ancestors[0] : '_root';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  let html = '';
  for (const [group, items] of Object.entries(groups)) {
    if (group !== '_root') {
      html += '<div style="margin:8px 0 4px 0;font-weight:600;color:#374151;font-size:13px;">' + group + '</div>';
    }
    for (const t of items) {
      const testName = t.ancestors.length > 1 ? t.ancestors.slice(1).join(' > ') + ' > ' + t.name.split('>').pop().trim() : t.name.split('>').pop().trim();
      html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0 3px 16px;font-size:12px;">' +
        statusIcon(t.status) +
        '<span style="color:#4b5563;">' + testName + '</span>' +
        '<span style="color:#9ca3af;font-size:11px;margin-left:auto;">' + t.duration + 'ms</span>' +
        '</div>';
    }
  }
  return html;
}

const html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<style>\n' +
  '* { margin: 0; padding: 0; box-sizing: border-box; }\n' +
  'body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; padding: 30px; background: #fff; }\n' +
  '.header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }\n' +
  '.header h1 { font-size: 24px; color: #111827; margin-bottom: 4px; }\n' +
  '.header p { color: #6b7280; font-size: 13px; }\n' +
  '.summary { display: flex; justify-content: center; gap: 20px; margin-bottom: 30px; }\n' +
  '.stat-card { text-align: center; padding: 16px 24px; border-radius: 10px; min-width: 100px; }\n' +
  '.stat-card .number { font-size: 32px; font-weight: 700; }\n' +
  '.stat-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; }\n' +
  '.section { margin-bottom: 24px; }\n' +
  '.section h2 { font-size: 16px; color: #111827; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }\n' +
  '.suite { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; page-break-inside: avoid; }\n' +
  '.suite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }\n' +
  '.suite-name { font-weight: 600; font-size: 14px; color: #1f2937; }\n' +
  '.suite-time { font-size: 12px; color: #9ca3af; }\n' +
  'table { width: 100%; border-collapse: collapse; font-size: 12px; }\n' +
  'th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }\n' +
  'td { padding: 6px 12px; border-bottom: 1px solid #f3f4f6; }\n' +
  'tr:hover { background: #f9fafb; }\n' +
  '.footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; }\n' +
  '</style>\n</head>\n<body>\n' +

  '<div class="header">' +
  '<h1>Vitest Test Report</h1>' +
  '<p>Membership Payment System - ' + CONFIG.title + '</p>' +
  '<p>Generated on ' + new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString('en-IN') + '</p>' +
  '</div>' +

  '<div class="summary">' +
  '<div class="stat-card" style="background:#f0fdf4;"><div class="number" style="color:#22c55e;">' + passedTests + '</div><div class="label">Passed</div></div>' +
  '<div class="stat-card" style="background:#fef2f2;"><div class="number" style="color:#ef4444;">' + failedTests + '</div><div class="label">Failed</div></div>' +
  '<div class="stat-card" style="background:#f5f3ff;"><div class="number" style="color:#8b5cf6;">' + totalTests + '</div><div class="label">Total</div></div>' +
  '<div class="stat-card" style="background:#eff6ff;"><div class="number" style="color:#3b82f6;">' + testSuites.length + '</div><div class="label">Test Files</div></div>' +
  '<div class="stat-card" style="background:#fefce8;"><div class="number" style="color:#eab308;">' + formatDuration(totalDuration) + '</div><div class="label">Duration</div></div>' +
  '</div>' +

  '<div class="section"><h2>Test Suites</h2>' +
  testSuites.map(function(s) {
    return '<div class="suite">' +
      '<div class="suite-header">' +
      '<span class="suite-name">' + statusIcon(s.status) + ' ' + s.name + '</span>' +
      '<span class="suite-time">' + s.tests.filter(function(t) { return t.status === 'passed'; }).length + '/' + s.tests.length + ' passed &bull; ' + formatDuration(s.duration) + '</span>' +
      '</div>' +
      buildTestHTML(s.tests) +
      '</div>';
  }).join('') +
  '</div>' +

  '<div class="footer">Generated by Vitest Test Report Generator &bull; ' + new Date().toISOString() + '</div>' +
  '</body></html>';

(async () => {
  const reportHtmlPath = path.join(baseDir, 'test-report.html');
  const pdfPath = path.join(baseDir, 'test-report.pdf');

  fs.writeFileSync(reportHtmlPath, html, 'utf-8');
  console.log('Static HTML report generated.');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const fileUrl = 'file:///' + reportHtmlPath.split(path.sep).join('/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });

  console.log('PDF saved to: ' + pdfPath);
  await browser.close();
})();
