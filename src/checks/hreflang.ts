import type { Finding, HreflangTag, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

const ISO_LANG_REGEX = /^([a-z]{2}(-[a-zA-Z]{2,4})?|x-default)$/i;

function normalizeHref(href: string, base: string): string {
  try {
    const url = new URL(href, base);
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return href;
  }
}

export const checkHreflang: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];
  const $ = page.$;

  if (!$) {
    return findings;
  }

  const links = $('link[rel="alternate" i][hreflang]');
  if (links.length === 0) {
    return findings; // Hreflang is optional unless present
  }

  const tags: HreflangTag[] = [];

  links.each((_, el) => {
    const lang = $(el).attr('hreflang')?.trim().toLowerCase() || '';
    const href = $(el).attr('href')?.trim() || '';
    if (lang && href) {
      tags.push({ lang, href });
    }
  });

  const normalizedPageUrl = normalizeHref(page.url, page.url);

  // 1. Language code validation
  for (const tag of tags) {
    if (!ISO_LANG_REGEX.test(tag.lang)) {
      findings.push({
        checkId: 'hreflang-invalid-code',
        url: page.url,
        severity: 'warn',
        message: `Invalid hreflang language/region code format: "${tag.lang}"`,
        evidence: `<link rel="alternate" hreflang="${tag.lang}" href="${tag.href}">`,
        fixHint: 'Use standard ISO 639-1 language codes (e.g. "en", "es-ES", or "x-default").',
        docsLink: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
      });
    }

    if (!tag.href.startsWith('http://') && !tag.href.startsWith('https://')) {
      findings.push({
        checkId: 'hreflang-relative-url',
        url: page.url,
        severity: 'error',
        message: `Hreflang href must be an absolute URL, but received relative path: "${tag.href}"`,
        evidence: `<link rel="alternate" hreflang="${tag.lang}" href="${tag.href}">`,
        fixHint: 'Update the hreflang href to an absolute URL including protocol and domain.',
        docsLink: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
      });
    }
  }

  // 2. Self-referencing check
  const hasSelfReference = tags.some((tag) => normalizeHref(tag.href, page.url) === normalizedPageUrl);
  if (!hasSelfReference) {
    findings.push({
      checkId: 'hreflang-missing-self-reference',
      url: page.url,
      severity: 'warn',
      message: 'Hreflang cluster is missing a self-referencing alternate link for this page',
      evidence: `Page: ${page.url} is not listed in its own alternate hreflang tags`,
      fixHint: 'Add a self-referencing <link rel="alternate" hreflang="..." href="..."> pointing to this page.',
      docsLink: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
    });
  }

  // 3. Reciprocal return tags check
  if (context.allPages && context.allPages.length > 0) {
    for (const tag of tags) {
      const targetNormalized = normalizeHref(tag.href, page.url);
      if (targetNormalized === normalizedPageUrl) continue;

      const targetPage = context.allPages.find((p) => normalizeHref(p.url, p.url) === targetNormalized);
      if (targetPage && targetPage.$) {
        const targetAlternateLinks = targetPage.$('link[rel="alternate" i][hreflang]');
        let hasReturnTag = false;

        targetAlternateLinks.each((_, el) => {
          const retHref = targetPage.$!(el).attr('href')?.trim() || '';
          if (normalizeHref(retHref, targetPage.url) === normalizedPageUrl) {
            hasReturnTag = true;
          }
        });

        if (!hasReturnTag) {
          findings.push({
            checkId: 'hreflang-missing-reciprocal',
            url: page.url,
            severity: 'error',
            message: `Missing reciprocal hreflang return tag on ${tag.href} back to ${page.url}`,
            evidence: `${page.url} links to ${tag.href}, but ${tag.href} does not link back`,
            fixHint: `Add a reciprocal hreflang link on ${tag.href} referencing ${page.url}. Google ignores non-reciprocal hreflang clusters.`,
            docsLink: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
          });
        }
      }
    }
  }

  return findings;
};
