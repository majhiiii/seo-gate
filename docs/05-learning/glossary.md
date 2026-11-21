# SEO Gate Glossary

A plain-language dictionary of terms used throughout `seo-gate`, designed for developers and technical interview preparation.

---

### Baseline
A saved, versioned JSON snapshot of findings and metrics from a known-good state (usually the `main` branch or production).
*Example:* `baseline.json` records 3 known pre-existing warnings so future runs only fail if new errors are introduced.

### Canonical URL
The designated authoritative master URL for a page, declared via `<link rel="canonical" href="...">`.
*Example:* `<link rel="canonical" href="https://example.com/shoes">` tells search engines that `https://example.com/shoes?sort=price` should be credited to `/shoes`.

### Check
A pure, deterministic function that inspects a page's status code, headers, or HTML and returns zero or more findings.
*Example:* The `title` check validates that a `<title>` tag exists and is between 20 and 65 characters.

### Concurrency Limit
The maximum number of asynchronous HTTP requests executed simultaneously by the crawler to avoid overwhelming the server.
*Example:* A concurrency limit of 4 processes at most 4 URLs at any given instant.

### Exit Code
The numeric status returned by a CLI process when it completes, communicating status to CI/CD pipelines (0 = pass, 1 = gate failed, 2 = execution error).
*Example:* A CI workflow halts deployment when `seo-gate` exits with code `1`.

### Finding
A structured object representing an identified SEO violation or recommendation on a specific URL.
*Example:* `{ checkId: "noindex", severity: "error", message: "Accidental noindex tag detected" }`.

### Gate Mode
The operational policy governing whether findings trigger a build failure:
- **`strict`:** Any error severity finding fails the build (exit code 1).
- **`regression`:** Fails the build only if new errors exist that were not present in the baseline.
- **`report`:** Never fails the build (exit code 0); only generates reports and logs.

### H1 Heading
The highest-level HTML heading element (`<h1>`) communicating the primary topic of the page to users and search engines.
*Example:* `<h1>Men's Trail Running Shoes</h1>`.

### Idempotent
An operation that produces the exact same outcome whether executed once or multiple times with the same input.
*Example:* Running `seo-gate` twice against the same static preview environment produces the exact same findings.

### Meta Description
An HTML tag in the `<head>` providing a concise preview snippet for search engine result pages.
*Example:* `<meta name="description" content="Shop durable trail shoes with all-weather traction.">`.

### Noindex
A directive instruction delivered via `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex` ordering search engines not to display the page in search results.
*Example:* Leaving `noindex` on a production product page deletes it from Google search results.

### Polite Delay
A controlled pause between outbound HTTP requests to prevent triggering rate limits or causing denial-of-service conditions.
*Example:* Waiting 100ms between page fetches.

### Regression
A finding or performance metric that is newly introduced or worse than the recorded baseline.
*Example:* A PR that deletes `<title>` from the checkout confirmation page introduces a regression.

### Title Tag
The HTML `<title>` element in `<head>` defining the document title displayed on browser tabs and search engine result headlines.
*Example:* `<title>Outdoor Hiking Gear & Camping Equipment | Acme</title>`.

### X-Robots-Tag
An HTTP response header used to deliver crawler instructions independently of HTML document content.
*Example:* `X-Robots-Tag: noindex, nofollow`.
