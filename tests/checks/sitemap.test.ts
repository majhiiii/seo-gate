import { describe, it, expect } from 'vitest';
import { checkSitemapHealth } from '../../src/checks/sitemap.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkSitemapHealth', () => {
  it('returns no findings on clean healthy sitemap entry', () => {
    const page = createMockPage(
      'https://example.com/shoes',
      '<html><head><link rel="canonical" href="https://example.com/shoes"></head></html>',
      200
    );
    const context = createMockContext([page], { pages: { include: ['/'], sitemap: true } });
    const findings = checkSitemapHealth(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags error when a sitemap URL returns HTTP 404', () => {
    const page = createMockPage('https://example.com/broken-page', '<html>404</html>', 404);
    const context = createMockContext([page], { pages: { include: ['/'], sitemap: true } });
    const findings = checkSitemapHealth(page, context);

    expect(findings.some((f) => f.checkId === 'sitemap-broken-url')).toBe(true);
    const finding = findings.find((f) => f.checkId === 'sitemap-broken-url')!;
    expect(finding.severity).toBe('error');
    expect(finding.message).toContain('HTTP 404');
  });

  it('flags error when a sitemap URL is marked with noindex', () => {
    const page = createMockPage(
      'https://example.com/private',
      '<html><head><meta name="robots" content="noindex, follow"></head></html>',
      200
    );
    const context = createMockContext([page], { pages: { include: ['/'], sitemap: true } });
    const findings = checkSitemapHealth(page, context);

    expect(findings.some((f) => f.checkId === 'sitemap-noindexed-url')).toBe(true);
    expect(findings[0].severity).toBe('error');
  });

  it('flags warning when sitemap URL points to a different canonical URL', () => {
    const page = createMockPage(
      'https://example.com/shoes?color=blue',
      '<html><head><link rel="canonical" href="https://example.com/shoes"></head></html>',
      200
    );
    const context = createMockContext([page], { pages: { include: ['/'], sitemap: true } });
    const findings = checkSitemapHealth(page, context);

    expect(findings.some((f) => f.checkId === 'sitemap-non-canonical-url')).toBe(true);
    expect(findings[0].severity).toBe('warn');
  });
});
