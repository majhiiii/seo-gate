import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createBaselineFromRun,
  loadBaseline,
  writeBaseline,
  BaselineError,
} from '../../src/baseline/storage.js';
import type { Finding } from '../../src/types.js';

describe('Baseline Storage Engine', () => {
  const tempPath = path.resolve(process.cwd(), 'temp-storage-baseline.json');

  afterEach(() => {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  });

  const sampleFinding: Finding = {
    checkId: 'title-missing',
    url: 'https://example.com/item',
    severity: 'error',
    message: 'Missing title',
    evidence: '',
    fixHint: '',
    docsLink: '',
  };

  it('creates a versioned snapshot from a run with schemaVersion 1', () => {
    const snapshot = createBaselineFromRun('https://example.com', 10, [sampleFinding]);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.target).toBe('https://example.com');
    expect(snapshot.totalPages).toBe(10);
    expect(snapshot.findings).toHaveLength(1);
    expect(snapshot.createdAt).toBeDefined();
  });

  it('persists and loads baseline accurately', () => {
    const original = createBaselineFromRun('https://example.com', 5, [sampleFinding]);
    writeBaseline(original, tempPath);

    const loaded = loadBaseline(tempPath);
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.findings[0].checkId).toBe('title-missing');
  });

  it('throws BaselineError when file does not exist', () => {
    expect(() => loadBaseline('non-existent-baseline-file.json')).toThrow(BaselineError);
  });

  it('throws BaselineError when schemaVersion is invalid', () => {
    fs.writeFileSync(tempPath, JSON.stringify({ schemaVersion: 99, findings: [] }), 'utf8');
    expect(() => loadBaseline(tempPath)).toThrow(BaselineError);
  });
});
