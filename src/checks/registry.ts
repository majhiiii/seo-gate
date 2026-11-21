import { checkHttpStatus } from './http-status.js';
import { checkTitle } from './title.js';
import { checkMetaDescription } from './meta-description.js';
import { checkH1 } from './h1.js';
import { checkCanonical } from './canonical.js';
import { checkNoindex } from './noindex.js';
import type { CheckDefinition } from './types.js';

export const CORE_CHECKS: CheckDefinition[] = [
  {
    id: 'http-status',
    name: 'HTTP Status & Redirects',
    description: 'Validates 200 OK responses and flags 4xx/5xx errors, redirect chains, and loops',
    run: checkHttpStatus,
  },
  {
    id: 'title',
    name: 'Page Title',
    description: 'Enforces presence, uniqueness, and length bounds for <title> tags',
    run: checkTitle,
  },
  {
    id: 'meta-description',
    name: 'Meta Description',
    description: 'Enforces presence, uniqueness, and length bounds for meta descriptions',
    run: checkMetaDescription,
  },
  {
    id: 'h1',
    name: 'H1 Primary Heading',
    description: 'Enforces exactly one non-empty <h1> heading per page',
    run: checkH1,
  },
  {
    id: 'canonical',
    name: 'Canonical URL',
    description: 'Validates presence, absolute URL syntax, and health of canonical tags',
    run: checkCanonical,
  },
  {
    id: 'noindex',
    name: 'Indexability & Noindex Directives',
    description: 'Catches accidental noindex directives via meta robots or X-Robots-Tag headers',
    run: checkNoindex,
  },
];
