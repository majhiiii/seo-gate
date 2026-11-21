# Contributing to seo-gate

We welcome contributions to `seo-gate`! This project provides an automated SEO regression gate for CI/CD pipelines.

---

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/majhiiii/seo-gate.git
   cd seo-gate
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run verification commands:
   ```bash
   # Typecheck
   pnpm typecheck

   # Run test suite with coverage
   pnpm test:coverage

   # Verify documentation links
   pnpm docs:check
   ```

---

## Architectural Principles

- **Pure Checks (`src/checks/`):** All checks must be pure functions that inspect the provided `PageAudit` object. Checks must never make outbound HTTP calls or read files from disk.
- **Unidirectional Flow:** Dependencies flow strictly downward from `cli` to underlying modules (`config`, `crawl`, `checks`, `baseline`, `report`, `github`). No circular dependencies are allowed.
- **Deterministic Testing:** Findings must be sorted alphabetically by URL and `checkId` to ensure reproducible test and CI outputs.
- **Documentation as Deliverable:** Every new check or architecture change must update relevant documentation in `docs/` and pass `pnpm docs:check`.

---

## Pull Request Checklist

Before submitting a pull request, ensure:
- [ ] TypeScript compiles cleanly without errors (`pnpm typecheck`)
- [ ] All unit and integration tests pass (`pnpm test`)
- [ ] Code coverage on `src/checks/` meets or exceeds 85%
- [ ] Documentation validator passes (`pnpm docs:check`)
- [ ] Commit messages follow conventional commit style (`feat:`, `fix:`, `docs:`, `chore:`)
