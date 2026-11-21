import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { SeoGateConfigSchema, type ValidatedConfig } from './schema.js';
import type { SeoGateConfig } from '../types.js';

export class ConfigError extends Error {
  constructor(message: string, public readonly details?: string[]) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(configPath: string): SeoGateConfig {
  const resolvedPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigError(`Configuration file not found at: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  let parsedRaw: unknown;

  try {
    parsedRaw = YAML.parse(rawContent);
  } catch (err) {
    throw new ConfigError(`Failed to parse configuration file (invalid YAML/JSON): ${(err as Error).message}`);
  }

  const result = SeoGateConfigSchema.safeParse(parsedRaw);

  if (!result.success) {
    const errorDetails = result.error.issues.map((issue) => {
      const fieldPath = issue.path.join('.') || 'root';
      return `Field "${fieldPath}": ${issue.message}`;
    });

    const summaryMessage = `Configuration validation failed with ${errorDetails.length} error(s):\n  - ${errorDetails.join('\n  - ')}`;
    throw new ConfigError(summaryMessage, errorDetails);
  }

  return result.data as SeoGateConfig;
}

export function generateStarterConfigYaml(targetUrl: string = 'http://localhost:3000'): string {
  return `# seo-gate Configuration File
# Documentation: docs/02-system-design/config-design.md

# Target preview or staging website to inspect
target: ${targetUrl}

# Optional production site for regression diffing
# production: https://www.example.com

# Mode: strict (fail on any error) | regression (fail only on new errors) | report (never fail)
mode: regression

pages:
  # Base paths to crawl
  include:
    - "/"
    - "/products/*"
    - "/category/*"
  exclude:
    - "/cart"
    - "/checkout/*"
    - "/account/*"
  # Fetch and parse XML sitemap
  sitemap: true
  crawl:
    maxPages: 100
    maxDepth: 3
    concurrency: 4
    delayMs: 100
  critical:
    - "/"

checks:
  title:
    min: 20
    max: 65
    unique: true
  metaDescription:
    min: 70
    max: 160
    unique: true
  h1:
    requireExactOne: true
  canonical:
    requireSelfReferencing: true
  noindex:
    allowOnStaging: false

severity_overrides:
  # Example: downgrade image alt warnings
  # images-missing-alt: warn

ignore:
  # Every ignore rule requires a documented reason
  # - check: "title-length"
  #   url: "/legal/*"
  #   reason: "Legal disclaimer pages require fixed-length statutory titles"
  #   expires: "2027-12-31"
`;
}
