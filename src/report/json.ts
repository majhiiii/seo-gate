import fs from 'node:fs';
import path from 'node:path';
import type { Finding, GateMode, RunResult } from '../types.js';

export interface CreateReportOptions {
  target: string;
  mode: GateMode;
  totalPages: number;
  findings: Finding[];
  regressions?: Finding[];
  ignoredCount?: number;
}

export function buildRunResult(options: CreateReportOptions): RunResult {
  const errors = options.findings.filter((f) => f.severity === 'error').length;
  const warnings = options.findings.filter((f) => f.severity === 'warn').length;
  const info = options.findings.filter((f) => f.severity === 'info').length;
  const regressions = options.regressions?.length ?? 0;

  let passed = true;
  if (options.mode === 'strict') {
    passed = errors === 0;
  } else if (options.mode === 'regression') {
    passed = regressions === 0;
  } else if (options.mode === 'report') {
    passed = true; // Report mode never fails
  }

  return {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    target: options.target,
    mode: options.mode,
    passed,
    summary: {
      totalPages: options.totalPages,
      errors,
      warnings,
      info,
      regressions,
    },
    findings: options.findings,
    regressions: options.regressions,
    ignoredCount: options.ignoredCount ?? 0,
  };
}

export function formatJsonReport(result: RunResult): string {
  return JSON.stringify(result, null, 2);
}

export function writeJsonReport(result: RunResult, outputPath: string): void {
  const resolved = path.resolve(process.cwd(), outputPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, formatJsonReport(result), 'utf8');
}
