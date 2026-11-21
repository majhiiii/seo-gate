import { describe, it, expect } from 'vitest';
import { checkStructuredData } from '../../src/checks/structured-data.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkStructuredData', () => {
  const context = createMockContext();

  it('returns no findings on valid schema markup with required fields', () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Trailmaster Boots",
        "offers": { "@type": "Offer", "price": "129.99" }
      }
      </script>
    </head></html>`;

    const page = createMockPage('https://example.com/shoes', html);
    const findings = checkStructuredData(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags syntax error when JSON-LD is malformed with error severity', () => {
    const html = `<html><head>
      <script type="application/ld+json">
      { "name": "Broken", "invalid_trailing_comma": true, }
      </script>
    </head></html>`;

    const page = createMockPage('https://example.com/broken-json', html);
    const findings = checkStructuredData(page, context);

    expect(findings.some((f) => f.checkId === 'structured-data-syntax')).toBe(true);
    const finding = findings.find((f) => f.checkId === 'structured-data-syntax')!;
    expect(finding.severity).toBe('error');
    expect(finding.message).toContain('Invalid JSON-LD syntax');
  });

  it('flags warning when recommended properties are missing', () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Missing Offers Product"
      }
      </script>
    </head></html>`;

    const page = createMockPage('https://example.com/no-offers', html);
    const findings = checkStructuredData(page, context);

    expect(findings.some((f) => f.checkId === 'structured-data-missing-field')).toBe(true);
    const finding = findings.find((f) => f.checkId === 'structured-data-missing-field')!;
    expect(finding.severity).toBe('warn');
    expect(finding.message).toContain('missing recommended property: "offers"');
  });

  it('warns on completely empty JSON-LD blocks', () => {
    const html = `<html><head><script type="application/ld+json"></script></head></html>`;
    const page = createMockPage('https://example.com/empty-jsonld', html);
    const findings = checkStructuredData(page, context);

    expect(findings.some((f) => f.checkId === 'structured-data-empty')).toBe(true);
  });
});
