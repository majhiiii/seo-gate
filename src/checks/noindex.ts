import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkNoindex: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];
  const $ = page.$;

  let hasMetaNoindex = false;
  let metaEvidence = '';

  if ($) {
    $('meta[name="robots" i], meta[name="googlebot" i]').each((_, el) => {
      const content = $(el).attr('content') || '';
      if (/\bnoindex\b/i.test(content)) {
        hasMetaNoindex = true;
        metaEvidence = $.html(el);
      }
    });
  }

  // Check HTTP response headers (X-Robots-Tag)
  let hasHeaderNoindex = false;
  let headerEvidence = '';
  const xRobotsTag = page.headers['x-robots-tag'];
  if (xRobotsTag && /\bnoindex\b/i.test(xRobotsTag)) {
    hasHeaderNoindex = true;
    headerEvidence = `X-Robots-Tag: ${xRobotsTag}`;
  }

  const allowOnStaging = context.config.checks?.noindex?.allowOnStaging ?? false;

  if (hasMetaNoindex && !allowOnStaging) {
    findings.push({
      checkId: 'noindex-meta',
      url: page.url,
      severity: 'error',
      message: 'Page contains a noindex directive in HTML meta tag but is configured to be indexable',
      evidence: metaEvidence,
      fixHint: 'Remove "noindex" from the <meta name="robots"> tag before deploying to production.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/block-indexing',
    });
  }

  if (hasHeaderNoindex && !allowOnStaging) {
    findings.push({
      checkId: 'noindex-header',
      url: page.url,
      severity: 'error',
      message: 'Page contains a noindex directive in the X-Robots-Tag HTTP header',
      evidence: headerEvidence,
      fixHint: 'Remove "noindex" from the web server response headers or CDN rewrite rules.',
      docsLink: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#xrobotstag',
    });
  }

  return findings;
};
