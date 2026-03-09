import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  resolveLink,
  createGraph,
  getOrCreateNode,
  addEdge,
  buildGraph,
  getDirectDependents,
  getDirectDependencies,
  getTransitiveDependents,
  getTransitiveDependencies,
  analyzeImpact,
  getLayerViolations,
  getOrphanNodes,
  getUnreferencedNodes,
  formatDependencyTree,
  exportAsMermaid,
  getGraphStats,
} from './graph.js';

// ---------- extractLinks ----------

describe('extractLinks', () => {
  it('extracts a standard markdown link', () => {
    const links = extractLinks('[click here](./other.md)');
    expect(links).toHaveLength(1);
    expect(links[0]!.text).toBe('click here');
    expect(links[0]!.href).toBe('./other.md');
    expect(links[0]!.line).toBe(1);
    expect(links[0]!.isExternal).toBe(false);
  });

  it('detects http and https links as external', () => {
    const links = extractLinks('[a](http://example.com)\n[b](https://example.com)');
    expect(links).toHaveLength(2);
    expect(links[0]!.isExternal).toBe(true);
    expect(links[1]!.isExternal).toBe(true);
  });

  it('detects mailto links as external', () => {
    const links = extractLinks('[email](mailto:user@example.com)');
    expect(links).toHaveLength(1);
    expect(links[0]!.isExternal).toBe(true);
  });

  it('extracts multiple links from the same line', () => {
    const links = extractLinks('See [A](a.md) and [B](b.md) for details');
    expect(links).toHaveLength(2);
    expect(links[0]!.text).toBe('A');
    expect(links[1]!.text).toBe('B');
    expect(links[0]!.line).toBe(1);
    expect(links[1]!.line).toBe(1);
  });

  it('returns empty array for content with no links', () => {
    const links = extractLinks('No links here.\nJust plain text.');
    expect(links).toHaveLength(0);
  });

  it('extracts anchor-only links as non-external', () => {
    const links = extractLinks('[section](#overview)');
    expect(links).toHaveLength(1);
    expect(links[0]!.href).toBe('#overview');
    expect(links[0]!.isExternal).toBe(false);
  });
});

// ---------- resolveLink ----------

describe('resolveLink', () => {
  it('resolves a sibling link (./sibling.md)', () => {
    const result = resolveLink('docs/domains/auth/index.md', './users.md');
    expect(result).toBe('docs/domains/auth/users.md');
  });

  it('resolves a parent link (../up.md)', () => {
    const result = resolveLink('docs/domains/auth/index.md', '../overview.md');
    expect(result).toBe('docs/domains/overview.md');
  });

  it('returns null for external http links', () => {
    expect(resolveLink('docs/a.md', 'https://example.com')).toBeNull();
  });

  it('returns null for anchor-only links', () => {
    expect(resolveLink('docs/a.md', '#section')).toBeNull();
  });

  it('resolves nested traversal (../../deep/path.md)', () => {
    const result = resolveLink('docs/domains/auth/deep/file.md', '../../schemas/users.md');
    expect(result).toBe('docs/domains/schemas/users.md');
  });

  it('strips anchor from path before resolving', () => {
    const result = resolveLink('docs/domains/auth/index.md', './users.md#roles');
    expect(result).toBe('docs/domains/auth/users.md');
  });
});

// ---------- createGraph ----------

describe('createGraph', () => {
  it('creates an empty graph with no nodes and no edges', () => {
    const graph = createGraph();
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges).toHaveLength(0);
  });
});

// ---------- getOrCreateNode ----------

describe('getOrCreateNode', () => {
  it('creates a node with correct componentType and layer for a known path', () => {
    const graph = createGraph();
    const node = getOrCreateNode(graph, 'docs/schemas/users.md');
    expect(node.path).toBe('docs/schemas/users.md');
    expect(node.componentType).toBe('Schema');
    expect(node.layer).toBe('reference');
  });

  it('returns null type and layer for an unrecognized path', () => {
    const graph = createGraph();
    const node = getOrCreateNode(graph, 'random/unknown/path.md');
    expect(node.componentType).toBeNull();
    expect(node.layer).toBeNull();
  });

  it('returns the existing node on duplicate call', () => {
    const graph = createGraph();
    const first = getOrCreateNode(graph, 'docs/schemas/users.md');
    const second = getOrCreateNode(graph, 'docs/schemas/users.md');
    expect(first).toBe(second);
    expect(graph.nodes.size).toBe(1);
  });
});

// ---------- addEdge ----------

describe('addEdge', () => {
  it('updates both nodes linksTo and linkedFrom', () => {
    const graph = createGraph();
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/users.md', 10, 'users');
    const from = graph.nodes.get('docs/domains/auth/index.md')!;
    const to = graph.nodes.get('docs/schemas/users.md')!;
    expect(from.linksTo.has('docs/schemas/users.md')).toBe(true);
    expect(to.linkedFrom.has('docs/domains/auth/index.md')).toBe(true);
  });

  it('detects a layer violation (schema referencing domain)', () => {
    const graph = createGraph();
    // schema canReference: [] — referencing domain is a violation
    const edge = addEdge(graph, 'docs/schemas/users.md', 'docs/domains/auth/index.md', 5, 'auth');
    expect(edge.layerViolation).toBe(true);
  });

  it('allows cross-layer references for decision type (exception)', () => {
    const graph = createGraph();
    // decision canReference: ['domain', 'supporting', 'product', 'planning']
    const edge = addEdge(
      graph,
      'docs/architecture/decisions/001.md',
      'docs/domains/auth/index.md',
      3,
      'auth'
    );
    expect(edge.layerViolation).toBe(false);
  });

  it('does not flag same-layer reference as violation', () => {
    const graph = createGraph();
    const edge = addEdge(
      graph,
      'docs/schemas/users.md',
      'docs/schemas/roles.md',
      1,
      'roles'
    );
    expect(edge.layerViolation).toBe(false);
  });
});

// ---------- buildGraph ----------

describe('buildGraph', () => {
  it('builds a multi-file graph with correct nodes and edges', () => {
    const files = new Map([
      ['docs/domains/auth/index.md', 'See [schema](../../schemas/users.md)'],
      ['docs/schemas/users.md', '# Users Schema'],
    ]);
    const graph = buildGraph(files);
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.from).toBe('docs/domains/auth/index.md');
    expect(graph.edges[0]!.to).toBe('docs/schemas/users.md');
  });

  it('does not create edges for external links', () => {
    const files = new Map([
      ['docs/domains/auth/index.md', 'See [docs](https://example.com) and [local](../../schemas/users.md)'],
      ['docs/schemas/users.md', '# Users'],
    ]);
    const graph = buildGraph(files);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.to).toBe('docs/schemas/users.md');
  });

  it('creates isolated nodes for files with no links', () => {
    const files = new Map([
      ['docs/schemas/users.md', '# Users Schema\n\nNo links here.'],
    ]);
    const graph = buildGraph(files);
    expect(graph.nodes.size).toBe(1);
    expect(graph.edges).toHaveLength(0);
    expect(graph.nodes.get('docs/schemas/users.md')).toBeDefined();
  });
});

// ---------- getDirectDependents / getDirectDependencies ----------

describe('getDirectDependents', () => {
  it('returns files that reference the given path', () => {
    const graph = createGraph();
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/users.md', 1, 'users');
    addEdge(graph, 'docs/products/app.md', 'docs/schemas/users.md', 2, 'users');

    const dependents = getDirectDependents(graph, 'docs/schemas/users.md');
    expect(dependents).toContain('docs/domains/auth/index.md');
    expect(dependents).toContain('docs/products/app.md');
    expect(dependents).toHaveLength(2);
  });

  it('returns empty array for a path not in the graph', () => {
    const graph = createGraph();
    expect(getDirectDependents(graph, 'nonexistent.md')).toEqual([]);
  });
});

describe('getDirectDependencies', () => {
  it('returns files that the given path references', () => {
    const graph = createGraph();
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/users.md', 1, 'users');
    addEdge(graph, 'docs/domains/auth/index.md', 'docs/schemas/roles.md', 2, 'roles');

    const deps = getDirectDependencies(graph, 'docs/domains/auth/index.md');
    expect(deps).toContain('docs/schemas/users.md');
    expect(deps).toContain('docs/schemas/roles.md');
    expect(deps).toHaveLength(2);
  });

  it('returns empty array for an isolated node', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/users.md');
    expect(getDirectDependencies(graph, 'docs/schemas/users.md')).toEqual([]);
  });
});

// ---------- getTransitiveDependents / getTransitiveDependencies ----------

describe('getTransitiveDependents', () => {
  it('follows chains to find transitive dependents', () => {
    const graph = createGraph();
    // C references B, B references A => A's transitive dependents include both B and C
    addEdge(graph, 'B.md', 'A.md', 1, 'a');
    addEdge(graph, 'C.md', 'B.md', 1, 'b');

    const result = getTransitiveDependents(graph, 'A.md');
    expect(result).toContain('B.md');
    expect(result).toContain('C.md');
  });

  it('handles cycles without infinite loop', () => {
    const graph = createGraph();
    addEdge(graph, 'A.md', 'B.md', 1, 'b');
    addEdge(graph, 'B.md', 'A.md', 1, 'a');

    // Should not hang
    const result = getTransitiveDependents(graph, 'A.md');
    expect(result).toContain('B.md');
  });
});

describe('getTransitiveDependencies', () => {
  it('follows chains to find transitive dependencies', () => {
    const graph = createGraph();
    // A links to B, B links to C => A's transitive deps include B and C
    addEdge(graph, 'A.md', 'B.md', 1, 'b');
    addEdge(graph, 'B.md', 'C.md', 1, 'c');

    const result = getTransitiveDependencies(graph, 'A.md');
    expect(result).toContain('B.md');
    expect(result).toContain('C.md');
  });

  it('handles cycles without infinite loop', () => {
    const graph = createGraph();
    addEdge(graph, 'A.md', 'B.md', 1, 'b');
    addEdge(graph, 'B.md', 'A.md', 1, 'a');

    const result = getTransitiveDependencies(graph, 'A.md');
    expect(result).toContain('B.md');
  });
});

// ---------- analyzeImpact ----------

describe('analyzeImpact', () => {
  it('includes direct and transitive dependents and dependencies', () => {
    const graph = createGraph();
    addEdge(graph, 'B.md', 'A.md', 1, 'a');
    addEdge(graph, 'C.md', 'B.md', 1, 'b');
    addEdge(graph, 'A.md', 'D.md', 1, 'd');

    const impact = analyzeImpact(graph, 'A.md');
    expect(impact.target).toBe('A.md');
    expect(impact.directDependents).toContain('B.md');
    expect(impact.transitiveDependents).toContain('C.md');
    expect(impact.directDependencies).toContain('D.md');
  });

  it('includes broken references (edges targeting the file)', () => {
    const graph = createGraph();
    addEdge(graph, 'B.md', 'A.md', 5, 'link to A');
    addEdge(graph, 'C.md', 'A.md', 10, 'another link');

    const impact = analyzeImpact(graph, 'A.md');
    expect(impact.brokenReferences).toHaveLength(2);
    expect(impact.brokenReferences[0]!.to).toBe('A.md');
    expect(impact.brokenReferences[1]!.to).toBe('A.md');
  });

  it('returns empty arrays for a file with no connections', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'lonely.md');

    const impact = analyzeImpact(graph, 'lonely.md');
    expect(impact.directDependents).toHaveLength(0);
    expect(impact.transitiveDependents).toHaveLength(0);
    expect(impact.directDependencies).toHaveLength(0);
    expect(impact.transitiveDependencies).toHaveLength(0);
    expect(impact.brokenReferences).toHaveLength(0);
  });
});

// ---------- getLayerViolations ----------

describe('getLayerViolations', () => {
  it('returns only edges flagged as violations', () => {
    const graph = createGraph();
    // schema -> domain is a violation (schema canReference: [])
    addEdge(graph, 'docs/schemas/a.md', 'docs/domains/auth/b.md', 1, 'b');
    // domain -> schema is allowed (domain canReference: ['reference'])
    addEdge(graph, 'docs/domains/auth/c.md', 'docs/schemas/d.md', 2, 'd');

    const violations = getLayerViolations(graph);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.from).toBe('docs/schemas/a.md');
  });

  it('returns empty array when there are no violations', () => {
    const graph = createGraph();
    addEdge(graph, 'docs/domains/auth/a.md', 'docs/schemas/b.md', 1, 'b');

    const violations = getLayerViolations(graph);
    expect(violations).toHaveLength(0);
  });
});

// ---------- getOrphanNodes / getUnreferencedNodes ----------

describe('getOrphanNodes', () => {
  it('returns nodes with no incoming or outgoing links', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'orphan.md');
    addEdge(graph, 'A.md', 'B.md', 1, 'link');

    const orphans = getOrphanNodes(graph);
    expect(orphans).toContain('orphan.md');
    expect(orphans).not.toContain('A.md');
    expect(orphans).not.toContain('B.md');
  });

  it('does not include nodes that have links', () => {
    const graph = createGraph();
    addEdge(graph, 'A.md', 'B.md', 1, 'link');

    const orphans = getOrphanNodes(graph);
    expect(orphans).toHaveLength(0);
  });
});

describe('getUnreferencedNodes', () => {
  it('returns nodes with no incoming links even if they have outgoing links', () => {
    const graph = createGraph();
    addEdge(graph, 'A.md', 'B.md', 1, 'link');

    const unreferenced = getUnreferencedNodes(graph);
    // A links to B, but nothing links to A
    expect(unreferenced).toContain('A.md');
    expect(unreferenced).not.toContain('B.md');
  });
});

// ---------- formatDependencyTree ----------

describe('formatDependencyTree', () => {
  it('produces ASCII output with the root node', () => {
    const graph = createGraph();
    addEdge(graph, 'B.md', 'A.md', 1, 'link');

    const tree = formatDependencyTree(graph, 'A.md', 'dependents');
    expect(tree).toContain('A.md');
    expect(tree).toContain('B.md');
  });

  it('shows circular annotation for cycles', () => {
    const graph = createGraph();
    addEdge(graph, 'A.md', 'B.md', 1, 'b');
    addEdge(graph, 'B.md', 'A.md', 1, 'a');

    const tree = formatDependencyTree(graph, 'A.md', 'dependencies');
    expect(tree).toContain('(circular:');
  });

  it('respects maxDepth limit', () => {
    const graph = createGraph();
    addEdge(graph, 'B.md', 'A.md', 1, 'a');
    addEdge(graph, 'C.md', 'B.md', 1, 'b');
    addEdge(graph, 'D.md', 'C.md', 1, 'c');

    // maxDepth 1 means root + 1 level: should show A and B but not C or D
    const tree = formatDependencyTree(graph, 'A.md', 'dependents', 1);
    expect(tree).toContain('A.md');
    expect(tree).toContain('B.md');
    expect(tree).not.toContain('C.md');
    expect(tree).not.toContain('D.md');
  });

  it('works for dependencies direction', () => {
    const graph = createGraph();
    addEdge(graph, 'A.md', 'B.md', 1, 'b');

    const tree = formatDependencyTree(graph, 'A.md', 'dependencies');
    expect(tree).toContain('A.md');
    expect(tree).toContain('B.md');
  });
});

// ---------- exportAsMermaid ----------

describe('exportAsMermaid', () => {
  it('starts with graph TD', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/users.md');

    const mermaid = exportAsMermaid(graph);
    expect(mermaid.startsWith('graph TD')).toBe(true);
  });

  it('includes VIOLATION labels for layer violation edges', () => {
    const graph = createGraph();
    addEdge(graph, 'docs/schemas/a.md', 'docs/domains/auth/b.md', 1, 'b');

    const mermaid = exportAsMermaid(graph);
    expect(mermaid).toContain('VIOLATION');
  });

  it('limits output to focusNode neighborhood', () => {
    const graph = createGraph();
    addEdge(graph, 'A.md', 'B.md', 1, 'b');
    getOrCreateNode(graph, 'isolated.md');

    const mermaid = exportAsMermaid(graph, { focusNode: 'A.md' });
    expect(mermaid).toContain('A');
    expect(mermaid).toContain('B');
    expect(mermaid).not.toContain('isolated');
  });

  it('includes style directives for nodes with known layers', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/users.md');

    const mermaid = exportAsMermaid(graph);
    expect(mermaid).toContain('style');
    expect(mermaid).toContain('fill:#e1f5fe');
  });
});

// ---------- getGraphStats ----------

describe('getGraphStats', () => {
  it('returns correct counts for nodes, edges, violations, orphans', () => {
    const graph = createGraph();
    addEdge(graph, 'docs/domains/auth/a.md', 'docs/schemas/b.md', 1, 'b');
    getOrCreateNode(graph, 'orphan.md');

    const stats = getGraphStats(graph);
    expect(stats.totalNodes).toBe(3);
    expect(stats.totalEdges).toBe(1);
    expect(stats.layerViolations).toBe(0);
    expect(stats.orphanNodes).toBe(1);
  });

  it('counts layer violations correctly', () => {
    const graph = createGraph();
    addEdge(graph, 'docs/schemas/a.md', 'docs/domains/auth/b.md', 1, 'b');

    const stats = getGraphStats(graph);
    expect(stats.layerViolations).toBe(1);
  });

  it('aggregates nodesByLayer including unknown for unrecognized paths', () => {
    const graph = createGraph();
    getOrCreateNode(graph, 'docs/schemas/a.md');
    getOrCreateNode(graph, 'docs/schemas/b.md');
    getOrCreateNode(graph, 'docs/domains/auth/c.md');
    getOrCreateNode(graph, 'random/unknown.md');

    const stats = getGraphStats(graph);
    expect(stats.nodesByLayer['reference']).toBe(2);
    expect(stats.nodesByLayer['domain']).toBe(1);
    expect(stats.nodesByLayer['unknown']).toBe(1);
  });
});
