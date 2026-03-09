import { describe, it, expect } from 'vitest';
import {
  parseManifest,
  serializeManifest,
  validateManifestOwnership,
  getOwnedFilePaths,
  isFileOwnedByManifest,
  findReferencingFeatures,
  computeReferencedBy,
  updateManifestReferencedBy,
  isReferencedByStale,
} from './manifest.js';
import type { FeatureManifest } from './types.js';
import type { DependencyGraph } from './graph.js';

// ---------- Helpers ----------

function makeManifest(overrides: Partial<FeatureManifest> = {}): FeatureManifest {
  return {
    feature: 'test-feature',
    status: 'active',
    owns: {},
    uses: {},
    ...overrides,
  };
}

function makeGraph(
  nodes: Record<string, { linksTo: string[] }> = {}
): DependencyGraph {
  const nodeMap = new Map<string, {
    path: string;
    componentType: string | null;
    layer: null;
    linksTo: Set<string>;
    linkedFrom: Set<string>;
  }>();

  // First pass: create all nodes
  for (const [path, config] of Object.entries(nodes)) {
    nodeMap.set(path, {
      path,
      componentType: null,
      layer: null,
      linksTo: new Set(config.linksTo),
      linkedFrom: new Set(),
    });
  }

  // Second pass: populate linkedFrom
  for (const [path, config] of Object.entries(nodes)) {
    for (const target of config.linksTo) {
      const targetNode = nodeMap.get(target);
      if (targetNode) {
        targetNode.linkedFrom.add(path);
      }
    }
  }

  return { nodes: nodeMap, edges: [] };
}

// ---------- parseManifest ----------

describe('parseManifest', () => {
  it('parses minimal valid manifest (feature + status only)', () => {
    const content = `feature: billing\nstatus: active`;
    const result = parseManifest(content);

    expect(result).not.toBeNull();
    expect(result!.feature).toBe('billing');
    expect(result!.status).toBe('active');
    expect(result!.owns).toEqual({});
    expect(result!.uses).toEqual({});
  });

  it('parses full manifest with owns, uses, and description', () => {
    const content = [
      'feature: billing',
      'status: active',
      'description: Handles payments',
      'owns:',
      '  schemas: [billing, invoices]',
      '  domains: [billing]',
      'uses:',
      '  schemas: [users]',
    ].join('\n');

    const result = parseManifest(content);
    expect(result).not.toBeNull();
    expect(result!.feature).toBe('billing');
    expect(result!.description).toBe('Handles payments');
    expect(result!.owns.schemas).toEqual(['billing', 'invoices']);
    expect(result!.owns.domains).toEqual(['billing']);
    expect(result!.uses.schemas).toEqual(['users']);
  });

  it('returns null when feature is missing', () => {
    const content = `status: active`;
    expect(parseManifest(content)).toBeNull();
  });

  it('returns null when status is missing', () => {
    const content = `feature: billing`;
    expect(parseManifest(content)).toBeNull();
  });

  it('parses inline array format schemas: [a, b]', () => {
    const content = [
      'feature: test',
      'status: planned',
      'owns:',
      '  schemas: [billing, users]',
    ].join('\n');

    const result = parseManifest(content);
    expect(result).not.toBeNull();
    expect(result!.owns.schemas).toEqual(['billing', 'users']);
  });

  it('parses multi-line array with - item format', () => {
    const content = [
      'feature: test',
      'status: active',
      'owns:',
      '  schemas:',
      '    - billing',
      '    - users',
      '    - invoices',
    ].join('\n');

    const result = parseManifest(content);
    expect(result).not.toBeNull();
    expect(result!.owns.schemas).toEqual(['billing', 'users', 'invoices']);
  });

  it('skips comment lines', () => {
    const content = [
      '# This is a comment',
      'feature: test',
      '# Another comment',
      'status: active',
    ].join('\n');

    const result = parseManifest(content);
    expect(result).not.toBeNull();
    expect(result!.feature).toBe('test');
  });

  it('parses description correctly', () => {
    const content = [
      'feature: notifications',
      'status: deprecated',
      'description: Email and webhook notification system',
    ].join('\n');

    const result = parseManifest(content);
    expect(result).not.toBeNull();
    expect(result!.description).toBe('Email and webhook notification system');
  });

  it('parses referencedBy section (Bug 1 fix)', () => {
    const content = [
      'feature: billing',
      'status: active',
      'owns:',
      '  schemas: [billing]',
      'referencedBy:',
      '  - notifications',
      '  - dashboard',
      '  - reporting',
    ].join('\n');

    const result = parseManifest(content);
    expect(result).not.toBeNull();
    expect(result!.referencedBy).toEqual(['notifications', 'dashboard', 'reporting']);
  });

  it('returns null for empty/whitespace content', () => {
    expect(parseManifest('')).toBeNull();
    expect(parseManifest('   \n  \n  ')).toBeNull();
  });
});

// ---------- serializeManifest ----------

describe('serializeManifest', () => {
  it('serializes minimal manifest (feature + status)', () => {
    const manifest = makeManifest({ feature: 'auth', status: 'planned' });
    const output = serializeManifest(manifest);

    expect(output).toContain('feature: auth');
    expect(output).toContain('status: planned');
    // Should not include owns/uses sections when empty
    expect(output).not.toContain('owns:');
    expect(output).not.toContain('uses:');
  });

  it('serializes full manifest with owns, uses, and referencedBy', () => {
    const manifest = makeManifest({
      feature: 'billing',
      status: 'active',
      description: 'Payment processing',
      owns: { schemas: ['billing', 'invoices'], domains: ['billing'] },
      uses: { schemas: ['users'] },
      referencedBy: ['dashboard', 'reporting'],
    });

    const output = serializeManifest(manifest);
    expect(output).toContain('feature: billing');
    expect(output).toContain('description: Payment processing');
    expect(output).toContain('owns:');
    expect(output).toContain('schemas: [billing, invoices]');
    expect(output).toContain('uses:');
    expect(output).toContain('referencedBy:');
    expect(output).toContain('- dashboard');
    expect(output).toContain('- reporting');
  });

  it('omits empty sections', () => {
    const manifest = makeManifest({
      owns: { schemas: [] },
      uses: {},
    });

    const output = serializeManifest(manifest);
    expect(output).not.toContain('owns:');
    expect(output).not.toContain('uses:');
    expect(output).not.toContain('referencedBy:');
  });

  it('round-trips: parseManifest(serializeManifest(m)) preserves all fields', () => {
    const original = makeManifest({
      feature: 'notifications',
      status: 'deprecated',
      description: 'Notification system',
      owns: { schemas: ['notifications'], domains: ['notifications'] },
      uses: { schemas: ['users'], patterns: ['event-driven'] },
      referencedBy: ['billing', 'dashboard'],
    });

    const serialized = serializeManifest(original);
    const parsed = parseManifest(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed!.feature).toBe(original.feature);
    expect(parsed!.status).toBe(original.status);
    expect(parsed!.description).toBe(original.description);
    expect(parsed!.owns.schemas).toEqual(original.owns.schemas);
    expect(parsed!.owns.domains).toEqual(original.owns.domains);
    expect(parsed!.uses.schemas).toEqual(original.uses.schemas);
    expect(parsed!.uses.patterns).toEqual(original.uses.patterns);
    expect(parsed!.referencedBy).toEqual(original.referencedBy);
  });
});

// ---------- validateManifestOwnership ----------

describe('validateManifestOwnership', () => {
  it('returns no issues when all owned files exist', () => {
    const manifest = makeManifest({
      owns: { schemas: ['billing'], domains: ['billing'] },
    });
    const files = new Set([
      'docs/schemas/billing.md',
      'docs/domains/billing/index.md',
    ]);

    const issues = validateManifestOwnership(manifest, files);
    expect(issues).toHaveLength(0);
  });

  it('reports MISSING_OWNED_COMPONENT for missing files', () => {
    const manifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });
    const files = new Set<string>();

    const issues = validateManifestOwnership(manifest, files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('MISSING_OWNED_COMPONENT');
    expect(issues[0]!.message).toContain('schemas/billing');
  });

  it('checks .md, /index.md, and /README.md variants', () => {
    const manifest = makeManifest({
      owns: { schemas: ['billing'] },
    });

    // Direct .md exists
    expect(
      validateManifestOwnership(manifest, new Set(['docs/schemas/billing.md']))
    ).toHaveLength(0);

    // index.md exists
    expect(
      validateManifestOwnership(manifest, new Set(['docs/schemas/billing/index.md']))
    ).toHaveLength(0);

    // README.md exists
    expect(
      validateManifestOwnership(manifest, new Set(['docs/schemas/billing/README.md']))
    ).toHaveLength(0);
  });

  it('gracefully skips unknown types (no crash)', () => {
    const manifest = makeManifest({
      owns: { unknownType: ['something'] } as FeatureManifest['owns'],
    });
    const files = new Set<string>();

    // Should not throw
    const issues = validateManifestOwnership(manifest, files);
    // Unknown type is skipped since baseDir is undefined
    expect(issues).toHaveLength(0);
  });

  it('reports missing diagram (Bug 2 fix - diagrams now in TYPE_TO_DIR)', () => {
    const manifest = makeManifest({
      feature: 'auth',
      owns: { diagrams: ['auth-flow'] },
    });
    const files = new Set<string>();

    const issues = validateManifestOwnership(manifest, files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('MISSING_OWNED_COMPONENT');
    expect(issues[0]!.message).toContain('diagrams/auth-flow');
  });

  it('finds existing diagram (no false positive)', () => {
    const manifest = makeManifest({
      owns: { diagrams: ['auth-flow'] },
    });
    const files = new Set(['docs/diagrams/auth-flow.md']);

    expect(validateManifestOwnership(manifest, files)).toHaveLength(0);
  });

  it('reports missing feature via pattern match (Bug 2 fix)', () => {
    const manifest = makeManifest({
      feature: 'billing',
      owns: { features: ['payment-form'] },
    });
    const files = new Set<string>();

    const issues = validateManifestOwnership(manifest, files);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('MISSING_OWNED_COMPONENT');
    expect(issues[0]!.message).toContain('features/payment-form');
  });

  it('finds existing feature nested under any product', () => {
    const manifest = makeManifest({
      owns: { features: ['payment-form'] },
    });
    const files = new Set([
      'docs/products/checkout/features/payment-form.md',
    ]);

    expect(validateManifestOwnership(manifest, files)).toHaveLength(0);
  });
});

// ---------- getOwnedFilePaths ----------

describe('getOwnedFilePaths', () => {
  it('returns docs/schemas/{name}.md for schemas', () => {
    const manifest = makeManifest({ owns: { schemas: ['billing'] } });
    const paths = getOwnedFilePaths(manifest);

    expect(paths).toContain('docs/schemas/billing.md');
  });

  it('returns index.md and directory for domains', () => {
    const manifest = makeManifest({ owns: { domains: ['billing'] } });
    const paths = getOwnedFilePaths(manifest);

    expect(paths).toContain('docs/domains/billing/index.md');
    expect(paths).toContain('docs/domains/billing');
  });

  it('returns glob pattern for features', () => {
    const manifest = makeManifest({ owns: { features: ['payment-form'] } });
    const paths = getOwnedFilePaths(manifest);

    expect(paths).toContain('docs/products/**/features/payment-form.md');
  });

  it('returns docs/diagrams/{name}.md for diagrams', () => {
    const manifest = makeManifest({ owns: { diagrams: ['auth-flow'] } });
    const paths = getOwnedFilePaths(manifest);

    expect(paths).toContain('docs/diagrams/auth-flow.md');
  });

  it('returns empty array for empty owns', () => {
    const manifest = makeManifest({ owns: {} });
    const paths = getOwnedFilePaths(manifest);

    expect(paths).toEqual([]);
  });
});

// ---------- isFileOwnedByManifest ----------

describe('isFileOwnedByManifest', () => {
  it('matches exact schema path', () => {
    const manifest = makeManifest({ owns: { schemas: ['billing'] } });
    expect(isFileOwnedByManifest('docs/schemas/billing.md', manifest)).toBe(true);
  });

  it('matches domain directory prefix', () => {
    const manifest = makeManifest({ owns: { domains: ['billing'] } });
    expect(
      isFileOwnedByManifest('docs/domains/billing/invoices.md', manifest)
    ).toBe(true);
  });

  it('matches glob ** pattern for features', () => {
    const manifest = makeManifest({ owns: { features: ['payment-form'] } });
    expect(
      isFileOwnedByManifest(
        'docs/products/checkout/features/payment-form.md',
        manifest
      )
    ).toBe(true);
  });

  it('returns false for unrelated file', () => {
    const manifest = makeManifest({ owns: { schemas: ['billing'] } });
    expect(
      isFileOwnedByManifest('docs/infrastructure/deploy.md', manifest)
    ).toBe(false);
  });

  it('returns false when owns is empty', () => {
    const manifest = makeManifest({ owns: {} });
    expect(isFileOwnedByManifest('docs/schemas/billing.md', manifest)).toBe(false);
  });
});

// ---------- findReferencingFeatures ----------

describe('findReferencingFeatures', () => {
  it('finds cross-feature references', () => {
    const billingManifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });
    const dashboardManifest = makeManifest({
      feature: 'dashboard',
      owns: { schemas: ['dashboard'] },
    });

    const graph = makeGraph({
      'docs/schemas/billing.md': { linksTo: [] },
      'docs/schemas/dashboard.md': {
        linksTo: ['docs/schemas/billing.md'],
      },
    });

    const refs = findReferencingFeatures(
      billingManifest,
      [billingManifest, dashboardManifest],
      graph
    );

    expect(refs).toEqual(['dashboard']);
  });

  it('returns empty when no references', () => {
    const manifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });

    const graph = makeGraph({
      'docs/schemas/billing.md': { linksTo: [] },
    });

    const refs = findReferencingFeatures(manifest, [manifest], graph);
    expect(refs).toEqual([]);
  });

  it('skips self-references', () => {
    const manifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'], domains: ['billing'] },
    });

    const graph = makeGraph({
      'docs/schemas/billing.md': { linksTo: [] },
      'docs/domains/billing/index.md': {
        linksTo: ['docs/schemas/billing.md'],
      },
    });

    const refs = findReferencingFeatures(manifest, [manifest], graph);
    expect(refs).toEqual([]);
  });
});

// ---------- computeReferencedBy ----------

describe('computeReferencedBy', () => {
  it('builds correct Map per manifest', () => {
    const billingManifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });
    const dashboardManifest = makeManifest({
      feature: 'dashboard',
      owns: { schemas: ['dashboard'] },
    });

    const graph = makeGraph({
      'docs/schemas/billing.md': { linksTo: [] },
      'docs/schemas/dashboard.md': {
        linksTo: ['docs/schemas/billing.md'],
      },
    });

    const result = computeReferencedBy(
      [billingManifest, dashboardManifest],
      graph
    );

    expect(result.get('billing')).toEqual(['dashboard']);
    expect(result.get('dashboard')).toEqual([]);
  });

  it('returns empty arrays when no cross-refs', () => {
    const m1 = makeManifest({ feature: 'a', owns: { schemas: ['a'] } });
    const m2 = makeManifest({ feature: 'b', owns: { schemas: ['b'] } });

    const graph = makeGraph({
      'docs/schemas/a.md': { linksTo: [] },
      'docs/schemas/b.md': { linksTo: [] },
    });

    const result = computeReferencedBy([m1, m2], graph);
    expect(result.get('a')).toEqual([]);
    expect(result.get('b')).toEqual([]);
  });
});

// ---------- updateManifestReferencedBy ----------

describe('updateManifestReferencedBy', () => {
  it('returns new object with referencedBy set', () => {
    const original = makeManifest({ feature: 'billing' });
    const updated = updateManifestReferencedBy(original, ['dashboard', 'reporting']);

    expect(updated.referencedBy).toEqual(['dashboard', 'reporting']);
    expect(updated.feature).toBe('billing');
  });

  it('does not mutate the original manifest (immutability)', () => {
    const original = makeManifest({ feature: 'billing' });
    const updated = updateManifestReferencedBy(original, ['dashboard']);

    expect(original.referencedBy).toBeUndefined();
    expect(updated).not.toBe(original);
  });
});

// ---------- isReferencedByStale ----------

describe('isReferencedByStale', () => {
  it('returns false when refs match', () => {
    const manifest = makeManifest({
      referencedBy: ['dashboard', 'reporting'],
    });
    expect(isReferencedByStale(manifest, ['dashboard', 'reporting'])).toBe(false);
  });

  it('returns true when lengths differ', () => {
    const manifest = makeManifest({
      referencedBy: ['dashboard'],
    });
    expect(isReferencedByStale(manifest, ['dashboard', 'reporting'])).toBe(true);
  });

  it('returns true when items differ', () => {
    const manifest = makeManifest({
      referencedBy: ['dashboard', 'billing'],
    });
    expect(isReferencedByStale(manifest, ['dashboard', 'reporting'])).toBe(true);
  });

  it('treats undefined referencedBy as empty', () => {
    const manifest = makeManifest(); // no referencedBy
    expect(isReferencedByStale(manifest, [])).toBe(false);
    expect(isReferencedByStale(manifest, ['dashboard'])).toBe(true);
  });
});
