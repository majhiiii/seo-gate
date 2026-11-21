# Learning Checkpoints

This document tracks your progress through each phase of `seo-gate`. After each phase, review these concepts, test yourself with the questions, and practice the 10-minute "explain it back" prompt so you can comfortably explain this system in technical interviews.

---

## Phase 1 Checkpoint: Architecture, Polite Crawler & Core Checks

### 1. What was built
- **Core Architecture:** Unidirectional module pipeline separating CLI orchestration, configuration validation, polite crawling, pure rule checking, baseline diffing, and reporting.
- **Config Schema:** Robust Zod validation for `seo-gate.config.yml` supporting targets, modes (`strict`, `regression`, `report`), page inclusions/exclusions, sitemap discovery, and custom check thresholds.
- **Polite Crawler:** Asynchronous fetcher with concurrency limiting (default: 4), polite delay (default: 100ms), timeout safety, and Cheerio DOM parsing.
- **Core 6 Checks:**
  1. `http-status`: Verifies HTTP 200, catches 4xx/5xx, redirect chains (>1 hop), and loops.
  2. `title`: Enforces existence, length bounds (20–65 chars), and cross-page set uniqueness.
  3. `meta-description`: Enforces existence, length bounds (70–160 chars), and uniqueness.
  4. `h1`: Asserts exactly one `<h1>` heading per page.
  5. `canonical`: Enforces presence, absolute URL syntax, and self-referencing integrity.
  6. `noindex`: Detects accidental `noindex` directives on indexable pages via `<meta name="robots">` and `X-Robots-Tag` headers.
- **JSON Report:** Deterministic, alphabetically sorted JSON output (`schemaVersion: 1`).
- **Test Suite:** Local Express test fixture site with planted positive and negative SEO issues; Vitest tests with >85% coverage.

### 2. Five concepts you must understand
1. **Pure Functions in Checks:** Checks in `src/checks/` never make network requests or read from disk. Given a `PageAudit` input, they deterministically return `Finding[]`. This makes tests run in milliseconds without mocking HTTP calls.
2. **Polite Crawling vs. Browser Flooding:** Browsers and headless drivers will open dozens of tabs if unchecked. A polite crawler uses a queue and a concurrency pool with a rate delay to avoid crashing staging environments or triggering rate limits.
3. **The Danger of Accidental `noindex`:** A single `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex` deployed to production commands search engine crawlers to remove the page from the search index.
4. **Canonical URLs as Master Records:** Like deduplicating Lead records in Salesforce to a single Master ID, a canonical URL tells Google which URL is the authoritative source when multiple URLs (like query string parameters) return similar content.
5. **Deterministic Testing:** In CI/CD, if results are sorted non-deterministically (e.g., whichever async request completes first), git diffs and reports become noisy. Sorting findings alphabetically by URL and `checkId` ensures exact repeatability.

### 3. Five self-test questions & answers
1. **Q: Why don't the check functions fetch the web pages themselves?**
   *A:* Keeping checks pure separates data fetching from business logic. It allows check unit tests to execute instantly using local HTML fixtures without spinning up web servers or dealing with network flakes.
2. **Q: What is the difference between inspecting `<meta name="robots">` and checking `X-Robots-Tag`?**
   *A:* `<meta name="robots">` lives inside the HTML `<head>` tag, whereas `X-Robots-Tag` is an HTTP response header sent by the web server. Both instruct search engines not to index a page, and a full check must inspect both.
3. **Q: How does `seo-gate` prevent overwhelming a preview server during a crawl?**
   *A:* By using a bounded concurrency pool (default: 4 simultaneous requests) and an enforced polite delay (e.g., 100ms) between outbound requests.
4. **Q: What happens if a canonical URL is specified as a relative path like `/products/shoes`?**
   *A:* The `canonical` check flags this as an error because RFC 6596 and search engine specifications require canonical URLs to be absolute (including protocol and domain name).
5. **Q: What are the three standard exit codes used by `seo-gate` in CI/CD?**
   *A:* `0` (pass / clean), `1` (gate failed due to regression or policy violation), `2` (system, network, or configuration error).

### 4. One thing that could break
- **Target Unreachability:** If the target preview deployment hasn't finished deploying before `seo-gate` runs, HTTP requests will time out. `seo-gate` treats target unreachability as exit code `2` (never exit `0`), preventing false positive passes when tests did not actually run.

### 5. 10-Minute "Explain it back" prompt
> *"Imagine you are in an interview for a Senior Backend / Integration Engineer role. The interviewer asks: 'How did you architect the crawling and checking pipeline for seo-gate?' Take 10 minutes to walk through: (1) how URLs are discovered and queued, (2) why concurrency limits and polite pacing are essential, (3) how Cheerio parses HTML in memory, and (4) why the checks are implemented as pure, decoupled functions with Salesforce validation rule analogies."*


---

## Phase 2 Checkpoint: Baselines, Regression Diffing & Markdown Reports

### 1. What was built
- **Baseline Storage Engine (`src/baseline/storage.ts`):** Created versioned baseline snapshot manager (`schemaVersion: 1`), with support for saving known good runs and loading them into memory without external database dependencies.
- **Diff & Regression Engine (`src/baseline/diff.ts`):** Built cross-environment fingerprinting (`${checkId}::${pathname}`), isolating hostnames so preview deployments can be accurately compared against production baselines. Categorizes issues into `newFindings`, `resolvedFindings`, and `unchangedFindings`.
- **Three Gate Modes (`strict`, `regression`, `report`):**
  - `strict`: Fails on any error.
  - `regression`: Fails only when new errors are introduced beyond the baseline. Existing baseline debt passes.
  - `report`: Always passes, reporting all findings without blocking deployment.
- **Markdown PR Report Generator (`src/report/markdown.ts`):** Formats GitHub-ready Markdown reports with summary metrics, top regressions tables, and collapsible `<details>` blocks for pre-existing debt, resolved issues, and documented active ignores.
- **CLI Commands:** Added `seo-gate baseline update` and `seo-gate diff fileA fileB`, plus full `--baseline` integration in `seo-gate run`.

### 2. Five concepts you must understand
1. **Host-Agnostic Fingerprinting:** Ephemeral preview environments generate dynamic hosts (e.g. `preview-99.vercel.app`). Comparing full URLs fails; stripping the origin and matching on `${checkId}::${pathname}` allows accurate cross-environment diffing.
2. **Regression Mode vs. Strict Mode:** In an enterprise codebase with existing SEO debt, strict mode blocks innocent feature PRs. Regression mode ensures developers are held accountable only for the regressions introduced by their PR.
3. **Three-Way Partitioning:** A diff engine must partition findings into `new`, `unchanged`, and `resolved`. Celebrating resolved findings encourages developers to clean up technical debt.
4. **Git-as-Database Architecture (ADR-0001):** By committing `baseline.json` into Git, baselines are versioned alongside application code with full audit history and zero external database infrastructure.
5. **Human-Centric PR Reports:** Pull request comments must highlight actionable fixes first, while collapsing noisy baseline debt into expandable `<details>` accordions to keep PR discussions clean.

### 3. Five self-test questions & answers
1. **Q: Why can't we use the full absolute URL as the unique identifier for diffing?**
   *A:* In CI pipelines, preview URLs change dynamically on every pull request (e.g. `https://preview-12.example.com` vs. `https://preview-13.example.com`). If we included the hostname, every existing finding would be classified as a brand new regression.
2. **Q: What happens if a pull request fixes a pre-existing SEO error that was present in the baseline?**
   *A:* The diff engine identifies it as a `resolvedFinding`, reports it in the "Resolved Issues" section of the PR summary, and does not fail the gate.
3. **Q: What is the purpose of the `seo-gate baseline update` command?**
   *A:* It crawls a known-good target (usually production or staging after a release) and updates the committed `baseline.json` file.
4. **Q: How does `seo-gate diff fileA.json fileB.json` help developers locally?**
   *A:* It allows developers to compare two local run results or a local run against a baseline file to inspect what changed without running a full CI pipeline.
5. **Q: What exit code does `seo-gate` return in `regression` mode if the preview site has 10 pre-existing errors in the baseline, but 0 new errors?**
   *A:* It exits with code `0` (Gate Passed), because no new regressions were introduced by the pull request.

### 4. One thing that could break
- **Outdated Baseline File:** If teams forget to run `seo-gate baseline update` after an intentional architectural redesign or page addition, `seo-gate` will flag newly introduced intentional pages or changes as regressions in subsequent pull requests until the baseline is refreshed.

### 5. 10-Minute "Explain it back" prompt
> *"Imagine an interviewer asks: 'How did you prevent legacy technical debt from blocking developers while still catching regressions?' Spend 10 minutes explaining: (1) how baselines are captured and stored in Git, (2) how finding fingerprints strip ephemeral hostnames, (3) how three-way partitioning differentiates between new regressions and pre-existing issues, and (4) why the Salesforce deployment analogy of RunSpecifiedTests maps to regression mode."*


---

## Phase 3 Checkpoint: CI/CD Automation, Sticky PR Comments & Webhooks

### 1. What was built
- **Reusable Composite Action (`action.yml`):** Packaged `seo-gate` as a plug-and-play GitHub Action supporting target URL inputs, baseline paths, gate modes, GitHub token injection, and webhook alerts.
- **Sticky PR Comment Manager (`src/github/comment.ts`):** Implemented an idempotent commenter that searches for `<!-- seo-gate-sticky-comment -->` on the pull request. If found, it updates the existing comment via `PATCH /issues/comments/{id}`; if not found, it creates the comment via `POST`. Eliminates PR spam across multiple commits.
- **Slack & Teams Webhook Dispatcher (`src/report/webhook.ts`):** Formats Slack Block Kit payloads and Microsoft Teams MessageCard payloads with color-coded status badges, regression lists, and metrics summaries.
- **Credential Redaction Engine (`redactSensitiveUrl`):** Enforces Rule 5 by stripping basic-auth passwords and query string API keys/tokens before payloads or URLs are transmitted or logged.
- **Production & PR Workflows:**
  - `.github/workflows/seo-gate-pr.yml`: Automated pull request quality gate workflow.
  - `.github/workflows/production-audit.yml`: Scheduled daily cron workflow (`0 6 * * *`) auditing production storefronts to detect CMS or configuration regressions.
- **Operations Runbooks:** Created [docs/06-operations/runbook.md](file:///d:/seo-gate/docs/06-operations/runbook.md) and [docs/06-operations/how-to-roll-out-to-the-team.md](file:///d:/seo-gate/docs/06-operations/how-to-roll-out-to-the-team.md).

### 2. Five concepts you must understand
1. **Idempotent Sticky Comments:** In automated CI pipelines, a bot that posts a new comment on every push to a branch pollutes discussion. Searching for a hidden HTML marker (`<!-- seo-gate-sticky-comment -->`) and issuing a `PATCH` request updates the existing comment in place.
2. **Scheduled Production Monitoring:** Code changes in Git are not the only way websites break. Content editors in CMS platforms, marketing teams editing tags, or CDN route misconfigurations can introduce accidental `noindex` directives on production without any code commits. Daily scheduled audits catch these external issues.
3. **Zero Secrets in Logs (Rule 5):** Basic-auth credentials in preview URLs (e.g., `https://admin:pass@preview.example.com`) or query tokens (`?token=secret`) must be stripped via `redactSensitiveUrl` before printing to terminal, reports, or webhooks.
4. **Phased Rollout Strategy:** Starting directly in strict mode breeds resistance from engineers. Rolling out in `mode: report` for 2 weeks builds trust, before transitioning to `mode: regression` enforcement.
5. **Composite Action Packaging:** An `action.yml` file allows any repository in an organization to consume `seo-gate` with a simple `uses: ./` or `uses: org/seo-gate@v1` step without copy-pasting shell scripts.

### 3. Five self-test questions & answers
1. **Q: How does `seo-gate` ensure only one comment exists on a pull request across 10 commits?**
   *A:* It includes a hidden HTML marker (`<!-- seo-gate-sticky-comment -->`) in the markdown comment body. Before posting, it queries the GitHub API for existing comments on that PR number; if it finds the marker, it updates that comment in place via `PATCH` instead of creating a new one.
2. **Q: Why is a daily scheduled production audit necessary if PR gates already exist?**
   *A:* Changes made outside of Git repositories—such as CMS content publishing, marketing tag manager updates, or CDN edge rule changes—can de-index pages or break canonicals without triggering pull request workflows.
3. **Q: How does `seo-gate` protect sensitive credentials in staging URLs?**
   *A:* `redactSensitiveUrl` parses URLs with the WHATWG URL API and replaces `username` and `password` with `***`, and replaces sensitive query parameters (`token`, `auth`, `key`, `secret`) with `[REDACTED]`.
4. **Q: What permissions are required by the GitHub Action workflow to post PR comments?**
   *A:* The workflow must declare `pull-requests: write` permissions in its YAML block to authorize the `GITHUB_TOKEN` to call GitHub's issue comments API.
5. **Q: What happens if a Slack or Teams webhook call fails due to a network timeout?**
   *A:* The error is caught and logged as a warning; it does not crash or invalidate the core SEO quality gate run.

### 4. One thing that could break
- **GitHub Token Permissions:** If a pull request originates from a fork (or an enterprise repo with restricted token permissions), GitHub defaults `GITHUB_TOKEN` to read-only (`pull-requests: read`), causing sticky comment creation to fail with HTTP 403. The error handler catches this gracefully and prints a warning without failing the SEO audit.

### 5. 10-Minute "Explain it back" prompt
> *"Imagine an interviewer asks: 'How did you integrate your tool into enterprise CI/CD without spamming developers or leaking secrets?' Spend 10 minutes walking through: (1) how composite actions encapsulate execution, (2) how the sticky comment algorithm uses hidden HTML markers to update in place, (3) how URL redaction prevents token leakage, and (4) why daily cron workflows are required to catch CMS regressions."*


---

## Phase 4 Checkpoint: Raw vs. Rendered Engine, Structured Data, Hreflang & Crawlability

### 1. What was built
- **Headless Browser Rendering Engine (`src/render/browser.ts`):** Playwright Chromium integration with resource aborting (blocking images, fonts, stylesheets, media) for high throughput and conservative timeouts (15s).
- **Raw vs. Rendered Discrepancy Check (`src/checks/rendered-vs-raw.ts`):** Compares static Cheerio HTML vs hydrated Playwright DOM. Detects when critical SEO elements (`<title>`, `<h1>`, `<meta description>`, `<link rel="canonical">`) exist only after JavaScript executes, or text content is significantly absent from initial HTML. Critical for Salesforce Experience Cloud / LWC storefronts and SPA frameworks.
- **Structured Data (JSON-LD) Validator (`src/checks/structured-data.ts`):** Validates JSON-LD schema syntax and enforces required schema.org properties for `Product`, `BreadcrumbList`, `Organization`, `FAQPage`, and `Article`.
- **Hreflang Reciprocal Validator (`src/checks/hreflang.ts`):** Validates ISO/BCP 47 language-region codes, verifies self-referencing alternate tags, and detects missing reciprocal return tags across multilingual page clusters.
- **Sitemap Health Check (`src/checks/sitemap.ts`):** Verifies that all sitemap URLs return HTTP 200, declare self-referencing canonical URLs, do not leak `noindex` directives, and flags sudden URL drops (>10% vs baseline).
- **Robots.txt Crawlability Check (`src/checks/robots-txt.ts`):** Parses robots.txt rules for `User-agent: *`, flags accidental `Disallow: /` directives, and asserts that configured critical paths (`pages.critical`) remain crawlable.
- **Architecture Documentation:**
  - [docs/01-concepts/structured-data.md](file:///d:/seo-gate/docs/01-concepts/structured-data.md)
  - [docs/02-system-design/failure-modes-and-reliability.md](file:///d:/seo-gate/docs/02-system-design/failure-modes-and-reliability.md)
  - [docs/04-code-walkthrough/checks-walkthrough.md](file:///d:/seo-gate/docs/04-code-walkthrough/checks-walkthrough.md)

### 2. Five concepts you must understand
1. **The Hydration Gap & Two-Wave Indexing:** Search engine crawlers (Googlebot) fetch raw HTML first and defer JavaScript execution to a second queue when compute capacity is available. If key metadata (`<h1>`, `<title>`, `canonical`) only exists after client JavaScript runs, indexing can be delayed or fail entirely.
2. **Headless Browser CI Optimization:** Running full Chromium browsers in CI can be slow and memory-intensive. By intercepting network requests with `page.route()` and aborting non-essential resources (images, fonts, stylesheets, media), page render times drop by up to 70%.
3. **Structured Data Contracts:** JSON-LD allows search engines to understand page entities. Invalid JSON syntax or missing required fields (`name`, `itemListElement`, `offers`) causes search engines to reject structured snippets, losing rich search result badges.
4. **Hreflang Reciprocal Confirmation:** Multi-language SEO requires reciprocal verification. If page `/en` points to `/es`, page `/es` MUST point back to `/en`. If the link is one-directional, search engines discard both tags to prevent third-party spoofing.
5. **Crawlability vs. Indexability:** A page disallowed in `robots.txt` cannot be crawled, meaning search engines will never see its `noindex` or canonical tags. `robots-txt` ensures search engine crawlers can reach revenue-critical pages.

### 3. Five self-test questions & answers
1. **Q: Why does `seo-gate` compare raw HTML against rendered HTML instead of only testing rendered HTML?**
   *A:* Raw HTML is what search engines evaluate immediately upon crawling. If critical SEO elements exist only after JavaScript hydration, the page suffers from the "hydration gap" and risks indexing delays, ranking drops, or canonical misattribution.
2. **Q: How does `seo-gate` keep Playwright fast in CI environments?**
   *A:* `src/render/browser.ts` aborts downloads of images, fonts, stylesheets, and media using `page.route()`, only downloading HTML and script assets needed for DOM hydration.
3. **Q: What is an hreflang reciprocity error and why does it matter?**
   *A:* It occurs when Page A points to Page B as its language alternate, but Page B does not point back to Page A. Search engines require reciprocal links to prevent unauthorized sites from falsely declaring themselves as translations of other sites.
4. **Q: What happens if a JSON-LD block has a syntax error like a trailing comma?**
   *A:* `src/checks/structured-data.ts` catches the `JSON.parse` error and emits a severity: `error` finding (`structured-data-syntax-error`) with the error snippet and a fix hint.
5. **Q: How does `seo-gate` verify that critical business URLs are not blocked by robots.txt?**
   *A:* `src/checks/robots-txt.ts` parses `Disallow` directives and tests each URL in `pages.critical` against the rules, emitting an `error` if a critical path matches a disallow pattern.

### 4. One thing that could break
- **CI Container Dependencies for Playwright:** Running headless Chromium inside minimal Docker containers or Linux runners requires OS-level shared libraries (e.g., `libnss3`, `libgbm1`). In GitHub Actions, using `npx playwright install --with-deps chromium` ensures these libraries are present.

### 5. 10-Minute "Explain it back" prompt
> *"Imagine an interviewer asks: 'How did you solve the single-page application and dynamic storefront SEO problem?' Spend 10 minutes explaining: (1) why client-rendered LWC/React apps fail initial crawler passes, (2) how Playwright headless rendering compares raw vs hydrated DOM, (3) how structured data and hreflang reciprocity are verified deterministically, and (4) how you optimized headless browser performance in resource-constrained CI environments."*
