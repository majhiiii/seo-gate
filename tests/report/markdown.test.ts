import { describe, it, expect } from 'vitest';
import { generateMarkdownReport } from '../../src/report/markdown.js';
import type { Finding } from '../../src/types.js';

describe('Markdown Report Generator', () => {
  const sampleError: Finding = {
    checkId: 'noindex-meta',
    url: 'https://preview.example.com/shoes',
    severity: 'error',
    message: 'Page contains accidental noindex',
    evidence: '<meta name="robots" content="noindex">',
    fixHint: 'Remove noindex before production',
    docsLink: 'https://developers.google.com/search',
  };

  const sampleWarn: Finding = {
    checkId: 'meta-description-short',
    url: 'https://preview.example.com/about',
    severity: 'warn',
    message: 'Description is too short',
    evidence: '<meta name="description" content="Hi">',
    fixHint: 'Expand description',
    docsLink: '',
  };

  it('generates passing report with green header and summary metrics', () => {
    const report = generateMarkdownReport({
      target: 'https://preview.example.com',
      mode: 'strict',
      totalPages: 10,
      passed: true,
      findings: [],
    });

    expect(report).toContain('## 🟢 seo-gate: Gate Passed');
    expect(report).toContain('| **Target URL** | `https://preview.example.com` |');
    expect(report).toContain('| **New Regressions** | ✅ 0 |');
  });

  it('generates failing report with regression table when regressions exist', () => {
    const report = generateMarkdownReport({
      target: 'https://preview.example.com',
      mode: 'regression',
      totalPages: 10,
      passed: false,
      findings: [sampleError],
      diffResult: {
        newFindings: [sampleError],
        resolvedFindings: [],
        unchangedFindings: [],
        regressions: [sampleError],
      },
    });

    expect(report).toContain('## 🔴 seo-gate: Gate Failed');
    expect(report).toContain('### 🚨 New Regressions Requiring Attention');
    expect(report).toContain('| `noindex-meta` |');
    expect(report).toContain('Remove noindex before production');
  });

  it('collapses pre-existing debt and resolved issues into details sections', () => {
    const report = generateMarkdownReport({
      target: 'https://preview.example.com',
      mode: 'regression',
      totalPages: 10,
      passed: true,
      findings: [sampleWarn],
      diffResult: {
        newFindings: [],
        resolvedFindings: [sampleError],
        unchangedFindings: [sampleWarn],
        regressions: [],
      },
      ignoredCount: 1,
      activeIgnores: [
        {
          check: 'title-short',
          url: '/legal/*',
          reason: 'Fixed statutory disclaimer title',
          expires: '2027-12-31',
        },
      ],
    });

    expect(report).toContain('<summary><b>🎉 Resolved Issues (1)</b></summary>');
    expect(report).toContain('<summary><b>📋 Pre-existing Technical Debt from Baseline (1)</b></summary>');
    expect(report).toContain('<summary><b>🛡️ Active Documented Ignores (1)</b></summary>');
    expect(report).toContain('Fixed statutory disclaimer title');
  });
});
