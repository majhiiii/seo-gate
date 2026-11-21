import { describe, it, expect, vi } from 'vitest';
import {
  computeMedian,
  diffPerformance,
} from '../../src/lighthouse/runner.js';
import type { PagePerformanceAudit, PerformanceBudgets } from '../../src/types.js';

describe('Lighthouse Runner & Performance Diffing', () => {
  describe('computeMedian', () => {
    it('returns 0 for empty array', () => {
      expect(computeMedian([])).toBe(0);
    });

    it('returns the exact value for a single item', () => {
      expect(computeMedian([42])).toBe(42);
    });

    it('returns middle value for odd-length array', () => {
      expect(computeMedian([300, 100, 200])).toBe(200);
    });

    it('returns the average of two middle values for even-length array', () => {
      expect(computeMedian([10, 30, 20, 40])).toBe(25);
    });
  });

  describe('diffPerformance', () => {
    const baselineAudit: PagePerformanceAudit = {
      url: 'https://example.com/products',
      runs: 3,
      metrics: {
        lcpMs: 2000,
        cls: 0.05,
        tbtMs: 150,
        totalJsKb: 300,
        totalImageKb: 500,
        profile: 'mobile',
      },
    };

    const budgets: PerformanceBudgets = {
      lcpMs: 2500,
      cls: 0.1,
      tbtMs: 300,
      totalJsKb: 500,
      totalImageKb: 1000,
      tolerancePercent: 10,
    };

    it('reports no regressions when current metrics match or improve upon baseline', async () => {
      const currentAudit: PagePerformanceAudit = {
        url: 'https://example.com/products',
        runs: 3,
        metrics: {
          lcpMs: 1950,
          cls: 0.04,
          tbtMs: 140,
          totalJsKb: 290,
          totalImageKb: 480,
          profile: 'mobile',
        },
      };

      const regressions = await diffPerformance([currentAudit], [baselineAudit], budgets);
      expect(regressions).toHaveLength(0);
    });

    it('detects a regression when metric exceeds baseline by more than tolerance', async () => {
      const currentAudit: PagePerformanceAudit = {
        url: 'https://example.com/products',
        runs: 3,
        metrics: {
          lcpMs: 2400, // +20% vs baseline (2000), tolerance is 10%
          cls: 0.05,
          tbtMs: 150,
          totalJsKb: 300,
          totalImageKb: 500,
          profile: 'mobile',
        },
      };

      const regressions = await diffPerformance([currentAudit], [baselineAudit], budgets);
      expect(regressions).toHaveLength(1);
      expect(regressions[0].metric).toBe('lcpMs');
      expect(regressions[0].current).toBe(2400);
      expect(regressions[0].baseline).toBe(2000);
      expect(regressions[0].deltaPercent).toBe(20);
      expect(regressions[0].reproduced).toBe(true);
    });

    it('detects budget exceedance when metric exceeds absolute budget limit', async () => {
      const currentAudit: PagePerformanceAudit = {
        url: 'https://example.com/new-page',
        runs: 3,
        metrics: {
          lcpMs: 3200, // Budget is 2500
          cls: 0.02,
          tbtMs: 100,
          totalJsKb: 200,
          totalImageKb: 300,
          profile: 'mobile',
        },
      };

      // No baseline available for new page
      const regressions = await diffPerformance([currentAudit], [], budgets);
      expect(regressions).toHaveLength(1);
      expect(regressions[0].metric).toBe('lcpMs');
      expect(regressions[0].budget).toBe(2500);
      expect(regressions[0].reproduced).toBe(true);
    });

    it('applies flaky protection: marks regression transient if not reproduced in confirm run', async () => {
      const currentAudit: PagePerformanceAudit = {
        url: 'https://example.com/products',
        runs: 3,
        metrics: {
          lcpMs: 2300, // +15% vs baseline (2000)
          cls: 0.05,
          tbtMs: 150,
          totalJsKb: 300,
          totalImageKb: 500,
          profile: 'mobile',
        },
      };

      // Confirmation function returns normalized value within tolerance
      const confirmFn = vi.fn().mockResolvedValue({
        url: 'https://example.com/products',
        runs: 3,
        metrics: {
          lcpMs: 2050, // Only +2.5%, within tolerance
          cls: 0.05,
          tbtMs: 150,
          totalJsKb: 300,
          totalImageKb: 500,
          profile: 'mobile',
        },
      });

      const regressions = await diffPerformance([currentAudit], [baselineAudit], budgets, confirmFn);
      expect(confirmFn).toHaveBeenCalledTimes(1);
      expect(regressions).toHaveLength(1);
      expect(regressions[0].metric).toBe('lcpMs');
      expect(regressions[0].reproduced).toBe(false); // Transient!
      expect(regressions[0].message).toContain('Transient');
    });

    it('applies flaky protection: marks regression confirmed when reproduced in confirm run', async () => {
      const currentAudit: PagePerformanceAudit = {
        url: 'https://example.com/products',
        runs: 3,
        metrics: {
          lcpMs: 2400,
          cls: 0.05,
          tbtMs: 150,
          totalJsKb: 300,
          totalImageKb: 500,
          profile: 'mobile',
        },
      };

      // Confirmation run also reproduces regression
      const confirmFn = vi.fn().mockResolvedValue({
        url: 'https://example.com/products',
        runs: 3,
        metrics: {
          lcpMs: 2450,
          cls: 0.05,
          tbtMs: 150,
          totalJsKb: 300,
          totalImageKb: 500,
          profile: 'mobile',
        },
      });

      const regressions = await diffPerformance([currentAudit], [baselineAudit], budgets, confirmFn);
      expect(confirmFn).toHaveBeenCalledTimes(1);
      expect(regressions).toHaveLength(1);
      expect(regressions[0].reproduced).toBe(true);
      expect(regressions[0].message).toContain('Confirmed');
    });
  });
});
