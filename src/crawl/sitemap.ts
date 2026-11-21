import * as cheerio from 'cheerio';

export interface SitemapParseResult {
  urls: string[];
  errors: string[];
}

/**
 * Parses an XML sitemap string and returns all extracted <loc> URLs.
 * Handles both default sitemaps.org namespaces and un-namespaced XML tags.
 */
export function parseSitemapXml(xmlContent: string): SitemapParseResult {
  const urls: string[] = [];
  const errors: string[] = [];

  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });

    // Look for <url><loc>...</loc></url> or <sitemap><loc>...</loc></sitemap>
    $('loc').each((_, el) => {
      const locText = $(el).text().trim();
      if (locText && locText.startsWith('http')) {
        urls.push(locText);
      }
    });

    if (urls.length === 0 && xmlContent.includes('<loc>')) {
      // Fallback regex in case of XML parse nuances
      const regex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(xmlContent)) !== null) {
        if (match[1]) urls.push(match[1].trim());
      }
    }
  } catch (err) {
    errors.push(`XML parsing error: ${(err as Error).message}`);
  }

  return {
    urls: Array.from(new Set(urls)),
    errors,
  };
}

/**
 * Fetches and parses a sitemap from a given URL.
 */
export async function fetchSitemap(sitemapUrl: string, timeoutMs: number = 10000): Promise<SitemapParseResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(sitemapUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'seo-gate/0.1.0 (+https://github.com/seo-gate)',
        Accept: 'application/xml, text/xml, */*',
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        urls: [],
        errors: [`Failed to fetch sitemap from ${sitemapUrl}: HTTP ${response.status} ${response.statusText}`],
      };
    }

    const xml = await response.text();
    return parseSitemapXml(xml);
  } catch (err) {
    return {
      urls: [],
      errors: [`Error retrieving sitemap from ${sitemapUrl}: ${(err as Error).message}`],
    };
  }
}
