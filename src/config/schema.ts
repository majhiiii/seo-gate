import { z } from 'zod';

export const SeveritySchema = z.enum(['error', 'warn', 'info']);

export const GateModeSchema = z.enum(['strict', 'regression', 'report']);

export const IgnoreRuleSchema = z.object({
  check: z.string().min(1, 'Check identifier is required in ignore entry'),
  url: z.string().min(1, 'URL or pattern is required in ignore entry'),
  reason: z.string().min(5, 'A clear documented reason (at least 5 characters) is required for every ignore entry'),
  expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiration date must be in YYYY-MM-DD format').optional(),
});

const CrawlOptionsSchema = z.object({
  maxPages: z.number().int().positive().default(100),
  maxDepth: z.number().int().nonnegative().default(3),
  concurrency: z.number().int().min(1).max(20).default(4),
  delayMs: z.number().int().nonnegative().default(100),
});

const TitleCheckSchema = z.object({
  min: z.number().int().positive().default(20),
  max: z.number().int().positive().default(65),
  unique: z.boolean().default(true),
});

const MetaDescriptionCheckSchema = z.object({
  min: z.number().int().positive().default(70),
  max: z.number().int().positive().default(160),
  unique: z.boolean().default(true),
});

const H1CheckSchema = z.object({
  requireExactOne: z.boolean().default(true),
});

const CanonicalCheckSchema = z.object({
  requireSelfReferencing: z.boolean().default(true),
});

const NoindexCheckSchema = z.object({
  allowOnStaging: z.boolean().default(false),
});

const ChecksSchema = z.object({
  title: TitleCheckSchema.default({
    min: 20,
    max: 65,
    unique: true,
  }),
  metaDescription: MetaDescriptionCheckSchema.default({
    min: 70,
    max: 160,
    unique: true,
  }),
  h1: H1CheckSchema.default({
    requireExactOne: true,
  }),
  canonical: CanonicalCheckSchema.default({
    requireSelfReferencing: true,
  }),
  noindex: NoindexCheckSchema.default({
    allowOnStaging: false,
  }),
});

export const SeoGateConfigSchema = z.object({
  target: z.string().url('Target must be a valid absolute URL (e.g. https://preview.example.com)'),
  production: z.string().url('Production target must be a valid absolute URL').optional(),
  mode: GateModeSchema.default('regression'),
  pages: z.object({
    include: z.array(z.string()).min(1, 'At least one page path must be included in pages.include'),
    exclude: z.array(z.string()).default([]),
    sitemap: z.union([z.boolean(), z.string()]).default(true),
    crawl: CrawlOptionsSchema.default({
      maxPages: 100,
      maxDepth: 3,
      concurrency: 4,
      delayMs: 100,
    }),
    critical: z.array(z.string()).default([]),
  }),
  checks: ChecksSchema.default({
    title: { min: 20, max: 65, unique: true },
    metaDescription: { min: 70, max: 160, unique: true },
    h1: { requireExactOne: true },
    canonical: { requireSelfReferencing: true },
    noindex: { allowOnStaging: false },
  }),
  severity_overrides: z.record(z.string(), SeveritySchema).default({}),
  ignore: z.array(IgnoreRuleSchema).default([]),
});

export type ValidatedConfig = z.infer<typeof SeoGateConfigSchema>;
