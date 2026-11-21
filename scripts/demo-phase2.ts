import fs from 'node:fs';
import path from 'node:path';
import { startFixtureServer } from '../fixtures/test-site/server.js';
import { executeBaselineUpdate, executeRun, executeDiff } from '../src/cli/commands.js';

async function main() {
  console.log('🚀 Phase 2 Demo: Baselines, Diffing & Regression Gate Modes');
  const fixture = await startFixtureServer(0);
  console.log(`📡 Fixture server online at: ${fixture.baseUrl}`);

  const demoConfig = path.resolve(process.cwd(), 'demo-phase2-config.yml');
  const demoBaseline = path.resolve(process.cwd(), 'demo-baseline.json');
  const demoReportPr1 = path.resolve(process.cwd(), 'demo-pr1-report.md');
  const demoReportPr2 = path.resolve(process.cwd(), 'demo-pr2-report.md');

  // Baseline config has / and a pre-existing issue on /missing-title
  const baseYaml = `
target: ${fixture.baseUrl}
mode: regression
pages:
  include:
    - "/"
    - "/missing-title"
  sitemap: false
`;
  fs.writeFileSync(demoConfig, baseYaml, 'utf8');

  try {
    // 1. Capture baseline snapshot
    console.log('\n--- 1. CAPTURING BASELINE SNAPSHOT (Simulating Main Branch) ---');
    await executeBaselineUpdate({
      config: demoConfig,
      output: demoBaseline,
    });

    // 2. PR #1: Touch unchanged pages (pre-existing issue exists in baseline)
    console.log('\n--- 2. PR #1: UNCHANGED SITE (Regression Mode) ---');
    const pr1ExitCode = await executeRun({
      config: demoConfig,
      baseline: demoBaseline,
      mode: 'regression',
      output: demoReportPr1,
      format: 'md',
    });
    console.log(`PR #1 Exit Code: ${pr1ExitCode} (Expected: 0 - Pre-existing baseline errors DO NOT fail the gate!)`);

    // 3. PR #2: Introduce a brand new regression (/accidental-noindex-meta)
    console.log('\n--- 3. PR #2: NEW REGRESSION INTRODUCED (/accidental-noindex-meta) ---');
    const regressionYaml = `
target: ${fixture.baseUrl}
mode: regression
pages:
  include:
    - "/"
    - "/missing-title"
    - "/accidental-noindex-meta"
  sitemap: false
`;
    fs.writeFileSync(demoConfig, regressionYaml, 'utf8');

    const pr2ExitCode = await executeRun({
      config: demoConfig,
      baseline: demoBaseline,
      mode: 'regression',
      output: demoReportPr2,
      format: 'md',
    });
    console.log(`PR #2 Exit Code: ${pr2ExitCode} (Expected: 1 - Gate failed due to new regression!)`);

    // 4. Output the generated PR Markdown comment
    console.log('\n--- 4. GENERATED GITHUB PR MARKDOWN COMMENT ---');
    const mdContent = fs.readFileSync(demoReportPr2, 'utf8');
    console.log(mdContent);

  } finally {
    await fixture.stop();
    if (fs.existsSync(demoConfig)) fs.unlinkSync(demoConfig);
    if (fs.existsSync(demoBaseline)) fs.unlinkSync(demoBaseline);
    if (fs.existsSync(demoReportPr1)) fs.unlinkSync(demoReportPr1);
    if (fs.existsSync(demoReportPr2)) fs.unlinkSync(demoReportPr2);
    console.log('\n🏁 Phase 2 Demo complete.');
  }
}

main().catch(console.error);
