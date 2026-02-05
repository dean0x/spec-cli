/**
 * Dependency Graph Module
 *
 * Builds and traverses the dependency graph between specification documents.
 * Supports forward analysis (what depends on this?) and backward analysis
 * (what does this depend on?).
 */
import { getComponentTypeFromPath, isValidLayerReference, } from './types.js';
/**
 * Extract all markdown links from content
 */
export function extractLinks(content) {
    const links = [];
    const lines = content.split('\n');
    // Match [text](url) pattern
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line)
            continue;
        let match;
        while ((match = linkRegex.exec(line)) !== null) {
            const href = match[2] ?? '';
            const isExternal = href.startsWith('http://') ||
                href.startsWith('https://') ||
                href.startsWith('mailto:');
            links.push({
                match: match[0],
                text: match[1] ?? '',
                href,
                line: lineNum + 1, // 1-indexed
                isExternal,
            });
        }
    }
    return links;
}
/**
 * Resolve a relative link path to an absolute path
 */
export function resolveLink(fromPath, linkHref) {
    // Skip external links
    if (linkHref.startsWith('http://') ||
        linkHref.startsWith('https://') ||
        linkHref.startsWith('mailto:')) {
        return null;
    }
    // Remove anchor
    const hrefWithoutAnchor = linkHref.split('#')[0] ?? '';
    if (!hrefWithoutAnchor) {
        // Just an anchor link like #section
        return null;
    }
    // Get directory of source file
    const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
    // Resolve relative path
    const parts = hrefWithoutAnchor.split('/');
    const baseParts = fromDir.split('/').filter(Boolean);
    for (const part of parts) {
        if (part === '..') {
            baseParts.pop();
        }
        else if (part !== '.' && part !== '') {
            baseParts.push(part);
        }
    }
    return baseParts.join('/');
}
/**
 * Create an empty graph
 */
export function createGraph() {
    return {
        nodes: new Map(),
        edges: [],
    };
}
/**
 * Get or create a node in the graph
 */
export function getOrCreateNode(graph, path) {
    let node = graph.nodes.get(path);
    if (!node) {
        const componentType = getComponentTypeFromPath(path);
        node = {
            path,
            componentType: componentType?.name ?? null,
            layer: componentType?.layer ?? null,
            linksTo: new Set(),
            linkedFrom: new Set(),
        };
        graph.nodes.set(path, node);
    }
    return node;
}
/**
 * Add an edge to the graph
 */
export function addEdge(graph, from, to, line, linkText) {
    const fromNode = getOrCreateNode(graph, from);
    const toNode = getOrCreateNode(graph, to);
    fromNode.linksTo.add(to);
    toNode.linkedFrom.add(from);
    // Check for layer violation
    let layerViolation = false;
    if (fromNode.layer && toNode.layer) {
        layerViolation = !isValidLayerReference(fromNode.layer, toNode.layer);
    }
    const edge = {
        from,
        to,
        line,
        linkText,
        layerViolation,
    };
    graph.edges.push(edge);
    return edge;
}
/**
 * Build graph from file contents
 *
 * @param files Map of file path to file content
 */
export function buildGraph(files) {
    const graph = createGraph();
    for (const [filePath, content] of files) {
        // Ensure node exists even if it has no links
        getOrCreateNode(graph, filePath);
        // Extract and process links
        const links = extractLinks(content);
        for (const link of links) {
            if (link.isExternal)
                continue;
            const resolvedPath = resolveLink(filePath, link.href);
            if (resolvedPath) {
                addEdge(graph, filePath, resolvedPath, link.line, link.text);
            }
        }
    }
    return graph;
}
/**
 * Get direct dependents (files that reference this file)
 */
export function getDirectDependents(graph, path) {
    const node = graph.nodes.get(path);
    if (!node)
        return [];
    return Array.from(node.linkedFrom);
}
/**
 * Get direct dependencies (files this file references)
 */
export function getDirectDependencies(graph, path) {
    const node = graph.nodes.get(path);
    if (!node)
        return [];
    return Array.from(node.linksTo);
}
/**
 * Get all transitive dependents (what would break if this file changed/was removed)
 */
export function getTransitiveDependents(graph, path, visited = new Set()) {
    if (visited.has(path))
        return [];
    visited.add(path);
    const directDependents = getDirectDependents(graph, path);
    const allDependents = [...directDependents];
    for (const dependent of directDependents) {
        const transitive = getTransitiveDependents(graph, dependent, visited);
        allDependents.push(...transitive);
    }
    return allDependents;
}
/**
 * Get all transitive dependencies (everything this file depends on)
 */
export function getTransitiveDependencies(graph, path, visited = new Set()) {
    if (visited.has(path))
        return [];
    visited.add(path);
    const directDeps = getDirectDependencies(graph, path);
    const allDeps = [...directDeps];
    for (const dep of directDeps) {
        const transitive = getTransitiveDependencies(graph, dep, visited);
        allDeps.push(...transitive);
    }
    return allDeps;
}
/**
 * Analyze impact of changing or removing a file
 */
export function analyzeImpact(graph, path) {
    const directDependents = getDirectDependents(graph, path);
    const transitiveDependents = getTransitiveDependents(graph, path);
    const directDependencies = getDirectDependencies(graph, path);
    const transitiveDependencies = getTransitiveDependencies(graph, path);
    // Find edges that would break if this file were removed
    const brokenReferences = graph.edges.filter((edge) => edge.to === path);
    return {
        target: path,
        directDependents,
        transitiveDependents: [...new Set(transitiveDependents)],
        directDependencies,
        transitiveDependencies: [...new Set(transitiveDependencies)],
        brokenReferences,
    };
}
/**
 * Get all layer violations in the graph
 */
export function getLayerViolations(graph) {
    return graph.edges.filter((edge) => edge.layerViolation);
}
/**
 * Get orphan nodes (files with no incoming or outgoing links)
 */
export function getOrphanNodes(graph) {
    const orphans = [];
    for (const [path, node] of graph.nodes) {
        if (node.linksTo.size === 0 && node.linkedFrom.size === 0) {
            orphans.push(path);
        }
    }
    return orphans;
}
/**
 * Get files with no incoming links (not referenced by anything)
 */
export function getUnreferencedNodes(graph) {
    const unreferenced = [];
    for (const [path, node] of graph.nodes) {
        if (node.linkedFrom.size === 0) {
            unreferenced.push(path);
        }
    }
    return unreferenced;
}
/**
 * Format graph as a simple text tree for a specific file
 */
export function formatDependencyTree(graph, path, direction = 'dependents', maxDepth = 3) {
    const lines = [];
    const visited = new Set();
    function traverse(currentPath, depth, prefix) {
        if (depth > maxDepth || visited.has(currentPath)) {
            if (visited.has(currentPath)) {
                lines.push(`${prefix}(circular: ${currentPath})`);
            }
            return;
        }
        visited.add(currentPath);
        const node = graph.nodes.get(currentPath);
        const typeLabel = node?.componentType ? ` [${node.componentType}]` : '';
        lines.push(`${prefix}${currentPath}${typeLabel}`);
        const children = direction === 'dependents'
            ? getDirectDependents(graph, currentPath)
            : getDirectDependencies(graph, currentPath);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const isLast = i === children.length - 1;
            const childPrefix = prefix.replace(/[├└]/g, '│').replace(/─/g, ' ') + (isLast ? '└── ' : '├── ');
            if (child) {
                traverse(child, depth + 1, childPrefix);
            }
        }
    }
    traverse(path, 0, '');
    return lines.join('\n');
}
/**
 * Export graph as Mermaid diagram
 */
export function exportAsMermaid(graph, options = {}) {
    const { focusNode, maxDepth = 3, showLayerViolations = true } = options;
    const lines = ['graph TD'];
    // Collect nodes to include up to maxDepth
    let nodesToInclude;
    if (focusNode) {
        nodesToInclude = new Set([focusNode]);
        // Add dependents and dependencies up to maxDepth
        const addConnected = (node, depth) => {
            if (depth >= maxDepth)
                return;
            const dependents = getDirectDependents(graph, node);
            const dependencies = getDirectDependencies(graph, node);
            for (const n of [...dependents, ...dependencies]) {
                if (!nodesToInclude.has(n)) {
                    nodesToInclude.add(n);
                    addConnected(n, depth + 1);
                }
            }
        };
        addConnected(focusNode, 0);
    }
    else {
        nodesToInclude = new Set(graph.nodes.keys());
    }
    // Define node styles by layer
    const layerStyles = {
        reference: 'fill:#e1f5fe',
        domain: 'fill:#fff3e0',
        supporting: 'fill:#e8f5e9',
        product: 'fill:#fce4ec',
        planning: 'fill:#f3e5f5',
    };
    // Add nodes
    for (const path of nodesToInclude) {
        const node = graph.nodes.get(path);
        if (!node)
            continue;
        const shortName = path.split('/').pop()?.replace('.md', '') ?? path;
        const nodeId = path.replace(/[/.]/g, '_');
        lines.push(`  ${nodeId}["${shortName}"]`);
    }
    // Add edges
    for (const edge of graph.edges) {
        if (!nodesToInclude.has(edge.from) || !nodesToInclude.has(edge.to))
            continue;
        const fromId = edge.from.replace(/[/.]/g, '_');
        const toId = edge.to.replace(/[/.]/g, '_');
        if (edge.layerViolation && showLayerViolations) {
            lines.push(`  ${fromId} -->|VIOLATION| ${toId}`);
        }
        else {
            lines.push(`  ${fromId} --> ${toId}`);
        }
    }
    // Add layer-based styling
    for (const path of nodesToInclude) {
        const node = graph.nodes.get(path);
        if (!node?.layer)
            continue;
        const nodeId = path.replace(/[/.]/g, '_');
        const style = layerStyles[node.layer];
        if (style) {
            lines.push(`  style ${nodeId} ${style}`);
        }
    }
    return lines.join('\n');
}
/**
 * Get graph statistics
 */
export function getGraphStats(graph) {
    const violations = getLayerViolations(graph);
    const orphans = getOrphanNodes(graph);
    const unreferenced = getUnreferencedNodes(graph);
    const nodesByLayer = {};
    for (const node of graph.nodes.values()) {
        const layer = node.layer ?? 'unknown';
        nodesByLayer[layer] = (nodesByLayer[layer] ?? 0) + 1;
    }
    return {
        totalNodes: graph.nodes.size,
        totalEdges: graph.edges.length,
        layerViolations: violations.length,
        orphanNodes: orphans.length,
        unreferencedNodes: unreferenced.length,
        nodesByLayer,
    };
}
//# sourceMappingURL=graph.js.map