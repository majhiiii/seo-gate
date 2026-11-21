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
