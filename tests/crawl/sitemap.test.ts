import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseSitemapXml, fetchSitemap } from '../../src/crawl/sitemap.js';
import { startFixtureServer, type FixtureServerInstance } from '../../fixtures/test-site/server.js';

describe('Sitemap XML Parser', () => {
  let fixture: FixtureServerInstance;

  beforeAll(async () => {
    fixture = await startFixtureServer(0);
  });

  afterAll(async () => {
    await fixture.stop();
  });

  it('extracts unique URLs from standard urlset sitemap', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-11-20</lastmod>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
  <url>
    <loc>https://example.com/</loc>
  </url>
</urlset>`;

    const result = parseSitemapXml(xml);
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain('https://example.com/');
    expect(result.urls).toContain('https://example.com/about');
    expect(result.errors).toHaveLength(0);
  });

  it('handles sitemap index files containing <sitemap><loc>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-products.xml</loc>
  </sitemap>
</sitemapindex>`;

    const result = parseSitemapXml(xml);
    expect(result.urls).toContain('https://example.com/sitemap-products.xml');
  });

  it('returns empty list gracefully on invalid non-xml string', () => {
    const result = parseSitemapXml('not xml at all');
    expect(result.urls).toHaveLength(0);
  });

  it('fetches sitemap over HTTP and parses correctly', async () => {
    const sitemapUrl = `${fixture.baseUrl}/sitemap.xml`;
    const result = await fetchSitemap(sitemapUrl);
    expect(result.urls.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles sitemap fetch errors gracefully on 404', async () => {
    const sitemapUrl = `${fixture.baseUrl}/non-existent-sitemap.xml`;
    const result = await fetchSitemap(sitemapUrl);
    expect(result.urls).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
