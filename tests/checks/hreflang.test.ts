import { describe, it, expect } from 'vitest';
import { checkHreflang } from '../../src/checks/hreflang.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkHreflang', () => {
  it('returns no findings for valid reciprocal self-referencing cluster', () => {
    const pageEn = createMockPage(
      'https://example.com/en',
      `<html><head>
        <link rel="alternate" hreflang="en" href="https://example.com/en">
        <link rel="alternate" hreflang="es" href="https://example.com/es">
      </head></html>`
    );
    const pageEs = createMockPage(
      'https://example.com/es',
      `<html><head>
        <link rel="alternate" hreflang="es" href="https://example.com/es">
        <link rel="alternate" hreflang="en" href="https://example.com/en">
      </head></html>`
    );

    const context = createMockContext([pageEn, pageEs]);
    const findingsEn = checkHreflang(pageEn, context);
    const findingsEs = checkHreflang(pageEs, context);

    expect(findingsEn).toHaveLength(0);
    expect(findingsEs).toHaveLength(0);
  });

  it('flags warning when self-referencing alternate link is missing', () => {
    const page = createMockPage(
      'https://example.com/en',
      `<html><head>
        <link rel="alternate" hreflang="es" href="https://example.com/es">
      </head></html>`
    );
    const context = createMockContext([page]);
    const findings = checkHreflang(page, context);

    expect(findings.some((f) => f.checkId === 'hreflang-missing-self-reference')).toBe(true);
  });

  it('flags error when hreflang href is relative instead of absolute', () => {
    const page = createMockPage(
      'https://example.com/en',
      `<html><head>
        <link rel="alternate" hreflang="en" href="https://example.com/en">
        <link rel="alternate" hreflang="es" href="/es">
      </head></html>`
    );
    const context = createMockContext([page]);
    const findings = checkHreflang(page, context);

    expect(findings.some((f) => f.checkId === 'hreflang-relative-url')).toBe(true);
  });

  it('flags warning on invalid language code syntax', () => {
    const page = createMockPage(
      'https://example.com/en',
      `<html><head>
        <link rel="alternate" hreflang="en" href="https://example.com/en">
        <link rel="alternate" hreflang="123_invalid_code" href="https://example.com/es">
      </head></html>`
    );
    const context = createMockContext([page]);
    const findings = checkHreflang(page, context);

    expect(findings.some((f) => f.checkId === 'hreflang-invalid-code')).toBe(true);
  });

  it('flags error when target page does not return a reciprocal link', () => {
    const pageEn = createMockPage(
      'https://example.com/en',
      `<html><head>
        <link rel="alternate" hreflang="en" href="https://example.com/en">
        <link rel="alternate" hreflang="es" href="https://example.com/es">
      </head></html>`
    );
    // pageEs does NOT link back to /en
    const pageEs = createMockPage(
      'https://example.com/es',
      `<html><head>
        <link rel="alternate" hreflang="es" href="https://example.com/es">
      </head></html>`
    );

    const context = createMockContext([pageEn, pageEs]);
    const findings = checkHreflang(pageEn, context);

    expect(findings.some((f) => f.checkId === 'hreflang-missing-reciprocal')).toBe(true);
    const finding = findings.find((f) => f.checkId === 'hreflang-missing-reciprocal')!;
    expect(finding.severity).toBe('error');
    expect(finding.message).toContain('Missing reciprocal hreflang return tag');
  });
});
