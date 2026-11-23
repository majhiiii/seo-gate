# Learning: 46 Technical Interview Questions & Answers

## 1. In one paragraph
This document compiles 46 comprehensive, real-world technical interview questions and detailed model answers covering system design, trade-offs, failure handling, browser automation, security, and scaling in `seo-gate`, designed to help you ace senior backend and systems engineering interviews.

## 2. Why this exists
Technical interviews evaluate not just what you built, but *why* you made specific architectural choices, how you handled edge cases, and how you think about trade-offs. These model answers use real implementation details from this repository so you can explain every aspect with confidence.

---

## Category 1: System Architecture & High-Level Design

### Q1: What is the high-level architecture of `seo-gate`?
**Model Answer:** `seo-gate` follows a strictly unidirectional pipeline architecture:
1. **CLI Layer (`src/cli/`):** Commander-based entry point parsing flags and executing commands.
2. **Configuration & Ingestion (`src/config/`):** Zod-validated YAML schema applying defaults.
3. **Crawl & Render Layer (`src/crawl/` & `src/render/`):** Concurrency-bounded HTTP crawler and Playwright headless Chromium renderer.
4. **Pure Check Suite (`src/checks/`):** 11 deterministic inspection rules operating on HTML and headers.
5. **Differential Regression Engine (`src/baseline/`):** Host-agnostic fingerprinting comparing current findings against Git-committed baselines.
6. **Reporting & CI Layer (`src/report/` & `src/github/`):** Multi-format formatters (JSON, Markdown, standalone HTML) and idempotent GitHub PR commenters.

### Q2: Why did you separate the crawler from the check functions?
**Model Answer:** Separation of concerns. If checks performed their own network calls, testing would be slow, prone to network timeouts, and difficult to isolate. By having the crawler fetch all pages upfront into `PageAudit` objects, all checks in `src/checks/` become 100% side-effect-free pure functions that execute in milliseconds on in-memory data.

### Q3: What is the "negative constraint" in your module design?
**Model Answer:** Module rules explicitly define what packages must *never* do. For example: `checks/` must never perform I/O; `crawl/` must never decide pass/fail; `baseline/` must never format HTML; and no module may ever import from `cli/`. This prevents circular dependencies and architectural erosion.

### Q4: How does `seo-gate` handle ephemeral preview environments (like Vercel or Netlify)?
**Model Answer:** Ephemeral preview URLs have dynamic hostnames (e.g. `preview-pr-42.vercel.app`) that differ from production. If we compared full URLs, every page would appear as a brand-new regression. Under **ADR-0002**, we fingerprint findings as `${checkId}::${pathname}`, stripping the hostname so findings match across preview and production environments.

### Q5: How do you prevent legacy technical debt from blocking urgent pull requests?
**Model Answer:** By introducing three gate modes: `strict`, `regression`, and `report`. In `regression` mode, the diff engine partitions findings into `newFindings`, `resolvedFindings`, and `unchangedFindings`. Pre-existing issues are displayed in a collapsed section of the PR report, and the build only fails if a *new* error was introduced.

### Q6: Why did you choose TypeScript with strict mode?
**Model Answer:** Type safety eliminates runtime errors in CI. Strict null checks, explicit return types on checks, and Zod inference ensure that data contracts (`Finding`, `PageAudit`, `SeoGateConfig`) are enforced at compile time.

### Q7: How does your Salesforce experience map to this project?
**Model Answer:** Salesforce enforces strict quality and architectural discipline: Apex test coverage gates deployments, governor limits prevent runaway resource usage, and validation rules enforce data contracts. I applied these exact principles to `seo-gate`: SEO checks act as validation rules, Lighthouse lab budgets mirror governor limits, and exit codes mirror deployment validation status.

### Q8: What happens if `seo-gate` encounters an invalid configuration file?
**Model Answer:** It throws a typed `ConfigError` with exact field paths (e.g. `Field 'budgets.lcpMs': Expected number, received string`) and exits with code `2`. It never fails silently or proceeds with corrupted settings.

---

## Category 2: Rendering & Crawling Mechanics

### Q9: What is the "Hydration Gap" and why is it dangerous for SEO?
**Model Answer:** Single-page applications and JavaScript storefronts (like Salesforce Experience Cloud, React, or Vue) often send bare HTML shells from the server and inject headings, titles, and canonical tags via client-side JavaScript. Search engine crawlers (Googlebot) fetch raw HTML in their first pass and defer JavaScript execution. If critical tags only exist post-hydration, the page risks indexing delays, ranking drops, or canonical misattribution.

### Q10: How does `seo-gate` detect client-only SEO elements?
**Model Answer:** The `rendered-vs-raw` check fetches the static HTML via Cheerio, renders the page in Playwright Chromium, and diffs critical tags (`<h1>`, `<title>`, `<meta description>`, `canonical`). If a tag is missing in the raw HTML but appears in the rendered DOM, it flags a `rendered-vs-raw` discrepancy error.

### Q11: How did you optimize Playwright to run fast in resource-constrained CI runners?
**Model Answer:** By intercepting network requests using `page.route()`. We abort non-essential assets—images, stylesheets, fonts, and media—while allowing only document and script requests necessary for DOM hydration. This reduced render time and memory usage by up to 70%.

### Q12: How does the crawler prevent overloading the target staging server?
**Model Answer:** It uses a bounded queue with configurable concurrency (default: 4 workers) and a polite per-request delay (default: 100ms).

### Q13: How does the crawler handle infinite redirect loops?
**Model Answer:** `fetchPage()` records every hop in the `redirectChain` array and caps redirects at 6 hops. If a loop occurs, it records the chain and the `http-status` check flags `http-redirect-loop`.

### Q14: How does URL normalization work in your crawler?
**Model Answer:** `normalizeUrl()` uses the WHATWG URL API to resolve relative paths, lowercase hostnames, strip default ports (80/443), remove trailing slashes (except root `/`), and strip hash fragments (`#section`).

### Q15: Why does `seo-gate` perform an initial reachability test on the target root?
**Model Answer:** To fail fast. If a staging environment is down, DNS is failing, or deployment is incomplete, running a full crawl wastes time and could produce confusing "0 pages audited: PASS" results. Testing root reachability first guarantees exit code `2` with a clear message: `"Could not reach target URL. Is the preview URL correct?"`

---

## Category 3: Determinism, Testing & Pure Functions

### Q16: How do you guarantee deterministic results across test runs?
**Model Answer:**
1. Pure check functions with zero side-effects.
2. Alphabetical sorting of all findings by URL and `checkId`.
3. Fixed Chromium emulation profiles (fixed viewport, user-agent).
4. Taking the median of multiple Lighthouse runs.

### Q17: What is your test coverage strategy?
**Model Answer:** We enforce an 85% coverage threshold on the check suite. Every check has unit tests with positive and negative HTML fixtures. In addition, integration tests run against a local test fixture server (`fixtures/test-site/server.ts`) with intentionally planted bugs (missing titles, redirect chains, accidental noindex, broken hreflang) to assert exact findings.

### Q18: Why did you build a local fixture server instead of mocking all network calls?
**Model Answer:** Mocking hides real-world protocol bugs (redirect headers, HTTP status codes, chunked transfer encoding, and Playwright Chromium interactions). A lightweight local Express fixture server provides realistic HTTP behavior while remaining completely offline and fast.

### Q19: How do you test the CLI commands?
**Model Answer:** `tests/cli/cli.test.ts` and `tests/cli/baseline-cli.test.ts` execute `executeRun`, `executeInit`, `executeBaselineUpdate`, and `executeDiff` programmatically, asserting console outputs, generated report files, and exit codes (`0`, `1`, `2`).

### Q20: How does `seo-gate` validate structured data (JSON-LD)?
**Model Answer:** `src/checks/structured-data.ts` extracts `<script type="application/ld+json">` tags, parses them with `JSON.parse` (catching syntax errors like trailing commas), and asserts required schema.org properties for 5 core types: `Product`, `BreadcrumbList`, `Organization`, `FAQPage`, and `Article`.

### Q21: How does `seo-gate` validate hreflang tags?
**Model Answer:** `src/checks/hreflang.ts` asserts:
1. Valid ISO 639-1 language and ISO 3166-1 region codes.
2. Self-referencing alternate tag on the current page.
3. Reciprocal return tags across all linked alternate pages.

### Q22: What happens if an HTML page has multiple `<h1>` tags?
**Model Answer:** `src/checks/h1.ts` counts `<h1>` elements. If count is 0, it emits `h1-missing` (error); if count > 1, it emits `h1-multiple` (warning), providing evidence of all headings found.

---

## Category 4: Baselines, Differential Logic & Gate Modes

### Q23: Why did you store baselines as JSON files in Git rather than a database?
**Model Answer (ADR-0001):**
1. **Zero Infrastructure Cost:** No PostgreSQL or DynamoDB hosting fees.
2. **Zero Secrets in CI:** No database credentials required in CI runners (Rule 5).
3. **Version Control:** Baselines branch, merge, and rollback alongside application code.
4. **Code Review:** Updating a baseline requires a Git commit, ensuring team visibility.

### Q24: How does the three-way diff partitioning work?
**Model Answer:** In `src/baseline/diff.ts`, findings are indexed by `${checkId}::${pathname}`. It computes:
- `newFindings`: Present in current run but absent in baseline.
- `resolvedFindings`: Present in baseline but absent in current run.
- `unchangedFindings`: Present in both.
- `regressions`: `newFindings` with severity `error`.

### Q25: What are the three gate modes and when should each be used?
**Model Answer:**
1. `strict`: Fails if any error exists (ideal for greenfield projects or production audits).
2. `regression`: Fails only if *new* errors were introduced vs baseline (default for CI pull requests).
3. `report`: Never fails (exit code 0); only generates reports and comments (used during the initial 2-week team rollout).

### Q26: What happens in regression mode if no `baseline.json` file is found?
**Model Answer:** If no baseline exists, `seo-gate` falls back to strict mode, treating all newly discovered errors as regressions, while logging a recommendation to run `seo-gate baseline update`.

### Q27: How does `seo-gate` handle intentional SEO changes (e.g. rebranding or title updates)?
**Model Answer:** The developer runs `seo-gate baseline update --config seo-gate.config.yml`, which updates `baseline.json`. The updated baseline is committed to the feature branch, so the PR diff passes cleanly.

### Q28: How do documented `ignore` rules work?
**Model Answer:** In `seo-gate.config.yml`, an `ignore` entry specifies `check`, `url`, a mandatory `reason`, and an optional `expires` date. If the rule matches and has not expired, the finding is suppressed and tallied in `ignoredCount`. The PR comment displays active ignores so exceptions cannot hide forever.

---

## Category 5: Performance Lab Audits & Flaky Protection

### Q29: What is the difference between Lab Data and Field Data for Web Vitals?
**Model Answer:**
- **Lab Data:** Synthetic metrics collected in a controlled simulated environment (Playwright + Lighthouse) with fixed CPU and network throttling. Perfect for catching regressions before code merges.
- **Field Data:** Real user metrics collected by Chrome User Experience Report (CrUX) over a 28-day window across diverse devices and networks.

### Q30: Why is single-run Lighthouse auditing bad in CI?
**Model Answer:** Virtualized CI runners experience CPU throttling spikes and host I/O contention. A single run can vary by $\pm 25\%$, creating false-positive build failures that frustrate developers and lead teams to disable the tool.

### Q31: How does your median-of-N algorithm work?
**Model Answer:** `auditPagePerformance()` runs Lighthouse $N$ times (default: 3) against the URL, collects LCP, CLS, TBT, JS weight, and Image weight arrays, sorts them, and computes the median value for each metric.

### Q32: Explain your two-strike flaky protection mechanism.
**Model Answer:** In `diffPerformance()`, if a page metric exceeds baseline tolerance (e.g. +10%) or budget, `seo-gate` immediately triggers an automated confirmation re-audit on that URL. If the second run also exceeds the threshold, `reproduced = true` and it fails the gate. If the second run passes, it is flagged as `reproduced = false` (transient CI noise) and does not block the build.

### Q33: How does `seo-gate` connect to Chromium for Lighthouse?
**Model Answer:** It launches Playwright Chromium with an open remote debugging port (`--remote-debugging-port`), acquires an available TCP port using `net.createServer().listen(0)`, and passes the port to Lighthouse to attach via Chrome DevTools Protocol (CDP).

### Q34: What performance metrics are audited?
**Model Answer:** Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), Total Blocking Time (TBT), Total JavaScript Transfer Size (kB), and Total Image Transfer Size (kB).

---

## Category 6: CI/CD Integration & Developer Experience

### Q35: What is a "sticky PR comment" and how did you implement it?
**Model Answer:** A sticky comment is a single pull request comment that updates in place across multiple commits instead of creating duplicate bot spam. `src/github/comment.ts` includes a hidden HTML marker (`<!-- seo-gate-sticky-comment -->`). Before commenting, it queries GitHub's API for existing comments on that PR; if the marker is found, it issues `PATCH /issues/comments/{id}`; if not found, it calls `POST /issues/{pr}/comments`.

### Q36: How is `seo-gate` packaged for GitHub Actions?
**Model Answer:** As a reusable composite action in `action.yml`. Any repository can consume it with a simple `uses: ./` step, passing inputs for `target`, `config`, `mode`, and secrets.

### Q37: Why do you run a daily scheduled audit against production?
**Model Answer:** Code commits in Git are not the only way websites break. Content editors in CMS platforms, marketing tag managers, or CDN route misconfigurations can introduce accidental `noindex` tags or broken canonicals on production without any code changes. A nightly cron workflow (`0 6 * * *`) audits production and alerts Slack or Teams.

### Q38: How does the standalone HTML report work without a web server?
**Model Answer:** `src/report/html.ts` bundles all CSS styles and vanilla JavaScript directly into a single `.html` file. It uses zero external CDN links. Anyone can double-click and open it locally in any browser with interactive search, filters, and KPI cards.

---

## Category 7: Security, Privacy & Compliance

### Q39: How does `seo-gate` enforce Rule 5 (No secrets in code, logs, or reports)?
**Model Answer:**
1. All secrets (`GITHUB_TOKEN`, webhooks) are injected via environment variables.
2. `redactSensitiveUrl` intercepts all URLs before logging or writing reports, replacing basic-auth credentials with `***:***` and redacting sensitive query parameters (`token`, `auth`, `key`, `secret`) with `[REDACTED]`.

### Q40: What external telemetry does `seo-gate` send?
**Model Answer:** Absolutely none. `seo-gate` has zero third-party analytics, zero tracking pixels, and zero outbound network calls to proprietary APIs. All data stays strictly within the user's execution environment.

### Q41: How do you handle supply chain security in this project?
**Model Answer:**
1. Exact package version pinning in `package.json`.
2. Committed `pnpm-lock.yaml`.
3. Running `pnpm audit` in CI to detect vulnerabilities.
4. Minimal dependency footprint, selecting well-maintained libraries (Cheerio, Commander, Playwright, Zod).

### Q42: Does `seo-gate` respect `robots.txt`?
**Model Answer:** Yes. The crawler parses `robots.txt` and asserts that preview environments do not disallow critical paths. For preview environments where robots.txt intentionally blocks external crawlers, the tool supports explicit configuration options.

---

## Category 8: Scaling, Trade-offs & "What Would You Do Differently?"

### Q43: How long does a 100-page crawl take, and what is the bottleneck?
**Model Answer:** A 100-page static Cheerio crawl takes ~3.5 seconds. The bottleneck is network I/O and server response latency. Adding Playwright hydration to 5 critical pages adds ~3 seconds. Adding Lighthouse lab audits (3 runs median) to 2 pages adds ~18 seconds. Total run: ~25 seconds, well below the 10-minute CI budget.

### Q44: How would you scale `seo-gate` to audit a 500,000-page e-commerce catalog?
**Model Answer:**
1. **Sitemap Sharding:** Partition sitemaps across matrix jobs in CI (`shard: 1/10`, `shard: 2/10`).
2. **Distributed Queue:** Replace the in-memory queue with BullMQ and Redis workers.
3. **Object Storage Baselines:** Store baseline JSON blobs in Amazon S3 or Cloudflare R2 instead of Git repositories.
4. **Sampling & Archetypes:** In CI, audit representative page archetypes (homepage, top categories, top product detail pages) rather than crawling half a million identical product templates.

### Q45: What trade-off was the hardest to make?
**Model Answer:** The trade-off between Git-committed baselines and an external database (ADR-0001). A database would allow central aggregation across thousands of runs, but it would require external hosting, database migrations, and connection credentials in CI. Choosing Git-committed baselines prioritized zero-trust security, zero infrastructure cost, and developer self-service.

### Q46: If you started over today, what would you do differently?
**Model Answer:** I would add visual snapshot diffing powered by Playwright screenshots and image comparison libraries (e.g. Pixelmatch) for critical pages. This would allow `seo-gate` to catch visual regressions—such as overlapping cookie banners hiding the `<h1>` or broken CSS layouts—alongside DOM and metadata assertions.
