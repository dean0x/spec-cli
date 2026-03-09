import { describe, it, expect } from 'vitest';
import {
  createRemovalMarker,
  getOwnedFilesFromGraph,
  findBreakingEdges,
  edgesToBreakingReferences,
  findDependentFeatures,
  planRemoval,
  formatRemovalPlan,
  generateLinkReplacement,
  applyRemovalMarkers,
  validateRemoval,
  groupReferencesByFile,
  type BreakingReference,
  type RemovalPlan,
} from './removal.js';
import { createGraph, getOrCreateNode, addEdge } from './graph.js';
import type { FeatureManifest } from './types.js';
import type { GraphEdge } from './graph.js';

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

function makeBreakingReference(overrides: Partial<BreakingReference> = {}): BreakingReference {
  const targetFile = overrides.targetFile ?? 'docs/schemas/billing.md';
  const featureName = overrides.marker?.featureName ?? 'billing';
  const linkText = overrides.linkText ?? 'billing schema';
  return {
    sourceFile: 'docs/domains/auth/index.md',
    line: 5,
    linkText,
    targetFile,
    marker: createRemovalMarker(linkText, targetFile, featureName),
    ...overrides,
  };
}

function makePlan(overrides: Partial<RemovalPlan> = {}): RemovalPlan {
  const filesToDelete = overrides.filesToDelete ?? [];
  const breakingReferences = overrides.breakingReferences ?? [];
  const dependentFeatures = overrides.dependentFeatures ?? [];
  return {
    featureName: overrides.featureName ?? 'billing',
    filesToDelete,
    breakingReferences,
    dependentFeatures,
    stats: overrides.stats ?? {
      filesDeleted: filesToDelete.length,
      referencesMarked: breakingReferences.length,
      featuresAffected: dependentFeatures.length,
    },
  };
}

// ---------- createRemovalMarker ----------

describe('createRemovalMarker', () => {
  it('populates all fields correctly', () => {
    const marker = createRemovalMarker('billing schema', 'docs/schemas/billing.md', 'billing');

    expect(marker.originalText).toBe('billing schema');
    expect(marker.originalPath).toBe('docs/schemas/billing.md');
    expect(marker.featureName).toBe('billing');
    expect(marker.markerText).toBe('[REMOVED: billing]');
  });

  it('uses [REMOVED: {featureName}] format', () => {
    const marker = createRemovalMarker('link text', '/some/path.md', 'my-cool-feature');

    expect(marker.markerText).toBe('[REMOVED: my-cool-feature]');
  });
});

// ---------- getOwnedFilesFromGraph ----------

describe('getOwnedFilesFromGraph', () => {
  it('matches exact file path for schemas', () => {
    const manifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/schemas/users.md');

    const files = getOwnedFilesFromGraph(manifest, graph);

    expect(files).toContain('docs/schemas/billing.md');
    expect(files).not.toContain('docs/schemas/users.md');
  });

  it('matches glob ** pattern for features', () => {
    const manifest = makeManifest({
      feature: 'checkout',
      owns: { features: ['checkout'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/products/ecommerce/features/checkout.md');
    getOrCreateNode(graph, 'docs/products/other/features/checkout.md');
    getOrCreateNode(graph, 'docs/products/ecommerce/features/returns.md');

    const files = getOwnedFilesFromGraph(manifest, graph);

    expect(files).toContain('docs/products/ecommerce/features/checkout.md');
    expect(files).toContain('docs/products/other/features/checkout.md');
    expect(files).not.toContain('docs/products/ecommerce/features/returns.md');
  });

  it('matches directory prefix for domains', () => {
    const manifest = makeManifest({
      feature: 'auth',
      owns: { domains: ['auth'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    getOrCreateNode(graph, 'docs/domains/auth/tokens.md');
    getOrCreateNode(graph, 'docs/domains/billing/index.md');

    const files = getOwnedFilesFromGraph(manifest, graph);

    expect(files).toContain('docs/domains/auth/index.md');
    expect(files).toContain('docs/domains/auth/tokens.md');
    expect(files).not.toContain('docs/domains/billing/index.md');
  });

  it('deduplicates files matched by multiple patterns', () => {
    // A domain owns both 'docs/domains/auth/index.md' (exact) and
    // 'docs/domains/auth' (directory prefix) which both match the same file
    const manifest = makeManifest({
      feature: 'auth',
      owns: { domains: ['auth'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/domains/auth/index.md');

    const files = getOwnedFilesFromGraph(manifest, graph);

    // Should contain the file exactly once despite potentially matching
    // both the index.md exact pattern and the directory prefix pattern
    const countOccurrences = files.filter((f) => f === 'docs/domains/auth/index.md').length;
    expect(countOccurrences).toBe(1);
  });

  it('returns empty array when no graph nodes match', () => {
    const manifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/users.md');

    const files = getOwnedFilesFromGraph(manifest, graph);

    expect(files).toEqual([]);
  });
});

// ---------- findBreakingEdges ----------

describe('findBreakingEdges', () => {
  it('returns edges from external files to removed files', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/billing.md', 5, 'billing schema');

    const edges = findBreakingEdges(['docs/schemas/billing.md'], graph);

    expect(edges).toHaveLength(1);
    expect(edges[0]!.from).toBe('docs/domains/auth/index.md');
    expect(edges[0]!.to).toBe('docs/schemas/billing.md');
  });

  it('excludes internal edges where both endpoints are in removed set', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/schemas/invoices.md');
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    addEdge(graph, 'docs/schemas/invoices.md', 'docs/schemas/billing.md', 3, 'billing');
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/billing.md', 5, 'billing schema');

    const edges = findBreakingEdges(
      ['docs/schemas/billing.md', 'docs/schemas/invoices.md'],
      graph
    );

    // The edge from invoices -> billing is internal (both removed), so only the auth edge remains
    expect(edges).toHaveLength(1);
    expect(edges[0]!.from).toBe('docs/domains/auth/index.md');
  });

  it('returns empty array when nothing references removed files', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    // Edge goes FROM billing TO auth — billing is removed but no inbound external edges
    addEdge(graph, 'docs/schemas/billing.md', 'docs/domains/auth/index.md', 2, 'auth');

    const edges = findBreakingEdges(['docs/schemas/billing.md'], graph);

    expect(edges).toHaveLength(0);
  });
});

// ---------- edgesToBreakingReferences ----------

describe('edgesToBreakingReferences', () => {
  it('converts edges to BreakingReference objects with markers', () => {
    const edge: GraphEdge = {
      from: 'docs/domains/auth/index.md',
      to: 'docs/schemas/billing.md',
      line: 5,
      linkText: 'billing schema',
      layerViolation: false,
    };

    const refs = edgesToBreakingReferences([edge], 'billing');

    expect(refs).toHaveLength(1);
    expect(refs[0]!.sourceFile).toBe('docs/domains/auth/index.md');
    expect(refs[0]!.line).toBe(5);
    expect(refs[0]!.linkText).toBe('billing schema');
    expect(refs[0]!.targetFile).toBe('docs/schemas/billing.md');
  });

  it('assigns correct featureName on markers', () => {
    const edge: GraphEdge = {
      from: 'docs/domains/auth/index.md',
      to: 'docs/schemas/billing.md',
      line: 10,
      linkText: 'link',
      layerViolation: false,
    };

    const refs = edgesToBreakingReferences([edge], 'my-feature');

    expect(refs[0]!.marker.featureName).toBe('my-feature');
    expect(refs[0]!.marker.markerText).toBe('[REMOVED: my-feature]');
  });
});

// ---------- findDependentFeatures ----------

describe('findDependentFeatures', () => {
  it('identifies features whose owned files link to our owned files', () => {
    const billingManifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });
    const authManifest = makeManifest({
      feature: 'auth',
      owns: { domains: ['auth'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/billing.md', 5, 'billing schema');

    const dependents = findDependentFeatures(
      billingManifest,
      [billingManifest, authManifest],
      graph
    );

    expect(dependents).toContain('auth');
  });

  it('does not include self in dependents', () => {
    const billingManifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing', 'invoices'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/schemas/invoices.md');
    addEdge(graph, 'docs/schemas/invoices.md', 'docs/schemas/billing.md', 3, 'billing');

    const dependents = findDependentFeatures(billingManifest, [billingManifest], graph);

    expect(dependents).not.toContain('billing');
    expect(dependents).toHaveLength(0);
  });

  it('returns sorted unique list', () => {
    const billingManifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });
    const authManifest = makeManifest({
      feature: 'auth',
      owns: { domains: ['auth'] },
    });
    const notifyManifest = makeManifest({
      feature: 'notifications',
      owns: { domains: ['notifications'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    getOrCreateNode(graph, 'docs/domains/notifications/index.md');
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/billing.md', 5, 'billing');
    addEdge(graph, 'docs/domains/notifications/index.md', 'docs/schemas/billing.md', 8, 'billing');

    const dependents = findDependentFeatures(
      billingManifest,
      [billingManifest, notifyManifest, authManifest],
      graph
    );

    // Should be sorted alphabetically
    expect(dependents).toEqual(['auth', 'notifications']);
  });
});

// ---------- planRemoval ----------

describe('planRemoval', () => {
  it('produces a complete plan with stats matching array lengths', () => {
    const billingManifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });
    const authManifest = makeManifest({
      feature: 'auth',
      owns: { domains: ['auth'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/billing.md', 5, 'billing schema');

    const plan = planRemoval(billingManifest, [billingManifest, authManifest], graph);

    expect(plan.featureName).toBe('billing');
    expect(plan.stats.filesDeleted).toBe(plan.filesToDelete.length);
    expect(plan.stats.referencesMarked).toBe(plan.breakingReferences.length);
    expect(plan.stats.featuresAffected).toBe(plan.dependentFeatures.length);
    expect(plan.filesToDelete).toContain('docs/schemas/billing.md');
    expect(plan.breakingReferences).toHaveLength(1);
    expect(plan.dependentFeatures).toContain('auth');
  });

  it('returns empty arrays and zero stats when no owned files exist in graph', () => {
    const manifest = makeManifest({
      feature: 'nonexistent',
      owns: { schemas: ['does-not-exist'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/users.md');

    const plan = planRemoval(manifest, [manifest], graph);

    expect(plan.filesToDelete).toEqual([]);
    expect(plan.breakingReferences).toEqual([]);
    expect(plan.dependentFeatures).toEqual([]);
    expect(plan.stats.filesDeleted).toBe(0);
    expect(plan.stats.referencesMarked).toBe(0);
    expect(plan.stats.featuresAffected).toBe(0);
  });

  it('includes dependent features in the plan', () => {
    const billingManifest = makeManifest({
      feature: 'billing',
      owns: { schemas: ['billing'] },
    });
    const authManifest = makeManifest({
      feature: 'auth',
      owns: { domains: ['auth'] },
    });

    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/billing.md');
    getOrCreateNode(graph, 'docs/domains/auth/index.md');
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/billing.md', 5, 'billing');

    const plan = planRemoval(billingManifest, [billingManifest, authManifest], graph);

    expect(plan.dependentFeatures).toContain('auth');
    expect(plan.stats.featuresAffected).toBeGreaterThan(0);
  });
});

// ---------- formatRemovalPlan ----------

describe('formatRemovalPlan', () => {
  it('includes feature name in header', () => {
    const plan = makePlan({ featureName: 'billing' });

    const output = formatRemovalPlan(plan);

    expect(output).toContain('Removal Plan: billing');
  });

  it('lists files, references with line and link, and dependents', () => {
    const ref = makeBreakingReference({
      sourceFile: 'docs/domains/auth/index.md',
      line: 5,
      linkText: 'billing schema',
      targetFile: 'docs/schemas/billing.md',
    });
    const plan = makePlan({
      featureName: 'billing',
      filesToDelete: ['docs/schemas/billing.md'],
      breakingReferences: [ref],
      dependentFeatures: ['auth'],
    });

    const output = formatRemovalPlan(plan);

    expect(output).toContain('- docs/schemas/billing.md');
    expect(output).toContain('docs/domains/auth/index.md:5');
    expect(output).toContain('[billing schema](docs/schemas/billing.md)');
    expect(output).toContain('- auth');
  });

  it('shows "(none)" for empty sections', () => {
    const plan = makePlan({
      featureName: 'empty-feature',
      filesToDelete: [],
      breakingReferences: [],
      dependentFeatures: [],
    });

    const output = formatRemovalPlan(plan);

    // Count occurrences of "(none)" — should appear 3 times (files, references, dependents)
    const noneCount = (output.match(/\(none\)/g) ?? []).length;
    expect(noneCount).toBe(3);
  });
});

// ---------- generateLinkReplacement ----------

describe('generateLinkReplacement', () => {
  it('produces [REMOVED: feature] <!-- was: [text](path) --> format', () => {
    const result = generateLinkReplacement('[billing schema](./billing.md)', 'billing');

    expect(result).toBe('[REMOVED: billing] <!-- was: [billing schema](./billing.md) -->');
  });

  it('works with various link formats', () => {
    const result = generateLinkReplacement('[Auth API](../api/auth.md)', 'auth');

    expect(result).toBe('[REMOVED: auth] <!-- was: [Auth API](../api/auth.md) -->');
  });
});

// ---------- applyRemovalMarkers ----------

describe('applyRemovalMarkers', () => {
  it('replaces the matching link on the correct line', () => {
    const content = [
      '# Auth Domain',
      '',
      'Uses the [billing schema](docs/schemas/billing.md) for invoices.',
    ].join('\n');

    const ref = makeBreakingReference({
      sourceFile: 'docs/domains/auth/index.md',
      line: 3,
      linkText: 'billing schema',
      targetFile: 'docs/schemas/billing.md',
    });

    const result = applyRemovalMarkers(content, [ref], 'billing');

    expect(result).toContain('[REMOVED: billing]');
    expect(result).toContain('<!-- was:');
    // The original link should only appear inside the "was" comment, not as an active link
    expect(result).toContain('<!-- was: [billing schema](docs/schemas/billing.md) -->');
    // The line should start with the replacement, not the original link
    const resultLines = result.split('\n');
    expect(resultLines[2]).toContain('[REMOVED: billing]');
    expect(resultLines[2]).not.toMatch(/Uses the \[billing schema\]\(docs\/schemas\/billing\.md\) for/);
  });

  it('applies multiple markers sorted by descending line number', () => {
    const content = [
      '# Auth Domain',
      '',
      'Uses [billing schema](docs/schemas/billing.md) for invoices.',
      '',
      'Also references [invoices schema](docs/schemas/invoices.md) here.',
    ].join('\n');

    const ref1 = makeBreakingReference({
      sourceFile: 'docs/domains/auth/index.md',
      line: 3,
      linkText: 'billing schema',
      targetFile: 'docs/schemas/billing.md',
    });
    const ref2 = makeBreakingReference({
      sourceFile: 'docs/domains/auth/index.md',
      line: 5,
      linkText: 'invoices schema',
      targetFile: 'docs/schemas/invoices.md',
    });

    const result = applyRemovalMarkers(content, [ref1, ref2], 'billing');

    expect(result).toContain('[REMOVED: billing] <!-- was: [billing schema](docs/schemas/billing.md) -->');
    expect(result).toContain('[REMOVED: billing] <!-- was: [invoices schema](docs/schemas/invoices.md) -->');
  });

  it('leaves content unchanged when line does not match', () => {
    const content = '# No links here\nJust plain text.';

    const ref = makeBreakingReference({
      sourceFile: 'docs/domains/auth/index.md',
      line: 99, // Out of range
      linkText: 'billing schema',
      targetFile: 'docs/schemas/billing.md',
    });

    const result = applyRemovalMarkers(content, [ref], 'billing');

    expect(result).toBe(content);
  });

  it('returns content unchanged when markers array is empty', () => {
    const content = '# Some content\nWith [links](./file.md) in it.';

    const result = applyRemovalMarkers(content, [], 'billing');

    expect(result).toBe(content);
  });
});

// ---------- validateRemoval ----------

describe('validateRemoval', () => {
  it('always returns valid: true', () => {
    const plan = makePlan({
      filesToDelete: ['docs/schemas/billing.md'],
      breakingReferences: [makeBreakingReference()],
      dependentFeatures: ['auth'],
    });

    const { valid } = validateRemoval(plan);

    expect(valid).toBe(true);
  });

  it('warns when no files to delete', () => {
    const plan = makePlan({
      filesToDelete: [],
      stats: { filesDeleted: 0, referencesMarked: 0, featuresAffected: 0 },
    });

    const { warnings } = validateRemoval(plan);

    expect(warnings.some((w) => w.includes('No files found to delete'))).toBe(true);
  });

  it('warns when dependent features exist', () => {
    const plan = makePlan({
      filesToDelete: ['docs/schemas/billing.md'],
      dependentFeatures: ['auth', 'notifications'],
      stats: { filesDeleted: 1, referencesMarked: 0, featuresAffected: 2 },
    });

    const { warnings } = validateRemoval(plan);

    expect(warnings.some((w) => w.includes('2 other feature(s)'))).toBe(true);
  });

  it('warns when more than 10 references will be marked', () => {
    const refs = Array.from({ length: 12 }, (_, i) =>
      makeBreakingReference({
        sourceFile: `docs/file-${i}.md`,
        line: i + 1,
      })
    );
    const plan = makePlan({
      filesToDelete: ['docs/schemas/billing.md'],
      breakingReferences: refs,
      stats: { filesDeleted: 1, referencesMarked: 12, featuresAffected: 0 },
    });

    const { warnings } = validateRemoval(plan);

    expect(warnings.some((w) => w.includes('12 references'))).toBe(true);
  });
});

// ---------- groupReferencesByFile ----------

describe('groupReferencesByFile', () => {
  it('groups references by sourceFile', () => {
    const ref1 = makeBreakingReference({
      sourceFile: 'docs/domains/auth/index.md',
      line: 5,
    });
    const ref2 = makeBreakingReference({
      sourceFile: 'docs/domains/auth/index.md',
      line: 10,
    });
    const ref3 = makeBreakingReference({
      sourceFile: 'docs/domains/billing/index.md',
      line: 3,
    });

    const grouped = groupReferencesByFile([ref1, ref2, ref3]);

    expect(grouped.size).toBe(2);
    expect(grouped.get('docs/domains/auth/index.md')).toHaveLength(2);
    expect(grouped.get('docs/domains/billing/index.md')).toHaveLength(1);
  });

  it('returns empty Map for empty input', () => {
    const grouped = groupReferencesByFile([]);

    expect(grouped.size).toBe(0);
  });
});
