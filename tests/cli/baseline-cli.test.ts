import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { executeBaselineUpdate, executeDiff, executeRun } from '../../src/cli/commands.js';
import { startFixtureServer, type FixtureServerInstance } from '../../fixtures/test-site/server.js';
import { writeBaseline, createBaselineFromRun } from '../../src/baseline/storage.js';
import type { Finding } from '../../src/types.js';

describe('CLI Baseline Update, Diff & Regression Mode', () => {
  let fixture: FixtureServerInstance;
  const tempConfig = path.resolve(process.cwd(), 'temp-base-config.yml');
  const tempBaseline = path.resolve(process.cwd(), 'temp-baseline.json');
  const tempReportA = path.resolve(process.cwd(), 'temp-report-a.json');
  const tempReportB = path.resolve(process.cwd(), 'temp-report-b.json');

  beforeAll(async () => {
    fixture = await startFixtureServer(0);
  });

  afterAll(async () => {
    await fixture.stop();
  });

  afterEach(() => {
    if (fs.existsSync(tempConfig)) fs.unlinkSync(tempConfig);
    if (fs.existsSync(tempBaseline)) fs.unlinkSync(tempBaseline);
    if (fs.existsSync(tempReportA)) fs.unlinkSync(tempReportA);
    if (fs.existsSync(tempReportB)) fs.unlinkSync(tempReportB);
  });

  it('baseline update crawls target and produces a baseline.json with exit code 0', async () => {
    const yaml = `
target: ${fixture.baseUrl}
mode: strict
pages:
  include: ["/"]
  sitemap: false
`;
    fs.writeFileSync(tempConfig, yaml, 'utf8');

    const code = await executeBaselineUpdate({
      config: tempConfig,
      output: tempBaseline,
    });

    expect(code).toBe(0);
    expect(fs.existsSync(tempBaseline)).toBe(true);

    const snapshot = JSON.parse(fs.readFileSync(tempBaseline, 'utf8'));
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.totalPages).toBe(1);
  });

  it('diff command returns 0 when no regressions exist', async () => {
    const runA = { schemaVersion: 1, findings: [] };
    const runB = { schemaVersion: 1, findings: [] };

    fs.writeFileSync(tempReportA, JSON.stringify(runA), 'utf8');
    fs.writeFileSync(tempReportB, JSON.stringify(runB), 'utf8');

    const code = await executeDiff(tempReportA, tempReportB);
    expect(code).toBe(0);
  });

  it('diff command returns 1 when new regressions are detected', async () => {
    const runA = { schemaVersion: 1, findings: [] };
    const runB = {
      schemaVersion: 1,
      findings: [
        {
          checkId: 'noindex-meta',
          url: 'https://example.com/shoes',
          severity: 'error',
          message: 'noindex',
          evidence: '',
          fixHint: '',
          docsLink: '',
        },
      ],
    };

    fs.writeFileSync(tempReportA, JSON.stringify(runA), 'utf8');
    fs.writeFileSync(tempReportB, JSON.stringify(runB), 'utf8');

    const code = await executeDiff(tempReportA, tempReportB);
    expect(code).toBe(1);
  });

  it('regression mode PASSES with exit code 0 when pre-existing errors are in baseline', async () => {
    // 1. Create a baseline that already includes the error on /missing-title
    const preExistingFinding: Finding = {
      checkId: 'title-missing',
      url: `${fixture.baseUrl}/missing-title`,
      severity: 'error',
      message: 'Missing title',
      evidence: '',
      fixHint: '',
      docsLink: '',
    };
    const baselineSnapshot = createBaselineFromRun(fixture.baseUrl, 1, [preExistingFinding]);
    writeBaseline(baselineSnapshot, tempBaseline);

    // 2. Run against /missing-title in regression mode
    const yaml = `
target: ${fixture.baseUrl}
mode: regression
pages:
  include: ["/missing-title"]
  sitemap: false
`;
    fs.writeFileSync(tempConfig, yaml, 'utf8');

    const code = await executeRun({
      config: tempConfig,
      baseline: tempBaseline,
      output: tempReportA,
    });

    // In regression mode, pre-existing baseline errors should NOT fail the gate!
    expect(code).toBe(0);
  });

  it('regression mode FAILS with exit code 1 when a brand new error is introduced vs baseline', async () => {
    // 1. Create a clean baseline with 0 findings
    const baselineSnapshot = createBaselineFromRun(fixture.baseUrl, 1, []);
    writeBaseline(baselineSnapshot, tempBaseline);

    // 2. Run against a page with an error (/accidental-noindex-meta)
    const yaml = `
target: ${fixture.baseUrl}
mode: regression
pages:
  include: ["/accidental-noindex-meta"]
  sitemap: false
`;
    fs.writeFileSync(tempConfig, yaml, 'utf8');

    const code = await executeRun({
      config: tempConfig,
      baseline: tempBaseline,
      output: tempReportA,
    });

    // Brand new regression MUST fail the gate
    expect(code).toBe(1);
  });
});
