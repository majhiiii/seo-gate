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
