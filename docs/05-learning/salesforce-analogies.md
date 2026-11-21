# Salesforce Analogies Guide

This guide bridges web engineering, SEO quality gates, and CI/CD concepts with concepts familiar to Salesforce developers (Apex, LWC, Admin, and DevOps).

---

## Concept Mapping Table

| Web / SEO / CI Concept | Salesforce Equivalent | Why the Analogy Fits |
|---|---|---|
| **Check (`src/checks/`)** | **Apex Validation Rule or Apex Test Assertion** | Both are pure logic rules that inspect record/page fields and return an error message if criteria are violated. |
| **PageAudit (`PageAudit`)** | **In-memory SObject instance** | A structured data object containing fields (status code, headers, title, canonical) before evaluation. |
| **Baseline (`baseline.json`)** | **Sandbox / Scratch Org Snapshot** | A reference state of known records and tests used to verify that new code changes don't cause regressions. |
| **Regression Gate Mode** | **Deploying with `RunSpecifiedTests`** | In Salesforce, you often only fail deployments on test failures in classes touched by the change, rather than all historical org debt. |
| **Strict Gate Mode** | **`RunLocalTests` on Production Deployment** | Every single failure or validation error halts the deployment immediately. |
| **Report Mode** | **Check-Only / Dry-Run Deployment (`--dry-run`)** | Executes all tests and produces an execution log without failing or blocking release artifacts. |
| **Finding (`Finding`)** | **`record.addError('...')` or `Database.Error`** | Contains the exact field/tag, human message, severity level, and fix hint. |
| **Ignore List (`ignore: []`)** | **Custom Permission / Bypass Custom Setting** | Allows documented exceptions for specific URLs or rules (e.g., exempting integration users from validation rules). |
| **Exit Code (`0`, `1`, `2`)** | **CI/CD Deployment Status (`Success`, `Failure`, `Configuration Error`)** | Tells GitHub Actions whether the pull request passes quality gates. |
| **Crawler (`src/crawl/`)** | **Batch Apex Job (`Database.Batchable`)** | Iterates through a large collection of items (URLs), chunking work into controlled batches. |
| **Concurrency Limit** | **Governor Limits on Concurrent Async Apex** | Limits simultaneous operations to 4 parallel jobs to protect system resources. |
| **Polite Delay** | **Callout pacing / Governor limit management** | Deliberately pacing HTTP callouts to prevent remote endpoint rate limits (HTTP 429). |
| **`seo-gate.config.yml`** | **Custom Metadata Type (`SeoGate_Config__mdt`)** | Declarative configuration controlling system behavior without modifying core code. |
| **Cheerio HTML Parsing** | **Apex JSON / XML Dom Parsing** | Fast in-memory parsing of raw string payloads without rendering a full user interface. |
| **Playwright Rendering** | **LWC Component Lifecycle rendering** | Spinning up the full client-side JavaScript runtime to observe reactive component DOM rendering. |
| **Canonical URL** | **Master Record in Duplicate Rules / Merge** | When multiple URLs point to identical content, the canonical points to the winning master record. |
| **Accidental `noindex`** | **Accidentally revoking Public Guest User Access** | Hiding the entire Experience Cloud storefront from external visitors. |

---

## Interview Walkthrough Tip
When asked in an interview: *"How did you design the regression gate in your project?"*
> **Answer:** *"I designed it just like a Salesforce deployment gate. If you deploy a new feature to an existing org with 50 legacy warnings, failing on legacy debt stops productivity. Instead, we snapshot a baseline from the main branch. If a pull request introduces a new error that didn't exist in the baseline snapshot—like an accidental noindex or missing canonical—the gate fails the build with exit code 1. Existing known warnings are reported without blocking the release."*
