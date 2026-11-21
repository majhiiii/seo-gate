import type { Finding, PagePerformanceAudit, PerformanceRegression } from '../types.js';

export interface BaselineSnapshot {
  schemaVersion: 1;
  createdAt: string;
  target: string;
  totalPages: number;
  findings: Finding[];
  performance?: PagePerformanceAudit[];
}

export interface DiffResult {
  /** Newly introduced findings that did not exist in the baseline */
  newFindings: Finding[];
  /** Findings present in the baseline that have been resolved / fixed */
  resolvedFindings: Finding[];
  /** Findings present in both the baseline and current run */
  unchangedFindings: Finding[];
  /** New findings with severity 'error' that trigger a gate failure */
  regressions: Finding[];
  /** Performance metric regressions vs baseline */
  performanceRegressions?: PerformanceRegression[];
}
