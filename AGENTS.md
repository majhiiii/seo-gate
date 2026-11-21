# AGENTS.md: seo-gate

> Instructions for AI coding agents (Antigravity, Claude Code, Cursor, Copilot, etc.) working in this repository.
> Read this whole file before writing any code. Follow it in every phase and every change.

---

## 0. Who you are working for

The owner of this project is a Salesforce developer (Apex, LWC, REST/SOAP integrations, GitHub CI/CD) who is moving toward backend and AI-integration engineering. They must be able to **understand and explain every part of this project in a job interview**. Therefore:

- The documentation is a deliverable, as important as the code.
- Explain things in plain language, with Salesforce analogies (triggers, governor limits, sandboxes, validation rules, Apex tests, change sets, deployment status).
- Never produce code the owner cannot follow. Prefer clear and boring over clever.
- Do not invent facts, metrics, results or features. If something is unknown, write it in `docs/open-questions.md` instead of guessing.

---

## 1. Project summary

**seo-gate** is an SEO regression guard for CI/CD.

Developers ship changes that silently break SEO: a stray `noindex`, a changed canonical, missing titles, content that only appears after JavaScript runs, slower pages. seo-gate runs on every pull request and deployment, compares the preview or staging site against a saved baseline (and optionally against production), and **fails the build or posts a clear report** when SEO gets worse.

It must be usable by developers **and** SEO specialists (non-developers can read the report and edit the config).

**Users:** 7 Salesforce developers, 3 full-stack developers, 3 SEO specialists.
**Sites:** Salesforce B2B Commerce / Experience Cloud storefronts (some JavaScript-heavy) and regular web apps.

### Non-goals
- No rank tracking, keyword research or paid SEO APIs.
- No scraping of third-party sites. Only test sites we own or have permission to test.
- Not a replacement for Google Search Console or field Core Web Vitals data.
- Respect `robots.txt` when crawling external sites. For our own preview environments, ignoring it must be an explicit config choice.

---

## 2. Rules for agents (read carefully)

1. **Design first, then code.** Before each phase: write or update the design docs and show a short plan. Then code. After coding: update docs to match the code exactly, run tests, run the learning checkpoint (section 12).
2. **Work in phases** (section 13). Stop at the end of each phase, run all tests and show a short demo. Do not start the next phase without confirmation.
3. **Never leave docs stale.** If code and docs disagree, fix the docs in the same change.
4. **No invented numbers.** Do not claim accuracy, speed or coverage unless it was measured in this repo. Put measured results in docs with the command used to measure them.
5. **No secrets in code, logs, reports, fixtures or docs.** Use environment variables. Redact tokens, auth headers and URLs with credentials before printing or storing.
6. **Pin and audit dependencies.** Commit the lockfile, use current stable versions (check the registry at install time, do not rely on remembered versions), run a dependency audit in CI, avoid abandoned packages.
7. **Small, reviewable changes.** One concern per commit. Conventional commit messages.
8. **Ask before big decisions.** If a choice affects architecture, security or public interfaces, write an ADR (section 11) and flag it. If the requirement is ambiguous, state your assumption in the doc and proceed with the safest option.
9. **Do not touch anything outside this repo,** and do not include company or client data (URLs, tokens, names, screenshots) in code, fixtures or docs. Use the local fixture site and public example domains only.
10. **Tests are mandatory.** A feature without tests is not done (section 10).
11. **Deterministic and honest output.** Sorted output, fixed settings, clear messages. An unreachable target must never produce a passing result.
12. **Explain as you go.** Summaries after each phase must say what was built, what was decided and why, and what could break.

---

## 3. Tech stack

Use the current stable versions at install time.

- **Runtime:** Node.js (current LTS), TypeScript (strict mode), pnpm
- **Rendering and crawling:** Playwright (Chromium)
- **Performance and audits:** Lighthouse (programmatic API)
- **HTML parsing:** cheerio (or parse5)
- **Validation:** zod (config and result schemas)
- **CLI:** commander
- **Tests:** Vitest; a local fixture server (Express or a static server); msw where useful
- **CI:** GitHub Actions, packaged as a reusable composite action; optional Slack or Teams webhook
- **Outputs:** JSON, Markdown, HTML
- **Storage:** no database for the MVP. Baselines are JSON files committed to the repo or stored as CI artifacts.
- **Docs:** Markdown with Mermaid diagrams (render on GitHub)

---

## 4. Core concepts (use these names consistently)

| Concept | Meaning |
|---|---|
| **Target** | A base URL: preview, staging or production |
| **Page set** | URLs to test, from (a) the config list, (b) the sitemap, (c) a limited crawl (depth and max-pages limits) |
| **Check** | A rule that inspects a page and returns findings |
| **Finding** | `{checkId, url, severity (error/warn/info), message, evidence, fixHint, docsLink}` |
| **Baseline** | A saved snapshot of findings and metrics from a known-good run (usually main branch or production) |
| **Regression** | A finding or metric that is worse than the baseline or exceeds a budget |
| **Gate mode** | `strict` = any error fails; `regression` = fail only on new errors vs baseline; `report` = never fails, only reports |

Salesforce analogies to use in docs: check = Apex test or validation rule; baseline = a sandbox snapshot you compare against; regression mode = only fail on new validation errors; ignore-with-reason = a documented exception; exit code = deployment status.

---

## 5. Checks (MVP set)

### Indexability
- `noindex` via meta robots or `X-Robots-Tag` header on pages that should be indexable (**error**)
- Staging must be `noindex`; production must not be (error if `noindex` leaks to production, error if staging looks production-like)
- `robots.txt`: fetch, parse, diff against baseline; error if it newly disallows important paths or `Disallow: /` appears on production
- HTTP status: expect 200; flag 4xx/5xx; flag redirect chains longer than 1 hop and redirect loops
- Canonical: present, absolute, self-referencing unless configured, points to a 200 page, consistent between raw and rendered HTML

### On-page
- Title: present, unique across the page set, length range (default 20 to 65 chars)
- Meta description: present, unique, length range (default 70 to 160)
- Exactly one `h1`; heading-order sanity (warn)
- Images: missing alt (warn); missing width/height (warn, layout-shift risk)
- Internal links: broken (error), pointing to redirects (warn), orphan pages in sitemap but not linked (info)
- hreflang: reciprocal tags, valid codes, self-reference (error on broken reciprocity)
- Open Graph and Twitter card tags (warn)

### Structured data
- Extract JSON-LD; it must parse; check required properties for Product, BreadcrumbList, Organization, FAQPage, Article using a small bundled rule set (not a full schema.org validator); removed schema vs baseline is an **error**

### Rendering (the standout feature)
- Fetch raw HTML without JavaScript, render the page with Playwright, compare title, `h1`, meta description, canonical, main text length and internal link count. Flag content that only exists after JavaScript runs (warn, or error for configured critical elements). This catches JavaScript-rendered storefront problems.

### Performance (lab data only)
- Lighthouse on a configurable subset (default 5 key pages), fixed profile, N runs (default 3), use the median
- Budgets for LCP, CLS, TBT, total JS size, image weight; fail on regression beyond tolerance (default 10%) vs baseline
- Always state clearly that these are **lab metrics**, not field Core Web Vitals; show the profile and throttling used

### Sitemap
- `sitemap.xml` exists and parses; URLs return 200; URLs are canonical and indexable; warn when URL count drops more than 10% vs baseline

---

## 6. Configuration: `seo-gate.config.yml` (validated with zod)

```yaml
target: https://preview-123.example.com
production: https://www.example.com      # optional, for comparison
mode: regression                         # strict | regression | report
pages:
  include: ["/", "/products/*", "/category/*"]
  exclude: ["/cart", "/account/*"]
  sitemap: true
  crawl: { maxPages: 100, maxDepth: 3 }
  critical: ["/", "/category/chairs"]    # extra scrutiny + Lighthouse
checks:
  title: { min: 20, max: 65, unique: true }
  metaDescription: { min: 70, max: 160 }
  renderedVsRaw: { critical: ["h1", "title", "canonical"] }
budgets:
  lcpMs: 2500
  cls: 0.1
  totalJsKb: 500
  tolerancePercent: 10
severity_overrides:
  images-missing-alt: warn
ignore:
  - { check: "title-length", url: "/legal/*", reason: "Legal pages are fixed", expires: "2027-06-30" }
slack: { webhookEnv: SLACK_WEBHOOK_URL }
```

Rules:
- Every `ignore` entry **requires a reason** and may have an expiry date. The report lists active ignores so they cannot hide forever.
- Config errors must produce clear, human messages naming the bad field.

---

## 7. CLI

- `seo-gate init`: create a starter config
- `seo-gate run --config seo-gate.config.yml [--baseline path] [--mode regression] [--format json,md,html]`
- `seo-gate baseline update`: write a new baseline from the current run
- `seo-gate diff a.json b.json`: compare two runs

**Exit codes:** `0` pass, `1` gate failed, `2` tool or config error. Never exit `0` when the target was unreachable.

---

## 8. GitHub Actions integration

- A reusable composite action (`action.yml`) plus an example workflow:
  1. Build and deploy a preview (user-supplied step) and pass its URL
  2. Run seo-gate against the preview
  3. Upload report artifacts (JSON, HTML)
  4. Post or update **one** sticky pull-request comment with the Markdown summary (new regressions first, existing issues collapsed)
  5. Pass or fail the check according to the mode
- A scheduled daily workflow that runs against production and alerts Slack or Teams on regressions, so issues caused outside code changes (CMS, config) are also caught
- Secrets only through environment variables; never print URLs with tokens or auth headers; support optional basic-auth or header injection for protected previews
- Rollout tip for docs: start every team in `mode: report` for 2 weeks, then switch to `regression`

---

## 9. Reports

- **Markdown PR comment:** summary table (errors/warns/new vs baseline), top 10 regressions with fix hints, performance delta table, link to the full HTML report
- **HTML report:** filterable by severity, check and page; shows evidence (the exact tag or header found), before/after against baseline; optional screenshots for critical pages; lists active ignores
- **Slack/Teams:** one short summary and a link
- **JSON:** stable, versioned schema (`schemaVersion: 1`)

---

## 10. Quality, reliability and testing

### Reliability
- Crawl politely: concurrency limit (default 4), delay, per-page timeout, retry once on network error, hard cap on pages
- Deterministic results: sorted output, fixed Lighthouse settings, median of runs, warm-up request
- Flaky protection: a performance regression must reproduce in a second run before it fails the gate
- Handle redirects and cookies; support a custom User-Agent
- Nothing hardcoded to one site
- Clear errors, for example: `Could not reach https://... (timeout after 30s). Is the preview URL correct?`

### Testing (required)
- Unit tests for every check with positive and negative HTML fixtures (`fixtures/` folder of small HTML files)
- Integration test: a tiny local test site with intentionally broken pages (noindex, duplicate titles, canonical to a 404, JavaScript-only `h1`, redirect chain, missing hreflang return tag). Assert the **exact** findings.
- Baseline and diff tests: same site, one change, assert only the new regression fails in regression mode
- CLI exit-code tests, config validation tests, report snapshot tests
- Coverage gate of 85% on the checks package
- CI for the tool itself: lint, typecheck, test, build, dependency audit, `pnpm docs:check`

---

## 11. Project structure

```
seo-gate/
  AGENTS.md
  README.md
  CONTRIBUTING.md
  SECURITY.md
  LICENSE
  action.yml
  .github/workflows/
  src/
    cli/
    config/
    crawl/
    render/
    checks/            # one file per check
    lighthouse/
    baseline/
    report/            # md, html, json, slack
    github/
  fixtures/
    test-site/
  docs/                # see section 12
```

**Module rules:**
- `checks/` never performs network calls; it only inspects data given to it.
- `crawl/` and `render/` fetch; they never decide pass or fail.
- Only `baseline/` and the gate logic decide regression and exit codes.
- `report/` formats results; it never changes them.
- Dependencies point one way: cli → (config, crawl, render, checks, baseline, report, github). No cycles.

---

## 12. Documentation and learning (deliverable, not optional)

Create and keep up to date this folder:

```
docs/
  00-START-HERE.md
  open-questions.md
  01-concepts/
    seo-basics.md
    how-crawlers-and-rendering-work.md
    ci-cd-concepts.md
    baselines-and-regression-testing.md
    lighthouse-and-core-web-vitals.md
    structured-data.md
    http-basics.md                     (status codes, redirects, headers, caching)
  02-system-design/
    overview.md
    architecture.md
    data-model.md
    data-flow.md
    sequence-diagrams.md
    module-guide.md
    config-design.md
    failure-modes-and-reliability.md
    security.md
    performance-and-scaling.md
    trade-offs.md
  03-decisions/
    ADR-0001-....md                    (one per major decision)
  04-code-walkthrough/
    reading-order.md
    cli-walkthrough.md
    crawler-walkthrough.md
    checks-walkthrough.md
    baseline-diff-walkthrough.md
    reports-walkthrough.md
    github-action-walkthrough.md
  05-learning/
    glossary.md
    salesforce-analogies.md
    faq.md
    interview-questions-and-answers.md
    exercises.md
    learning-checkpoints.md
    how-to-explain-this-project.md
  06-operations/
    runbook.md
    troubleshooting.md
    how-to-add-a-check.md
    how-to-roll-out-to-the-team.md
  CHANGELOG-OF-DESIGN.md
```

### How every document is written
Each document starts with these sections, in this order:
1. **In one paragraph:** plain English, no jargon
2. **Why this exists:** the problem it solves
3. **How it works:** steps, with a diagram where useful
4. **Example:** a real input and output from this project
5. **Salesforce analogy:** compare to something the owner knows
6. **Common mistakes** and **What to remember**

Write for a smart junior developer. Define every technical term the first time it appears and link it to the glossary. Short sentences, concrete examples, no filler, no marketing language.

### Diagrams
Use Mermaid blocks for: system context, components, data flow, sequence diagrams (PR opened to PR comment posted; baseline update; scheduled production run; raw vs rendered comparison), a state diagram for the gate decision (pass, fail, error), and an entity diagram for the JSON data model. Under each diagram add a short "How to read this diagram". Keep each diagram under about 12 nodes; split if larger.

### Required content for the system design docs
- **overview.md:** problem, users, goals, non-goals, success metrics (regressions caught, false-positive rate, run time)
- **architecture.md:** layers and modules, what each owns, what each must never do, dependency rules
- **data-model.md:** JSON schemas for config, finding, run result and baseline, field by field with examples; how `schemaVersion` works and how to migrate it
- **data-flow.md:** step by step from "pull request opened" to "comment posted", naming every file and function involved
- **failure-modes-and-reliability.md:** table of what can go wrong (preview not ready, timeouts, flaky Lighthouse, rate limits, login pages, huge sites, invalid config), how the tool detects it, and what it does; explain exit codes and why an unreachable site is never a pass
- **security.md:** secrets handling, log redaction, authenticated previews, permission to crawl, supply-chain care (pinned versions, lockfile, audit in CI), what the tool must never send anywhere
- **performance-and-scaling.md:** concurrency, delays, memory, how long 100 and 10,000 pages would take (measured, not guessed), and how to scale (sharding, caching, incremental crawls)
- **trade-offs.md:** honest pros and cons of the choices (Playwright vs plain fetch, files vs a database for baselines, median-of-3 Lighthouse runs, regression vs strict mode) and alternatives not chosen
- **ADRs:** context, options considered, decision, consequences

### Code walkthrough docs
For each module: its purpose, the main functions in order of execution, a trace of one real example through the code (input, what each function does, output), and the tests that cover it with exact file paths. `reading-order.md` gives the exact order in which to read the source files, with the first file to open and what to look for.

### Learning aids
- **glossary.md:** every term (crawler, canonical, noindex, hreflang, JSON-LD, LCP, CLS, TBT, baseline, regression, idempotent, exit code, flaky test, etc.) in plain language with a one-line example
- **salesforce-analogies.md:** mapping table (check = Apex test, baseline = sandbox snapshot, ignore = documented exception, exit code = deployment status, config = custom metadata, etc.)
- **interview-questions-and-answers.md:** at least 40 questions (design, trade-offs, failure handling, testing, scaling, security, "what would you do differently?") with honest model answers using this project's real details
- **exercises.md:** 15 small hands-on exercises of increasing difficulty with hints; solution outlines in a separate collapsed section
- **learning-checkpoints.md:** after **every phase** append a section with: what was built, the 5 concepts the owner must now understand, 5 self-test questions with answers, one thing that could break, and a 10-minute "explain it back" prompt
- **how-to-explain-this-project.md:** a 30-second pitch, a 2-minute explanation, a 10-minute deep-dive outline, and an honest list of limitations
- **00-START-HERE.md:** a one-page map of the docs, a 30-minute reading path, a 3-hour deep-dive path, and a 5-minute demo script

### Quality checks for the docs
- Every link works; every Mermaid block renders
- Every function or file mentioned in the docs exists in the code
- No unexplained jargon; no unmeasured numbers
- Add `pnpm docs:check` (verifies internal links and referenced files) and run it in CI
- After each phase, list which docs were created or updated

---

## 13. Phases (stop after each, run tests, show a demo, wait for confirmation)

| Phase | Scope |
|---|---|
| **1** | Project setup, config schema, crawler (list + sitemap), 6 core checks (status, title, description, h1, canonical, noindex), JSON output, CLI. Docs: START-HERE, concepts, overview, architecture, data-model, glossary, first learning checkpoint |
| **2** | Baseline, diff, modes, exit codes, Markdown report. Docs: baseline walkthrough, sequence diagrams, ADRs, checkpoint |
| **3** | GitHub Action, sticky PR comment, Slack/Teams notification, scheduled production run. Docs: CI concepts, GitHub Action walkthrough, runbook, checkpoint |
| **4** | Raw vs rendered check, structured data, hreflang, sitemap, redirects, robots diff. Docs: rendering concepts, checks walkthrough, failure modes, checkpoint |
| **5** | Lighthouse budgets with median runs and flaky protection; HTML report. Docs: performance concepts, scaling, trade-offs, checkpoint |
| **6** | Docs polish, fixtures polish, coverage, security doc, interview Q&A (40+), exercises (15), release v0.1.0, short demo script. Final deliverables below |

### Final deliverables (end of Phase 6)
- Complete `/docs` folder
- A 1-page architecture summary that can be printed
- A short "what I learned and what to learn next" note
- Root `README.md` linking to `docs/00-START-HERE.md` and showing the architecture diagram

---

## 14. Acceptance criteria

- On the fixture site, seo-gate reports exactly the planted problems and nothing else
- In regression mode, an unchanged site passes and a PR that adds a `noindex` fails with a clear message and a fix hint
- A full run on a 100-page site finishes in under 10 minutes in GitHub Actions (measured and recorded)
- No secrets or tokens appear in logs, reports or docs
- A non-developer can read the HTML report and edit the config without help
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:check` all pass in CI

---

## 15. Definition of done (every change)

- [ ] Code compiles with strict TypeScript, no lint errors
- [ ] Tests added or updated and passing; coverage gate met
- [ ] Docs updated and match the code; `pnpm docs:check` passes
- [ ] No secrets, no company or client data, no unmeasured claims
- [ ] Learning checkpoint appended (end of a phase)
- [ ] Short summary written: what changed, why, what could break

---

## 16. Rollout and adoption notes (for the owner)

- Get approval from your manager before using this at work and before publishing any version. Work built for the company usually belongs to the company.
- For a public portfolio version: test only your own demo site, with no company URLs, client data or config.
- Start in `mode: report` for 2 weeks, then move to `regression` once the team trusts the output. Noisy checks kill adoption, so keep default severities conservative and make every rule easy to turn off with a reason.
- Track adoption honestly: number of users, runs per week, regressions caught (for example "caught 3 accidental noindex or canonical changes in the first month"), false-positive rate, and run time. Only record numbers that were really measured.
