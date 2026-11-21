import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { executeInit, executeRun } from '../../src/cli/commands.js';
import { startFixtureServer, type FixtureServerInstance } from '../../fixtures/test-site/server.js';

describe('CLI Commands & Exit Codes', () => {
  let fixture: FixtureServerInstance;
  const tempConfigFile = path.resolve(process.cwd(), 'temp-cli-config.yml');
  const tempReportFile = path.resolve(process.cwd(), 'temp-cli-report.json');

  beforeAll(async () => {
    fixture = await startFixtureServer(0);
  });

  afterAll(async () => {
    await fixture.stop();
  });

  afterEach(() => {
    if (fs.existsSync(tempConfigFile)) fs.unlinkSync(tempConfigFile);
    if (fs.existsSync(tempReportFile)) fs.unlinkSync(tempReportFile);
  });

  it('init command creates seo-gate.config.yml with exit code 0', async () => {
    const starterPath = path.resolve(process.cwd(), 'seo-gate.config.yml');
    if (fs.existsSync(starterPath)) fs.unlinkSync(starterPath);

    const code = await executeInit('http://127.0.0.1:3000');
    expect(code).toBe(0);
    expect(fs.existsSync(starterPath)).toBe(true);

    // Running again without deleting should exit with code 2
    const code2 = await executeInit('http://127.0.0.1:3000');
    expect(code2).toBe(2);

    fs.unlinkSync(starterPath);
  });

  it('run command returns exit code 2 when config is missing', async () => {
    const code = await executeRun({ config: 'non-existent-config.yml' });
    expect(code).toBe(2);
  });

  it('run command returns exit code 2 when target is completely unreachable', async () => {
    const deadConfigYaml = `
target: http://127.0.0.1:59998
mode: strict
pages:
  include: ["/"]
`;
    fs.writeFileSync(tempConfigFile, deadConfigYaml, 'utf8');

    const code = await executeRun({ config: tempConfigFile, output: tempReportFile });
    expect(code).toBe(2);
  });

  it('run command returns exit code 0 on clean pages', async () => {
    const cleanConfigYaml = `
target: ${fixture.baseUrl}
mode: strict
pages:
  include: ["/"]
  sitemap: false
`;
    fs.writeFileSync(tempConfigFile, cleanConfigYaml, 'utf8');

    const code = await executeRun({ config: tempConfigFile, output: tempReportFile });
    expect(code).toBe(0);
    expect(fs.existsSync(tempReportFile)).toBe(true);

    const report = JSON.parse(fs.readFileSync(tempReportFile, 'utf8'));
    expect(report.schemaVersion).toBe(1);
    expect(report.passed).toBe(true);
    expect(report.summary.errors).toBe(0);
  });

  it('run command returns exit code 1 when errors are present in strict mode', async () => {
    const brokenConfigYaml = `
target: ${fixture.baseUrl}
mode: strict
pages:
  include: ["/accidental-noindex-meta"]
  sitemap: false
`;
    fs.writeFileSync(tempConfigFile, brokenConfigYaml, 'utf8');

    const code = await executeRun({ config: tempConfigFile, output: tempReportFile });
    expect(code).toBe(1);

    const report = JSON.parse(fs.readFileSync(tempReportFile, 'utf8'));
    expect(report.passed).toBe(false);
    expect(report.summary.errors).toBeGreaterThan(0);
  });

  it('run command returns exit code 0 in report mode even with errors', async () => {
    const reportModeConfigYaml = `
target: ${fixture.baseUrl}
mode: report
pages:
  include: ["/accidental-noindex-meta"]
  sitemap: false
`;
    fs.writeFileSync(tempConfigFile, reportModeConfigYaml, 'utf8');

    const code = await executeRun({ config: tempConfigFile, output: tempReportFile });
    expect(code).toBe(0);

    const report = JSON.parse(fs.readFileSync(tempReportFile, 'utf8'));
    expect(report.passed).toBe(true);
  });
});
