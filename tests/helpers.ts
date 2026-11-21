import * as cheerio from 'cheerio';
import type { PageAudit, SeoGateConfig } from '../src/types.js';
import type { CheckContext } from '../src/checks/types.js';

export function createMockPage(
  url: string,
  html: string,
  statusCode: number = 200,
  headers: Record<string, string> = {},
  redirectChain?: string[]
): PageAudit {
  return {
    url,
    statusCode,
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    ),
    html,
    redirectChain,
    $: cheerio.load(html),
  };
}

export function createMockContext(
  allPages: PageAudit[] = [],
  configOverrides: Partial<SeoGateConfig> = {}
): CheckContext {
  const config: SeoGateConfig = {
    target: 'https://example.com',
    mode: 'regression',
    pages: {
      include: ['/'],
    },
    checks: {
      title: { min: 20, max: 65, unique: true },
      metaDescription: { min: 70, max: 160, unique: true },
      h1: { requireExactOne: true },
      canonical: { requireSelfReferencing: true },
      noindex: { allowOnStaging: false },
    },
    severity_overrides: {},
    ignore: [],
    ...configOverrides,
  };

  return {
    allPages,
    config,
  };
}
