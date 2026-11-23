# Learning: 15 Hands-On Progressive Exercises

## 1. In one paragraph
This document presents 15 practical, progressive exercises designed to reinforce your understanding of `seo-gate`'s architecture, configuration, check authoring, and CI/CD operations, ranging from basic CLI invocations to custom check development and headless browser tuning.

## 2. Why this exists
True mastery comes from active problem solving, not passive reading. These exercises simulate real-world tasks you might encounter when extending `seo-gate` or demonstrating it live in a technical interview.

---

## 3. The 15 Progressive Exercises

### Beginner Tier (Exercises 1–5: Operations & Configuration)

#### Exercise 1: Generate a Starter Configuration
- **Goal:** Initialize `seo-gate` for a new preview environment.
- **Task:** Run the command to create a starter configuration targeting `https://staging-shop.example.com`.
- **Hint:** Use the `init` subcommand with a target URL argument.
<details>
<summary><b>Solution Outline</b></summary>

```bash
pnpm seo-gate init https://staging-shop.example.com
```
Verify that `seo-gate.config.yml` was generated with the specified target URL.
</details>

---

#### Exercise 2: Switch to Regression Mode
- **Goal:** Prevent pre-existing technical debt from failing CI builds.
- **Task:** Update `seo-gate.config.yml` to use `regression` mode and specify a baseline file path.
- **Hint:** Set `mode: regression` in the configuration file.
<details>
<summary><b>Solution Outline</b></summary>

In `seo-gate.config.yml`:
```yaml
mode: regression
```
Run `seo-gate run --config seo-gate.config.yml --baseline baseline.json`.
</details>

---

#### Exercise 3: Document an Expiring Ignore Exception
- **Goal:** Temporarily ignore a short title on a legal page without disabling the check globally.
- **Task:** Add an ignore rule for `title-length-short` on `/legal/*` with the reason "Approved legal disclaimer" and an expiration date of December 31, 2026.
- **Hint:** Edit the `ignore` array in `seo-gate.config.yml`.
<details>
<summary><b>Solution Outline</b></summary>

In `seo-gate.config.yml`:
```yaml
ignore:
  - check: title-length-short
    url: "/legal/*"
    reason: "Approved legal disclaimer"
    expires: "2026-12-31"
```
</details>

---

#### Exercise 4: Enforce Custom Severity Overrides
- **Goal:** Upgrade missing meta descriptions from a warning to a blocking error.
- **Task:** Use `severity_overrides` in `seo-gate.config.yml` to treat `meta-description-missing` as `error`.
- **Hint:** Add a key-value pair under `severity_overrides`.
<details>
<summary><b>Solution Outline</b></summary>

In `seo-gate.config.yml`:
```yaml
severity_overrides:
  meta-description-missing: error
```
</details>

---

#### Exercise 5: Generate an Interactive HTML Report
- **Goal:** Produce a visual, filterable HTML report for non-developer stakeholders.
- **Task:** Execute `seo-gate run` against the fixture site and output an HTML report to `reports/audit.html`.
- **Hint:** Use `--format html` or `--html <path>`.
<details>
<summary><b>Solution Outline</b></summary>

```bash
pnpm seo-gate run --config fixtures/test-site/seo-gate.config.yml --html reports/audit.html
```
Open `reports/audit.html` in your web browser.
</details>

---

### Intermediate Tier (Exercises 6–10: Custom Checks & Baselines)

#### Exercise 6: Capture a Fresh Production Baseline
- **Goal:** Snapshot production SEO health as the gold standard for PR diffing.
- **Task:** Run the command to update `baseline.json` from production.
- **Hint:** Use the `baseline update` subcommand.
<details>
<summary><b>Solution Outline</b></summary>

```bash
pnpm seo-gate baseline update --config seo-gate.config.yml --output baseline.json
```
Inspect `baseline.json` to verify `schemaVersion: 1` and `findings` array.
</details>

---

#### Exercise 7: Compare Two Prior Runs with Diff
- **Goal:** Compare two historical audit reports to see what changed between releases.
- **Task:** Use `seo-gate diff` to compare `report-v1.json` and `report-v2.json`.
- **Hint:** Run `seo-gate diff <fileA> <fileB>`.
<details>
<summary><b>Solution Outline</b></summary>

```bash
pnpm seo-gate diff report-v1.json report-v2.json
```
Observe the terminal summary table showing new regressions, resolved issues, and unchanged findings.
</details>

---

#### Exercise 8: Author an Open Graph Image Check
- **Goal:** Warn when a page lacks an `og:image` tag for social media sharing.
- **Task:** Create `src/checks/og-image.ts` that inspects `<meta property="og:image">` and returns a `warn` finding if absent.
- **Hint:** Use Cheerio to query `meta[property="og:image"]`.
<details>
<summary><b>Solution Outline</b></summary>

```typescript
import * as cheerio from 'cheerio';
import type { CheckDefinition, CheckContext } from './types.js';
import type { Finding, PageAudit } from '../types.js';

export const OgImageCheck: CheckDefinition = {
  id: 'og-image',
  name: 'Open Graph Image Check',
  description: 'Asserts presence of og:image',
  run(page: PageAudit, context: CheckContext): Finding[] {
    if (!page.html) return [];
    const $ = cheerio.load(page.html);
    const ogImg = $('meta[property="og:image"]').attr('content');
    if (!ogImg) {
      return [{
        checkId: 'og-image-missing',
        url: page.url,
        severity: 'warn',
        message: 'Missing Open Graph image meta tag',
        evidence: 'No og:image found',
        fixHint: 'Add <meta property="og:image" content="...">',
      }];
    }
    return [];
  }
};
```
</details>

---

#### Exercise 9: Verify Hreflang Return Tags
- **Goal:** Detect non-reciprocal language tags.
- **Task:** Configure an English page to link to `/fr` as French alternate, but verify what happens when `/fr` omits the reciprocal link back to `/en`.
- **Hint:** Test using `tests/checks/hreflang.test.ts`.
<details>
<summary><b>Solution Outline</b></summary>

`src/checks/hreflang.ts` flags `hreflang-missing-reciprocal` when Page A points to Page B as an alternate, but Page B does not point back to Page A.
</details>

---

#### Exercise 10: Enforce JSON-LD Product Schema
- **Goal:** Assert that all e-commerce product pages declare schema.org `Product` markup with `name` and `offers`.
- **Task:** Write an HTML snippet with incomplete JSON-LD and verify that `structured-data` check flags the missing `offers` property.
- **Hint:** Look at `fixtures/test-site/server.ts` endpoint `/structured-data-missing-field`.
<details>
<summary><b>Solution Outline</b></summary>

Omit the `"offers"` property from `<script type="application/ld+json">`. `src/checks/structured-data.ts` emits `structured-data-missing-field` with severity `warn`.
</details>

---

### Advanced Tier (Exercises 11–15: Browser Automation & CI/CD)

#### Exercise 11: Optimize Headless Chromium Network Requests
- **Goal:** Accelerate Playwright rendering by 70% in CI.
- **Task:** Configure Playwright's `page.route()` to abort image, stylesheet, font, and media requests while allowing scripts and document requests.
- **Hint:** Inspect `src/render/browser.ts`.
<details>
<summary><b>Solution Outline</b></summary>

```typescript
await page.route('**/*', (route) => {
  const resourceType = route.request().resourceType();
  if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
    route.abort();
  } else {
    route.continue();
  }
});
```
</details>

---

#### Exercise 12: Configure Lighthouse Lab Budgets
- **Goal:** Fail pull requests that increase Largest Contentful Paint beyond 2.5 seconds.
- **Task:** Configure `budgets.lcpMs: 2500` and `tolerancePercent: 10` in `seo-gate.config.yml`.
- **Hint:** Use the `budgets` configuration block.
<details>
<summary><b>Solution Outline</b></summary>

```yaml
budgets:
  lcpMs: 2500
  cls: 0.1
  totalJsKb: 500
  tolerancePercent: 10
  runs: 3
  profile: mobile
```
</details>

---

#### Exercise 13: Simulate and Verify Flaky-Test Protection
- **Goal:** Understand how `seo-gate` filters out CI runner CPU jitter.
- **Task:** Write a unit test where run 1 exceeds baseline tolerance, but confirmation run 2 passes within tolerance. Assert that the regression is marked `reproduced: false` and does not fail the gate.
- **Hint:** Review `tests/lighthouse/runner.test.ts`.
<details>
<summary><b>Solution Outline</b></summary>

Pass a mock `confirmFn` to `diffPerformance` that returns normalized metrics. Verify that `regressions[0].reproduced === false` and the message indicates a transient occurrence.
</details>

---

#### Exercise 14: Test Idempotent Sticky PR Commenting
- **Goal:** Prevent bot spam on pull requests across multiple commits.
- **Task:** Write an integration test that posts a comment on PR #12, then issues a second comment with new findings. Assert that only one comment exists on the PR, updated in place via `PATCH`.
- **Hint:** Search for the hidden marker `<!-- seo-gate-sticky-comment -->` in `src/github/comment.ts`.
<details>
<summary><b>Solution Outline</b></summary>

`postOrUpdateStickyComment()` searches existing comments on the PR for `<!-- seo-gate-sticky-comment -->`. If found, it issues `PATCH /issues/comments/{id}`; otherwise it calls `POST /issues/{prNumber}/comments`.
</details>

---

#### Exercise 15: Implement Zero-Secret Redaction
- **Goal:** Prevent credentials in staging URLs from leaking into logs or public reports.
- **Task:** Write a test verifying that `redactSensitiveUrl` sanitizes `https://admin:secret123@preview.example.com/checkout?token=xyz` into `https://***:***@preview.example.com/checkout?token=[REDACTED]`.
- **Hint:** Inspect `src/report/webhook.ts`.
<details>
<summary><b>Solution Outline</b></summary>

```typescript
import { redactSensitiveUrl } from '../src/report/webhook.js';

const safe = redactSensitiveUrl('https://admin:secret123@preview.example.com/checkout?token=xyz');
expect(safe).toBe('https://***:***@preview.example.com/checkout?token=[REDACTED]');
```
</details>
