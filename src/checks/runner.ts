import type { Finding, IgnoreRule, PageAudit, SeoGateConfig, Severity } from '../types.js';
import { CORE_CHECKS } from './registry.js';
import type { CheckContext } from './types.js';

export interface RunChecksResult {
  findings: Finding[];
  ignoredCount: number;
  activeIgnores: { rule: IgnoreRule; count: number }[];
}

function matchesUrlPattern(url: string, pattern: string): boolean {
  if (pattern === '*' || pattern === url) return true;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
      const patternUrl = new URL(pattern);
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return url.startsWith(prefix);
      }
      return url === pattern;
    }

    // Path pattern (e.g. /legal/* or /products/*)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return pathname.startsWith(prefix);
    }
    return pathname === pattern || pathname === `${pattern}/`;
  } catch {
    return url.includes(pattern);
  }
}

function isIgnoreExpired(expires?: string): boolean {
  if (!expires) return false;
  const expiryDate = new Date(`${expires}T23:59:59Z`);
  return Date.now() > expiryDate.getTime();
}

/**
 * Runs all core SEO checks on the set of audited pages, applying severity overrides
 * and filtering active ignore rules.
 */
export function runChecks(allPages: PageAudit[], config: SeoGateConfig): RunChecksResult {
  const context: CheckContext = { allPages, config };
  const rawFindings: Finding[] = [];
  const activeIgnoresMap = new Map<IgnoreRule, number>();

  for (const page of allPages) {
    for (const checkDef of CORE_CHECKS) {
      const results = checkDef.run(page, context);
      rawFindings.push(...results);
    }
  }

  const finalFindings: Finding[] = [];
  let ignoredCount = 0;

  for (const finding of rawFindings) {
    // 1. Apply severity overrides if configured
    let severity = finding.severity;
    if (config.severity_overrides && config.severity_overrides[finding.checkId]) {
      severity = config.severity_overrides[finding.checkId] as Severity;
    }

    const modifiedFinding: Finding = {
      ...finding,
      severity,
    };

    // 2. Check ignore rules
    let isIgnored = false;
    for (const rule of config.ignore || []) {
      const checkMatches = rule.check === '*' || rule.check === finding.checkId || finding.checkId.startsWith(rule.check);
      const urlMatches = matchesUrlPattern(finding.url, rule.url);
      const expired = isIgnoreExpired(rule.expires);

      if (checkMatches && urlMatches && !expired) {
        isIgnored = true;
        const currentCount = activeIgnoresMap.get(rule) || 0;
        activeIgnoresMap.set(rule, currentCount + 1);
        break;
      }
    }

    if (isIgnored) {
      ignoredCount++;
    } else {
      finalFindings.push(modifiedFinding);
    }
  }

  // 3. Deterministic alphabetical sorting: url ascending, then checkId ascending
  finalFindings.sort((a, b) => {
    const urlCmp = a.url.localeCompare(b.url);
    if (urlCmp !== 0) return urlCmp;
    return a.checkId.localeCompare(b.checkId);
  });

  const activeIgnores = Array.from(activeIgnoresMap.entries()).map(([rule, count]) => ({
    rule,
    count,
  }));

  return {
    findings: finalFindings,
    ignoredCount,
    activeIgnores,
  };
}
