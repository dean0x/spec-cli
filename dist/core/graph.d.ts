/**
 * Dependency Graph Module
 *
 * Builds and traverses the dependency graph between specification documents.
 * Supports forward analysis (what depends on this?) and backward analysis
 * (what does this depend on?).
 */
import { type ComponentLayer } from './types.js';
/**
 * A node in the dependency graph
 */
export interface GraphNode {
    /** File path relative to docs root */
    path: string;
    /** Component type if recognized */
    componentType: string | null;
    /** Component layer if recognized */
    layer: ComponentLayer | null;
    /** Files this node links to (dependencies) */
    linksTo: Set<string>;
    /** Files that link to this node (dependents) */
    linkedFrom: Set<string>;
}
/**
 * An edge in the dependency graph
 */
export interface GraphEdge {
    /** Source file path */
    from: string;
    /** Target file path */
    to: string;
    /** Line number in source file */
    line: number;
    /** Link text */
    linkText: string;
    /** Whether this edge violates layer rules */
    layerViolation: boolean;
}
/**
 * The complete dependency graph
 */
export interface DependencyGraph {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
}
/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
    /** The file being analyzed */
    target: string;
    /** Files directly referencing this file */
    directDependents: string[];
    /** All files that would be affected (transitive) */
    transitiveDependents: string[];
    /** Files this file directly depends on */
    directDependencies: string[];
    /** All files this depends on (transitive) */
    transitiveDependencies: string[];
    /** Layer violations if this file were removed */
    brokenReferences: GraphEdge[];
}
/**
 * Parsed markdown link
 */
export interface ParsedLink {
    /** Full match text */
    match: string;
    /** Link text */
    text: string;
    /** Link URL/path */
    href: string;
    /** Line number */
    line: number;
    /** Whether it's an external link */
    isExternal: boolean;
}
/**
 * Extract all markdown links from content
 */
export declare function extractLinks(content: string): ParsedLink[];
/**
 * Resolve a relative link path to an absolute path
 */
export declare function resolveLink(fromPath: string, linkHref: string): string | null;
/**
 * Create an empty graph
 */
export declare function createGraph(): DependencyGraph;
/**
 * Get or create a node in the graph
 */
export declare function getOrCreateNode(graph: DependencyGraph, path: string): GraphNode;
/**
 * Add an edge to the graph
 */
export declare function addEdge(graph: DependencyGraph, from: string, to: string, line: number, linkText: string): GraphEdge;
/**
 * Build graph from file contents
 *
 * @param files Map of file path to file content
 */
export declare function buildGraph(files: Map<string, string>): DependencyGraph;
/**
 * Get direct dependents (files that reference this file)
 */
export declare function getDirectDependents(graph: DependencyGraph, path: string): string[];
/**
 * Get direct dependencies (files this file references)
 */
export declare function getDirectDependencies(graph: DependencyGraph, path: string): string[];
/**
 * Get all transitive dependents (what would break if this file changed/was removed)
 */
export declare function getTransitiveDependents(graph: DependencyGraph, path: string, visited?: Set<string>): string[];
/**
 * Get all transitive dependencies (everything this file depends on)
 */
export declare function getTransitiveDependencies(graph: DependencyGraph, path: string, visited?: Set<string>): string[];
/**
 * Analyze impact of changing or removing a file
 */
export declare function analyzeImpact(graph: DependencyGraph, path: string): ImpactAnalysis;
/**
 * Get all layer violations in the graph
 */
export declare function getLayerViolations(graph: DependencyGraph): GraphEdge[];
/**
 * Get orphan nodes (files with no incoming or outgoing links)
 */
export declare function getOrphanNodes(graph: DependencyGraph): string[];
/**
 * Get files with no incoming links (not referenced by anything)
 */
export declare function getUnreferencedNodes(graph: DependencyGraph): string[];
/**
 * Format graph as a simple text tree for a specific file
 */
export declare function formatDependencyTree(graph: DependencyGraph, path: string, direction?: 'dependents' | 'dependencies', maxDepth?: number): string;
/**
 * Export graph as Mermaid diagram
 */
export declare function exportAsMermaid(graph: DependencyGraph, options?: {
    focusNode?: string;
    maxDepth?: number;
    showLayerViolations?: boolean;
}): string;
/**
 * Get graph statistics
 */
export declare function getGraphStats(graph: DependencyGraph): {
    totalNodes: number;
    totalEdges: number;
    layerViolations: number;
    orphanNodes: number;
    unreferencedNodes: number;
    nodesByLayer: Record<string, number>;
};
//# sourceMappingURL=graph.d.ts.map