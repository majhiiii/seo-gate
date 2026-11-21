import fs from 'node:fs';
import path from 'node:path';
import { startFixtureServer } from '../fixtures/test-site/server.js';
import { auditPagePerformance, diffPerformance } from '../src/lighthouse/runner.js';
import { generateHtmlReport, writeHtmlReport } from '../src/report/html.js';
import { runChecks } from '../src/checks/runner.js';
import { crawlTarget } from '../src/crawl/fetcher.js';
import { closeBrowser } from '../src/render/browser.js';
import { SeoGateConfigSchema } from '../src/config/schema.js';
import type { PagePerformanceAudit } from '../src/types.js';

async function main() {
  console.log('==================================================================');
  console.log(' 🚀 seo-gate Phase 5 Live Demo: Lighthouse Budgets & HTML Report');
  console.log('==================================================================\n');

  // 1. Start local fixture server
  const server = await startFixtureServer();
  const baseUrl = server.baseUrl;
  console.log(`🌐 Fixture server running at: ${baseUrl}\n`);

  try {
    const config = SeoGateConfigSchema.parse({
      target: baseUrl,
      mode: 'regression',
      pages: {
        include: ['/', '/about', '/rendered-vs-raw-js-only'],
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
      }
    });

    console.log('🔍 Auditing pages and running core checks...');
    const pages = await crawlTarget(config);
    const checkResults = runChecks(pages, config);
    console.log(`✓ Fetched ${pages.length} pages; detected ${checkResults.findings.length} findings\n`);

    console.log('⚡ Running Lighthouse Lab Performance Audits (2 runs median)...');
    const targetUrl = `${baseUrl}/`;
    const perfAudit = await auditPagePerformance(targetUrl, 2, 'mobile');
    console.log(`   Audited:     ${perfAudit.url}`);
    console.log(`   LCP:         ${perfAudit.metrics.lcpMs} ms`);
    console.log(`   CLS:         ${perfAudit.metrics.cls}`);
    console.log(`   TBT:         ${perfAudit.metrics.tbtMs} ms`);
    console.log(`   Total JS:    ${perfAudit.metrics.totalJsKb} kB`);
    console.log(`   Total Image: ${perfAudit.metrics.totalImageKb} kB\n`);

    // 2. Demonstrate Flaky-Protection Diffing
    console.log('🛡️  Evaluating Performance Diffs with Flaky Protection...');
    const baselineMock: PagePerformanceAudit = {
      url: targetUrl,
      runs: 2,
      metrics: {
        lcpMs: Math.round(perfAudit.metrics.lcpMs * 0.7), // Baseline was faster to test regression
        cls: 0.01,
        tbtMs: 50,
        totalJsKb: 200,
        totalImageKb: 300,
        profile: 'mobile'
      }
    };

    const regressions = await diffPerformance(
      [perfAudit],
      [baselineMock],
      config.budgets,
      async (retestUrl) => auditPagePerformance(retestUrl, 1, 'mobile') // confirmation run
    );

    console.log(`✓ Evaluated ${regressions.length} potential regressions vs baseline (with confirmation re-run)\n`);
    for (const r of regressions) {
      const badge = r.reproduced ? '🚨 [CONFIRMED REGRESSION]' : '⚠️ [TRANSIENT]';
      console.log(`   ${badge} ${r.metric}: current=${r.current}, baseline=${r.baseline} (+${r.deltaPercent}%)`);
    }

    // 3. Generate Standalone HTML Report
    console.log('\n📊 Generating Standalone Interactive HTML Report...');
    const outDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const htmlReportPath = path.join(outDir, 'demo-phase5-report.html');

    const htmlContent = generateHtmlReport({
      target: baseUrl,
      mode: 'regression',
      totalPages: pages.length,
      passed: regressions.filter(r => r.reproduced).length === 0,
      findings: checkResults.findings,
      performance: [perfAudit],
      performanceRegressions: regressions,
      durationSeconds: 8.2,
      activeIgnores: [
        { check: 'title-length', url: '/legal/*', reason: 'Fixed legal disclaimer text', expires: '2027-01-01' }
      ]
    });

    writeHtmlReport(htmlContent, htmlReportPath);
    console.log(`✅ Interactive HTML Report generated at: ${htmlReportPath}`);
    console.log(`   File size: ${(Buffer.byteLength(htmlContent) / 1024).toFixed(1)} kB (Zero external CDN dependencies)`);

    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log(' ✨ Key Capabilities Demonstrated in Phase 5:');
    console.log(' 1. Programmatic Lighthouse CDP audits on Playwright Chromium');
    console.log(' 2. Median-of-N averaging to eliminate virtualized CI runner noise');
    console.log(' 3. Flaky protection with automatic confirmation re-testing');
    console.log(' 4. Single-file interactive HTML report with embedded CSS/JS and search');
    console.log('==================================================================\n');

  } finally {
    await closeBrowser();
    await server.stop();
  }
}

main().catch((err) => {
  console.error('Fatal Phase 5 demo error:', err);
  process.exit(1);
});
