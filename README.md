# 🛡️ seo-gate

> **The Automated SEO Regression Guard for CI/CD Pipelines.**  
> Prevent accidental `noindex` tags, dropped canonicals, broken titles, and search visibility loss before code reaches production.

---

## ⚡ The Problem

Developers move fast. In rapid deployment cycles, template adjustments, router tweaks, or environment switches frequently introduce silent SEO regressions:
- A staging configuration leaves `<meta name="robots" content="noindex">` on production.
- A component refactor drops `<link rel="canonical">` or makes it relative.
- A routing change creates multi-hop redirect chains or loops.
- Title and description tags get duplicated or stripped.

Because visual layouts and functional checkout flows still pass tests, these regressions silently deploy to production—wiping out organic search traffic, customer discovery, and store revenue before anyone notices.

**seo-gate turns SEO specifications into automated regression tests for your CI/CD pipeline.**

---

## 🚀 Key Features

- **🎯 Regression-First Gate:** Diffs preview environments against your production baseline. Fails builds *only* when new errors are introduced—pre-existing debt won't block feature pull requests.
- **⚡ Polite Asynchronous Crawler:** Bounded concurrency pool (default: 4 workers) with polite pacing delays to prevent overwhelming preview or staging servers.
- **📌 Idempotent Sticky PR Comments:** Automatically updates a single comment on GitHub pull requests. Zero bot spam across multiple commits.
- **🛡️ Zero Secret Leakage:** Automatically redacts basic-auth credentials and sensitive tokens from URLs in logs and reports.
- **📊 Multi-Format Reporting:** Generates versioned JSON (`schemaVersion: 1`), PR Markdown comments, and Slack/Teams alert cards.
- **💼 Enterprise Ready:** Tested on headless e-commerce storefronts, Salesforce Experience Cloud / B2B Commerce, and modern web frameworks (React, Next.js, Nuxt, Astro).

---

## 🔄 How It Works

```mermaid
flowchart LR
    A["Pull Request / Deployment"] --> B["seo-gate CLI / Action"]
    B --> C["Polite Crawl\n(Target + Sitemap)"]
    C --> D["Pure SEO Checks\n(Status, Titles, Meta, Canonical, Noindex)"]
    D --> E["Diff Engine vs. baseline.json"]
    E --> F{"Gate Mode"}
    F -->|"New Regression (Error)"| G["Fail Build (Exit 1) + Update Sticky PR Comment"]
    F -->|"Clean / Baseline Match"| H["Pass Build (Exit 0)"]
```

---

## 🚦 Three Gate Modes

| Mode | Behavior | Best Used For |
|---|---|---|
| **`regression`** (Default) | Fails **only** if new errors exist that were not present in the baseline. | Active development teams with existing technical debt. |
| **`strict`** | Fails if **any** error exists across the audited page set. | Green-field projects and high-security release branches. |
| **`report`** | Never fails (always exits with code `0`); logs findings and comments. | Initial 2-week team onboarding and observational audits. |

---

## 💻 Quick Start

### 1. Installation

```bash
# Clone and install dependencies
git clone https://github.com/majhiiii/seo-gate.git
cd seo-gate
pnpm install
```

### 2. Scaffold Starter Configuration

```bash
pnpm seo-gate init https://preview.example.com
```

This creates a starter `seo-gate.config.yml`:

```yaml
target: https://preview.example.com
mode: regression

pages:
  include:
    - "/"
    - "/products/*"
    - "/category/*"
  exclude:
    - "/cart"
    - "/account/*"
  sitemap: true
  crawl:
    concurrency: 4
    delayMs: 100

checks:
  title: { min: 20, max: 65, unique: true }
  metaDescription: { min: 70, max: 160, unique: true }
  h1: { requireExactOne: true }
  canonical: { requireSelfReferencing: true }
  noindex: { allowOnStaging: false }

ignore:
  - check: "title-length-short"
    url: "/legal/*"
    reason: "Fixed statutory title required by compliance"
```

### 3. Capture Production Baseline

```bash
pnpm seo-gate baseline update --config seo-gate.config.yml --output baseline.json
```

### 4. Run the Audit

```bash
pnpm seo-gate run --config seo-gate.config.yml --baseline baseline.json
```

---

## 🤖 GitHub Actions Integration

Use our reusable composite action in `.github/workflows/seo-gate.yml`:

```yaml
name: SEO Quality Gate

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  seo-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run seo-gate
        uses: ./
        with:
          target-url: ${{ env.PREVIEW_URL }}
          config-path: seo-gate.config.yml
          baseline-path: baseline.json
          mode: regression
          github-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 🛠️ CLI Reference & Subcommands

| Command | Description | Example |
|---|---|---|
| `seo-gate init [url]` | Generate a starter `seo-gate.config.yml` with safe defaults | `npx seo-gate init https://preview.example.com` |
| `seo-gate run -c <config>` | Run crawler, checks, and regression gate against target | `npx seo-gate run -c seo-gate.config.yml -b baseline.json` |
| `seo-gate baseline update -c <config>` | Crawl target or production and write a fresh `baseline.json` | `npx seo-gate baseline update -c seo-gate.config.yml` |
| `seo-gate diff <fileA> <fileB>` | Compare two JSON run results and summarize regressions | `npx seo-gate diff baseline.json report.json` |

### CLI Options for `seo-gate run`:
- `-c, --config <path>`: Path to configuration YAML (Required)
- `-b, --baseline <path>`: Path to baseline JSON snapshot (for regression mode)
- `-m, --mode <mode>`: Override gate mode (`strict`, `regression`, `report`)
- `-f, --format <format>`: Report format (`json`, `md`, `html`)
- `-o, --output <path>`: Custom report output path
- `--html <path>`: Generate a standalone interactive HTML report
- `--performance`: Run programmatic Lighthouse lab audits on critical pages
- `--pr <number>`: Pull request number for posting/updating a sticky PR comment
- `--github-token <token>`: GitHub token for commenting (`secrets.GITHUB_TOKEN`)
- `--slack-webhook <url>`: Slack incoming webhook URL for alert cards
- `--teams-webhook <url>`: Microsoft Teams incoming webhook URL

---

## 🔍 The 11 Core Checks

| Check ID | Default Severity | What It Inspects |
|---|---|---|
| `noindex` | `error` | Blocks accidental `noindex` meta tags or `X-Robots-Tag` headers on indexable pages. |
| `http-status` | `error` | Asserts HTTP 200; flags 4xx/5xx errors, redirect chains (>1 hop), and redirect loops. |
| `canonical` | `error` | Asserts presence, absolute URL format, self-referencing consistency, and non-404 targets. |
| `robots-txt` | `error` | Asserts robots.txt exists, flags accidental `Disallow: /`, and verifies critical paths. |
| `rendered-vs-raw` | `error` | Compares raw Cheerio HTML vs Playwright DOM to catch the **hydration gap** on SPA/LWC apps. |
| `title` | `warn` / `error` | Asserts existence, uniqueness across page set, and length bounds (20–65 characters). |
| `meta-description` | `warn` | Asserts existence, uniqueness, and length bounds (70–160 characters). |
| `h1` | `warn` / `error` | Asserts exactly one `<h1>` heading per page. |
| `structured-data` | `warn` / `error` | Validates JSON-LD syntax and asserts required schema properties (`Product`, `BreadcrumbList`, etc.). |
| `hreflang` | `error` | Asserts ISO language codes, self-references, and reciprocal return tags across languages. |
| `sitemap` | `warn` / `error` | Asserts sitemap URLs return 200, are canonical, and flags sudden URL drops (>10%). |

---

## 📦 Programmatic Node.js SDK

`seo-gate` can also be imported directly as a TypeScript / ES module library:

```typescript
import { crawlTarget, runChecks, evaluateGate, generateHtmlReport } from 'seo-gate';
import { loadConfig } from 'seo-gate';

// 1. Load config
const config = loadConfig('seo-gate.config.yml');

// 2. Crawl target
const pages = await crawlTarget(config);

// 3. Run pure checks
const result = runChecks(pages, config);

// 4. Generate standalone HTML report
const html = generateHtmlReport({
  target: config.target,
  mode: config.mode,
  totalPages: pages.length,
  passed: result.findings.filter(f => f.severity === 'error').length === 0,
  findings: result.findings
});
```

---

## 🧪 Testing & Quality Standards

```bash
# Run unit and integration test suite
pnpm test

# Run tests with code coverage report (>= 85% checks gate)
pnpm test:coverage

# Validate documentation internal links and references
pnpm docs:check
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
