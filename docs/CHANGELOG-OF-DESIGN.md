# Changelog of Design Decisions

This document logs significant architectural choices, technical decisions, and evolutionary milestones across `seo-gate` phases.

---

### [2026-11-21] Phase 1: Architecture, Core Engine & First Check Suite

#### Added
- **Core Architecture:** Defined clean unidirectional module hierarchy (`cli` $\rightarrow$ `config`, `crawl`, `render`, `checks`, `baseline`, `report`, `github`).
- **Data Model:** Defined `schemaVersion: 1` contracts for `Finding`, `PageAudit`, `RunResult`, and `SeoGateConfig`.
- **Pure Check Constraint:** Established architectural rule that all checks in `src/checks/` are side-effect-free pure functions that never perform network or disk I/O.
- **Polite Crawler:** Designed crawler with queueing, URL de-duplication, concurrency throttling (default: 4), and polite request delays (default: 100ms).
- **Core 6 Checks:**
  1. `http-status`: Asserts HTTP 200, flags 4xx/5xx, redirect chains (>1 hop), and redirect loops.
  2. `title`: Asserts existence, uniqueness, and length bounds (20–65 characters).
  3. `meta-description`: Asserts existence, uniqueness, and length bounds (70–160 characters).
  4. `h1`: Asserts exactly one `<h1>` per page.
  5. `canonical`: Asserts presence, absolute URL format, self-referencing consistency, and non-error target.
  6. `noindex`: Detects accidental `noindex` directives on indexable pages via `<meta name="robots">` and `X-Robots-Tag` headers.
- **Deterministic Output:** Enforced alphabetical sorting of findings by URL and `checkId` across all reporters.


---

### [2026-11-21] Phase 2: Baselines, Regression Diffing & Markdown PR Reporting

#### Added
- **Baseline Engine (`src/baseline/`):** Implemented snapshot creation, file serialization, and schema validation (`schemaVersion: 1`).
- **Diff Strategy (ADR-0002):** Implemented host-agnostic finding fingerprinting (`${checkId}::${pathname}`), enabling seamless comparison between dynamic preview environments and production baselines.
- **Three-Way Partitioning:** Diff engine partitions findings into `newFindings`, `resolvedFindings`, and `unchangedFindings`.
- **Gate Evaluation:** Implemented `evaluateGate()` supporting `strict`, `regression`, and `report` modes.
- **Markdown Reporter (`src/report/markdown.ts`):** Generates clean, actionable GitHub PR summaries with collapsible sections for baseline debt and resolved issues.
- **CLI Subcommands:**
  - `seo-gate baseline update --config <path> [--output <path>]`
  - `seo-gate diff <fileA> <fileB>`
  - `--baseline` and `--format md` options for `seo-gate run`.
- **Architectural Decision Records:**
  - `ADR-0001`: Baseline file format and Git-based storage strategy.
  - `ADR-0002`: Finding identity and cross-environment diff strategy.


---

### [2026-11-21] Phase 3: GitHub Actions Composite Action, Sticky PR Comments & Webhooks

#### Added
- **Reusable Composite Action (`action.yml`):** Encapsulated `seo-gate` for GitHub Actions workflows with input parameters for targets, configs, tokens, and webhooks.
- **Sticky PR Comment Manager (`src/github/comment.ts`):** Created idempotent PR commenting using the `<!-- seo-gate-sticky-comment -->` marker to update in place and eliminate notification spam.
- **Webhook Alerts (`src/report/webhook.ts`):** Implemented Slack Block Kit and Microsoft Teams MessageCard alert dispatchers.
- **Zero-Secret Redaction Engine (`redactSensitiveUrl`):** Automatically redacts basic-auth passwords and query string tokens from URLs in logs and reports.
- **Workflows:**
  - Added `.github/workflows/seo-gate-pr.yml` for pull request testing.
  - Added `.github/workflows/production-audit.yml` for scheduled daily production monitoring (`0 6 * * *`).
- **Operational Documentation:**
  - Added [docs/04-code-walkthrough/github-action-walkthrough.md](file:///d:/seo-gate/docs/04-code-walkthrough/github-action-walkthrough.md).
  - Added [docs/06-operations/runbook.md](file:///d:/seo-gate/docs/06-operations/runbook.md).
  - Added [docs/06-operations/how-to-roll-out-to-the-team.md](file:///d:/seo-gate/docs/06-operations/how-to-roll-out-to-the-team.md).


---

### [2026-11-21] Phase 4: Headless Rendering, Structured Data, Hreflang & Crawlability

#### Added
- **Headless Browser Engine (`src/render/browser.ts`):** Integrated Playwright Chromium with request interception (`page.route()`) to block media, stylesheets, and fonts for high performance in CI.
- **Rendered vs. Raw Discrepancy Check (`src/checks/rendered-vs-raw.ts`):** Detects hydration gaps where essential tags (`<h1>`, `<title>`, `<meta description>`, `<link rel="canonical">`) exist only after client-side JavaScript execution.
- **Structured Data Validator (`src/checks/structured-data.ts`):** Validates JSON-LD schema syntax and asserts required schema.org properties for `Product`, `BreadcrumbList`, `Organization`, `FAQPage`, and `Article`.
- **Hreflang Reciprocity Check (`src/checks/hreflang.ts`):** Validates ISO language/region codes and enforces reciprocal confirmation between localized URLs.
- **Sitemap Health Audit (`src/checks/sitemap.ts`):** Validates sitemap HTTP status codes, canonical references, and indexability; flags drops >10% vs baseline.
- **Robots.txt Crawlability Check (`src/checks/robots-txt.ts`):** Checks `User-agent: *` rules, flags accidental `Disallow: /` directives, and verifies crawlability for all paths configured in `pages.critical`.
- **System Design & Concepts:**
  - Added [docs/01-concepts/structured-data.md](file:///d:/seo-gate/docs/01-concepts/structured-data.md).
  - Added [docs/02-system-design/failure-modes-and-reliability.md](file:///d:/seo-gate/docs/02-system-design/failure-modes-and-reliability.md).
  - Added [docs/04-code-walkthrough/checks-walkthrough.md](file:///d:/seo-gate/docs/04-code-walkthrough/checks-walkthrough.md).


---

### [2026-11-21] Phase 5: Lighthouse Lab Budgets, Flaky Protection & Interactive HTML Reports

#### Added
- **Programmatic Lighthouse Integration (`src/lighthouse/runner.ts`):** Orchestrates Chrome DevTools Protocol sessions with Playwright Chromium, extracting median metrics across $N$ runs (default: 3) for LCP, CLS, TBT, JS weight, and Image weight.
- **Performance Budget Engine:** Supports configurable thresholds (`budgets: { lcpMs: 2500, cls: 0.1, totalJsKb: 500, tolerancePercent: 10 }`) comparing against baseline snapshots.
- **Two-Strike Flaky Protection:** Automatically re-tests failing performance metrics; only regressions that reproduce twice fail the CI gate, filtering out virtualized CI runner jitter.
- **Interactive Standalone HTML Report (`src/report/html.ts`):** Single-file HTML report with embedded styles and vanilla JS, live search filtering, severity toggle buttons, and lab performance comparison table.
- **CLI Options:** Added `--performance`, `--format html`, and `--html <path>`.
- **System Design & Documentation:**
  - Added [docs/01-concepts/lighthouse-and-core-web-vitals.md](file:///d:/seo-gate/docs/01-concepts/lighthouse-and-core-web-vitals.md).
  - Added [docs/02-system-design/performance-and-scaling.md](file:///d:/seo-gate/docs/02-system-design/performance-and-scaling.md).
  - Added [docs/02-system-design/trade-offs.md](file:///d:/seo-gate/docs/02-system-design/trade-offs.md).
  - Added [docs/04-code-walkthrough/reports-walkthrough.md](file:///d:/seo-gate/docs/04-code-walkthrough/reports-walkthrough.md).
