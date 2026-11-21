import type { Finding, GateMode } from '../types.js';
import type { DiffResult } from './types.js';

/**
 * Computes an environment-agnostic identity fingerprint for a finding.
 * Strips protocol, hostname, and port so preview and production findings can be correlated.
 */
export function computeFindingFingerprint(finding: Finding): string {
  try {
    const parsed = new URL(finding.url);
    let pathname = parsed.pathname;
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    const search = parsed.search || '';
    return `${finding.checkId}::${pathname}${search}`;
  } catch {
    return `${finding.checkId}::${finding.url}`;
  }
}

function sortFindings(list: Finding[]): Finding[] {
  return [...list].sort((a, b) => {
    const urlCmp = a.url.localeCompare(b.url);
    if (urlCmp !== 0) return urlCmp;
    return a.checkId.localeCompare(b.checkId);
  });
}

/**
 * Diffs current run findings against a baseline snapshot.
 */
export function diffFindings(currentFindings: Finding[], baselineFindings: Finding[]): DiffResult {
  const baselineMap = new Map<string, Finding>();
  for (const f of baselineFindings) {
    baselineMap.set(computeFindingFingerprint(f), f);
  }

  const currentMap = new Map<string, Finding>();
  for (const f of currentFindings) {
    currentMap.set(computeFindingFingerprint(f), f);
  }

  const newFindings: Finding[] = [];
  const unchangedFindings: Finding[] = [];
  const resolvedFindings: Finding[] = [];

  // Identify new and unchanged findings
  for (const finding of currentFindings) {
    const key = computeFindingFingerprint(finding);
    if (baselineMap.has(key)) {
      unchangedFindings.push(finding);
    } else {
      newFindings.push(finding);
    }
  }

  // Identify resolved findings (in baseline but missing from current run)
  for (const baselineFinding of baselineFindings) {
    const key = computeFindingFingerprint(baselineFinding);
    if (!currentMap.has(key)) {
      resolvedFindings.push(baselineFinding);
    }
  }

  // Regressions are new findings with error severity
  const regressions = newFindings.filter((f) => f.severity === 'error');

  return {
    newFindings: sortFindings(newFindings),
    resolvedFindings: sortFindings(resolvedFindings),
    unchangedFindings: sortFindings(unchangedFindings),
    regressions: sortFindings(regressions),
  };
}

/**
 * Determines whether a run passes or fails the gate based on gate mode and diff results.
 */
export function evaluateGate(
  mode: GateMode,
  diffResult: DiffResult,
  totalErrors: number
): boolean {
  if (mode === 'strict') {
    return totalErrors === 0;
  }
  if (mode === 'regression') {
    return diffResult.regressions.length === 0;
  }
  if (mode === 'report') {
    return true; // Report mode never fails
  }
  return totalErrors === 0;
}
