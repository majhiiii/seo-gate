import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkMetaDescription: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];
  const $ = page.$;

  if (!$) {
    return findings;
  }

  const descElements = $('meta[name="description" i]');
  const descContent = descElements.first().attr('content')?.trim();

  // 1. Missing or empty meta description
  if (descElements.length === 0 || !descContent) {
    findings.push({
      checkId: 'meta-description-missing',
      url: page.url,
      severity: 'warn',
      message: 'Page is missing a meta description tag or the description content is empty',
      evidence: descElements.length === 0 ? 'No <meta name="description"> tag found' : '<meta name="description" content="">',
      fixHint: 'Add a concise meta description summarizing the page content (between 70 and 160 characters).',
      docsLink: 'https://developers.google.com/search/docs/appearance/snippets',
    });
    return findings;
  }

  const min = context.config.checks?.metaDescription?.min ?? 70;
  const max = context.config.checks?.metaDescription?.max ?? 160;

  // 2. Length bounds
  if (descContent.length < min) {
    findings.push({
      checkId: 'meta-description-short',
      url: page.url,
      severity: 'warn',
      message: `Meta description is shorter than recommended minimum of ${min} characters (currently ${descContent.length} characters)`,
      evidence: `<meta name="description" content="${descContent}"> (${descContent.length} chars)`,
      fixHint: `Expand the description to between ${min} and ${max} characters to provide search engines with a meaningful snippet.`,
      docsLink: 'https://developers.google.com/search/docs/appearance/snippets',
    });
  } else if (descContent.length > max) {
    findings.push({
      checkId: 'meta-description-long',
      url: page.url,
      severity: 'warn',
      message: `Meta description exceeds recommended maximum of ${max} characters (currently ${descContent.length} characters) and may be truncated`,
      evidence: `<meta name="description" content="${descContent}"> (${descContent.length} chars)`,
      fixHint: `Shorten the description to under ${max} characters to avoid search result snippet truncation.`,
      docsLink: 'https://developers.google.com/search/docs/appearance/snippets',
    });
  }

  // 3. Uniqueness across the page set
  const checkUnique = context.config.checks?.metaDescription?.unique ?? true;
  if (checkUnique && context.allPages && context.allPages.length > 1) {
    const duplicates = context.allPages.filter((other) => {
      if (other.url === page.url || !other.$) return false;
      const otherDesc = other.$('meta[name="description" i]').first().attr('content')?.trim();
      return otherDesc && otherDesc.toLowerCase() === descContent.toLowerCase();
    });

    if (duplicates.length > 0) {
      const dupUrls = duplicates.map((d) => d.url).join(', ');
      findings.push({
        checkId: 'meta-description-duplicate',
        url: page.url,
        severity: 'warn',
        message: 'Duplicate meta description detected across multiple pages',
        evidence: `Duplicate of: ${dupUrls}`,
        fixHint: 'Ensure each indexable page has a unique meta description tailored to its content.',
        docsLink: 'https://developers.google.com/search/docs/appearance/snippets',
      });
    }
  }

  return findings;
};
