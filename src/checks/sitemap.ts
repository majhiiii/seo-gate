import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkSitemapHealth: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];

  // Only evaluate pages that came from or exist in sitemaps
  if (!context.config.pages.sitemap) {
    return findings;
  }

  // 1. If page status is client error or server error, and page was audited
  if (page.statusCode >= 400) {
    findings.push({
      checkId: 'sitemap-broken-url',
      url: page.url,
      severity: 'error',
      message: `Sitemap URL returns broken HTTP ${page.statusCode}`,
      evidence: `HTTP ${page.statusCode} on sitemap entry: ${page.url}`,
      fixHint: 'Remove broken or 404 URLs from sitemap.xml or restore the missing page.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
    });
  }

  // 2. Sitemap URL has noindex
  if (page.$) {
    const hasNoindexMeta = page.$('meta[name="robots" i]').attr('content')?.toLowerCase().includes('noindex');
    const hasNoindexHeader = page.headers['x-robots-tag']?.toLowerCase().includes('noindex');

    if (hasNoindexMeta || hasNoindexHeader) {
      findings.push({
        checkId: 'sitemap-noindexed-url',
        url: page.url,
        severity: 'error',
        message: 'Sitemap contains a URL that is marked as noindex',
        evidence: `URL: ${page.url} is submitted in sitemap but delivers noindex directive`,
        fixHint: 'Sitemaps must only contain indexable URLs. Either remove noindex or exclude the URL from sitemap.xml.',
        docsLink: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
      });
    }

    // 3. Sitemap URL is not canonical to itself
    const canonical = page.$('link[rel="canonical" i]').attr('href')?.trim();
    if (canonical && (canonical.startsWith('http://') || canonical.startsWith('https://'))) {
      try {
        const u1 = new URL(page.url);
        const u2 = new URL(canonical);
        const isSelf = u1.origin === u2.origin &&
                       u1.pathname.replace(/\/$/, '') === u2.pathname.replace(/\/$/, '') &&
                       u1.search === u2.search;
        if (!isSelf) {
          findings.push({
            checkId: 'sitemap-non-canonical-url',
            url: page.url,
            severity: 'warn',
            message: `Sitemap contains a non-canonical URL that points to ${canonical}`,
            evidence: `Sitemap entry: ${page.url} -> Canonical: ${canonical}`,
            fixHint: 'Sitemaps should only contain canonical URLs to avoid wasting search engine crawl budget.',
            docsLink: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
          });
        }
      } catch {
        // Handled by canonical check
      }
    }
  }

  return findings;
};
