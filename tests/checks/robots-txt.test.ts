import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, isPathDisallowed, checkRobotsTxt } from '../../src/checks/robots-txt.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkRobotsTxt', () => {
  describe('parseRobotsTxt', () => {
    it('parses User-agent and Disallow directives correctly', () => {
      const content = `User-agent: *
Disallow: /cart
Disallow: /account/
Allow: /public/
`;
      const rules = parseRobotsTxt(content);
      expect(rules).toHaveLength(1);
      expect(rules[0].userAgent).toBe('*');
      expect(rules[0].disallow).toContain('/cart');
      expect(rules[0].disallow).toContain('/account/');
      expect(rules[0].allow).toContain('/public/');
    });
  });

  describe('isPathDisallowed', () => {
    it('accurately identifies disallowed subpaths', () => {
      const rules = parseRobotsTxt(`User-agent: *\nDisallow: /checkout\nDisallow: /admin/\n`);
      expect(isPathDisallowed('/checkout', rules)).toBe(true);
      expect(isPathDisallowed('/admin/dashboard', rules)).toBe(true);
      expect(isPathDisallowed('/products/shoes', rules)).toBe(false);
    });
  });

  describe('checkRobotsTxt evaluator', () => {
    it('returns no findings on clean robots.txt', () => {
      const robotsContent = `User-agent: *\nDisallow: /cart\nDisallow: /account/\n`;
      const page = createMockPage('https://example.com/robots.txt', robotsContent);
      const context = createMockContext([page], { pages: { include: ['/'], critical: ['/'] } });

      const findings = checkRobotsTxt(page, context);
      expect(findings).toHaveLength(0);
    });

    it('flags error when Disallow: / blocks the entire website', () => {
      const robotsContent = `User-agent: *\nDisallow: /\n`;
      const page = createMockPage('https://example.com/robots.txt', robotsContent);
      const context = createMockContext([page]);

      const findings = checkRobotsTxt(page, context);
      expect(findings.some((f) => f.checkId === 'robots-txt-disallow-all')).toBe(true);
      const finding = findings.find((f) => f.checkId === 'robots-txt-disallow-all')!;
      expect(finding.severity).toBe('error');
    });

    it('flags error when critical landing path is disallowed', () => {
      const robotsContent = `User-agent: *\nDisallow: /products/\n`;
      const page = createMockPage('https://example.com/robots.txt', robotsContent);
      const context = createMockContext([page], {
        pages: { include: ['/'], critical: ['/products/featured'] },
      });

      const findings = checkRobotsTxt(page, context);
      expect(findings.some((f) => f.checkId === 'robots-txt-disallow-critical')).toBe(true);
    });
  });
});
