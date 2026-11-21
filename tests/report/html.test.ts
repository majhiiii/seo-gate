import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { generateHtmlReport, writeHtmlReport } from '../../src/report/html.js';
import type { Finding, PagePerformanceAudit, PerformanceRegression } from '../../src/types.js';

describe('HTML Report Generator', () => {
  const tempHtmlPath = path.resolve(process.cwd(), 'temp-test-report.html');

  afterEach(() => {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  });

  const sampleFinding: Finding = {
    checkId: 'canonical-missing',
    url: 'https://example.com/test-page',
    severity: 'error',
    message: 'Page is missing a canonical link tag',
    evidence: '<head> without canonical',
    fixHint: 'Add a self-referencing <link rel="canonical"> tag',
    docsLink: 'https://example.com/docs/canonical',
  };

  const samplePerformance: PagePerformanceAudit = {
    url: 'https://example.com/test-page',
    runs: 3,
    metrics: {
      lcpMs: 2100,
      cls: 0.04,
      tbtMs: 120,
      totalJsKb: 340,
      totalImageKb: 450,
      profile: 'mobile',
    },
  };

  const samplePerfRegression: PerformanceRegression = {
    url: 'https://example.com/test-page',
    metric: 'lcpMs',
    current: 2800,
    baseline: 2100,
    budget: 2500,
    tolerancePercent: 10,
    deltaPercent: 33.3,
    reproduced: true,
    message: 'Performance regression on lcpMs [Confirmed in re-run]',
  };

  it('generates a complete HTML report with header, summary cards, and findings', () => {
    const html = generateHtmlReport({
      target: 'https://example.com',
      mode: 'strict',
      totalPages: 10,
      passed: false,
      findings: [sampleFinding],
      performance: [samplePerformance],
      performanceRegressions: [samplePerfRegression],
      activeIgnores: [
        { check: 'title-length', url: '/legal/*', reason: 'Fixed legal text', expires: '2027-01-01' },
      ],
      durationSeconds: 4.5,
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('GATE FAILED');
    expect(html).toContain('https://example.com');
    expect(html).toContain('Pages Audited');
    expect(html).toContain('canonical-missing');
    expect(html).toContain('&lt;head&gt; without canonical');
    expect(html).toContain('Add a self-referencing &lt;link rel=&quot;canonical&quot;&gt; tag');
    expect(html).toContain('2100 ms');
    expect(html).toContain('Fixed legal text');
  });

  it('generates a clean passing report when no findings are detected', () => {
    const html = generateHtmlReport({
      target: 'https://clean.example.com',
      mode: 'regression',
      totalPages: 5,
      passed: true,
      findings: [],
    });

    expect(html).toContain('GATE PASSED');
    expect(html).toContain('No SEO findings detected!');
    expect(html).toContain('All pages passed audited quality standards.');
  });

  it('writes HTML report to file successfully', () => {
    const html = generateHtmlReport({
      target: 'https://file.example.com',
      mode: 'report',
      totalPages: 1,
      passed: true,
      findings: [],
    });

    writeHtmlReport(html, tempHtmlPath);
    expect(fs.existsSync(tempHtmlPath)).toBe(true);
    const content = fs.readFileSync(tempHtmlPath, 'utf8');
    expect(content).toContain('https://file.example.com');
  });
});
