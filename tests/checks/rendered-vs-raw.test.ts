import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { checkRenderedVsRaw } from '../../src/checks/rendered-vs-raw.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkRenderedVsRaw', () => {
  it('returns no findings when raw and rendered content match', () => {
    const html = `<html><head>
      <title>Matching Product Title Example</title>
      <meta name="description" content="Matching description for product">
      <link rel="canonical" href="https://example.com/shoes">
    </head><body><h1>Matching H1 Heading</h1></body></html>`;

    const page = createMockPage('https://example.com/shoes', html);
    page.renderedHtml = html;
    page.rendered$ = cheerio.load(html);

    const context = createMockContext([page]);
    const findings = checkRenderedVsRaw(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags error when critical title exists only in rendered DOM', () => {
    const rawHtml = `<html><head><title></title></head><body></body></html>`;
    const renderedHtml = `<html><head><title>Client Rendered Product Title</title></head><body></body></html>`;

    const page = createMockPage('https://example.com/item', rawHtml);
    page.renderedHtml = renderedHtml;
    page.rendered$ = cheerio.load(renderedHtml);

    const context = createMockContext([page]);
    const findings = checkRenderedVsRaw(page, context);

    expect(findings.some((f) => f.checkId === 'rendered-vs-raw-title')).toBe(true);
    const finding = findings.find((f) => f.checkId === 'rendered-vs-raw-title')!;
    expect(finding.severity).toBe('error');
    expect(finding.message).toContain('missing in raw HTML');
  });

  it('flags error when critical H1 exists only in rendered DOM', () => {
    const rawHtml = `<html><head><title>Title</title></head><body><div>Loading...</div></body></html>`;
    const renderedHtml = `<html><head><title>Title</title></head><body><h1>Client Injected H1</h1></body></html>`;

    const page = createMockPage('https://example.com/item', rawHtml);
    page.renderedHtml = renderedHtml;
    page.rendered$ = cheerio.load(renderedHtml);

    const context = createMockContext([page]);
    const findings = checkRenderedVsRaw(page, context);

    expect(findings.some((f) => f.checkId === 'rendered-vs-raw-h1')).toBe(true);
    const finding = findings.find((f) => f.checkId === 'rendered-vs-raw-h1')!;
    expect(finding.severity).toBe('error');
  });

  it('flags error when canonical tags mismatch between raw and rendered HTML', () => {
    const rawHtml = `<html><head><link rel="canonical" href="https://example.com/item"></head></html>`;
    const renderedHtml = `<html><head><link rel="canonical" href="https://example.com/altered-canonical"></head></html>`;

    const page = createMockPage('https://example.com/item', rawHtml);
    page.renderedHtml = renderedHtml;
    page.rendered$ = cheerio.load(renderedHtml);

    const context = createMockContext([page]);
    const findings = checkRenderedVsRaw(page, context);

    expect(findings.some((f) => f.checkId === 'rendered-vs-raw-canonical-mismatch')).toBe(true);
  });

  it('flags warning when content gap indicates client-side-only rendering', () => {
    const rawHtml = `<html><body><div></div></body></html>`;
    const renderedHtml = `<html><body><main>${'Lorem ipsum dolor sit amet. '.repeat(50)}</main></body></html>`;

    const page = createMockPage('https://example.com/item', rawHtml);
    page.renderedHtml = renderedHtml;
    page.rendered$ = cheerio.load(renderedHtml);

    const context = createMockContext([page]);
    const findings = checkRenderedVsRaw(page, context);

    expect(findings.some((f) => f.checkId === 'rendered-vs-raw-content-gap')).toBe(true);
  });
});
