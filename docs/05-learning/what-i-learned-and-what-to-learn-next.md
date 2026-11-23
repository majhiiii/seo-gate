# Learning: What I Learned and What to Learn Next

## 1. In one paragraph
This document reflects on the technical transition from a Salesforce developer (Apex, LWC, Governor Limits, Change Sets) to a backend and systems engineer building production-grade CI/CD developer tooling in Node.js, TypeScript, Playwright, and Lighthouse.

## 2. Why this exists
In engineering interviews, interviewers love to ask: *"What was the most surprising thing you learned while building this, and what would you study next if you had another month?"* Having a structured, thoughtful reflection demonstrates growth mindset and continuous curiosity.

---

## 3. What I Learned Building seo-gate

### 1. Pure Functional Separation of Concerns
Coming from Salesforce Apex triggers and enterprise services, keeping business logic side-effect-free is often discussed but hard to practice. In `seo-gate`, enforcing that **no check in `src/checks/` may perform I/O** fundamentally simplified testing. Every check is a pure function: give it a `PageAudit` object and a `CheckContext`, and it deterministically returns `Finding[]`. Unit tests run in under 20 milliseconds without network mocking.

### 2. Headless Browser Lifecycle & CI Resource Constraints
Running Playwright and Lighthouse in CI runners with 2 vCPUs and 4GB RAM revealed the importance of browser process hygiene:
- Aborting non-essential network assets (images, stylesheets, fonts, media) via `page.route()` reduced DOM hydration latency by up to 70%.
- Managing Chromium debugging ports dynamically via `net.createServer().listen(0)` eliminated port collisions.
- Virtualized CI CPU throttling variance is real: a single Lighthouse run fluctuates by $\pm 25\%$, making median-of-3 averaging and two-strike confirmation re-tests mandatory.

### 3. Ephemeral Environment Diffing
Staging environments deploy to ephemeral hostnames (e.g. `preview-123.vercel.app` vs `staging.example.com`). Comparing raw URLs between preview runs and production baselines initially produced false regressions for every page. Formulating **ADR-0002**—stripping hostnames and fingerprinting findings by `${checkId}::${pathname}`—solved cross-environment differential analysis cleanly.

### 4. Zero-Trust Credential Redaction (Rule 5)
Securing automated tools requires active defenses. Staging URLs with embedded basic-auth (`https://user:pass@host`) or authentication tokens (`?token=secret`) will leak into GitHub PR comments and Slack alerts unless proactively stripped. Building `redactSensitiveUrl` taught me how to sanitize URLs at the framework boundary using WHATWG URL APIs.

---

## 4. What to Learn Next

Building `seo-gate` established strong foundations in TypeScript, browser automation, and CI/CD engineering. The natural next steps on the path to senior backend and AI integration engineering are:

1. **Distributed Crawling with Work Queues:**
   - Transitioning from in-memory concurrency queues to distributed worker queues (e.g., BullMQ with Redis) to scale crawls across multiple worker nodes for million-page catalogs.
2. **AI-Powered Visual Regression & Semantic Inspection:**
   - Integrating multimodal LLMs (e.g., Gemini Vision API) to inspect rendered page screenshots: verifying that hero banners are not visually overlapping headings, assessing visual layout shifts beyond numeric CLS, and evaluating semantic content quality.
3. **OpenTelemetry & Distributed Tracing:**
   - Instrumenting the crawler and check pipeline with OpenTelemetry spans to trace crawl latency bottlenecks across complex redirect hops and server response times.
4. **Rust / WebAssembly Native Check Kernels:**
   - Experimenting with compiling HTML parsing and DOM validation rules to WebAssembly or native Rust binaries for ultra-high-throughput crawling engines.
