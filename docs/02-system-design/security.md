# System Design: Security & Privacy Architecture

## 1. In one paragraph
`seo-gate` is built around a zero-trust, zero-leakage security posture designed to safely inspect pre-production and staging environments without exposing sensitive credentials, leaking authentication tokens to logs, or transmitting proprietary code to third parties.

## 2. Why this exists
CI/CD systems handle sensitive credentials: basic-auth staging passwords, GitHub personal access tokens, Slack webhook URLs, and internal preview hostnames. If an automated testing tool accidentally prints basic-auth credentials to terminal logs or embeds sensitive query tokens into public PR comments, company security is compromised. `seo-gate` guarantees strict privacy and security boundaries.

## 3. How it works
The security model encompasses five core defense layers:

```mermaid
flowchart TD
    A["Sensitive Input<br/>(Basic-auth URL, tokens, webhooks)"] --> B["Security Layer"]
    B --> C["1. URL Credential Redaction<br/>(redactSensitiveUrl)"]
    B --> D["2. Environment Variable Injection<br/>(Zero secrets in config/code)"]
    B --> E["3. Local Sandbox Isolation<br/>(No external telemetry/APIs)"]
    B --> F["4. Supply Chain Security<br/>(Pinned versions + lockfile audit)"]
    B --> G["5. Controlled Crawl Scope<br/>(Only authorized domains)"]
```
*How to read this diagram: All external data passes through strict redaction, environment-based secret handling, and offline-first processing.*

### The Five Security Pillars

1. **Zero-Secret Logging & Redaction Engine (`redactSensitiveUrl`):**
   - Staging preview URLs frequently include basic authentication credentials (e.g., `https://admin:supersecret@preview.example.com`).
   - Every URL printed to stdout, stderr, Markdown reports, JSON files, or webhook alerts is processed through `redactSensitiveUrl`.
   - Replaces `username:password` with `***:***`.
   - Redacts sensitive query parameters matching `/^(token|key|secret|auth|apikey|access_token|password)$/i` with `[REDACTED]`.
2. **Environment Variable Secret Ingestion:**
   - Secrets (`GITHUB_TOKEN`, `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`) are read exclusively from process environment variables.
   - `seo-gate.config.yml` never stores passwords or API tokens.
3. **Strict Telemetry & Data Sovereignty Policy:**
   - `seo-gate` has **zero external analytics, tracking pixels, or third-party telemetry**.
   - Findings and HTML payloads are written to local disk or CI artifacts only.
   - The tool never sends code, metadata, or URLs to third-party SEO or AI APIs.
4. **Supply Chain Care:**
   - Exact dependency pinning in `package.json`.
   - `pnpm-lock.yaml` is committed and audited with `pnpm audit`.
   - Minimal dependency tree avoiding unmaintained or deprecated packages.
5. **Crawl Permission & Scope Limitation:**
   - `seo-gate` only crawls target domains explicitly configured in `target` or `pages.include`.
   - External links discovered during crawls are checked for status codes but never crawled recursively.
   - Respects `robots.txt` rules by default.

## 4. Example
URL redaction before outputting to logs and reports:
```typescript
import { redactSensitiveUrl } from './src/report/webhook.js';

const rawUrl = 'https://deploy-user:p@ssword123@preview-42.example.com/checkout?token=xyz987secret';
const safeUrl = redactSensitiveUrl(rawUrl);

console.log(safeUrl);
// Output: 'https://***:***@preview-42.example.com/checkout?token=[REDACTED]'
```

## 5. Salesforce analogy
`seo-gate`'s credential handling mirrors **Salesforce Named Credentials and Shield Platform Encryption**. Just as Salesforce Named Credentials manage endpoint URLs and callout authentication headers without hardcoding passwords in Apex code, `seo-gate` injects credentials through CI environment variables and redacts them from debug logs.

## 6. Common mistakes and What to remember
- **Mistake:** Committing `seo-gate.config.yml` with basic-auth credentials written directly in the `target` URL. Always inject credentials via CI environment variables or use GitHub Actions secrets.
- **Mistake:** Assuming CI runner logs are private. In public open-source repos or multi-team enterprise orgs, logs are visible to many developers. Never print unredacted URLs.
- **What to remember:** Rule 5 of `seo-gate` is absolute: No secrets in code, logs, reports, fixtures, or docs.
