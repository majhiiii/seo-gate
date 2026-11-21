# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

---

## Reporting a Vulnerability

If you discover a security vulnerability in `seo-gate`, please do not report it through public GitHub issues.

Instead, please email the maintainer directly or report it via private GitHub security advisory. Please provide:
- A description of the vulnerability.
- Steps to reproduce the issue or proof-of-concept configuration.
- The potential impact on CI/CD environments or credentials.

We will review reports promptly and publish patches in a timely manner.

---

## Security Invariants in seo-gate

1. **Zero Secret Leakage:** `seo-gate` automatically redacts basic-authentication credentials (`username:password`) and sensitive query parameters (`token`, `key`, `auth`, `secret`) from URLs before writing reports or sending webhooks.
2. **Environment Variable Injection:** Authentication tokens (such as `GITHUB_TOKEN` and webhook URLs) must be supplied via environment variables, never hardcoded in configuration files or committed to Git.
3. **Restricted Crawl Scope:** `seo-gate` strictly bounds crawls to configured target domains and paths with concurrency limits to prevent denial-of-service conditions on preview hosts.
