import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import {
  redactSensitiveUrl,
  sendSlackNotification,
  sendTeamsNotification,
} from '../../src/report/webhook.js';

describe('Webhook Notifier & Credential Redaction', () => {
  describe('redactSensitiveUrl', () => {
    it('redacts basic-auth credentials from preview URLs', () => {
      const raw = 'https://admin:supersecret@preview-123.store.com/shoes';
      const clean = redactSensitiveUrl(raw);
      expect(clean).toBe('https://***:***@preview-123.store.com/shoes');
      expect(clean).not.toContain('supersecret');
      expect(clean).not.toContain('admin:');
    });

    it('redacts auth tokens and api keys from query strings', () => {
      const raw = 'https://preview.example.com/products?token=ghp_secretToken123&sort=price';
      const clean = redactSensitiveUrl(raw);
      expect(clean).toContain('sort=price');
      expect(clean).not.toContain('ghp_secretToken123');
      expect(clean).toContain('%5BREDACTED%5D');
    });

    it('leaves standard public URLs untouched', () => {
      const standard = 'https://www.example.com/products/shoes';
      expect(redactSensitiveUrl(standard)).toBe(standard);
    });
  });

  describe('Live Webhook Dispatching', () => {
    let server: http.Server;
    let serverUrl: string;
    let receivedPayload: any = null;

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          receivedPayload = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
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

    it('formats and dispatches Slack webhook notification', async () => {
      const success = await sendSlackNotification(`${serverUrl}/slack`, {
        target: 'https://preview.example.com',
        mode: 'regression',
        passed: false,
        totalPages: 5,
        errors: 1,
        warnings: 1,
        regressions: [
          {
            checkId: 'noindex-meta',
            url: 'https://preview.example.com/shoes',
            severity: 'error',
            message: 'Accidental noindex',
            evidence: '',
            fixHint: 'Remove noindex',
            docsLink: '',
          },
        ],
      });

      expect(success).toBe(true);
      expect(receivedPayload).toBeDefined();
      expect(receivedPayload.attachments).toBeDefined();
      expect(receivedPayload.attachments[0].color).toBe('#a30200'); // red for failure
    });

    it('formats and dispatches Microsoft Teams MessageCard webhook', async () => {
      const success = await sendTeamsNotification(`${serverUrl}/teams`, {
        target: 'https://preview.example.com',
        mode: 'regression',
        passed: true,
        totalPages: 5,
        errors: 0,
        warnings: 0,
        regressions: [],
      });

      expect(success).toBe(true);
      expect(receivedPayload['@type']).toBe('MessageCard');
      expect(receivedPayload.themeColor).toBe('00FF00'); // green for success
    });

    it('handles network failures gracefully without throwing', async () => {
      // Non-existent port
      const success = await sendSlackNotification('http://127.0.0.1:59997/slack', {
        target: 'https://example.com',
        mode: 'strict',
        passed: true,
        totalPages: 1,
        errors: 0,
        warnings: 0,
        regressions: [],
      });
      expect(success).toBe(false);
    });
  });
});
