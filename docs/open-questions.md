# Open Questions & Assumptions Log

This document tracks unresolved design questions, recorded assumptions, and future investigation topics for `seo-gate`. In accordance with our core engineering principles, we never guess or invent facts—if something is unknown or pending operational measurement, it is documented here.

---

## Active Questions & Decisions

| ID | Topic | Question / Assumption | Status | Impact / Notes |
|---|---|---|---|---|
| **OQ-001** | Sitemap XML Namespaces | Assumed sitemap parsers must handle both standard `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` and prefixed tags without throwing XML parsing errors. | **Accepted for Phase 1** | Cheerio / regex tag extraction handles standard and namespaced tags gracefully. |
| **OQ-002** | Default Crawl Concurrency | Default concurrency set to 4 concurrent HTTP requests with a 100ms polite delay between requests. | **Measuring in Phase 1** | Prevents overwhelming preview or staging servers (especially lower-tier environments). |
| **OQ-003** | Robots.txt Parsing | In Phase 1, `seo-gate` crawls the explicit page list and sitemap URLs. Full `robots.txt` diffing and AST parsing will be formally introduced in Phase 4. | **Scheduled Phase 4** | Preview targets often require an override option to ignore `robots.txt` during staging builds. |
| **OQ-004** | Title & Description Lengths | Default title length bounds are 20 to 65 characters; meta description bounds are 70 to 160 characters. | **Configurable** | Default bounds match Google search SERP snippet display guidelines. Config overrides supported in `seo-gate.config.yml`. |
| **OQ-005** | Schema Versioning | Data format versioning set to `schemaVersion: 1`. If breaking changes occur to the JSON report or baseline schema, version will increment to 2 with migration notes. | **Accepted** | Documented in `docs/02-system-design/data-model.md`. |
