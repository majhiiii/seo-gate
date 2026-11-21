import type { Finding, GateMode } from '../types.js';

export interface WebhookNotificationPayload {
  target: string;
  mode: GateMode;
  passed: boolean;
  totalPages: number;
  errors: number;
  warnings: number;
  regressions: Finding[];
  reportUrl?: string;
}

/**
 * Redacts credentials and auth tokens from URLs before transmission.
 */
export function redactSensitiveUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    // Redact common auth token query parameters
    const sensitiveParams = ['token', 'auth', 'key', 'secret', 'apikey'];
    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Dispatches an alert card to a Slack incoming webhook.
 */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: WebhookNotificationPayload
): Promise<boolean> {
  const safeTarget = redactSensitiveUrl(payload.target);
  const statusEmoji = payload.passed ? ':white_check_mark:' : ':rotating_light:';
  const statusText = payload.passed ? 'PASSED' : 'FAILED';
  const color = payload.passed ? '#2eb886' : '#a30200';

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} seo-gate: ${statusText} on ${safeTarget}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Mode:* \`${payload.mode}\`` },
        { type: 'mrkdwn', text: `*Audited Pages:* ${payload.totalPages}` },
        { type: 'mrkdwn', text: `*Regressions:* *${payload.regressions.length}*` },
        { type: 'mrkdwn', text: `*Total Errors:* ${payload.errors}` },
      ],
    },
  ];

  if (payload.regressions.length > 0) {
    const topRegs = payload.regressions
      .slice(0, 3)
      .map((r) => `• *${r.checkId}* on ${redactSensitiveUrl(r.url)}: ${r.message}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top Regressions:*\n${topRegs}`,
      },
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachments: [{ color, blocks }] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Dispatches an alert card to a Microsoft Teams incoming webhook.
 */
export async function sendTeamsNotification(
  webhookUrl: string,
  payload: WebhookNotificationPayload
): Promise<boolean> {
  const safeTarget = redactSensitiveUrl(payload.target);
  const statusTitle = payload.passed
    ? `✅ seo-gate: PASSED on ${safeTarget}`
    : `🚨 seo-gate: FAILED on ${safeTarget}`;
  const themeColor = payload.passed ? '00FF00' : 'FF0000';

  const card = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor,
    summary: statusTitle,
    title: statusTitle,
    sections: [
      {
        facts: [
          { name: 'Target:', value: safeTarget },
          { name: 'Mode:', value: payload.mode },
          { name: 'Pages Audited:', value: `${payload.totalPages}` },
          { name: 'New Regressions:', value: `${payload.regressions.length}` },
          { name: 'Total Errors:', value: `${payload.errors}` },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    return response.ok;
  } catch {
    return false;
  }
}
