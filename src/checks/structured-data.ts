import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

interface SchemaValidationRule {
  type: string;
  requiredFields: string[];
}

const SCHEMA_RULES: Record<string, string[]> = {
  Product: ['name', 'offers'],
  BreadcrumbList: ['itemListElement'],
  Organization: ['name', 'url'],
  FAQPage: ['mainEntity'],
  Article: ['headline', 'datePublished'],
};

export const checkStructuredData: CheckFunction = (page: PageAudit, _context: CheckContext): Finding[] => {
  const findings: Finding[] = [];
  const $ = page.$;

  if (!$) {
    return findings;
  }

  const scripts = $('script[type="application/ld+json"]');

  scripts.each((idx, el) => {
    const rawContent = $(el).html()?.trim() || '';

    if (!rawContent) {
      findings.push({
        checkId: 'structured-data-empty',
        url: page.url,
        severity: 'warn',
        message: 'Empty <script type="application/ld+json"> block detected',
        evidence: '<script type="application/ld+json"></script>',
        fixHint: 'Remove empty structured data blocks or populate valid schema.org JSON-LD.',
        docsLink: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
      });
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      findings.push({
        checkId: 'structured-data-syntax',
        url: page.url,
        severity: 'error',
        message: `Invalid JSON-LD syntax in script block #${idx + 1}: ${(err as Error).message}`,
        evidence: rawContent.length > 100 ? `${rawContent.slice(0, 100)}...` : rawContent,
        fixHint: 'Fix JSON syntax errors (check for trailing commas, unquoted keys, or mismatched brackets).',
        docsLink: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
      });
      return;
    }

    // Inspect objects (handle single object or array of objects)
    const objects = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);

    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue;
      const schemaType = obj['@type'];
      if (!schemaType || typeof schemaType !== 'string') continue;

      const required = SCHEMA_RULES[schemaType];
      if (required) {
        for (const field of required) {
          if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
            findings.push({
              checkId: 'structured-data-missing-field',
              url: page.url,
              severity: 'warn',
              message: `Structured data for @type "${schemaType}" is missing recommended property: "${field}"`,
              evidence: `JSON-LD @type "${schemaType}" without "${field}"`,
              fixHint: `Include the "${field}" property in your schema.org "${schemaType}" JSON-LD markup to unlock rich search results.`,
              docsLink: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
            });
          }
        }
      }
    }
  });

  return findings;
};
