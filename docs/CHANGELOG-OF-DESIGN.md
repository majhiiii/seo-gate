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
