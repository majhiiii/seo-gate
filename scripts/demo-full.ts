import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { startFixtureServer } from '../fixtures/test-site/server.js';
import { crawlTarget } from '../src/crawl/fetcher.js';
import { runChecks } from '../src/checks/runner.js';
import { closeBrowser } from '../src/render/browser.js';
import { auditPagePerformance, diffPerformance } from '../src/lighthouse/runner.js';
import { diffFindings, evaluateGate } from '../src/baseline/diff.js';
import { buildRunResult, writeJsonReport } from '../src/report/json.js';
import { generateMarkdownReport, writeMarkdownReport } from '../src/report/markdown.js';
import { generateHtmlReport, writeHtmlReport } from '../src/report/html.js';
import { SeoGateConfigSchema } from '../src/config/schema.js';
import type { Finding } from '../src/types.js';

async function main() {
  const startTime = Date.now();
  console.log(pc.bold('══════════════════════════════════════════════════════════════════'));
  console.log(pc.bold(' 🚀 seo-gate v0.1.0 Full End-to-End Architectural Demo'));
  console.log(pc.bold('══════════════════════════════════════════════════════════════════\n'));

  // 1. Launch local test fixture server
  const fixture = await startFixtureServer();
  const baseUrl = fixture.baseUrl;
  console.log(pc.green(`🌐 Local fixture server running at: ${pc.bold(baseUrl)}\n`));

  try {
    // 2. Load and parse configuration
    const config = SeoGateConfigSchema.parse({
      target: baseUrl,
      mode: 'regression',
      pages: {
        include: [
          '/',
          '/about',
          '/accidental-noindex-meta',
          '/rendered-vs-raw-js-only',
          '/structured-data-missing-field',
          '/hreflang-broken-en',
          '/hreflang-broken-es',
          '/redirect-chain-1'
        ],
        critical: ['/', '/rendered-vs-raw-js-only'],
        sitemap: false
      },
      budgets: {
        lcpMs: 2500,
        cls: 0.1,
        tbtMs: 300,
        totalJsKb: 500,
        totalImageKb: 1000,
        tolerancePercent: 10,
        runs: 2,
        profile: 'mobile'
      },
      ignore: [
        { check: 'title-length-short', url: '/legal/*', reason: 'Approved legal disclaimer text', expires: '2027-12-31' }
      ]
    });

    // 3. Execute Polite Crawl & Playwright Hydration
    console.log(pc.cyan('🔍 [Stage 1] Crawling target & hydrating critical pages via Playwright Chromium...'));
    const pages = await crawlTarget(config);
    console.log(pc.green(`   ✓ Fetched ${pages.length} pages (Raw HTML + Hydrated Chromium DOM)\n`));

    // 4. Execute 11 Pure Core Checks
    console.log(pc.cyan('⚙️  [Stage 2] Executing 11 Pure Core SEO Checks (Zero I/O)...'));
    const checkResults = runChecks(pages, config);
    console.log(pc.green(`   ✓ Checked ${pages.length} pages: ${checkResults.findings.length} total findings detected\n`));

    // 5. Execute Programmatic Lighthouse Lab Performance Audits
    console.log(pc.cyan('⚡ [Stage 3] Running Lighthouse Lab Performance Audits (2 runs median)...'));
    const perfAudit = await auditPagePerformance(`${baseUrl}/`, 2, 'mobile');
    console.log(pc.green(`   ✓ Page:        ${perfAudit.url}`));
    console.log(`     LCP:         ${perfAudit.metrics.lcpMs} ms`);
    console.log(`     CLS:         ${perfAudit.metrics.cls}`);
    console.log(`     TBT:         ${perfAudit.metrics.tbtMs} ms`);
    console.log(`     Total JS:    ${perfAudit.metrics.totalJsKb} kB`);
    console.log(`     Total Image: ${perfAudit.metrics.totalImageKb} kB\n`);

    // 6. Simulate Pre-existing Baseline & Evaluate Differential Gate
    console.log(pc.cyan('🛡️  [Stage 4] Performing Differential Regression Analysis vs Baseline...'));
    // Baseline contains an existing technical debt issue (redirect chain)
    const mockBaselineFindings: Finding[] = [
      {
        checkId: 'http-redirect-chain',
        url: `${baseUrl}/redirect-chain-1`,
        severity: 'warn',
        message: 'Redirect chain detected: 2 hops',
        evidence: '301 -> 301 -> 200',
        fixHint: 'Point links directly to destination',
        docsLink: 'https://example.com/docs'
      }
    ];

    const diffResult = diffFindings(checkResults.findings, mockBaselineFindings);
    const totalErrors = checkResults.findings.filter((f) => f.severity === 'error').length;
    const passed = evaluateGate(config.mode, diffResult, totalErrors);

    console.log(pc.bold('══════════════════════════════════════════════════════════════════'));
    console.log(pc.bold('                   GATE DECISION SUMMARY                          '));
    console.log(pc.bold('══════════════════════════════════════════════════════════════════'));
    console.log(` Gate Mode:       ${pc.bold(config.mode)}`);
    console.log(` Audited Pages:   ${pages.length}`);
    console.log(` Total Findings:  ${checkResults.findings.length}`);
    console.log(` New Regressions: ${diffResult.regressions.length > 0 ? pc.red(diffResult.regressions.length.toString()) : pc.green('0')}`);
    console.log(` Pre-existing:    ${pc.dim(diffResult.unchangedFindings.length.toString())}`);
    console.log(` Gate Status:     ${passed ? pc.green('PASSED') : pc.red('FAILED (Regressions Block Build)')}`);
    console.log(pc.bold('══════════════════════════════════════════════════════════════════\n'));

    // 7. Output All 3 Report Formats
    console.log(pc.cyan('📊 [Stage 5] Generating Multi-Format Reports...'));
    const reportsDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));

    // JSON
    const jsonPath = path.join(reportsDir, 'full-demo-report.json');
    const runResult = buildRunResult({
      target: config.target,
      mode: config.mode,
      totalPages: pages.length,
      findings: checkResults.findings,
      regressions: diffResult.regressions,
      performance: [perfAudit],
      ignoredCount: checkResults.ignoredCount
    });
    runResult.passed = passed;
    writeJsonReport(runResult, jsonPath);
    console.log(pc.green(`   ✓ Wrote JSON report:     ${jsonPath}`));

    // Markdown
    const mdPath = path.join(reportsDir, 'full-demo-report.md');
    const mdContent = generateMarkdownReport({
      target: config.target,
      mode: config.mode,
      totalPages: pages.length,
      passed,
      findings: checkResults.findings,
      diffResult,
      performance: [perfAudit],
      ignoredCount: checkResults.ignoredCount,
      activeIgnores: config.ignore,
      htmlReportLink: 'reports/full-demo-report.html'
    });
    writeMarkdownReport(mdContent, mdPath);
    console.log(pc.green(`   ✓ Wrote Markdown report: ${mdPath}`));

    // HTML
    const htmlPath = path.join(reportsDir, 'full-demo-report.html');
    const htmlContent = generateHtmlReport({
      target: config.target,
      mode: config.mode,
      totalPages: pages.length,
      passed,
      findings: checkResults.findings,
      diffResult,
      performance: [perfAudit],
      ignoredCount: checkResults.ignoredCount,
      activeIgnores: config.ignore,
      durationSeconds
    });
    writeHtmlReport(htmlContent, htmlPath);
    console.log(pc.green(`   ✓ Wrote Standalone HTML: ${htmlPath} (Zero CDN dependencies)`));

    console.log(pc.bold('\n══════════════════════════════════════════════════════════════════'));
    console.log(pc.green(' 🎉 Phase 6 End-to-End Demo Complete in ' + durationSeconds + 's!'));
    console.log(pc.bold('══════════════════════════════════════════════════════════════════\n'));

  } finally {
    await closeBrowser();
    await fixture.stop();
  }
}

main().catch((err) => {
  console.error('Fatal demo failure:', err);
  process.exit(1);
});
