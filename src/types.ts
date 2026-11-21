/**
 * Core type definitions for seo-gate.
 * Unidirectional dependency: All modules may import from types.ts,
 * but types.ts imports no other module.
 */

export type Severity = 'error' | 'warn' | 'info';

export type GateMode = 'strict' | 'regression' | 'report';

export interface Finding {
  /** Identifier of the check, e.g. 'title-missing', 'noindex', 'canonical-relative' */
  checkId: string;
  /** The URL where the violation was detected */
  url: string;
  /** Severity level */
  severity: Severity;
  /** Plain English description of the finding */
  message: string;
  /** Exact HTML snippet or header line */
  evidence: string;
  /** Concrete guidance on how to remediate the issue */
  fixHint: string;
  /** Documentation URL for reference */
  docsLink: string;
}

export interface PageAudit {
  /** The requested or final URL */
  url: string;
  /** HTTP response status code */
  statusCode: number;
  /** Normalised HTTP headers (lowercased keys) */
  headers: Record<string, string>;
  /** Raw HTML content as received from server */
  html: string;
  /** If redirects occurred, the chain of visited URLs */
  redirectChain?: string[];
  /** Cheerio parsed document object (lazy or precomputed) */
  $?: import('cheerio').CheerioAPI;
}

export interface IgnoreRule {
  /** Pattern or checkId to match */
  check: string;
  /** URL pattern or exact URL */
  url: string;
  /** Mandatory documented explanation for why this issue is ignored */
  reason: string;
  /** Optional expiration date string (YYYY-MM-DD) */
  expires?: string;
}

export interface SeoGateConfig {
  /** Target preview or staging URL */
  target: string;
  /** Optional production URL for baseline comparison */
  production?: string;
  /** Operational gate mode */
  mode: GateMode;
  /** Pages and discovery settings */
  pages: {
    include: string[];
    exclude?: string[];
    sitemap?: boolean | string;
    crawl?: {
      maxPages?: number;
      maxDepth?: number;
      concurrency?: number;
      delayMs?: number;
    };
    critical?: string[];
  };
  /** Rules & thresholds for checks */
  checks?: {
    title?: {
      min?: number;
      max?: number;
      unique?: boolean;
    };
    metaDescription?: {
      min?: number;
      max?: number;
      unique?: boolean;
    };
    h1?: {
      requireExactOne?: boolean;
    };
    canonical?: {
      requireSelfReferencing?: boolean;
    };
    noindex?: {
      allowOnStaging?: boolean;
    };
  };
  /** Custom severity overrides by checkId */
  severity_overrides?: Record<string, Severity>;
  /** Explicitly ignored findings */
  ignore?: IgnoreRule[];
}

export interface RunSummary {
  totalPages: number;
  errors: number;
  warnings: number;
  info: number;
  regressions: number;
}

export interface RunResult {
  schemaVersion: 1;
  timestamp: string;
  target: string;
  mode: GateMode;
  passed: boolean;
  summary: RunSummary;
  findings: Finding[];
  regressions?: Finding[];
  ignoredCount?: number;
}
