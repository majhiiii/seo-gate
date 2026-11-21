import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { normalizeUrl, fetchPage, crawlTarget, CrawlerError } from '../../src/crawl/fetcher.js';
import { startFixtureServer, type FixtureServerInstance } from '../../fixtures/test-site/server.js';
import type { SeoGateConfig } from '../../src/types.js';

describe('Crawler & Page Fetcher', () => {
  let fixture: FixtureServerInstance;

  beforeAll(async () => {
    fixture = await startFixtureServer(0);
  });

  afterAll(async () => {
    await fixture.stop();
  });

  describe('normalizeUrl', () => {
    it('normalizes trailing slashes for non-root paths', () => {
      expect(normalizeUrl('https://example.com/shoes/')).toBe('https://example.com/shoes');
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('strips url hash fragments', () => {
      expect(normalizeUrl('https://example.com/shoes#reviews')).toBe('https://example.com/shoes');
    });

    it('resolves relative URLs against a base URL', () => {
      expect(normalizeUrl('/boots', 'https://example.com/category/')).toBe('https://example.com/boots');
    });
  });

  describe('fetchPage with Live Fixture', () => {
    it('fetches a 200 page and populates Cheerio instance', async () => {
      const page = await fetchPage(`${fixture.baseUrl}/`);
      expect(page.statusCode).toBe(200);
      expect(page.$).toBeDefined();
      expect(page.$!('h1').text().trim()).toBe('Welcome to Acme Storefront');
    });

    it('records redirect chain on multi-hop redirects', async () => {
      const page = await fetchPage(`${fixture.baseUrl}/redirect-chain-1`);
      expect(page.statusCode).toBe(200);
      expect(page.redirectChain).toBeDefined();
      expect(page.redirectChain!.length).toBe(3); // /redirect-chain-1 -> /redirect-chain-2 -> /redirect-final
    });

    it('handles redirect loops safely without infinite recursion', async () => {
      const page = await fetchPage(`${fixture.baseUrl}/redirect-loop-1`);
      expect(page.redirectChain).toBeDefined();
      expect(page.redirectChain!.length).toBeGreaterThan(1);
    });
  });

  describe('crawlTarget error handling', () => {
    it('throws CrawlerError when target host is completely unreachable', async () => {
      const deadConfig: SeoGateConfig = {
        target: 'http://127.0.0.1:59999', // Non-existent local port
        mode: 'strict',
        pages: { include: ['/'] },
      };

      await expect(crawlTarget(deadConfig)).rejects.toThrow(CrawlerError);
    });
  });
});
