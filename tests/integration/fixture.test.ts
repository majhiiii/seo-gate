import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFixtureServer, type FixtureServerInstance } from '../../fixtures/test-site/server.js';
import { crawlTarget } from '../../src/crawl/fetcher.js';
import { runChecks } from '../../src/checks/runner.js';
import { buildRunResult } from '../../src/report/json.js';
import type { SeoGateConfig } from '../../src/types.js';

describe('End-to-End Fixture Site Integration Test', () => {
  let fixture: FixtureServerInstance;

  beforeAll(async () => {
    fixture = await startFixtureServer(0);
  });

  afterAll(async () => {
    await fixture.stop();
  });

  it('runs against fixture site and detects exact planted SEO violations', async () => {
    const config: SeoGateConfig = {
      target: fixture.baseUrl,
      mode: 'strict',
      pages: {
        include: [
          '/',
          '/about',
          '/missing-title',
          '/short-title',
          '/missing-description',
          '/missing-h1',
          '/multiple-h1',
          '/missing-canonical',
          '/relative-canonical',
          '/accidental-noindex-meta',
          '/accidental-noindex-header',
          '/redirect-chain-1',
        ],
        sitemap: false,
        crawl: {
          concurrency: 4,
          delayMs: 20,
        },
      },
      checks: {
        title: { min: 20, max: 65, unique: true },
        metaDescription: { min: 70, max: 160, unique: true },
        h1: { requireExactOne: true },
        canonical: { requireSelfReferencing: true },
        noindex: { allowOnStaging: false },
      },
      severity_overrides: {},
      ignore: [],
    };

    // 1. Crawl
    const pages = await crawlTarget(config);
    expect(pages.length).toBeGreaterThanOrEqual(10);

    // 2. Run checks
    const checkResults = runChecks(pages, config);

    // 3. Verify clean root page has zero errors
    const rootFindings = checkResults.findings.filter((f) => f.url === `${fixture.baseUrl}/`);
    expect(rootFindings.filter((f) => f.severity === 'error')).toHaveLength(0);

    // 4. Assert exact planted findings
    const checkIds = checkResults.findings.map((f) => f.checkId);
    expect(checkIds).toContain('title-missing'); // from /missing-title
    expect(checkIds).toContain('title-length-short'); // from /short-title
    expect(checkIds).toContain('meta-description-missing'); // from /missing-description
    expect(checkIds).toContain('h1-missing'); // from /missing-h1
    expect(checkIds).toContain('h1-multiple'); // from /multiple-h1
    expect(checkIds).toContain('canonical-missing'); // from /missing-canonical
    expect(checkIds).toContain('canonical-relative'); // from /relative-canonical
    expect(checkIds).toContain('noindex-meta'); // from /accidental-noindex-meta
    expect(checkIds).toContain('noindex-header'); // from /accidental-noindex-header
    expect(checkIds).toContain('http-redirect-chain'); // from /redirect-chain-1

    // 5. Build run result in strict mode
    const runResult = buildRunResult({
      target: config.target,
      mode: 'strict',
      totalPages: pages.length,
      findings: checkResults.findings,
    });

    expect(runResult.passed).toBe(false);
    expect(runResult.summary.errors).toBeGreaterThan(0);
  });

  it('honors documented ignore rules with reason', async () => {
    const configWithIgnore: SeoGateConfig = {
      target: fixture.baseUrl,
      mode: 'strict',
      pages: {
        include: ['/missing-title'],
        sitemap: false,
      },
      ignore: [
        {
          check: 'title-missing',
          url: '/missing-title',
          reason: 'Documented test exception for legacy endpoint',
        },
      ],
    };

    const pages = await crawlTarget(configWithIgnore);
    const checkResults = runChecks(pages, configWithIgnore);

    expect(checkResults.ignoredCount).toBe(1);
    const remainingMissingTitle = checkResults.findings.filter((f) => f.checkId === 'title-missing');
    expect(remainingMissingTitle).toHaveLength(0);
  });
});
