import * as cheerio from 'cheerio';
import type { Finding, PageAudit, Severity } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkRenderedVsRaw: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];

  // Only run if renderedHtml was captured
  if (!page.renderedHtml) {
    return findings;
  }

  const raw$ = page.$;
  const rendered$ = page.rendered$ || cheerio.load(page.renderedHtml);

  if (!raw$) {
    return findings;
  }

  const criticalList = context.config.checks?.renderedVsRaw?.critical || ['h1', 'title', 'canonical'];

  // 1. Title comparison
  const rawTitle = raw$('title').first().text().trim();
  const renderedTitle = rendered$('title').first().text().trim();

  if (!rawTitle && renderedTitle) {
    const isCritical = criticalList.includes('title');
    const severity: Severity = isCritical ? 'error' : 'warn';
    findings.push({
      checkId: 'rendered-vs-raw-title',
      url: page.url,
      severity,
      message: 'Page title is missing in raw HTML and only exists after client-side JavaScript execution',
      evidence: `Raw: <title></title> | Rendered: <title>${renderedTitle}</title>`,
      fixHint: 'Render the <title> tag server-side (SSR) so crawlers without JavaScript execution can index it.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
    });
  }

  // 2. H1 comparison
  const rawH1 = raw$('h1').first().text().trim();
  const renderedH1 = rendered$('h1').first().text().trim();

  if (!rawH1 && renderedH1) {
    const isCritical = criticalList.includes('h1');
    const severity: Severity = isCritical ? 'error' : 'warn';
    findings.push({
      checkId: 'rendered-vs-raw-h1',
      url: page.url,
      severity,
      message: 'Primary <h1> heading is missing in raw HTML and only exists after JavaScript rendering',
      evidence: `Raw: (no h1) | Rendered: <h1>${renderedH1}</h1>`,
      fixHint: 'Render the primary <h1> heading server-side so search engines receive meaningful topic headings immediately.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
    });
  }

  // 3. Meta description comparison
  const rawDesc = raw$('meta[name="description" i]').first().attr('content')?.trim();
  const renderedDesc = rendered$('meta[name="description" i]').first().attr('content')?.trim();

  if (!rawDesc && renderedDesc) {
    const isCritical = criticalList.includes('description') || criticalList.includes('metaDescription');
    const severity: Severity = isCritical ? 'error' : 'warn';
    findings.push({
      checkId: 'rendered-vs-raw-description',
      url: page.url,
      severity,
      message: 'Meta description is missing in raw HTML and only injected after JavaScript execution',
      evidence: `Raw: (none) | Rendered: <meta name="description" content="${renderedDesc}">`,
      fixHint: 'Include the meta description in the initial server response HTML.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
    });
  }

  // 4. Canonical comparison
  const rawCanonical = raw$('link[rel="canonical" i]').first().attr('href')?.trim();
  const renderedCanonical = rendered$('link[rel="canonical" i]').first().attr('href')?.trim();

  if (!rawCanonical && renderedCanonical) {
    const isCritical = criticalList.includes('canonical');
    const severity: Severity = isCritical ? 'error' : 'warn';
    findings.push({
      checkId: 'rendered-vs-raw-canonical',
      url: page.url,
      severity,
      message: 'Canonical link tag is missing in raw HTML and only added by client JavaScript',
      evidence: `Raw: (none) | Rendered: <link rel="canonical" href="${renderedCanonical}">`,
      fixHint: 'Define the canonical URL in the initial server HTML to ensure crawlers detect the authoritative URL.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
    });
  } else if (rawCanonical && renderedCanonical && rawCanonical !== renderedCanonical) {
    findings.push({
      checkId: 'rendered-vs-raw-canonical-mismatch',
      url: page.url,
      severity: 'error',
      message: `Canonical URL in raw HTML (${rawCanonical}) does not match rendered HTML (${renderedCanonical})`,
      evidence: `Raw: ${rawCanonical} vs Rendered: ${renderedCanonical}`,
      fixHint: 'Ensure client-side JavaScript does not alter or conflict with the server-rendered canonical tag.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    });
  }

  // 5. Significant text content delta (gap)
  const rawTextLength = raw$('body').text().replace(/\s+/g, ' ').trim().length;
  const renderedTextLength = rendered$('body').text().replace(/\s+/g, ' ').trim().length;

  if (rawTextLength < 100 && renderedTextLength > 500) {
    findings.push({
      checkId: 'rendered-vs-raw-content-gap',
      url: page.url,
      severity: 'warn',
      message: 'Substantial content is rendered exclusively via client-side JavaScript (raw HTML is largely blank)',
      evidence: `Raw text length: ${rawTextLength} chars | Rendered text length: ${renderedTextLength} chars`,
      fixHint: 'Implement Server-Side Rendering (SSR) or Static Site Generation (SSG) for critical storefront text.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
    });
  }

  return findings;
};
