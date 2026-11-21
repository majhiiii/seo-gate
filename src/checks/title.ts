import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkTitle: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];
  const $ = page.$;

  if (!$) {
    return findings;
  }

  const titleElements = $('title');
  const titleText = titleElements.first().text().trim();

  // 1. Missing title tag or empty title
  if (titleElements.length === 0 || !titleText) {
    findings.push({
      checkId: 'title-missing',
      url: page.url,
      severity: 'error',
      message: 'Page is missing a title tag or the title tag is empty',
      evidence: titleElements.length === 0 ? 'No <title> tag found in HTML' : '<title></title>',
      fixHint: 'Add a descriptive <title> tag between 20 and 65 characters inside the <head> element.',
      docsLink: 'https://developers.google.com/search/docs/appearance/title-link',
    });
    return findings;
  }

  const min = context.config.checks?.title?.min ?? 20;
  const max = context.config.checks?.title?.max ?? 65;

  // 2. Title length bounds
  if (titleText.length < min) {
    findings.push({
      checkId: 'title-length-short',
      url: page.url,
      severity: 'warn',
      message: `Title is shorter than recommended minimum of ${min} characters (currently ${titleText.length} characters)`,
      evidence: `<title>${titleText}</title> (${titleText.length} chars)`,
      fixHint: `Expand the title to between ${min} and ${max} characters with descriptive keywords and brand naming.`,
      docsLink: 'https://developers.google.com/search/docs/appearance/title-link',
    });
  } else if (titleText.length > max) {
    findings.push({
      checkId: 'title-length-long',
      url: page.url,
      severity: 'warn',
      message: `Title exceeds recommended maximum of ${max} characters (currently ${titleText.length} characters) and may be truncated in search results`,
      evidence: `<title>${titleText}</title> (${titleText.length} chars)`,
      fixHint: `Shorten the title to under ${max} characters to avoid search snippet truncation.`,
      docsLink: 'https://developers.google.com/search/docs/appearance/title-link',
    });
  }

  // 3. Uniqueness across the page set
  const checkUnique = context.config.checks?.title?.unique ?? true;
  if (checkUnique && context.allPages && context.allPages.length > 1) {
    const duplicates = context.allPages.filter((other) => {
      if (other.url === page.url || !other.$) return false;
      const otherTitle = other.$('title').first().text().trim();
      return otherTitle.toLowerCase() === titleText.toLowerCase();
    });

    if (duplicates.length > 0) {
      const dupUrls = duplicates.map((d) => d.url).join(', ');
      findings.push({
        checkId: 'title-duplicate',
        url: page.url,
        severity: 'warn',
        message: `Duplicate title detected across multiple pages: "${titleText}"`,
        evidence: `Duplicate of: ${dupUrls}`,
        fixHint: 'Ensure each indexable page has a unique title representing its specific content.',
        docsLink: 'https://developers.google.com/search/docs/appearance/title-link',
      });
    }
  }

  return findings;
};
