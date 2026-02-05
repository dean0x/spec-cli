import { describe, it, expect } from 'vitest';
import {
  extractTitle,
  extractStatusFromBody,
  extractDateFromBody,
  inferDomain,
  generateFrontmatter,
  serializeFrontmatter,
  processFiles,
} from './add-frontmatter.js';
import type { FrontmatterFields } from './add-frontmatter.js';

describe('extractTitle', () => {
  it('extracts from first heading', () => {
    expect(extractTitle('# My Title\n\nBody text', 'docs/foo.md')).toBe('My Title');
  });

  it('extracts heading with special characters', () => {
    expect(extractTitle('# ADR-004: Modular Monolith', 'docs/adr.md')).toBe(
      'ADR-004: Modular Monolith',
    );
  });

  it('falls back to humanized filename when no heading', () => {
    expect(extractTitle('No heading here', 'docs/schemas/billing.md')).toBe('Billing');
  });

  it('uses parent directory for index files', () => {
    expect(extractTitle('No heading', 'docs/schemas/index.md')).toBe('Schemas');
  });

  it('handles dashed filenames', () => {
    expect(extractTitle('No heading', 'docs/local-development.md')).toBe(
      'Local Development',
    );
  });
});

describe('extractStatusFromBody', () => {
  it('extracts accepted status', () => {
    expect(extractStatusFromBody('**Status:** Accepted\n')).toBe('accepted');
  });

  it('extracts planned status', () => {
    expect(extractStatusFromBody('> **Status:** Planned\n')).toBe('planned');
  });

  it('returns draft when no status found', () => {
    expect(extractStatusFromBody('No status here')).toBe('draft');
  });

  it('is case insensitive', () => {
    expect(extractStatusFromBody('**status:** Active\n')).toBe('active');
  });
});

describe('extractDateFromBody', () => {
  it('extracts date from body', () => {
    expect(extractDateFromBody('**Date:** 2024-01-03\n')).toBe('2024-01-03');
  });

  it('returns today when no date found', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(extractDateFromBody('No date here')).toBe(today);
  });
});

describe('inferDomain', () => {
  it('infers from schema path', () => {
    expect(inferDomain('docs/schemas/billing.md')).toBe('billing');
  });

  it('infers from domain topic path', () => {
    expect(inferDomain('docs/domains/notifications/overview.md')).toBe('notifications');
  });

  it('returns null for unrelated path', () => {
    expect(inferDomain('docs/architecture/patterns/tenant-context.md')).toBeNull();
  });

  it('skips index files in schemas', () => {
    expect(inferDomain('docs/schemas/index.md')).toBeNull();
  });
});

describe('generateFrontmatter', () => {
  it('generates schema frontmatter with domain', () => {
    const fields = generateFrontmatter(
      '# Schema: Billing\n\nData structures.',
      'docs/schemas/billing.md',
      'schema',
    );
    expect(fields.title).toBe('Schema: Billing');
    expect(fields.domain).toBe('billing');
    expect(fields.status).toBeUndefined();
  });

  it('generates decision frontmatter with extracted status and date', () => {
    const content = '# ADR-004\n\n**Status:** Accepted\n**Date:** 2024-01-03\n';
    const fields = generateFrontmatter(
      content,
      'docs/architecture/decisions/004-test.md',
      'decision',
    );
    expect(fields.title).toBe('ADR-004');
    expect(fields.status).toBe('accepted');
    expect(fields.date).toBe('2024-01-03');
  });

  it('generates pattern frontmatter with default status', () => {
    const fields = generateFrontmatter(
      '# CQRS Pattern\n\nDescription.',
      'docs/architecture/patterns/cqrs.md',
      'pattern',
    );
    expect(fields.title).toBe('CQRS Pattern');
    expect(fields.status).toBe('draft');
  });

  it('generates feature frontmatter', () => {
    const content = '# Property Management\n\n> **Status:** Planned\n';
    const fields = generateFrontmatter(
      content,
      'docs/products/web-app/features/property-management.md',
      'feature',
    );
    expect(fields.title).toBe('Property Management');
    expect(fields.status).toBe('planned');
  });

  it('generates api frontmatter with version', () => {
    const fields = generateFrontmatter(
      '# REST API\n\nEndpoints.',
      'docs/api/rest.md',
      'api',
    );
    expect(fields.title).toBe('REST API');
    expect(fields.version).toBe('1.0');
  });
});

describe('serializeFrontmatter', () => {
  it('serializes basic fields', () => {
    const result = serializeFrontmatter({ title: 'Billing', domain: 'billing' });
    expect(result).toBe('---\ntitle: Billing\ndomain: billing\n---');
  });

  it('quotes values with special characters', () => {
    const result = serializeFrontmatter({ title: 'ADR-004: Modular Monolith' });
    expect(result).toBe('---\ntitle: "ADR-004: Modular Monolith"\n---');
  });

  it('skips undefined values', () => {
    const fields: FrontmatterFields = { title: 'Test', status: undefined };
    const result = serializeFrontmatter(fields);
    expect(result).toBe('---\ntitle: Test\n---');
  });

  it('handles empty string values', () => {
    const fields: FrontmatterFields = { title: 'Test', domain: '' };
    // Empty domain gets quoted
    const result = serializeFrontmatter(fields);
    expect(result).toContain('domain: ""');
  });
});

describe('processFiles', () => {
  it('skips files with existing frontmatter', () => {
    const files = new Map([
      ['docs/schemas/billing.md', '---\ntitle: Billing\n---\n# Billing'],
    ]);
    const results = processFiles(files, null);
    expect(results[0]!.skipped).toBe(true);
    expect(results[0]!.skipReason).toBe('already has frontmatter');
  });

  it('processes files missing frontmatter', () => {
    const files = new Map([
      ['docs/schemas/billing.md', '# Schema: Billing\n\nData.'],
    ]);
    const results = processFiles(files, null);
    expect(results[0]!.skipped).toBe(false);
    expect(results[0]!.fields.title).toBe('Schema: Billing');
    expect(results[0]!.fields.domain).toBe('billing');
  });

  it('respects filter option', () => {
    const files = new Map([
      ['docs/schemas/billing.md', '# Billing\n\nData.'],
      ['docs/architecture/decisions/001.md', '# ADR-001\n\nDecision.'],
    ]);
    const results = processFiles(files, 'schema');
    // Only schema file should be in results (decision filtered out)
    const nonSkipped = results.filter((r) => !r.skipped);
    expect(nonSkipped).toHaveLength(1);
    expect(nonSkipped[0]!.componentType).toBe('schema');
  });

  it('skips files with no matching component type', () => {
    const files = new Map([['README.md', '# Readme']]);
    const results = processFiles(files, null);
    expect(results[0]!.skipped).toBe(true);
    expect(results[0]!.skipReason).toBe('no matching component type');
  });
});
