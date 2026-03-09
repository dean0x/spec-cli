import { describe, it, expect } from 'vitest';
import { checkManifests } from './manifest-checker.js';

describe('checkManifests', () => {
  it('returns empty array when manifestFiles is empty', () => {
    const issues = checkManifests(new Map(), new Set());
    expect(issues).toEqual([]);
  });

  it('returns no issues for valid manifest with all owned components existing', () => {
    const manifest = `feature: billing
status: active
owns:
  schemas: [billing]
  domains: [billing]
uses:
  schemas: [users]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);
    const existingFiles = new Set([
      'docs/schemas/billing.md',
      'docs/domains/billing/index.md',
      'docs/schemas/users.md',
    ]);

    const issues = checkManifests(manifestFiles, existingFiles);
    expect(issues).toEqual([]);
  });

  it('reports INVALID_MANIFEST when feature field is missing', () => {
    const manifest = `status: active
owns:
  schemas: [billing]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('INVALID_MANIFEST');
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.file).toBe('.manifests/features/billing.yaml');
  });

  it('reports INVALID_MANIFEST when status field is missing', () => {
    const manifest = `feature: billing
owns:
  schemas: [billing]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('INVALID_MANIFEST');
    expect(issues[0]!.severity).toBe('error');
  });

  it('reports MANIFEST_NAME_MISMATCH when filename does not match feature value', () => {
    const manifest = `feature: bar
status: active`;

    const manifestFiles = new Map([
      ['.manifests/features/foo.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('MANIFEST_NAME_MISMATCH');
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.message).toContain('foo');
    expect(issues[0]!.message).toContain('bar');
  });

  it('reports no mismatch warning when filename matches feature name', () => {
    const manifest = `feature: billing
status: active`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    const mismatchIssues = issues.filter((i) => i.code === 'MANIFEST_NAME_MISMATCH');
    expect(mismatchIssues).toHaveLength(0);
  });

  it('reports INVALID_MANIFEST_STATUS for unrecognized status value', () => {
    const manifest = `feature: billing
status: draft`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    const statusIssues = issues.filter((i) => i.code === 'INVALID_MANIFEST_STATUS');
    expect(statusIssues).toHaveLength(1);
    expect(statusIssues[0]!.severity).toBe('warning');
    expect(statusIssues[0]!.message).toContain('draft');
  });

  it('reports no status warning for valid statuses: active, deprecated, planned', () => {
    const statuses = ['active', 'deprecated', 'planned'];

    for (const status of statuses) {
      const manifest = `feature: billing
status: ${status}`;

      const manifestFiles = new Map([
        ['.manifests/features/billing.yaml', manifest],
      ]);

      const issues = checkManifests(manifestFiles, new Set());
      const statusIssues = issues.filter((i) => i.code === 'INVALID_MANIFEST_STATUS');
      expect(statusIssues).toHaveLength(0);
    }
  });

  it('reports MISSING_OWNED_COMPONENT when owned schema does not exist', () => {
    const manifest = `feature: billing
status: active
owns:
  schemas: [billing]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);
    const existingFiles = new Set<string>();

    const issues = checkManifests(manifestFiles, existingFiles);
    const ownershipIssues = issues.filter((i) => i.code === 'MISSING_OWNED_COMPONENT');
    expect(ownershipIssues).toHaveLength(1);
    expect(ownershipIssues[0]!.severity).toBe('error');
  });

  it('reports multiple MISSING_OWNED_COMPONENT errors for multiple missing components', () => {
    const manifest = `feature: billing
status: active
owns:
  schemas: [billing, invoices]
  domains: [billing]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);
    const existingFiles = new Set<string>();

    const issues = checkManifests(manifestFiles, existingFiles);
    const ownershipIssues = issues.filter((i) => i.code === 'MISSING_OWNED_COMPONENT');
    expect(ownershipIssues.length).toBeGreaterThanOrEqual(3);
  });

  it('reports MISSING_USED_COMPONENT when used schema does not exist', () => {
    const manifest = `feature: billing
status: active
uses:
  schemas: [nonexistent]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);
    const existingFiles = new Set<string>();

    const issues = checkManifests(manifestFiles, existingFiles);
    const usesIssues = issues.filter((i) => i.code === 'MISSING_USED_COMPONENT');
    expect(usesIssues).toHaveLength(1);
    expect(usesIssues[0]!.severity).toBe('warning');
    expect(usesIssues[0]!.message).toContain('nonexistent');
  });

  it('reports no issue for used component that exists', () => {
    const manifest = `feature: billing
status: active
uses:
  schemas: [users]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);
    const existingFiles = new Set([
      'docs/schemas/users.md',
    ]);

    const issues = checkManifests(manifestFiles, existingFiles);
    const usesIssues = issues.filter((i) => i.code === 'MISSING_USED_COMPONENT');
    expect(usesIssues).toHaveLength(0);
  });

  it('reports DUPLICATE_FEATURE_NAME when two manifests share the same feature name', () => {
    const manifest1 = `feature: billing
status: active`;
    const manifest2 = `feature: billing
status: planned`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest1],
      ['.manifests/features/billing-v2.yaml', manifest2],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    const dupIssues = issues.filter((i) => i.code === 'DUPLICATE_FEATURE_NAME');
    expect(dupIssues).toHaveLength(2);
    expect(dupIssues[0]!.severity).toBe('error');
    expect(dupIssues[1]!.severity).toBe('error');
  });

  it('reports multiple issue types in a single run', () => {
    // manifest1: invalid (missing feature) + INVALID_MANIFEST
    // manifest2: name mismatch + invalid status + missing used component
    const manifest1 = `status: active`;
    const manifest2 = `feature: bar
status: draft
uses:
  schemas: [nonexistent]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest1],
      ['.manifests/features/foo.yaml', manifest2],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    const codes = new Set(issues.map((i) => i.code));
    expect(codes.has('INVALID_MANIFEST')).toBe(true);
    expect(codes.has('MANIFEST_NAME_MISMATCH')).toBe(true);
    expect(codes.has('INVALID_MANIFEST_STATUS')).toBe(true);
    expect(codes.has('MISSING_USED_COMPONENT')).toBe(true);
  });

  it('reports INVALID_MANIFEST for empty content', () => {
    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', ''],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('INVALID_MANIFEST');
  });

  it('reports INVALID_MANIFEST for whitespace-only content', () => {
    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', '   \n  \n   '],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('INVALID_MANIFEST');
  });

  it('returns no issues for manifest with empty owns and uses arrays', () => {
    const manifest = `feature: billing
status: active
owns:
uses:`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    expect(issues).toEqual([]);
  });

  it('returns no issues for minimal valid manifest (no owns/uses)', () => {
    const manifest = `feature: billing
status: active`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    expect(issues).toEqual([]);
  });

  it('extracts filename correctly from subdirectory paths', () => {
    const manifest = `feature: billing
status: active`;

    const manifestFiles = new Map([
      ['some/deep/path/billing.yaml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    // filename "billing" matches feature "billing" — no mismatch
    const mismatchIssues = issues.filter((i) => i.code === 'MANIFEST_NAME_MISMATCH');
    expect(mismatchIssues).toHaveLength(0);
  });

  it('handles .yml extension the same as .yaml', () => {
    const manifest = `feature: billing
status: active`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yml', manifest],
    ]);

    const issues = checkManifests(manifestFiles, new Set());
    // filename "billing" matches feature "billing" — no mismatch
    const mismatchIssues = issues.filter((i) => i.code === 'MANIFEST_NAME_MISMATCH');
    expect(mismatchIssues).toHaveLength(0);
  });

  it('reports MISSING_USED_COMPONENT for used domain that does not exist', () => {
    const manifest = `feature: billing
status: active
uses:
  domains: [nonexistent]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);
    const existingFiles = new Set<string>();

    const issues = checkManifests(manifestFiles, existingFiles);
    const usesIssues = issues.filter((i) => i.code === 'MISSING_USED_COMPONENT');
    expect(usesIssues).toHaveLength(1);
    expect(usesIssues[0]!.message).toContain('domains/nonexistent');
  });

  it('reports MISSING_USED_COMPONENT for used pattern that does not exist', () => {
    const manifest = `feature: billing
status: active
uses:
  patterns: [cqrs]`;

    const manifestFiles = new Map([
      ['.manifests/features/billing.yaml', manifest],
    ]);
    const existingFiles = new Set<string>();

    const issues = checkManifests(manifestFiles, existingFiles);
    const usesIssues = issues.filter((i) => i.code === 'MISSING_USED_COMPONENT');
    expect(usesIssues).toHaveLength(1);
    expect(usesIssues[0]!.message).toContain('patterns/cqrs');
  });
});
