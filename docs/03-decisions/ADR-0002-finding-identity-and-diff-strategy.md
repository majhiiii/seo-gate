# ADR-0002: Finding Identity and Cross-Environment Diff Strategy

## 1. In one paragraph
We decided to identify findings during regression diffing using a composite key of the check identifier and the normalized URL pathname (`${checkId}::${pathname}`), stripping protocol, host, and port so that findings can be compared accurately across ephemeral preview environments and production baselines.

## 2. Why this exists
Ephemeral CI preview environments use dynamic domain names (e.g. `https://preview-pr-42-xyz.vercel.app`), while the baseline was recorded against a production or staging host (e.g. `https://www.example.com`). If finding comparisons use full absolute URLs, every single finding on preview would be marked as a "new regression" because the hostnames do not match. We needed a robust identity strategy to correlate findings across different environments without false positives.

## 3. How it works
1. When comparing a finding from the current run against the baseline, `seo-gate` computes a normalized identity fingerprint:
   $$\text{Key} = \text{checkId} + \text{"::"} + \text{URL Pathname}$$
2. The URL pathname strips trailing slashes (except root) and query parameters unless configured.
3. If a finding with that key exists in the baseline with equal or worse severity, it is marked as `unchanged`.
4. If a finding with that key does not exist in the baseline, it is marked as `new` (a regression).
5. If a baseline key is absent from the current run, it is marked as `resolved`.

### Options Considered
- **Option A: Full URL Matching (`checkId + fullUrl`)**
  - *Cons:* Complete failure in CI preview environments with dynamic hosts.
- **Option B: Hash of Complete Finding Payload (including evidence snippet)**
  - *Cons:* Extremely fragile. Minor whitespace changes or timestamp shifts in evidence would mark existing issues as brand new regressions.
- **Option C (Selected): Normalized Path + Check ID Fingerprint (`checkId + pathname`)**
  - *Pros:* Environment-agnostic, resilient to dynamic preview hostnames, deterministic.
  - *Cons:* If a page has two distinct violations of the exact same check ID on the same page, they map to the same key unless differentiated by evidence sub-keys.

## 4. Example
```typescript
const previewFindingUrl = "https://preview-104.store.app/products/hiking-boots";
const baselineFindingUrl = "https://www.store.com/products/hiking-boots";

// Both normalize to: "noindex-meta::/products/hiking-boots"
const key1 = computeFindingKey(previewFindingUrl, "noindex-meta");
const key2 = computeFindingKey(baselineFindingUrl, "noindex-meta");

console.log(key1 === key2); // true: correctly recognized as the same issue
```

## 5. Salesforce analogy
In Salesforce integrations:
- This is like matching incoming records using an **External ID (e.g., `Product_SKU__c`)** rather than matching on the auto-generated Salesforce record `Id`.
- Even if a sandbox creates an Account with `Id = 001xxxxxxxxxxxxAAA` and production has `001xxxxxxxxxxxxBBB`, they represent the same entity if their `AccountNumber` or external identifier matches.

## 6. Common mistakes and What to remember
- **Mistake:** Stripping search parameters on pages that rely on query strings for unique content (e.g., `/products?id=123`). In those cases, query parameters must be retained in the path identity.
- **Remember:** The identity key bridges the gap between preview environments and production baselines.
