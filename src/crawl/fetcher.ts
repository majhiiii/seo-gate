import * as cheerio from 'cheerio';
import type { PageAudit, SeoGateConfig } from '../types.js';
import { fetchSitemap } from './sitemap.js';
import { renderPage, closeBrowser } from '../render/browser.js';

export class CrawlerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CrawlerError';
  }
}

/**
 * Normalizes URLs by removing trailing slashes (except root) and resolving relative paths.
 */
export function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  try {
    const parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    // Remove default ports if present
    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }
    // Remove hash fragment
    parsed.hash = '';
    let result = parsed.toString();
    if (parsed.pathname !== '/' && result.endsWith('/')) {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return rawUrl;
  }
}

function matchesPattern(urlPath: string, pattern: string): boolean {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return urlPath.startsWith(prefix);
  }
  return urlPath === pattern || urlPath === pattern + '/';
}

/**
 * Fetches a single URL while recording redirect hops and headers.
 */
export async function fetchPage(
  initialUrl: string,
  timeoutMs: number = 15000,
  maxHops: number = 6
): Promise<PageAudit> {
  let currentUrl = initialUrl;
  const redirectChain: string[] = [initialUrl];
  const visited = new Set<string>([initialUrl]);
  let hops = 0;

  while (hops <= maxHops) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Manually track redirects to catch chains and loops
        signal: controller.signal,
        headers: {
          'User-Agent': 'seo-gate/0.1.0 (+https://github.com/seo-gate)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const isAbort = (err as Error).name === 'AbortError';
      const msg = isAbort
        ? `Request timed out after ${timeoutMs / 1000}s fetching ${currentUrl}`
        : `Network error connecting to ${currentUrl}: ${(err as Error).message}`;
      return {
        url: currentUrl,
        statusCode: 0,
        headers: {},
        html: '',
        redirectChain,
      };
    } finally {
      clearTimeout(timer);
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);

    if (isRedirect && headers['location']) {
      hops++;
      const nextUrl = normalizeUrl(headers['location'], currentUrl);
      redirectChain.push(nextUrl);

      // Check for redirect loop
      if (visited.has(nextUrl)) {
        return {
          url: nextUrl,
          statusCode: response.status,
          headers,
          html: '',
          redirectChain,
        };
      }

      if (hops > maxHops) {
        return {
          url: nextUrl,
          statusCode: response.status,
          headers,
          html: '',
          redirectChain,
        };
      }

      visited.add(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    // Terminal page reached
    const html = await response.text();
    const $ = cheerio.load(html);

    return {
      url: currentUrl,
      statusCode: response.status,
      headers,
      html,
      redirectChain: redirectChain.length > 1 ? redirectChain : undefined,
      $,
    };
  }

  return {
    url: currentUrl,
    statusCode: 0,
    headers: {},
    html: '',
    redirectChain,
  };
}

/**
 * Concurrency-bounded queue crawler.
 */
export async function crawlTarget(config: SeoGateConfig): Promise<PageAudit[]> {
  const target = normalizeUrl(config.target);
  const discoveredUrls = new Set<string>();

  // 1. Initial reachability test on target root
  const rootTest = await fetchPage(target, 10000);
  if (rootTest.statusCode === 0) {
    throw new CrawlerError(`Could not reach ${target} (timeout or connection error). Is the preview URL correct?`);
  }

  // 2. Discover URLs from pages.include
  for (const includePath of config.pages.include) {
    if (includePath.startsWith('http://') || includePath.startsWith('https://')) {
      discoveredUrls.add(normalizeUrl(includePath));
    } else {
      const cleanPath = includePath.replace(/\*$/, '');
      const full = normalizeUrl(cleanPath, target);
      discoveredUrls.add(full);
    }
  }

  // 3. Discover URLs from sitemap if configured
  if (config.pages.sitemap) {
    const sitemapUrl = typeof config.pages.sitemap === 'string'
      ? normalizeUrl(config.pages.sitemap, target)
      : `${target.replace(/\/$/, '')}/sitemap.xml`;

    const sitemapResult = await fetchSitemap(sitemapUrl);
    for (const url of sitemapResult.urls) {
      discoveredUrls.add(normalizeUrl(url));
    }
  }

  // 4. Apply pages.exclude
  const urlList = Array.from(discoveredUrls).filter((url) => {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      for (const pattern of config.pages.exclude || []) {
        if (matchesPattern(pathname, pattern)) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });

  // Limit max pages if configured
  const maxPages = config.pages.crawl?.maxPages || 100;
  const pagesToCrawl = urlList.slice(0, maxPages);

  const concurrency = config.pages.crawl?.concurrency || 4;
  const delayMs = config.pages.crawl?.delayMs || 100;
  const results: PageAudit[] = [];

  // 5. Worker pool execution
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < pagesToCrawl.length) {
      const idx = currentIndex++;
      const url = pagesToCrawl[idx];
      if (!url) break;

      const pageAudit = await fetchPage(url);

      // Perform JavaScript rendering if enabled globally or if page is in critical list
      const shouldRenderJs = config.pages.crawl?.renderJs || (config.pages.critical && config.pages.critical.some((c) => url.includes(c)));
      if (shouldRenderJs && pageAudit.statusCode === 200) {
        try {
          const renderResult = await renderPage(url);
          if (renderResult.renderedHtml) {
            pageAudit.renderedHtml = renderResult.renderedHtml;
            pageAudit.rendered$ = cheerio.load(renderResult.renderedHtml);
          }
        } catch {
          // Gracefully continue if headless rendering times out
        }
      }

      results.push(pageAudit);

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, pagesToToCrawlCount(pagesToCrawl.length)) }, () => worker());
  await Promise.all(workers);

  // Deterministic sorting by URL
  return results.sort((a, b) => a.url.localeCompare(b.url));
}

function pagesToToCrawlCount(len: number): number {
  return Math.max(1, len);
}
