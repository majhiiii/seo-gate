import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderPage, closeBrowser } from '../../src/render/browser.js';
import { startFixtureServer, type FixtureServerInstance } from '../../fixtures/test-site/server.js';

describe('Playwright Headless Renderer', () => {
  let fixture: FixtureServerInstance;

  beforeAll(async () => {
    fixture = await startFixtureServer(0);
  });

  afterAll(async () => {
    await closeBrowser();
    await fixture.stop();
  });

  it('renders dynamic client-side JavaScript DOM using Playwright', async () => {
    const url = `${fixture.baseUrl}/rendered-vs-raw-js-only`;
    const result = await renderPage(url, 10000);

    expect(result.renderedHtml).toBeDefined();
    expect(result.renderedHtml).toContain('Client Rendered Product Page Title');
    expect(result.renderedHtml).toContain('Client Rendered Dynamic H1');
  });

  it('handles unreachable render targets gracefully without throwing', async () => {
    const result = await renderPage('http://127.0.0.1:59995/dead-port', 2000);
    expect(result.renderedHtml).toBe('');
    expect(result.error).toBeDefined();
  });
});
