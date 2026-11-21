import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export const checkHttpStatus: CheckFunction = (page: PageAudit, _context: CheckContext): Finding[] => {
  const findings: Finding[] = [];

  // 1. Unreachable / 0 status code
  if (page.statusCode === 0) {
    findings.push({
      checkId: 'http-status-unreachable',
      url: page.url,
      severity: 'error',
      message: `Failed to connect or received network timeout for ${page.url}`,
      evidence: `HTTP Status: 0 (Network Timeout/Failure)`,
      fixHint: 'Verify server routing, DNS, SSL certificate, and preview host availability.',
      docsLink: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status',
    });
    return findings;
  }

  // 2. Client error (4xx)
  if (page.statusCode >= 400 && page.statusCode < 500) {
    findings.push({
      checkId: 'http-status-client-error',
      url: page.url,
      severity: 'error',
      message: `Page returned client error status HTTP ${page.statusCode}`,
      evidence: `HTTP ${page.statusCode}`,
      fixHint: `Ensure the URL path exists and does not return HTTP ${page.statusCode}.`,
      docsLink: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404',
    });
  }

  // 3. Server error (5xx)
  if (page.statusCode >= 500) {
    findings.push({
      checkId: 'http-status-server-error',
      url: page.url,
      severity: 'error',
      message: `Page returned internal server error HTTP ${page.statusCode}`,
      evidence: `HTTP ${page.statusCode}`,
      fixHint: 'Check backend application logs and exception handlers.',
      docsLink: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500',
    });
  }

  // 4. Redirect chains & loops
  if (page.redirectChain && page.redirectChain.length > 1) {
    const chain = page.redirectChain;
    const isLoop = new Set(chain).size !== chain.length;

    if (isLoop) {
      findings.push({
        checkId: 'http-redirect-loop',
        url: page.url,
        severity: 'error',
        message: `Redirect loop detected across: ${chain.join(' -> ')}`,
        evidence: `Redirect loop: ${chain.join(' -> ')}`,
        fixHint: 'Resolve circular rewrite or redirect rules in your server configuration or application router.',
        docsLink: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections',
      });
    } else if (chain.length > 2) {
      // More than 1 hop: e.g. A -> B -> C has length 3
      const hops = chain.length - 1;
      findings.push({
        checkId: 'http-redirect-chain',
        url: page.url,
        severity: 'warn',
        message: `Redirect chain with ${hops} hops detected: ${chain.join(' -> ')}`,
        evidence: `Redirect chain (${hops} hops): ${chain.join(' -> ')}`,
        fixHint: 'Update intermediate redirects to point directly to the final destination to preserve crawl budget and speed.',
        docsLink: 'https://developers.google.com/search/docs/crawling-indexing/301-redirects',
      });
    }
  }

  return findings;
};
