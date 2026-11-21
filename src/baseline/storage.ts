import fs from 'node:fs';
import path from 'node:path';
import type { Finding, PagePerformanceAudit } from '../types.js';
import type { BaselineSnapshot } from './types.js';

export class BaselineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BaselineError';
  }
}

export function createBaselineFromRun(
  target: string,
  totalPages: number,
  findings: Finding[],
  performance?: PagePerformanceAudit[]
): BaselineSnapshot {
  const sortedFindings = [...findings].sort((a, b) => {
    const urlCmp = a.url.localeCompare(b.url);
    if (urlCmp !== 0) return urlCmp;
    return a.checkId.localeCompare(b.checkId);
  });

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    target,
    totalPages,
    findings: sortedFindings,
    performance,
  };
}

export function loadBaseline(baselinePath: string): BaselineSnapshot {
  const resolved = path.resolve(process.cwd(), baselinePath);
  if (!fs.existsSync(resolved)) {
    throw new BaselineError(`Baseline file not found at: ${resolved}`);
  }

  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(content) as BaselineSnapshot;

    if (parsed.schemaVersion !== 1) {
      throw new BaselineError(
        `Unsupported baseline schemaVersion: ${parsed.schemaVersion}. Expected schemaVersion: 1.`
      );
    }

    if (!Array.isArray(parsed.findings)) {
      throw new BaselineError('Invalid baseline format: "findings" array is missing.');
    }

    return parsed;
  } catch (err) {
    if (err instanceof BaselineError) throw err;
    throw new BaselineError(`Failed to parse baseline JSON file: ${(err as Error).message}`);
  }
}

export function writeBaseline(snapshot: BaselineSnapshot, outputPath: string): void {
  const resolved = path.resolve(process.cwd(), outputPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolved, JSON.stringify(snapshot, null, 2), 'utf8');
}
