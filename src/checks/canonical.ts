import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkCanonical: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];
  const $ = page.$;

  if (!$) {
    return findings;
  }

  const canonicalElements = $('link[rel="canonical" i]');

  // 1. Missing canonical link
  if (canonicalElements.length === 0) {
    findings.push({
      checkId: 'canonical-missing',
      url: page.url,
      severity: 'error',
      message: 'Page is missing a canonical link tag (<link rel="canonical">)',
      evidence: 'No <link rel="canonical"> element found in HTML head',
      fixHint: 'Add a self-referencing absolute <link rel="canonical" href="..."> tag to specify the authoritative URL.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    });
    return findings;
  }

  // 2. Multiple canonical tags
  if (canonicalElements.length > 1) {
    const urls = canonicalElements.map((_, el) => $(el).attr('href') || '').get().join(', ');
    findings.push({
      checkId: 'canonical-multiple',
      url: page.url,
      severity: 'error',
      message: `Multiple canonical link tags detected (${canonicalElements.length} tags found)`,
      evidence: urls,
      fixHint: 'Ensure exactly one <link rel="canonical"> tag is rendered in the <head> element.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    });
  }

  const href = canonicalElements.first().attr('href')?.trim();

  // 3. Empty canonical href
  if (!href) {
    findings.push({
      checkId: 'canonical-empty',
      url: page.url,
      severity: 'error',
      message: 'Canonical link tag has an empty or missing href attribute',
      evidence: '<link rel="canonical" href="">',
      fixHint: 'Provide an absolute URL in the href attribute of the canonical link tag.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    });
    return findings;
  }

  // 4. Must be an absolute URL (starts with http:// or https://)
  if (!href.startsWith('http://') && !href.startsWith('https://')) {
    findings.push({
      checkId: 'canonical-relative',
      url: page.url,
      severity: 'error',
      message: `Canonical URL must be absolute, but a relative path was found: "${href}"`,
      evidence: `<link rel="canonical" href="${href}">`,
      fixHint: 'Update the canonical URL to include the protocol and domain (e.g. https://example.com/path).',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    });
    return findings;
  }

  // 5. Check if canonical points to a known 4xx/5xx broken page
  if (context.allPages && context.allPages.length > 0) {
    const targetPage = context.allPages.find((p) => {
      try {
        const u1 = new URL(p.url);
        const u2 = new URL(href);
        return u1.origin === u2.origin && u1.pathname === u2.pathname;
      } catch {
        return false;
      }
    });

    if (targetPage && targetPage.statusCode >= 400) {
      findings.push({
        checkId: 'canonical-broken-target',
        url: page.url,
        severity: 'error',
        message: `Canonical tag points to a broken page that returns HTTP ${targetPage.statusCode}: ${href}`,
        evidence: `<link rel="canonical" href="${href}"> (returns HTTP ${targetPage.statusCode})`,
        fixHint: 'Ensure the canonical URL points to a healthy, indexable page returning HTTP 200.',
        docsLink: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
      });
    }
  }

  // 6. Self-referencing check
  const requireSelfReferencing = context.config.checks?.canonical?.requireSelfReferencing ?? true;
  if (requireSelfReferencing) {
    try {
      const pageUrl = new URL(page.url);
      const canonicalUrl = new URL(href);

      // Compare pathname and origin
      const isSelf = pageUrl.origin === canonicalUrl.origin && pageUrl.pathname.replace(/\/$/, '') === canonicalUrl.pathname.replace(/\/$/, '');
      if (!isSelf) {
        findings.push({
          checkId: 'canonical-non-self-referencing',
          url: page.url,
          severity: 'warn',
          message: `Canonical points to a different URL (${href}) instead of self-referencing (${page.url})`,
          evidence: `<link rel="canonical" href="${href}">`,
          fixHint: 'If this is an intentional canonicalization to consolidate duplicate content, ignore this rule; otherwise make it self-referencing.',
          docsLink: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
        });
      }
    } catch {
      // invalid URL structure caught by earlier check
    }
  }

  return findings;
};
