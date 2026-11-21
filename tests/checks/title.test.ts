import { describe, it, expect } from 'vitest';
import { checkTitle } from '../../src/checks/title.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkTitle', () => {
  it('returns no findings for optimal title length and uniqueness', () => {
    const page = createMockPage(
      'https://example.com/clean',
      '<html><head><title>Clean Valid Product Title With Good Length</title></head></html>'
    );
    const context = createMockContext([page]);
    const findings = checkTitle(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags missing title element with error severity', () => {
    const page = createMockPage('https://example.com/no-title', '<html><head></head></html>');
    const context = createMockContext([page]);
    const findings = checkTitle(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('title-missing');
    expect(findings[0].severity).toBe('error');
  });

  it('flags empty title element with error severity', () => {
    const page = createMockPage('https://example.com/empty-title', '<html><head><title>   </title></head></html>');
    const context = createMockContext([page]);
    const findings = checkTitle(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('title-missing');
    expect(findings[0].severity).toBe('error');
  });

  it('flags title shorter than 20 characters with warning', () => {
    const page = createMockPage('https://example.com/short', '<html><head><title>Short Title</title></head></html>');
    const context = createMockContext([page]);
    const findings = checkTitle(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('title-length-short');
    expect(findings[0].severity).toBe('warn');
  });

  it('flags title longer than 65 characters with warning', () => {
    const longTitle = 'This title is intentionally written to be way too long and exceed the standard sixty-five character maximum limit';
    const page = createMockPage('https://example.com/long', `<html><head><title>${longTitle}</title></head></html>`);
    const context = createMockContext([page]);
    const findings = checkTitle(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('title-length-long');
    expect(findings[0].severity).toBe('warn');
  });

  it('flags duplicate titles across different pages with warning', () => {
    const page1 = createMockPage('https://example.com/page1', '<html><head><title>Duplicate Page Title Across Both</title></head></html>');
    const page2 = createMockPage('https://example.com/page2', '<html><head><title>Duplicate Page Title Across Both</title></head></html>');
    const context = createMockContext([page1, page2]);

    const findings1 = checkTitle(page1, context);
    expect(findings1.some((f) => f.checkId === 'title-duplicate')).toBe(true);

    const findings2 = checkTitle(page2, context);
    expect(findings2.some((f) => f.checkId === 'title-duplicate')).toBe(true);
  });
});
