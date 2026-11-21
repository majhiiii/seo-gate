import { describe, it, expect } from 'vitest';
import { checkNoindex } from '../../src/checks/noindex.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkNoindex', () => {
  const context = createMockContext();

  it('returns no findings on clean indexable page', () => {
    const page = createMockPage(
      'https://example.com/shoes',
      '<html><head><meta name="robots" content="index, follow"></head></html>'
    );
    const findings = checkNoindex(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags accidental noindex in meta robots tag with error severity', () => {
    const page = createMockPage(
      'https://example.com/shoes',
      '<html><head><meta name="robots" content="noindex, follow"></head></html>'
    );
    const findings = checkNoindex(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('noindex-meta');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].evidence).toContain('noindex, follow');
  });

  it('flags accidental noindex in X-Robots-Tag HTTP header with error severity', () => {
    const page = createMockPage(
      'https://example.com/shoes',
      '<html><head></head></html>',
      200,
      { 'x-robots-tag': 'noindex, noarchive' }
    );
    const findings = checkNoindex(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('noindex-header');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].evidence).toContain('X-Robots-Tag: noindex, noarchive');
  });

  it('allows noindex when allowOnStaging is explicitly configured', () => {
    const stagingContext = createMockContext([], {
      checks: {
        noindex: { allowOnStaging: true },
      },
    });
    const page = createMockPage(
      'https://staging.example.com/shoes',
      '<html><head><meta name="robots" content="noindex"></head></html>',
      200,
      { 'x-robots-tag': 'noindex' }
    );
    const findings = checkNoindex(page, stagingContext);
    expect(findings).toHaveLength(0);
  });
});
