import { describe, it, expect } from 'vitest';
import { checkCanonical } from '../../src/checks/canonical.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkCanonical', () => {
  it('returns no findings for clean self-referencing absolute canonical', () => {
    const page = createMockPage(
      'https://example.com/shoes',
      '<html><head><link rel="canonical" href="https://example.com/shoes"></head></html>'
    );
    const context = createMockContext([page]);
    const findings = checkCanonical(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags missing canonical tag with error severity', () => {
    const page = createMockPage('https://example.com/no-canonical', '<html><head></head></html>');
    const context = createMockContext([page]);
    const findings = checkCanonical(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('canonical-missing');
    expect(findings[0].severity).toBe('error');
  });

  it('flags multiple canonical tags with error severity', () => {
    const html = `<html><head>
      <link rel="canonical" href="https://example.com/a">
      <link rel="canonical" href="https://example.com/b">
    </head></html>`;
    const page = createMockPage('https://example.com/multi', html);
    const context = createMockContext([page]);
    const findings = checkCanonical(page, context);
    expect(findings.some((f) => f.checkId === 'canonical-multiple')).toBe(true);
  });

  it('flags relative canonical URL with error severity', () => {
    const page = createMockPage(
      'https://example.com/relative',
      '<html><head><link rel="canonical" href="/products/shoes"></head></html>'
    );
    const context = createMockContext([page]);
    const findings = checkCanonical(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('canonical-relative');
    expect(findings[0].severity).toBe('error');
  });

  it('flags empty canonical href with error severity', () => {
    const page = createMockPage(
      'https://example.com/empty',
      '<html><head><link rel="canonical" href=""></head></html>'
    );
    const context = createMockContext([page]);
    const findings = checkCanonical(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('canonical-empty');
  });

  it('flags canonical pointing to a known 404 page with error severity', () => {
    const badTarget = createMockPage('https://example.com/broken-target', '<html>404</html>', 404);
    const page = createMockPage(
      'https://example.com/source',
      '<html><head><link rel="canonical" href="https://example.com/broken-target"></head></html>'
    );
    const context = createMockContext([page, badTarget]);
    const findings = checkCanonical(page, context);
    expect(findings.some((f) => f.checkId === 'canonical-broken-target')).toBe(true);
  });

  it('warns when canonical is non-self-referencing', () => {
    const page = createMockPage(
      'https://example.com/source',
      '<html><head><link rel="canonical" href="https://example.com/master-page"></head></html>'
    );
    const context = createMockContext([page]);
    const findings = checkCanonical(page, context);
    expect(findings.some((f) => f.checkId === 'canonical-non-self-referencing')).toBe(true);
    expect(findings[0].severity).toBe('warn');
  });
});
