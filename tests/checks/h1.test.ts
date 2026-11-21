import { describe, it, expect } from 'vitest';
import { checkH1 } from '../../src/checks/h1.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkH1', () => {
  const context = createMockContext();

  it('returns no findings when exactly one non-empty H1 is present', () => {
    const page = createMockPage('https://example.com/clean', '<html><body><h1>Primary Heading</h1></body></html>');
    const findings = checkH1(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags missing H1 tag with error severity', () => {
    const page = createMockPage('https://example.com/no-h1', '<html><body><h2>Secondary Only</h2></body></html>');
    const findings = checkH1(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('h1-missing');
    expect(findings[0].severity).toBe('error');
  });

  it('flags whitespace-only H1 tag with error severity', () => {
    const page = createMockPage('https://example.com/empty-h1', '<html><body><h1>   </h1></body></html>');
    const findings = checkH1(page, context);
    expect(findings.some((f) => f.checkId === 'h1-empty')).toBe(true);
    expect(findings[0].severity).toBe('error');
  });

  it('flags multiple H1 tags with warning severity', () => {
    const page = createMockPage(
      'https://example.com/multi-h1',
      '<html><body><h1>First Heading</h1><h1>Second Heading</h1></body></html>'
    );
    const findings = checkH1(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('h1-multiple');
    expect(findings[0].severity).toBe('warn');
    expect(findings[0].message).toContain('Multiple <h1>');
  });
});
