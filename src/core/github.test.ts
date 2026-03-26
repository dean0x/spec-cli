import { describe, it, expect } from 'vitest';
import { buildIssueTitle, buildIssueBody, getLabelsForManifest } from './github.js';
import type { FeatureManifest } from './types.js';

function makeManifest(overrides: Partial<FeatureManifest> = {}): FeatureManifest {
  return {
    feature: 'test-feature',
    status: 'active',
    owns: {},
    uses: {},
    ...overrides,
  };
}

describe('buildIssueTitle', () => {
  it('uses description when available', () => {
    const manifest = makeManifest({ feature: 'billing', description: 'Payment processing' });
    expect(buildIssueTitle(manifest)).toBe('[spec] billing: Payment processing');
  });

  it('falls back to feature name when no description', () => {
    const manifest = makeManifest({ feature: 'billing' });
    expect(buildIssueTitle(manifest)).toBe('[spec] billing: billing');
  });
});

describe('buildIssueBody', () => {
  it('includes status and manifest path', () => {
    const manifest = makeManifest({ feature: 'billing', status: 'planned' });
    const body = buildIssueBody(manifest, '.manifests/features/billing.yaml');

    expect(body).toContain('## Specification: billing');
    expect(body).toContain('**Status:** planned');
    expect(body).toContain('**Manifest:** `.manifests/features/billing.yaml`');
  });

  it('includes description when present', () => {
    const manifest = makeManifest({ description: 'Handles payments' });
    const body = buildIssueBody(manifest, '.manifests/features/test.yaml');

    expect(body).toContain('### Description');
    expect(body).toContain('Handles payments');
  });

  it('includes owned components table', () => {
    const manifest = makeManifest({
      owns: { schemas: ['billing', 'invoices'], features: ['billing'] },
    });
    const body = buildIssueBody(manifest, '.manifests/features/test.yaml');

    expect(body).toContain('### Owned Components');
    expect(body).toContain('| schemas | billing |');
    expect(body).toContain('| schemas | invoices |');
    expect(body).toContain('| features | billing |');
  });

  it('includes dependencies table', () => {
    const manifest = makeManifest({
      uses: { schemas: ['users'], domains: ['auth'] },
    });
    const body = buildIssueBody(manifest, '.manifests/features/test.yaml');

    expect(body).toContain('### Dependencies');
    expect(body).toContain('| schemas | users |');
    expect(body).toContain('| domains | auth |');
  });

  it('includes referencedBy section', () => {
    const manifest = makeManifest({
      referencedBy: ['dashboard', 'reporting'],
    });
    const body = buildIssueBody(manifest, '.manifests/features/test.yaml');

    expect(body).toContain('### Referenced By');
    expect(body).toContain('- dashboard');
    expect(body).toContain('- reporting');
  });

  it('includes spec:managed comment marker', () => {
    const manifest = makeManifest();
    const body = buildIssueBody(manifest, '.manifests/features/test.yaml');

    expect(body).toContain('<!-- spec:managed -->');
  });

  it('omits sections when empty', () => {
    const manifest = makeManifest({ owns: {}, uses: {} });
    const body = buildIssueBody(manifest, '.manifests/features/test.yaml');

    expect(body).not.toContain('### Owned Components');
    expect(body).not.toContain('### Dependencies');
    expect(body).not.toContain('### Referenced By');
  });
});

describe('getLabelsForManifest', () => {
  it('returns spec and spec:{status} labels', () => {
    const manifest = makeManifest({ status: 'planned' });
    expect(getLabelsForManifest(manifest)).toEqual(['spec', 'spec:planned']);
  });

  it('uses custom label prefix', () => {
    const manifest = makeManifest({ status: 'active' });
    expect(getLabelsForManifest(manifest, 'docs')).toEqual(['docs', 'docs:active']);
  });
});

describe('manifest github round-trip', () => {
  it('parseManifest preserves github section', async () => {
    const { parseManifest } = await import('./manifest.js');
    const content = [
      'feature: billing',
      'status: active',
      'owns:',
      '  schemas: [billing]',
      'github:',
      '  issue: 42',
      '  labels: [spec, spec:active]',
    ].join('\n');

    const result = parseManifest(content);
    expect(result).not.toBeNull();
    expect(result!.github?.issue).toBe(42);
    expect(result!.github?.labels).toEqual(['spec', 'spec:active']);
  });

  it('serializeManifest includes github section', async () => {
    const { serializeManifest } = await import('./manifest.js');
    const manifest = makeManifest({
      feature: 'billing',
      status: 'active',
      owns: { schemas: ['billing'] },
      github: { issue: 42, labels: ['spec', 'spec:active'] },
    });

    const output = serializeManifest(manifest);
    expect(output).toContain('github:');
    expect(output).toContain('issue: 42');
    expect(output).toContain('labels: [spec, spec:active]');
  });

  it('serializeManifest omits github when absent', async () => {
    const { serializeManifest } = await import('./manifest.js');
    const manifest = makeManifest({ feature: 'billing', status: 'active', owns: {} });

    const output = serializeManifest(manifest);
    expect(output).not.toContain('github:');
  });

  it('parseManifest -> serializeManifest round-trips github', async () => {
    const { parseManifest, serializeManifest } = await import('./manifest.js');
    const content = [
      'feature: billing',
      'status: active',
      'github:',
      '  issue: 42',
      '  labels: [spec, spec:active]',
    ].join('\n');

    const parsed = parseManifest(content);
    expect(parsed).not.toBeNull();
    const serialized = serializeManifest(parsed!);
    const reparsed = parseManifest(serialized);
    expect(reparsed!.github?.issue).toBe(42);
    expect(reparsed!.github?.labels).toEqual(['spec', 'spec:active']);
  });
});
