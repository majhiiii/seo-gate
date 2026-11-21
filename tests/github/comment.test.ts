import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import {
  postOrUpdateStickyComment,
  STICKY_COMMENT_MARKER,
  GitHubApiError,
} from '../../src/github/comment.js';
import type { GitHubComment } from '../../src/github/types.js';

describe('Sticky PR Comment Engine', () => {
  let server: http.Server;
  let serverUrl: string;
  let commentsDatabase: GitHubComment[] = [];
  let lastAuthHeader = '';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      lastAuthHeader = req.headers['authorization'] || '';
      const url = req.url || '';

      // Check authentication
      if (req.headers['authorization'] === 'Bearer bad-token') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Bad credentials' }));
        return;
      }

      // GET /repos/owner/repo/issues/42/comments
      if (req.method === 'GET' && url.includes('/issues/42/comments')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(commentsDatabase));
        return;
      }

      // POST /repos/owner/repo/issues/42/comments
      if (req.method === 'POST' && url.includes('/issues/42/comments')) {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const parsed = JSON.parse(body);
          const newComment: GitHubComment = {
            id: 101,
            body: parsed.body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          commentsDatabase.push(newComment);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newComment));
        });
        return;
      }

      // PATCH /repos/owner/repo/issues/comments/101
      if (req.method === 'PATCH' && url.includes('/issues/comments/101')) {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const parsed = JSON.parse(body);
          const comment = commentsDatabase.find((c) => c.id === 101);
          if (comment) {
            comment.body = parsed.body;
            comment.updated_at = new Date().toISOString();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(comment));
        });
        return;
      }

      // Simulate 401 unauthorized
      if (url.includes('/unauthorized')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Bad credentials' }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('creates a new sticky comment on first run with STICKY_COMMENT_MARKER', async () => {
    commentsDatabase = [];
    const result = await postOrUpdateStickyComment({
      owner: 'acme-corp',
      repo: 'storefront',
      prNumber: 42,
      token: 'test-gh-token',
      body: '## 🟢 seo-gate: Gate Passed',
      apiBaseUrl: serverUrl,
    });

    expect(result.action).toBe('created');
    expect(result.commentId).toBe(101);
    expect(commentsDatabase).toHaveLength(1);
    expect(commentsDatabase[0].body).toContain(STICKY_COMMENT_MARKER);
    expect(commentsDatabase[0].body).toContain('Gate Passed');
    expect(lastAuthHeader).toBe('Bearer test-gh-token');
  });

  it('updates existing sticky comment in place on subsequent runs instead of duplicating', async () => {
    // commentsDatabase already has comment id 101 with STICKY_COMMENT_MARKER from prior test
    const result = await postOrUpdateStickyComment({
      owner: 'acme-corp',
      repo: 'storefront',
      prNumber: 42,
      token: 'test-gh-token',
      body: '## 🔴 seo-gate: Gate Failed with 1 regression',
      apiBaseUrl: serverUrl,
    });

    expect(result.action).toBe('updated');
    expect(result.commentId).toBe(101);
    expect(commentsDatabase).toHaveLength(1); // Still exactly one comment! No duplicates!
    expect(commentsDatabase[0].body).toContain('Gate Failed with 1 regression');
  });

  it('throws GitHubApiError when authentication fails', async () => {
    await expect(
      postOrUpdateStickyComment({
        owner: 'acme-corp',
        repo: 'unauthorized',
        prNumber: 42,
        token: 'bad-token',
        body: 'test',
        apiBaseUrl: serverUrl,
      })
    ).rejects.toThrow(GitHubApiError);
  });
});
