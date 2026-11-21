import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkH1: CheckFunction = (page: PageAudit, _context: CheckContext): Finding[] => {
  const findings: Finding[] = [];
  const $ = page.$;

  if (!$) {
    return findings;
  }

  const h1Elements = $('h1');
  const count = h1Elements.length;

  if (count === 0) {
    findings.push({
      checkId: 'h1-missing',
      url: page.url,
      severity: 'error',
      message: 'Page is missing an <h1> heading element',
      evidence: 'No <h1> tag found in HTML',
      fixHint: 'Add exactly one descriptive <h1> heading communicating the primary subject of the page.',
      docsLink: 'https://developers.google.com/search/docs/appearance/title-link',
    });
    return findings;
  }

  // Check if primary H1 is empty text
  const primaryText = h1Elements.first().text().trim();
  if (!primaryText) {
    findings.push({
      checkId: 'h1-empty',
      url: page.url,
      severity: 'error',
      message: 'The <h1> heading contains empty or whitespace-only text',
      evidence: '<h1></h1>',
      fixHint: 'Provide meaningful, visible text inside the <h1> heading.',
      docsLink: 'https://developers.google.com/search/docs/appearance/title-link',
    });
  }

  if (count > 1) {
    const snippets = h1Elements.map((_, el) => `<h1>${$(el).text().trim()}</h1>`).get().join(' | ');
    findings.push({
      checkId: 'h1-multiple',
      url: page.url,
      severity: 'warn',
      message: `Multiple <h1> headings found (${count} headings). Best practice is exactly one <h1> per page`,
      evidence: snippets,
      fixHint: 'Demote secondary <h1> headings to <h2> or <h3> to establish a clear hierarchy.',
      docsLink: 'https://developers.google.com/search/docs/appearance/title-link',
    });
  }

  return findings;
};
