# Learning: Frequently Asked Questions (FAQ)

## 1. In one paragraph
This document compiles answers to the most frequently asked questions regarding `seo-gate`'s architecture, day-to-day operation, gate mode selection, and integration into existing enterprise development pipelines.

## 2. Why this exists
Developers, technical leads, and SEO specialists frequently ask similar operational questions when adopting `seo-gate`. Having a centralized FAQ resolves ambiguity and establishes common expectations.

## 3. General Architecture & Design FAQs

### Q1: Why not just use existing SaaS SEO crawlers like Screaming Frog or Sitebulb?
**A:** SaaS crawlers are designed for periodic manual audits by SEO specialists, not real-time CI/CD blocking on pull requests. They cannot easily integrate into a GitHub Actions branch preview lifecycle, cannot fail a pull request with an exit code, and cost thousands of dollars per seat. `seo-gate` is developer-first, lightweight, runs directly inside CI runners, and gates deployments automatically.

### Q2: Why is `baseline.json` committed to Git instead of stored in a database?
**A:** Storing the baseline in Git eliminates all external infrastructure costs, requires zero database connection strings or secrets in CI (strictly adhering to Rule 5), and makes baseline changes auditable via Git commits and PR code reviews. When an architectural redesign intentionally changes page titles, updating the baseline is as simple as committing the new `baseline.json`.

### Q3: How does `seo-gate` avoid blocking urgent pull requests on pre-existing legacy issues?
**A:** By using `mode: regression`. In regression mode, `seo-gate` compares the current run against the baseline snapshot. Pre-existing issues are displayed in a collapsed section of the report but do not fail the build. The gate only fails if a *new* error is introduced.

### Q4: Can `seo-gate` test single-page applications built with React, Vue, or Salesforce LWC?
**A:** Yes. `seo-gate` features a dedicated **Rendered vs. Raw inspection check** powered by Playwright Chromium. It compares the raw server HTML against the client-hydrated DOM to detect when essential tags (`<h1>`, `<title>`, `<meta description>`, `canonical`) only exist after client-side JavaScript execution.

### Q5: How does flaky test protection work for Lighthouse audits?
**A:** Shared CI runners (like GitHub Actions) experience virtualized CPU throttling variance. `seo-gate` takes the median of 3 runs. If a performance regression is detected, it triggers an immediate confirmation re-test. Only regressions that reproduce twice fail the CI gate; transient spikes are logged as non-blocking warnings.

### Q6: Can non-developers read the results?
**A:** Yes. `seo-gate` generates an interactive, standalone HTML report (`seo-gate-report.html`) with embedded styles and vanilla JavaScript. It includes visual KPI cards, live search filtering, severity toggle buttons, and plain-English fix hints. Non-developers can open it in any web browser without running local servers.

## 4. Example
Viewing an active ignore in the FAQ context:
- Question: *"Can our marketing team temporarily ignore a short title on a promotional landing page?"*
- Answer: *"Yes. Add an ignore entry to `seo-gate.config.yml` with a mandatory reason and an optional expiration date. The issue will be ignored until the expiration date passes."*

## 5. Salesforce analogy
Adopting `seo-gate` is like **enabling Salesforce Code Coverage Requirements (75% minimum) and Apex Test Executions** before deploying change sets. It transitions quality enforcement from manual post-release triage to automated pre-deployment prevention.

## 6. Common mistakes and What to remember
- **Mistake:** Running `mode: strict` on legacy websites on day one. Always start with `mode: report` for 2 weeks, capture a baseline, and transition to `mode: regression`.
- **What to remember:** An SEO gate should empower developers with actionable fix hints, not frustrate them with noisy or unexplainable failures.
