# ADR-0001: Baseline File Format and Storage Strategy

## 1. In one paragraph
We decided to store baseline audit snapshots as committed JSON files in the Git repository (`baseline.json`) rather than hosting an external database or cloud storage service.

## 2. Why this exists
`seo-gate` needs a persistent reference snapshot of historical findings from the `main` branch to evaluate regressions in pull requests. We had to decide whether to require an external database (PostgreSQL/Redis), cloud storage (S3/GCS), or local version-controlled files in the Git repository.

## 3. How it works
1. When a release workflow merges into `main`, it runs `seo-gate baseline update` and commits `baseline.json` into the repository.
2. In PR workflows, `seo-gate` reads the committed `baseline.json` directly from the checked-out workspace without making network calls or requiring external credentials.

### Options Considered
- **Option A: External Database (PostgreSQL / DynamoDB)**
  - *Pros:* Centralized querying, historical time-series analytics.
  - *Cons:* Heavy operational overhead, requires database credentials in CI secrets, adds infrastructure costs, unusable for simple open-source setups.
- **Option B: CI Artifacts (GitHub Actions Cache / Artifacts)**
  - *Pros:* No database required.
  - *Cons:* Cache expiration policies can evict baselines; difficult to inspect or audit historical baselines across branches.
- **Option C (Selected): Git-Committed JSON File (`baseline.json`)**
  - *Pros:* Zero external dependencies, version-controlled alongside application code, easily reviewed in PR diffs, zero credentials needed.
  - *Cons:* Large sites with thousands of findings increase Git repo file size slightly.

## 4. Example
A sample committed `baseline.json`:
```json
{
  "schemaVersion": 1,
  "createdAt": "2026-11-21T10:00:00.000Z",
  "target": "https://www.example.com",
  "totalPages": 25,
  "findings": [
    {
      "checkId": "meta-description-short",
      "url": "https://www.example.com/about",
      "severity": "warn",
      "message": "Meta description is shorter than 70 characters"
    }
  ]
}
```

## 5. Salesforce analogy
In Salesforce development, storing `baseline.json` in Git is like committing **Custom Metadata records or Static Resources (`.resource-meta.xml`)** into your source control repository rather than querying a third-party Heroku database. Everything needed to validate deployments is self-contained in the repo.

## 6. Common mistakes and What to remember
- **Mistake:** Forgetting to commit `baseline.json` when adding new intentional site sections.
- **Remember:** Git-committed baselines make audit trails transparent: every baseline modification is tracked in `git log` with the author and PR commit message.
