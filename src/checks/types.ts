import type { Finding, PageAudit, SeoGateConfig } from '../types.js';

export interface CheckContext {
  /** All crawled pages in the current run (used for uniqueness and cross-page checks) */
  allPages: PageAudit[];
  /** Validated runtime configuration */
  config: SeoGateConfig;
}

export type CheckFunction = (page: PageAudit, context: CheckContext) => Finding[];

export interface CheckDefinition {
  id: string;
  name: string;
  description: string;
  run: CheckFunction;
}
