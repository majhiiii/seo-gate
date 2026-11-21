import fs from 'node:fs';
import path from 'node:path';
import type { Finding, GateMode, PagePerformanceAudit, PerformanceRegression } from '../types.js';
import type { DiffResult } from '../baseline/types.js';

export interface MarkdownReportOptions {
  target: string;
  mode: GateMode;
  totalPages: number;
  passed: boolean;
  findings: Finding[];
  diffResult?: DiffResult;
  performance?: PagePerformanceAudit[];
  performanceRegressions?: PerformanceRegression[];
  ignoredCount?: number;
  activeIgnores?: { check: string; url: string; reason: string; expires?: string }[];
  htmlReportLink?: string;
}

export function generateMarkdownReport(options: MarkdownReportOptions): string {
  const statusEmoji = options.passed ? '🟢' : '🔴';
  const statusText = options.passed ? 'Gate Passed' : 'Gate Failed';

  const errors = options.findings.filter((f) => f.severity === 'error').length;
  const warnings = options.findings.filter((f) => f.severity === 'warn').length;
  const regressions = (options.diffResult ? options.diffResult.regressions.length : errors) +
    (options.performanceRegressions?.filter((p) => p.reproduced).length ?? 0);
  const resolved = options.diffResult ? options.diffResult.resolvedFindings.length : 0;

  const lines: string[] = [];

  // 1. Header
  lines.push(`## ${statusEmoji} seo-gate: ${statusText}\n`);
  lines.push(`Automated SEO regression audit for **${options.target}** (Mode: \`${options.mode}\`).\n`);

  // 2. Summary Table
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| **Target URL** | \`${options.target}\` |`);
  lines.push(`| **Gate Mode** | \`${options.mode}\` |`);
  lines.push(`| **Audited Pages** | ${options.totalPages} |`);
  lines.push(`| **New Regressions** | ${regressions > 0 ? `🚨 **${regressions}**` : '✅ 0'} |`);
  lines.push(`| **Total Errors** | ${errors > 0 ? `❌ ${errors}` : '0'} |`);
  lines.push(`| **Total Warnings** | ${warnings > 0 ? `⚠️ ${warnings}` : '0'} |`);
  if (options.diffResult) {
    lines.push(`| **Resolved Issues** | ${resolved > 0 ? `🎉 ${resolved}` : '0'} |`);
  }
  if (options.ignoredCount && options.ignoredCount > 0) {
    lines.push(`| **Ignored Findings** | ${options.ignoredCount} (with documented reason) |`);
  }
  lines.push('');

  // 3. New Regressions Section
  const regressionList = options.diffResult ? options.diffResult.regressions : options.findings.filter((f) => f.severity === 'error');
  if (regressionList.length > 0) {
    lines.push('### 🚨 New Regressions Requiring Attention\n');
    lines.push('| Check | URL | Message | Fix Hint |');
    lines.push('|---|---|---|---|');
    for (const reg of regressionList.slice(0, 10)) {
      const escapedUrl = reg.url.replace(/\|/g, '\\|');
      const escapedMsg = reg.message.replace(/\|/g, '\\|');
      const escapedHint = reg.fixHint.replace(/\|/g, '\\|');
      lines.push(`| \`${reg.checkId}\` | [${escapedUrl}](${escapedUrl}) | ${escapedMsg} | ${escapedHint} |`);
    }
    lines.push('');
    if (regressionList.length > 10) {
      lines.push(`*... and ${regressionList.length - 10} more regressions recorded in report.* \n`);
    }
  }

  // 4. Performance Lab Audits Section
  if (options.performance && options.performance.length > 0) {
    lines.push('### ⚡ Lab Performance Audits (Lighthouse)\n');
    lines.push('> *Simulated lab metrics (median of runs). Not field Core Web Vitals.*\n');
    lines.push('| Page | Profile | LCP | CLS | TBT | Total JS | Total Images |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const p of options.performance) {
      lines.push(`| \`${p.url}\` | ${p.metrics.profile} | ${p.metrics.lcpMs}ms | ${p.metrics.cls} | ${p.metrics.tbtMs}ms | ${p.metrics.totalJsKb}kB | ${p.metrics.totalImageKb}kB |`);
    }
    lines.push('');

    if (options.performanceRegressions && options.performanceRegressions.length > 0) {
      lines.push('**Performance Regressions:**\n');
      for (const pr of options.performanceRegressions) {
        const badge = pr.reproduced ? '🚨 **REGRESSION**' : '⚠️ **TRANSIENT**';
        lines.push(`- ${badge} \`${pr.metric}\` on ${pr.url}: ${pr.message}`);
      }
      lines.push('');
    }
  }

  // 5. Resolved Issues Section (Celebrated)
  if (options.diffResult && options.diffResult.resolvedFindings.length > 0) {
    lines.push('<details>');
    lines.push(`<summary><b>🎉 Resolved Issues (${options.diffResult.resolvedFindings.length})</b></summary>\n`);
    lines.push('| Check | URL | Previous Message |');
    lines.push('|---|---|---|');
    for (const res of options.diffResult.resolvedFindings) {
      lines.push(`| \`${res.checkId}\` | ${res.url} | ${res.message} |`);
    }
    lines.push('</details>\n');
  }

  // 6. Pre-existing Technical Debt Section (Collapsed)
  if (options.diffResult && options.diffResult.unchangedFindings.length > 0) {
    lines.push('<details>');
    lines.push(`<summary><b>📋 Pre-existing Technical Debt from Baseline (${options.diffResult.unchangedFindings.length})</b></summary>\n`);
    lines.push('These issues existed in the baseline and did not block this pull request:\n');
    lines.push('| Severity | Check | URL | Message |');
    lines.push('|---|---|---|---|');
    for (const unc of options.diffResult.unchangedFindings) {
      const sev = unc.severity === 'error' ? '❌ error' : '⚠️ warn';
      lines.push(`| ${sev} | \`${unc.checkId}\` | ${unc.url} | ${unc.message} |`);
    }
    lines.push('</details>\n');
  }

  // 7. Active Documented Ignores Section (Collapsed)
  if (options.activeIgnores && options.activeIgnores.length > 0) {
    lines.push('<details>');
    lines.push(`<summary><b>🛡️ Active Documented Ignores (${options.activeIgnores.length})</b></summary>\n`);
    lines.push('| Check | URL Pattern | Reason | Expiration |');
    lines.push('|---|---|---|---|');
    for (const rule of options.activeIgnores) {
      lines.push(`| \`${rule.check}\` | \`${rule.url}\` | ${rule.reason} | ${rule.expires || 'None'} |`);
    }
    lines.push('</details>\n');
  }

  // 8. Full HTML report link
  if (options.htmlReportLink) {
    lines.push(`\n📊 [View Full Interactive HTML Report](${options.htmlReportLink})\n`);
  }

  return lines.join('\n');
}

export function writeMarkdownReport(reportContent: string, outputPath: string): void {
  const resolved = path.resolve(process.cwd(), outputPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, reportContent, 'utf8');
}
