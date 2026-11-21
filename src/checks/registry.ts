import { checkHttpStatus } from './http-status.js';
import { checkTitle } from './title.js';
import { checkMetaDescription } from './meta-description.js';
import { checkH1 } from './h1.js';
import { checkCanonical } from './canonical.js';
import { checkNoindex } from './noindex.js';
import { checkRenderedVsRaw } from './rendered-vs-raw.js';
import { checkStructuredData } from './structured-data.js';
import { checkHreflang } from './hreflang.js';
import { checkSitemapHealth } from './sitemap.js';
import { checkRobotsTxt } from './robots-txt.js';
import type { CheckDefinition } from './types.js';

export const CORE_CHECKS: CheckDefinition[] = [
  {
    id: 'http-status',
    name: 'HTTP Status & Redirects',
    description: 'Validates 200 OK responses and flags 4xx/5xx errors, redirect chains, and loops',
    run: checkHttpStatus,
  },
  {
    id: 'title',
    name: 'Page Title',
    description: 'Enforces presence, uniqueness, and length bounds for <title> tags',
    run: checkTitle,
  },
  {
    id: 'meta-description',
    name: 'Meta Description',
    description: 'Enforces presence, uniqueness, and length bounds for meta descriptions',
    run: checkMetaDescription,
  },
  {
    id: 'h1',
    name: 'H1 Primary Heading',
    description: 'Enforces exactly one non-empty <h1> heading per page',
    run: checkH1,
  },
  {
    id: 'canonical',
    name: 'Canonical URL',
    description: 'Validates presence, absolute URL syntax, and health of canonical tags',
    run: checkCanonical,
  },
  {
    id: 'noindex',
    name: 'Indexability & Noindex Directives',
    description: 'Catches accidental noindex directives via meta robots or X-Robots-Tag headers',
    run: checkNoindex,
  },
  {
    id: 'rendered-vs-raw',
    name: 'Raw vs Rendered HTML Comparison',
    description: 'Detects content and SEO metadata that only exists after JavaScript rendering',
    run: checkRenderedVsRaw,
  },
  {
    id: 'structured-data',
    name: 'Structured Data (JSON-LD)',
    description: 'Validates JSON syntax and schema.org required properties for rich snippets',
    run: checkStructuredData,
  },
  {
    id: 'hreflang',
    name: 'International Hreflang Reciprocity',
    description: 'Enforces valid language codes, self-references, and reciprocal return links',
    run: checkHreflang,
  },
  {
    id: 'sitemap',
    name: 'XML Sitemap Health',
    description: 'Verifies submitted sitemap URLs return 200 OK, are canonical, and indexable',
    run: checkSitemapHealth,
  },
  {
    id: 'robots-txt',
    name: 'Robots.txt Crawlability',
    description: 'Verifies robots.txt does not disallow critical paths or block the site with Disallow: /',
    run: checkRobotsTxt,
  },
];
