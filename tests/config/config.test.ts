import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, generateStarterConfigYaml, ConfigError } from '../../src/config/loader.js';
import { SeoGateConfigSchema } from '../../src/config/schema.js';

describe('Configuration Engine', () => {
  const tempConfigPath = path.resolve(process.cwd(), 'temp-test-config.yml');

  afterEach(() => {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  });

  it('validates a correct minimal config with defaults', () => {
    const raw = {
      target: 'https://preview.example.com',
      pages: {
        include: ['/'],
      },
    };
    const parsed = SeoGateConfigSchema.parse(raw);
    expect(parsed.target).toBe('https://preview.example.com');
    expect(parsed.mode).toBe('regression');
    expect(parsed.checks?.title?.min).toBe(20);
    expect(parsed.checks?.title?.max).toBe(65);
    expect(parsed.pages.crawl.concurrency).toBe(4);
  });

  it('rejects invalid target URL with clear error message', () => {
    const raw = {
      target: 'not-a-valid-url',
      pages: { include: ['/'] },
    };
    const result = SeoGateConfigSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Target must be a valid absolute URL');
    }
  });

  it('enforces that ignore entries require a reason with minimum length', () => {
    const raw = {
      target: 'https://preview.example.com',
      pages: { include: ['/'] },
      ignore: [
        { check: 'title-short', url: '/legal/*', reason: 'tiny' }, // < 5 chars
      ],
    };
    const result = SeoGateConfigSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 5 characters');
    }
  });

  it('validates ignore expiry date format', () => {
    const raw = {
      target: 'https://preview.example.com',
      pages: { include: ['/'] },
      ignore: [
        { check: 'title-short', url: '/legal/*', reason: 'Legal compliance', expires: 'invalid-date' },
      ],
    };
    const result = SeoGateConfigSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('YYYY-MM-DD');
    }
  });

  it('loads valid YAML file and applies overrides', () => {
    const yamlContent = `
target: https://preview-123.example.com
mode: strict
pages:
  include:
    - "/"
    - "/products/*"
  exclude:
    - "/cart"
checks:
  title:
    min: 25
    max: 60
`;
    fs.writeFileSync(tempConfigPath, yamlContent, 'utf8');
    const config = loadConfig(tempConfigPath);
    expect(config.target).toBe('https://preview-123.example.com');
    expect(config.mode).toBe('strict');
    expect(config.checks?.title?.min).toBe(25);
    expect(config.checks?.title?.max).toBe(60);
  });

  it('generates starter configuration containing valid YAML', () => {
    const starterYaml = generateStarterConfigYaml('https://my-preview.storefront.com');
    expect(starterYaml).toContain('target: https://my-preview.storefront.com');
    expect(starterYaml).toContain('mode: regression');
  });
});
