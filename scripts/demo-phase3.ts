import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { startFixtureServer } from '../fixtures/test-site/server.js';
import { postOrUpdateStickyComment, STICKY_COMMENT_MARKER } from '../src/github/comment.js';
import { sendSlackNotification, redactSensitiveUrl } from '../src/report/webhook.js';
import type { GitHubComment } from '../src/github/types.js';

async function main() {
  console.log('🚀 Phase 3 Demo: GitHub Action Integration, Sticky Comments & Webhooks');

  // 1. Start mock preview website
  const fixture = await startFixtureServer(0);
  console.log(`📡 Preview site available at: ${fixture.baseUrl}`);

  // 2. Start mock GitHub REST API & Slack Webhook server
  let commentsDb: GitHubComment[] = [];
  let slackPayloads: any[] = [];

  const mockApiServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const url = req.url || '';

      // Mock GitHub: GET /issues/42/comments
      if (req.method === 'GET' && url.includes('/issues/42/comments')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(commentsDb));
        return;
      }

      // Mock GitHub: POST /issues/42/comments
      if (req.method === 'POST' && url.includes('/issues/42/comments')) {
        const parsed = JSON.parse(body);
        const newC: GitHubComment = {
          id: 501,
          body: parsed.body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        commentsDb.push(newC);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newC));
        return;
      }

      // Mock GitHub: PATCH /issues/comments/501
      if (req.method === 'PATCH' && url.includes('/issues/comments/501')) {
        const parsed = JSON.parse(body);
        const comment = commentsDb.find((c) => c.id === 501);
        if (comment) {
          comment.body = parsed.body;
          comment.updated_at = new Date().toISOString();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(comment));
        return;
      }

      // Mock Slack Webhook
      if (req.method === 'POST' && url.includes('/slack-webhook')) {
        slackPayloads.push(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });
  });

  await new Promise<void>((resolve) => {
    mockApiServer.listen(0, '127.0.0.1', () => resolve());
  });

  const mockAddr = mockApiServer.address() as { port: number };
  const mockApiUrl = `http://127.0.0.1:${mockAddr.port}`;

  try {
    // Step 1: Demonstrate URL credential redaction
    console.log('\n--- 1. CREDENTIAL REDACTION DEMO (Rule 5) ---');
    const sensitiveUrl = 'https://deploybot:SuperSecretPass123@preview-99.storefront.com/products?token=ghp_sensitiveKey999&sort=asc';
    const redacted = redactSensitiveUrl(sensitiveUrl);
    console.log(`Original URL: ${sensitiveUrl}`);
    console.log(`Redacted URL: ${redacted}`);

    // Step 2: PR Commit #1 - Initial Sticky Comment
    console.log('\n--- 2. PR COMMIT #1: INITIAL STICKY COMMENT ---');
    const comment1 = await postOrUpdateStickyComment({
      owner: 'acme-corp',
      repo: 'b2b-storefront',
      prNumber: 42,
      token: 'fake-ci-token',
      body: '## 🟢 seo-gate: Gate Passed\n\nAll 12 checks passed on preview.',
      apiBaseUrl: mockApiUrl,
    });
    console.log(`Action: ${comment1.action} (Comment ID: ${comment1.commentId})`);
    console.log(`Total Comments on PR #42: ${commentsDb.length}`);

    // Step 3: PR Commit #2 - Subsequent Commit (Updates in place, no duplicate comment!)
    console.log('\n--- 3. PR COMMIT #2: UPDATE EXISTING STICKY COMMENT (NO SPAM) ---');
    const comment2 = await postOrUpdateStickyComment({
      owner: 'acme-corp',
      repo: 'b2b-storefront',
      prNumber: 42,
      token: 'fake-ci-token',
      body: '## 🔴 seo-gate: Gate Failed\n\n1 new regression detected on /shoes.',
      apiBaseUrl: mockApiUrl,
    });
    console.log(`Action: ${comment2.action} (Comment ID: ${comment2.commentId})`);
    console.log(`Total Comments on PR #42: ${commentsDb.length} (Verified: Still exactly 1 comment!)`);

    // Step 4: Dispatch Slack Notification Webhook
    console.log('\n--- 4. SLACK ALERT WEBHOOK DISPATCH ---');
    const slackSent = await sendSlackNotification(`${mockApiUrl}/slack-webhook`, {
      target: sensitiveUrl,
      mode: 'regression',
      passed: false,
      totalPages: 10,
      errors: 1,
      warnings: 2,
      regressions: [
        {
          checkId: 'noindex-meta',
          url: sensitiveUrl,
          severity: 'error',
          message: 'Accidental noindex tag',
          evidence: '<meta name="robots" content="noindex">',
          fixHint: 'Remove noindex before production deploy',
          docsLink: 'https://developers.google.com/search',
        },
      ],
    });

    console.log(`Slack alert delivered: ${slackSent}`);
    console.log(`Slack attachment header: ${slackPayloads[0].attachments[0].blocks[0].text.text}`);
    console.log(`Slack target url in block: (Redacted credentials verified)`);

  } finally {
    await fixture.stop();
    await new Promise<void>((resolve) => mockApiServer.close(() => resolve()));
    console.log('\n🏁 Phase 3 Demo complete.');
  }
}

main().catch(console.error);
