import { describe, it, expect } from 'vitest';
import { computeFindingFingerprint, diffFindings, evaluateGate } from '../../src/baseline/diff.js';
import type { Finding } from '../../src/types.js';

describe('Baseline Diff Engine', () => {
  describe('computeFindingFingerprint', () => {
    it('normalizes preview hostnames so findings can be correlated across environments', () => {
      const f1: Finding = {
        checkId: 'title-missing',
        url: 'https://preview-123.store.com/products/shoes',
        severity: 'error',
        message: 'Missing title',
        evidence: '',
        fixHint: '',
        docsLink: '',
      };
      const f2: Finding = {
        checkId: 'title-missing',
        url: 'https://www.production-store.com/products/shoes',
        severity: 'error',
        message: 'Missing title',
        evidence: '',
        fixHint: '',
        docsLink: '',
      };

      expect(computeFindingFingerprint(f1)).toBe('title-missing::/products/shoes');
      expect(computeFindingFingerprint(f2)).toBe('title-missing::/products/shoes');
      expect(computeFindingFingerprint(f1)).toBe(computeFindingFingerprint(f2));
    });

    it('retains query parameters when present', () => {
      const f: Finding = {
        checkId: 'canonical-relative',
        url: 'https://example.com/search?q=boots',
        severity: 'error',
        message: '',
        evidence: '',
        fixHint: '',
        docsLink: '',
      };
      expect(computeFindingFingerprint(f)).toBe('canonical-relative::/search?q=boots');
    });
  });

  describe('diffFindings', () => {
    const finding1: Finding = {
      checkId: 'meta-description-short',
      url: 'https://example.com/about',
      severity: 'warn',
      message: 'Short description',
      evidence: '',
      fixHint: '',
      docsLink: '',
    };
    const finding2: Finding = {
      checkId: 'noindex-meta',
      url: 'https://example.com/shoes',
      severity: 'error',
      message: 'Accidental noindex',
      evidence: '',
      fixHint: '',
      docsLink: '',
    };

    it('reports zero regressions when current findings match baseline', () => {
      const current = [finding1];
      const baseline = [finding1];

      const diff = diffFindings(current, baseline);
      expect(diff.regressions).toHaveLength(0);
      expect(diff.newFindings).toHaveLength(0);
      expect(diff.unchangedFindings).toHaveLength(1);
      expect(diff.resolvedFindings).toHaveLength(0);
    });

    it('identifies new errors as regressions', () => {
      const current = [finding1, finding2];
      const baseline = [finding1];

      const diff = diffFindings(current, baseline);
      expect(diff.regressions).toHaveLength(1);
      expect(diff.regressions[0].checkId).toBe('noindex-meta');
      expect(diff.unchangedFindings).toHaveLength(1);
    });

    it('identifies resolved issues present in baseline but missing in current', () => {
      const current: Finding[] = [];
      const baseline = [finding1];

      const diff = diffFindings(current, baseline);
      expect(diff.resolvedFindings).toHaveLength(1);
      expect(diff.resolvedFindings[0].checkId).toBe('meta-description-short');
      expect(diff.regressions).toHaveLength(0);
    });
  });

  describe('evaluateGate', () => {
    const emptyDiff = {
      newFindings: [],
      resolvedFindings: [],
      unchangedFindings: [],
      regressions: [],
    };

    const diffWithRegression = {
      ...emptyDiff,
      regressions: [
        {
          checkId: 'noindex-meta',
          url: 'https://example.com/shoes',
          severity: 'error' as const,
          message: 'noindex',
          evidence: '',
          fixHint: '',
          docsLink: '',
        },
      ],
    };

    it('strict mode fails if total errors > 0 even without regressions', () => {
      expect(evaluateGate('strict', emptyDiff, 1)).toBe(false);
      expect(evaluateGate('strict', emptyDiff, 0)).toBe(true);
    });

    it('regression mode passes with pre-existing errors as long as regressions == 0', () => {
      // 5 pre-existing errors in baseline, but 0 regressions
      expect(evaluateGate('regression', emptyDiff, 5)).toBe(true);
      // 1 new regression fails the gate
      expect(evaluateGate('regression', diffWithRegression, 1)).toBe(false);
    });

    it('report mode always passes', () => {
      expect(evaluateGate('report', diffWithRegression, 10)).toBe(true);
    });
  });
});
