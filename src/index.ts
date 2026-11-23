// Core types
export * from './types.js';

// Configuration
export { loadConfig, generateStarterConfigYaml, ConfigError } from './config/loader.js';
export { SeoGateConfigSchema, PerformanceBudgetsSchema } from './config/schema.js';

// Crawling & Rendering
export { crawlTarget, fetchPage, CrawlerError, normalizeUrl } from './crawl/fetcher.js';
export { fetchSitemap } from './crawl/sitemap.js';
export { renderPage, closeBrowser } from './render/browser.js';

// Checks
export { runChecks, type RunChecksResult } from './checks/runner.js';
export { CORE_CHECKS } from './checks/registry.js';
export type { CheckDefinition, CheckContext } from './checks/types.js';

// Baselines & Diffing
export { diffFindings, evaluateGate } from './baseline/diff.js';
export { loadBaseline, writeBaseline, createBaselineFromRun, BaselineError } from './baseline/storage.js';
export type { BaselineSnapshot, DiffResult } from './baseline/types.js';

// Lighthouse Lab Auditing
export { auditPagePerformance, diffPerformance, computeMedian } from './lighthouse/runner.js';

// Multi-Format Reporters
export { generateHtmlReport, writeHtmlReport, type HtmlReportOptions } from './report/html.js';
export { generateMarkdownReport, writeMarkdownReport, type MarkdownReportOptions } from './report/markdown.js';
export { buildRunResult, writeJsonReport, formatJsonReport, type CreateReportOptions } from './report/json.js';
export { sendSlackNotification, sendTeamsNotification, redactSensitiveUrl } from './report/webhook.js';

// GitHub Commenting
export { postOrUpdateStickyComment } from './github/comment.js';
