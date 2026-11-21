import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { loadConfig, generateStarterConfigYaml, ConfigError } from '../config/loader.js';
import { crawlTarget, CrawlerError } from '../crawl/fetcher.js';
import { runChecks } from '../checks/runner.js';
import { buildRunResult, writeJsonReport } from '../report/json.js';
import { generateMarkdownReport, writeMarkdownReport } from '../report/markdown.js';
import {
  loadBaseline,
  writeBaseline,
  createBaselineFromRun,
  BaselineError,
} from '../baseline/storage.js';
import { diffFindings, evaluateGate } from '../baseline/diff.js';
import type { GateMode, Finding } from '../types.js';
import type { DiffResult } from '../baseline/types.js';

export interface RunCommandOptions {
  config: string;
  mode?: GateMode;
  format?: string;
  output?: string;
  baseline?: string;
}

export interface BaselineUpdateOptions {
  config: string;
  output?: string;
}

export async function executeInit(targetUrl?: string): Promise<number> {
  const targetPath = path.resolve(process.cwd(), 'seo-gate.config.yml');

  if (fs.existsSync(targetPath)) {
    console.error(pc.red(`\n❌ Configuration file already exists at: ${targetPath}`));
    console.error(pc.yellow('To re-initialize, delete or rename your existing seo-gate.config.yml file.'));
    return 2;
  }

  const content = generateStarterConfigYaml(targetUrl || 'http://localhost:3000');
  fs.writeFileSync(targetPath, content, 'utf8');

  console.log(pc.green(`\n✅ Created starter configuration: ${targetPath}`));
  console.log(pc.cyan('👉 Edit seo-gate.config.yml with your preview URL, then run:'));
  console.log(pc.bold('   pnpm seo-gate run --config seo-gate.config.yml\n'));
  return 0;
}

export async function executeRun(options: RunCommandOptions): Promise<number> {
  const startTime = Date.now();
  console.log(pc.cyan(`\n🔍 seo-gate: Initializing run with config: ${options.config}...`));

  // 1. Load and validate config
  let config;
  try {
    config = loadConfig(options.config);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(pc.red(`\n❌ Configuration Error:`));
      console.error(pc.red(err.message));
    } else {
      console.error(pc.red(`\n❌ Failed to load config: ${(err as Error).message}`));
    }
    return 2;
  }

  if (options.mode) {
    config.mode = options.mode;
  }

  console.log(pc.dim(`   Target: ${config.target} [Mode: ${config.mode}]`));

  // 2. Load baseline if specified or available in regression mode
  let baselineSnapshot;
  const baselinePath = options.baseline || (config.mode === 'regression' && fs.existsSync('baseline.json') ? 'baseline.json' : undefined);

  if (baselinePath) {
    try {
      console.log(pc.dim(`   Loading baseline snapshot: ${baselinePath}...`));
      baselineSnapshot = loadBaseline(baselinePath);
      console.log(pc.dim(`   ✓ Loaded baseline with ${baselineSnapshot.findings.length} prior finding(s)`));
    } catch (err) {
      console.error(pc.red(`\n❌ Baseline Error: ${(err as Error).message}`));
      return 2;
    }
  }

  // 3. Crawl target
  let pages;
  try {
    console.log(pc.dim(`   Crawling target pages and verifying reachability...`));
    pages = await crawlTarget(config);
    console.log(pc.green(`   ✓ Successfully fetched ${pages.length} page(s)`));
  } catch (err) {
    if (err instanceof CrawlerError) {
      console.error(pc.red(`\n❌ Crawl Error: ${err.message}`));
    } else {
      console.error(pc.red(`\n❌ Unhandled Network/Crawl Failure: ${(err as Error).message}`));
    }
    return 2;
  }

  // 4. Execute SEO checks
  console.log(pc.dim(`   Executing core SEO checks...`));
  const checkResults = runChecks(pages, config);

  const totalErrors = checkResults.findings.filter((f) => f.severity === 'error').length;
  const totalWarnings = checkResults.findings.filter((f) => f.severity === 'warn').length;

  // 5. Diff with baseline if available
  let diffResult: DiffResult | undefined;
  let passed = true;

  if (baselineSnapshot) {
    diffResult = diffFindings(checkResults.findings, baselineSnapshot.findings);
    passed = evaluateGate(config.mode, diffResult, totalErrors);
  } else {
    // If no baseline is available, strict mode fails on errors, regression treats current errors as regressions
    if (config.mode === 'strict' || config.mode === 'regression') {
      passed = totalErrors === 0;
    } else {
      passed = true;
    }
  }

  const regressions = diffResult ? diffResult.regressions : (config.mode === 'regression' ? checkResults.findings.filter((f) => f.severity === 'error') : []);

  // 6. Build outputs
  const runResult = buildRunResult({
    target: config.target,
    mode: config.mode,
    totalPages: pages.length,
    findings: checkResults.findings,
    regressions,
    ignoredCount: checkResults.ignoredCount,
  });
  runResult.passed = passed;

  const outputPath = options.output || 'seo-gate-report.json';
  if (options.format === 'md' || options.format === 'markdown' || outputPath.endsWith('.md')) {
    const mdReport = generateMarkdownReport({
      target: config.target,
      mode: config.mode,
      totalPages: pages.length,
      passed,
      findings: checkResults.findings,
      diffResult,
      ignoredCount: checkResults.ignoredCount,
      activeIgnores: config.ignore,
    });
    writeMarkdownReport(mdReport, outputPath);
    console.log(pc.dim(`   ✓ Wrote Markdown report to ${outputPath}`));
  } else {
    writeJsonReport(runResult, outputPath);
    console.log(pc.dim(`   ✓ Wrote JSON report to ${outputPath}`));
  }

  // 7. Print terminal summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + pc.bold('═══════════════════════════════════════════════════'));
  console.log(pc.bold('                   RUN SUMMARY                     '));
  console.log(pc.bold('═══════════════════════════════════════════════════'));
  console.log(` Target:      ${pc.cyan(config.target)}`);
  console.log(` Mode:        ${pc.bold(config.mode)}`);
  console.log(` Audited:     ${pc.bold(pages.length.toString())} page(s)`);
  if (diffResult) {
    const regCount = diffResult.regressions.length;
    console.log(` Regressions: ${regCount > 0 ? pc.red(regCount.toString()) : pc.green('0')}`);
    console.log(` Resolved:    ${pc.green(diffResult.resolvedFindings.length.toString())}`);
  }
  console.log(` Total Errors:${totalErrors > 0 ? pc.red(totalErrors.toString()) : pc.green('0')}`);
  console.log(` Warnings:    ${totalWarnings > 0 ? pc.yellow(totalWarnings.toString()) : pc.green('0')}`);
  if (checkResults.ignoredCount > 0) {
    console.log(` Ignored:     ${pc.dim(checkResults.ignoredCount.toString())} finding(s) with documented reason`);
  }
  console.log(` Duration:    ${duration}s`);
  console.log(pc.bold('═══════════════════════════════════════════════════'));

  const reportedRegressions = diffResult ? diffResult.regressions : checkResults.findings.filter((f) => f.severity === 'error');
  if (reportedRegressions.length > 0) {
    console.log('\nTop Regressions:');
    for (const finding of reportedRegressions.slice(0, 5)) {
      console.log(`  ${pc.red('✗ [REGRESSION]')} ${pc.bold(finding.checkId)} on ${finding.url}`);
      console.log(`    ${pc.dim(finding.message)}`);
      console.log(`    ${pc.cyan('Fix hint:')} ${finding.fixHint}`);
    }
  }

  if (passed) {
    console.log(pc.green(`\n Gate Passed: All quality criteria satisfied.\n`));
    return 0;
  } else {
    console.log(pc.red(`\n❌ Gate Failed: SEO regressions detected.\n`));
    return 1;
  }
}

export async function executeBaselineUpdate(options: BaselineUpdateOptions): Promise<number> {
  console.log(pc.cyan(`\n📦 seo-gate baseline update: Initializing crawl...`));

  let config;
  try {
    config = loadConfig(options.config);
  } catch (err) {
    console.error(pc.red(`\n❌ Configuration Error: ${(err as Error).message}`));
    return 2;
  }

  const targetToCrawl = config.production || config.target;
  console.log(pc.dim(`   Crawling target for baseline snapshot: ${targetToCrawl}...`));

  let pages;
  try {
    pages = await crawlTarget({ ...config, target: targetToCrawl });
    console.log(pc.green(`   ✓ Fetched ${pages.length} page(s)`));
  } catch (err) {
    console.error(pc.red(`\n❌ Failed to crawl target for baseline: ${(err as Error).message}`));
    return 2;
  }

  const checkResults = runChecks(pages, config);
  const baseline = createBaselineFromRun(targetToCrawl, pages.length, checkResults.findings);

  const outputPath = options.output || 'baseline.json';
  writeBaseline(baseline, outputPath);

  console.log(pc.green(`\n✅ Baseline successfully saved to: ${outputPath}`));
  console.log(pc.dim(`   Snapshot contains ${baseline.findings.length} findings across ${pages.length} page(s).\n`));
  return 0;
}

export async function executeDiff(fileAPath: string, fileBPath: string): Promise<number> {
  console.log(pc.cyan(`\n🔍 seo-gate diff: Comparing ${fileAPath} vs ${fileBPath}...`));

  function readFindings(filePath: string): Finding[] {
    const full = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(full)) {
      throw new Error(`File not found: ${full}`);
    }
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    return Array.isArray(data.findings) ? data.findings : [];
  }

  let findingsA: Finding[];
  let findingsB: Finding[];

  try {
    findingsA = readFindings(fileAPath);
    findingsB = readFindings(fileBPath);
  } catch (err) {
    console.error(pc.red(`\n❌ Error reading diff files: ${(err as Error).message}`));
    return 2;
  }

  const diffResult = diffFindings(findingsB, findingsA);

  console.log('\n' + pc.bold('═══════════════════════════════════════════════════'));
  console.log(pc.bold('                   DIFF SUMMARY                    '));
  console.log(pc.bold('═══════════════════════════════════════════════════'));
  console.log(` Baseline (A):   ${fileAPath} (${findingsA.length} findings)`);
  console.log(` Target (B):     ${fileBPath} (${findingsB.length} findings)`);
  console.log(` New Findings:   ${diffResult.newFindings.length > 0 ? pc.yellow(diffResult.newFindings.length.toString()) : pc.green('0')}`);
  console.log(` Regressions:    ${diffResult.regressions.length > 0 ? pc.red(diffResult.regressions.length.toString()) : pc.green('0')}`);
  console.log(` Resolved:       ${pc.green(diffResult.resolvedFindings.length.toString())}`);
  console.log(` Unchanged:      ${pc.dim(diffResult.unchangedFindings.length.toString())}`);
  console.log(pc.bold('═══════════════════════════════════════════════════'));

  if (diffResult.regressions.length > 0) {
    console.log(pc.red('\nNew Regressions:'));
    for (const r of diffResult.regressions) {
      console.log(`  ✗ [ERROR] ${pc.bold(r.checkId)} on ${r.url}`);
      console.log(`    ${pc.dim(r.message)}`);
    }
    return 1;
  }

  if (diffResult.resolvedFindings.length > 0) {
    console.log(pc.green('\nResolved Issues:'));
    for (const res of diffResult.resolvedFindings) {
      console.log(`  ✓ ${pc.bold(res.checkId)} on ${res.url}`);
    }
  }

  console.log(pc.green(`\n✓ No regressions found between runs.\n`));
  return 0;
}
