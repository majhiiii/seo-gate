import { startFixtureServer } from '../fixtures/test-site/server.js';
import { crawlTarget } from '../src/crawl/fetcher.js';
import { runChecks } from '../src/checks/runner.js';
import { closeBrowser } from '../src/render/browser.js';
import { SeoGateConfigSchema } from '../src/config/schema.js';

async function main() {
  console.log('==================================================================');
  console.log(' 🚀 seo-gate Phase 4 Live Demo: Headless Rendering & Advanced Checks');
  console.log('==================================================================\n');

  // 1. Start local fixture server
  const server = await startFixtureServer();
  const baseUrl = server.baseUrl;
  console.log(`🌐 Fixture server running at: ${baseUrl}\n`);

  try {
    const config = SeoGateConfigSchema.parse({
      target: baseUrl,
      mode: 'strict',
      pages: {
        include: [
          '/rendered-vs-raw-js-only',
          '/structured-data-clean',
          '/structured-data-missing-field',
          '/hreflang-broken-en',
          '/hreflang-broken-es'
        ],
        critical: ['/rendered-vs-raw-js-only', '/admin/dashboard'],
        sitemap: false
      },
      checks: {
        renderedVsRaw: {
          critical: ['h1', 'title', 'canonical', 'metaDescription']
        }
      }
    });

    console.log('🔍 Crawling pages with Playwright headless rendering on critical pages...\n');
    const pages = await crawlTarget(config);
    console.log(`✓ Fetched ${pages.length} pages (Raw HTML + Hydrated Chromium DOM)\n`);

    console.log('⚙️  Running Check Suite (11 deterministic checks)...\n');
    const result = runChecks(pages, config);
    const findings = result.findings;

    console.log('══════════════════════════════════════════════════════════════════');
    console.log(` 📋 ADVANCED FINDINGS DETECTED (${findings.length} total)`);
    console.log('══════════════════════════════════════════════════════════════════\n');

    for (const f of findings) {
      const badge = f.severity === 'error' ? '❌ [ERROR]' : '⚠️  [WARN]';
      console.log(`${badge} ${f.checkId}`);
      console.log(`   Page:     ${f.url}`);
      console.log(`   Message:  ${f.message}`);
      if (f.evidence) {
        console.log(`   Evidence: ${f.evidence.replace(/\n/g, ' ')}`);
      }
      if (f.fixHint) {
        console.log(`   Fix Hint: ${f.fixHint}`);
      }
      console.log('');
    }

    console.log('══════════════════════════════════════════════════════════════════');
    console.log(' ✨ Key Capabilities Demonstrated in Phase 4:');
    console.log(' 1. Raw vs. Rendered (Hydration Gap): Flagged elements that only exist after JS');
    console.log(' 2. Structured Data (JSON-LD): Caught missing recommended schema.org properties');
    console.log(' 3. Hreflang Reciprocity: Caught missing reciprocal return tag across languages');
    console.log(' 4. Robots.txt Audit: Verified critical paths against disallow directives');
    console.log('==================================================================\n');

  } finally {
    await closeBrowser();
    await server.stop();
  }
}

main().catch((err) => {
  console.error('Fatal demo error:', err);
  process.exit(1);
});
