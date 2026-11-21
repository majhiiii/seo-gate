import type { Finding, PageAudit } from '../types.js';
import type { CheckContext, CheckFunction } from './types.js';

export interface RobotsTxtRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

export function parseRobotsTxt(content: string): RobotsTxtRule[] {
  const rules: RobotsTxtRule[] = [];
  let currentRule: RobotsTxtRule | null = null;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const [directive, ...rest] = line.split(':');
    const val = rest.join(':').trim();
    const key = directive.trim().toLowerCase();

    if (key === 'user-agent') {
      currentRule = { userAgent: val, disallow: [], allow: [] };
      rules.push(currentRule);
    } else if (key === 'disallow' && currentRule) {
      if (val) currentRule.disallow.push(val);
    } else if (key === 'allow' && currentRule) {
      if (val) currentRule.allow.push(val);
    }
  }

  return rules;
}

export function isPathDisallowed(path: string, rules: RobotsTxtRule[]): boolean {
  for (const rule of rules) {
    if (rule.userAgent === '*' || rule.userAgent.toLowerCase() === 'googlebot') {
      for (const pattern of rule.disallow) {
        if (pattern === '/') return true;
        if (pattern.endsWith('/') && path.startsWith(pattern)) return true;
        if (pattern.endsWith('*') && path.startsWith(pattern.slice(0, -1))) return true;
        if (path === pattern || path.startsWith(`${pattern}/`)) return true;
      }
    }
  }
  return false;
}

export const checkRobotsTxt: CheckFunction = (page: PageAudit, context: CheckContext): Finding[] => {
  const findings: Finding[] = [];

  // Only run when inspecting robots.txt endpoint
  if (!page.url.endsWith('/robots.txt')) {
    return findings;
  }

  const rules = parseRobotsTxt(page.html);

  // 1. Check for Disallow: / across entire site
  for (const rule of rules) {
    if (rule.userAgent === '*' && rule.disallow.includes('/')) {
      findings.push({
        checkId: 'robots-txt-disallow-all',
        url: page.url,
        severity: 'error',
        message: 'robots.txt contains "Disallow: /" blocking search engines from indexing the entire site',
        evidence: 'User-agent: * \nDisallow: /',
        fixHint: 'Remove "Disallow: /" from production robots.txt to restore search engine crawling.',
        docsLink: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
      });
    }
  }

  // 2. Check if critical paths are disallowed
  const critical = context.config.pages.critical || [];
  for (const critPath of critical) {
    if (isPathDisallowed(critPath, rules)) {
      findings.push({
        checkId: 'robots-txt-disallow-critical',
        url: page.url,
        severity: 'error',
        message: `robots.txt disallows configured critical path: "${critPath}"`,
        evidence: `Disallowed path: ${critPath}`,
        fixHint: `Ensure critical landing and product paths like "${critPath}" are allowed in robots.txt.`,
        docsLink: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
      });
    }
  }

  return findings;
};
