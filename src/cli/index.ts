#!/usr/bin/env node

import { Command } from 'commander';
import { executeInit, executeRun, executeBaselineUpdate, executeDiff } from './commands.js';
import type { GateMode } from '../types.js';

const program = new Command();

program
  .name('seo-gate')
  .description('Automated SEO Regression Guard for CI/CD')
  .version('0.1.0');

program
  .command('init')
  .description('Create a starter seo-gate.config.yml file')
  .argument('[targetUrl]', 'Default target preview or local development URL')
  .action(async (targetUrl) => {
    const exitCode = await executeInit(targetUrl);
    process.exit(exitCode);
  });

program
  .command('run')
  .description('Run SEO crawler, checks, and regression gate against target')
  .requiredOption('-c, --config <path>', 'Path to seo-gate.config.yml configuration file')
  .option('-m, --mode <mode>', 'Gate mode: strict | regression | report')
  .option('-b, --baseline <path>', 'Path to baseline snapshot JSON file')
  .option('-f, --format <format>', 'Report format: json | md | html', 'json')
  .option('-o, --output <path>', 'Output path for report')
  .option('--html <path>', 'Write standalone HTML report to specified path')
  .option('--performance', 'Run Lighthouse lab performance audits on critical pages')
  .option('--pr <number>', 'Pull request number for sticky PR comment')
  .option('--github-token <token>', 'GitHub personal access token or secrets.GITHUB_TOKEN')
  .option('--slack-webhook <url>', 'Slack incoming webhook URL for alert card')
  .option('--teams-webhook <url>', 'Microsoft Teams incoming webhook URL for alert card')
  .action(async (options) => {
    const exitCode = await executeRun({
      config: options.config,
      mode: options.mode as GateMode | undefined,
      format: options.format,
      output: options.output,
      html: options.html,
      performance: Boolean(options.performance),
      baseline: options.baseline,
      pr: options.pr ? parseInt(options.pr, 10) : undefined,
      githubToken: options.githubToken,
      slackWebhook: options.slackWebhook,
      teamsWebhook: options.teamsWebhook,
    });
    process.exit(exitCode);
  });

const baselineCmd = program
  .command('baseline')
  .description('Manage SEO regression baseline snapshots');

baselineCmd
  .command('update')
  .description('Crawl target and update the baseline snapshot JSON file')
  .requiredOption('-c, --config <path>', 'Path to seo-gate.config.yml configuration file')
  .option('-o, --output <path>', 'Output path for baseline snapshot', 'baseline.json')
  .option('--performance', 'Also capture Lighthouse lab performance metrics in baseline')
  .action(async (options) => {
    const exitCode = await executeBaselineUpdate({
      config: options.config,
      output: options.output,
      performance: Boolean(options.performance),
    });
    process.exit(exitCode);
  });

program
  .command('diff')
  .description('Diff two JSON run results or baseline files')
  .argument('<fileA>', 'Path to baseline / original JSON file')
  .argument('<fileB>', 'Path to target / new JSON run result file')
  .action(async (fileA, fileB) => {
    const exitCode = await executeDiff(fileA, fileB);
    process.exit(exitCode);
  });

program.parse(process.argv);
