import { describe, it, expect } from 'vitest';
import { checkHttpStatus } from '../../src/checks/http-status.js';
import { createMockPage, createMockContext } from '../helpers.js';

describe('checkHttpStatus', () => {
  const context = createMockContext();

  it('returns no findings on clean 200 OK without redirects', () => {
    const page = createMockPage('https://example.com/', '<html></html>', 200);
    const findings = checkHttpStatus(page, context);
    expect(findings).toHaveLength(0);
  });

  it('flags 404 client error with error severity', () => {
    const page = createMockPage('https://example.com/not-found', '<html>404</html>', 404);
    const findings = checkHttpStatus(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('http-status-client-error');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('HTTP 404');
  });

  it('flags 500 server error with error severity', () => {
    const page = createMockPage('https://example.com/broken', '<html>500</html>', 500);
    const findings = checkHttpStatus(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('http-status-server-error');
    expect(findings[0].severity).toBe('error');
  });

  it('flags network unreachable status (0) as error', () => {
    const page = createMockPage('https://example.com/offline', '', 0);
    const findings = checkHttpStatus(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('http-status-unreachable');
    expect(findings[0].severity).toBe('error');
  });

  it('flags redirect chains longer than 1 hop with warning', () => {
    const chain = ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'];
    const page = createMockPage('https://example.com/c', '<html>OK</html>', 200, {}, chain);
    const findings = checkHttpStatus(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('http-redirect-chain');
    expect(findings[0].severity).toBe('warn');
    expect(findings[0].message).toContain('2 hops');
  });

  it('flags circular redirect loops with error', () => {
    const chain = ['https://example.com/loop1', 'https://example.com/loop2', 'https://example.com/loop1'];
    const page = createMockPage('https://example.com/loop1', '', 302, {}, chain);
    const findings = checkHttpStatus(page, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('http-redirect-loop');
    expect(findings[0].severity).toBe('error');
  });
});
