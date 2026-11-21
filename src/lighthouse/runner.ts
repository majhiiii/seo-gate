import net from 'net';
import { chromium, type Browser } from 'playwright';
import lighthouse from 'lighthouse';
import type { PagePerformanceAudit, PerformanceBudgets, PerformanceMetrics, PerformanceRegression } from '../types.js';

export function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 9222;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4));
}

export interface ResourceSummaryItem {
  resourceType: string;
  transferSize: number;
}

/**
 * Executes a single Lighthouse run on a running Chromium instance via CDP.
 */
export async function runLighthouseSingle(
  url: string,
  port: number,
  profile: 'mobile' | 'desktop' = 'mobile'
): Promise<PerformanceMetrics> {
  const flags = {
    port,
    output: 'json' as const,
    onlyCategories: ['performance'],
    formFactor: profile,
    screenEmulation: profile === 'desktop' ? { disabled: true } : undefined,
  };

  const runnerResult = await (lighthouse as any)(url, flags);
  if (!runnerResult || !runnerResult.lhr) {
    throw new Error(`Lighthouse failed to generate a report for URL: ${url}`);
  }

  const audits = runnerResult.lhr.audits;
  const lcpMs = Math.round(audits['largest-contentful-paint']?.numericValue ?? 0);
  const cls = Number((audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(4));
  const tbtMs = Math.round(audits['total-blocking-time']?.numericValue ?? 0);

  const resourceSummary = audits['resource-summary']?.details?.items as ResourceSummaryItem[] | undefined;
  const scriptItem = resourceSummary?.find((i) => i.resourceType === 'script');
  const imageItem = resourceSummary?.find((i) => i.resourceType === 'image');

  const totalJsKb = Math.round((scriptItem?.transferSize ?? 0) / 1024);
  const totalImageKb = Math.round((imageItem?.transferSize ?? 0) / 1024);

  return {
    lcpMs,
    cls,
    tbtMs,
    totalJsKb,
    totalImageKb,
    profile,
  };
}

/**
 * Runs N iterations of Lighthouse against a target URL and calculates median lab metrics.
 */
export async function auditPagePerformance(
  url: string,
  runs: number = 3,
  profile: 'mobile' | 'desktop' = 'mobile'
): Promise<PagePerformanceAudit> {
  const port = await getAvailablePort();
  const browser: Browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${port}`],
  });

  try {
    // 1. Warm-up request to prime server and edge caches
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.close();
    } catch {
      // Warm-up failure is non-fatal; proceed to audit runs
    }

    const runResults: PerformanceMetrics[] = [];
    const count = Math.max(1, runs);

    for (let i = 0; i < count; i++) {
      const res = await runLighthouseSingle(url, port, profile);
      runResults.push(res);
    }

    const medianMetrics: PerformanceMetrics = {
      lcpMs: computeMedian(runResults.map((r) => r.lcpMs)),
      cls: computeMedian(runResults.map((r) => r.cls)),
      tbtMs: computeMedian(runResults.map((r) => r.tbtMs)),
      totalJsKb: computeMedian(runResults.map((r) => r.totalJsKb)),
      totalImageKb: computeMedian(runResults.map((r) => r.totalImageKb)),
      profile,
    };

    return {
      url,
      runs: count,
      metrics: medianMetrics,
    };
  } finally {
    await browser.close();
  }
}

export type MetricKey = 'lcpMs' | 'cls' | 'tbtMs' | 'totalJsKb' | 'totalImageKb';

/**
 * Compares current lab metrics against baseline snapshots and budgets.
 * Applies flaky protection by triggering a confirmation re-test when a regression is detected.
 */
export async function diffPerformance(
  currentAudits: PagePerformanceAudit[],
  baselineAudits?: PagePerformanceAudit[],
  budgets?: PerformanceBudgets,
  confirmFn?: (url: string) => Promise<PagePerformanceAudit>
): Promise<PerformanceRegression[]> {
  const regressions: PerformanceRegression[] = [];
  const tolerancePercent = budgets?.tolerancePercent ?? 10;
  const metricsToCheck: MetricKey[] = ['lcpMs', 'cls', 'tbtMs', 'totalJsKb', 'totalImageKb'];

  const budgetLimits: Record<MetricKey, number | undefined> = {
    lcpMs: budgets?.lcpMs ?? 2500,
    cls: budgets?.cls ?? 0.1,
    tbtMs: budgets?.tbtMs ?? 300,
    totalJsKb: budgets?.totalJsKb ?? 500,
    totalImageKb: budgets?.totalImageKb ?? 1000,
  };

  const baselineMap = new Map<string, PerformanceMetrics>();
  if (baselineAudits) {
    for (const b of baselineAudits) {
      try {
        const path = new URL(b.url).pathname;
        baselineMap.set(path, b.metrics);
      } catch {
        baselineMap.set(b.url, b.metrics);
      }
    }
  }

  for (const audit of currentAudits) {
    let urlPath = audit.url;
    try {
      urlPath = new URL(audit.url).pathname;
    } catch {
      // Keep raw url
    }

    const baseline = baselineMap.get(urlPath);
    let pageNeedsConfirmation = false;
    const candidates: Array<{
      metric: MetricKey;
      current: number;
      baselineVal?: number;
      budgetVal?: number;
      deltaPercent: number;
      message: string;
    }> = [];

    for (const metric of metricsToCheck) {
      const currentVal = audit.metrics[metric];
      const baselineVal = baseline ? baseline[metric] : undefined;
      const budgetVal = budgetLimits[metric];

      // 1. Check regression against baseline
      if (baselineVal !== undefined && baselineVal > 0) {
        const threshold = baselineVal * (1 + tolerancePercent / 100);
        if (currentVal > threshold) {
          const delta = Number((((currentVal - baselineVal) / baselineVal) * 100).toFixed(1));
          candidates.push({
            metric,
            current: currentVal,
            baselineVal,
            budgetVal,
            deltaPercent: delta,
            message: `Performance regression on ${metric}: ${currentVal} exceeds baseline (${baselineVal}) by ${delta}% (tolerance: ${tolerancePercent}%)`,
          });
          pageNeedsConfirmation = true;
          continue;
        }
      }

      // 2. Check budget violation if no baseline regression
      if (budgetVal !== undefined && currentVal > budgetVal) {
        const delta = Number((((currentVal - budgetVal) / budgetVal) * 100).toFixed(1));
        candidates.push({
          metric,
          current: currentVal,
          baselineVal,
          budgetVal,
          deltaPercent: delta,
          message: `Performance budget exceeded on ${metric}: ${currentVal} exceeds budget of ${budgetVal} (+${delta}%)`,
        });
        pageNeedsConfirmation = true;
      }
    }

    // 3. Flaky protection confirmation run
    let confirmAudit: PagePerformanceAudit | undefined;
    if (pageNeedsConfirmation && confirmFn) {
      try {
        confirmAudit = await confirmFn(audit.url);
      } catch {
        confirmAudit = undefined;
      }
    }

    for (const cand of candidates) {
      let reproduced = true;
      if (confirmAudit) {
        const recheckVal = confirmAudit.metrics[cand.metric];
        const baselineVal = cand.baselineVal;
        const budgetVal = cand.budgetVal;

        if (baselineVal !== undefined && baselineVal > 0) {
          const threshold = baselineVal * (1 + tolerancePercent / 100);
          reproduced = recheckVal > threshold;
        } else if (budgetVal !== undefined) {
          reproduced = recheckVal > budgetVal;
        }
      }

      regressions.push({
        url: audit.url,
        metric: cand.metric,
        current: cand.current,
        baseline: cand.baselineVal,
        budget: cand.budgetVal,
        tolerancePercent,
        deltaPercent: cand.deltaPercent,
        reproduced,
        message: cand.message + (reproduced ? ' [Confirmed in re-run]' : ' [Transient - Not reproduced in re-run]'),
      });
    }
  }

  return regressions;
}
