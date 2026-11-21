import { describe, it, expect } from 'vitest';
import { checkMetaDescription } from '../../src/checks/meta-description.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkMetaDescription', () => {
  it('returns no findings for optimal description length and uniqueness', () => {
    const page = createMockPage(
      'https://example.com/clean',
      '<html><head><meta name="description" content="This is an optimal clean meta description that has between seventy and one hundred sixty characters."></head></html>'
    );
    const context = createMockContext([page]);
    const findings = checkMetaDescription(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags missing meta description with warning severity', () => {
    const page = createMockPage('https://example.com/no-desc', '<html><head></head></html>');
    const context = createMockContext([page]);
    const findings = checkMetaDescription(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('meta-description-missing');
    expect(findings[0].severity).toBe('warn');
  });

  it('flags empty meta description with warning severity', () => {
    const page = createMockPage('https://example.com/empty-desc', '<html><head><meta name="description" content="   "></head></html>');
    const context = createMockContext([page]);
    const findings = checkMetaDescription(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('meta-description-missing');
  });

  it('flags meta description shorter than 70 characters with warning', () => {
    const page = createMockPage('https://example.com/short-desc', '<html><head><meta name="description" content="Short description"></head></html>');
    const context = createMockContext([page]);
    const findings = checkMetaDescription(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('meta-description-short');
  });

  it('flags meta description longer than 160 characters with warning', () => {
    const longDesc = 'A'.repeat(165);
    const page = createMockPage('https://example.com/long-desc', `<html><head><meta name="description" content="${longDesc}"></head></html>`);
    const context = createMockContext([page]);
    const findings = checkMetaDescription(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('meta-description-long');
  });

  it('flags duplicate descriptions across pages with warning', () => {
    const desc = 'This is an optimal clean meta description that has between seventy and one hundred sixty characters.';
    const page1 = createMockPage('https://example.com/p1', `<html><head><meta name="description" content="${desc}"></head></html>`);
    const page2 = createMockPage('https://example.com/p2', `<html><head><meta name="description" content="${desc}"></head></html>`);
    const context = createMockContext([page1, page2]);

    const findings1 = checkMetaDescription(page1, context);
    expect(findings1.some((f) => f.checkId === 'meta-description-duplicate')).toBe(true);
  });
});
