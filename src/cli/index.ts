#!/usr/bin/env node

import { Command } from 'commander';
import { executeInit, executeRun } from './commands.js';
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
  .option('-f, --format <format>', 'Report format (json)', 'json')
  .option('-o, --output <path>', 'Output path for the report', 'seo-gate-report.json')
  .action(async (options) => {
    const exitCode = await executeRun({
      config: options.config,
      mode: options.mode as GateMode | undefined,
      format: options.format,
      output: options.output,
      baseline: options.baseline,
    });
    process.exit(exitCode);
  });

program.parse(process.argv);
