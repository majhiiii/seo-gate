import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { loadConfig, generateStarterConfigYaml, ConfigError } from '../config/loader.js';
import { crawlTarget, CrawlerError } from '../crawl/fetcher.js';
import { runChecks } from '../checks/runner.js';
import { buildRunResult, writeJsonReport } from '../report/json.js';
import type { GateMode } from '../types.js';

export interface RunCommandOptions {
  config: string;
  mode?: GateMode;
  format?: string;
  output?: string;
  baseline?: string;
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

  // CLI argument override for mode
  if (options.mode) {
    config.mode = options.mode;
  }

  console.log(pc.dim(`   Target: ${config.target} [Mode: ${config.mode}]`));

  // 2. Crawl target
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

  // 3. Execute SEO checks
  console.log(pc.dim(`   Executing core SEO checks...`));
  const checkResults = runChecks(pages, config);

  // In Phase 1 (standalone or strict mode), errors trigger gate failures unless in report mode
  // Regressions diffing engine will be enhanced in Phase 2
  const errors = checkResults.findings.filter((f) => f.severity === 'error');
  const warnings = checkResults.findings.filter((f) => f.severity === 'warn');

  const runResult = buildRunResult({
    target: config.target,
    mode: config.mode,
    totalPages: pages.length,
    findings: checkResults.findings,
    regressions: config.mode === 'regression' ? errors : undefined,
    ignoredCount: checkResults.ignoredCount,
  });

  // 4. Output report
  const outputPath = options.output || 'seo-gate-report.json';
  writeJsonReport(runResult, outputPath);
  console.log(pc.dim(`   ✓ Wrote JSON report to ${outputPath}`));

  // 5. Print terminal summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + pc.bold('═══════════════════════════════════════════════════'));
  console.log(pc.bold('                   RUN SUMMARY                     '));
  console.log(pc.bold('═══════════════════════════════════════════════════'));
  console.log(` Target:      ${pc.cyan(config.target)}`);
  console.log(` Mode:        ${pc.bold(config.mode)}`);
  console.log(` Audited:     ${pc.bold(pages.length.toString())} page(s)`);
  console.log(` Errors:      ${errors.length > 0 ? pc.red(errors.length.toString()) : pc.green('0')}`);
  console.log(` Warnings:    ${warnings.length > 0 ? pc.yellow(warnings.length.toString()) : pc.green('0')}`);
  if (checkResults.ignoredCount > 0) {
    console.log(` Ignored:     ${pc.dim(checkResults.ignoredCount.toString())} finding(s) with documented reason`);
  }
  console.log(` Duration:    ${duration}s`);
  console.log(pc.bold('═══════════════════════════════════════════════════'));

  if (runResult.findings.length > 0) {
    console.log('\nTop Findings:');
    for (const finding of runResult.findings.slice(0, 5)) {
      const icon = finding.severity === 'error' ? pc.red('✗ [ERROR]') : pc.yellow('⚠ [WARN]');
      console.log(`  ${icon} ${pc.bold(finding.checkId)} on ${finding.url}`);
      console.log(`    ${pc.dim(finding.message)}`);
      console.log(`    ${pc.cyan('Fix hint:')} ${finding.fixHint}`);
    }
    if (runResult.findings.length > 5) {
      console.log(pc.dim(`  ... and ${runResult.findings.length - 5} more finding(s). See ${outputPath}`));
    }
  }

  if (runResult.passed) {
    console.log(pc.green(`\n Gate Passed: All criteria satisfied.\n`));
    return 0;
  } else {
    console.log(pc.red(`\n❌ Gate Failed: SEO errors or regressions detected.\n`));
    return 1;
  }
}
