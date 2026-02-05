/**
 * spec-cli Core Types
 *
 * Defines the 16 component types across 5 layers with their dependency rules.
 * This is the foundation of the specification framework.
 */
/**
 * Layer hierarchy (dependencies flow DOWN only):
 *
 * planning    -> can reference everything
 * product     -> reference, domain, supporting
 * supporting  -> reference, domain
 * domain      -> reference
 * reference   -> nothing (foundation)
 */
export const LAYER_HIERARCHY = {
    reference: 0,
    domain: 1,
    supporting: 2,
    product: 3,
    planning: 4,
};
/**
 * All 16 component types organized by layer
 */
export const COMPONENT_TYPES = {
    // Reference Layer (can reference: nothing)
    schema: {
        layer: 'reference',
        name: 'Schema',
        directory: 'docs/schemas',
        canReference: [],
    },
    pattern: {
        layer: 'reference',
        name: 'Pattern',
        directory: 'docs/architecture/patterns',
        canReference: [],
    },
    decision: {
        layer: 'reference',
        name: 'Decision',
        directory: 'docs/architecture/decisions',
        canReference: [],
    },
    // Domain Layer (can reference: reference)
    domain: {
        layer: 'domain',
        name: 'Domain',
        directory: 'docs/domains',
        canReference: ['reference'],
    },
    'domain-topic': {
        layer: 'domain',
        name: 'Domain Topic',
        directory: 'docs/domains/*',
        canReference: ['reference'],
    },
    // Supporting Layer (can reference: reference, domain)
    infrastructure: {
        layer: 'supporting',
        name: 'Infrastructure',
        directory: 'docs/infrastructure',
        canReference: ['reference', 'domain'],
    },
    security: {
        layer: 'supporting',
        name: 'Security',
        directory: 'docs/security',
        canReference: ['reference', 'domain'],
    },
    operations: {
        layer: 'supporting',
        name: 'Operations',
        directory: 'docs/operations',
        canReference: ['reference', 'domain'],
    },
    frontend: {
        layer: 'supporting',
        name: 'Frontend',
        directory: 'docs/frontend',
        canReference: ['reference', 'domain'],
    },
    api: {
        layer: 'supporting',
        name: 'API',
        directory: 'docs/api',
        canReference: ['reference', 'domain'],
    },
    diagram: {
        layer: 'supporting',
        name: 'Diagram',
        directory: 'docs/diagrams',
        canReference: ['reference', 'domain', 'supporting'],
    },
    // Product Layer (can reference: reference, domain, supporting)
    product: {
        layer: 'product',
        name: 'Product',
        directory: 'docs/products',
        canReference: ['reference', 'domain', 'supporting'],
    },
    feature: {
        layer: 'product',
        name: 'Feature',
        directory: 'docs/products/*/features',
        canReference: ['reference', 'domain', 'supporting'],
    },
    // Planning Layer (can reference: all)
    overview: {
        layer: 'planning',
        name: 'Overview',
        directory: 'docs/overview',
        canReference: ['reference', 'domain', 'supporting', 'product'],
    },
    'planning-doc': {
        layer: 'planning',
        name: 'Planning Doc',
        directory: 'docs/architecture',
        canReference: ['reference', 'domain', 'supporting', 'product'],
    },
    framework: {
        layer: 'planning',
        name: 'Framework',
        directory: 'docs',
        canReference: ['reference', 'domain', 'supporting', 'product', 'planning'],
    },
};
/**
 * Determine component type from file path
 */
export function getComponentTypeFromPath(filePath) {
    // Normalize path
    const normalizedPath = filePath.replace(/\\/g, '/');
    // Check each component type's directory pattern
    for (const [, type] of Object.entries(COMPONENT_TYPES)) {
        const pattern = type.directory;
        // Handle wildcard patterns like 'docs/domains/*' or 'docs/products/*/features'
        if (pattern.includes('*')) {
            const regexPattern = pattern
                .replace(/\*/g, '[^/]+')
                .replace(/\//g, '\\/');
            const regex = new RegExp(`^${regexPattern}`);
            if (regex.test(normalizedPath)) {
                return type;
            }
        }
        else if (normalizedPath.startsWith(pattern)) {
            return type;
        }
    }
    return null;
}
/**
 * Check if a reference from sourceLayer to targetLayer is valid
 */
export function isValidLayerReference(sourceLayer, targetLayer) {
    const sourceLevel = LAYER_HIERARCHY[sourceLayer];
    const targetLevel = LAYER_HIERARCHY[targetLayer];
    // Can only reference layers at same level or below
    return targetLevel <= sourceLevel;
}
/**
 * Get all component types in a specific layer
 */
export function getComponentsByLayer(layer) {
    return Object.values(COMPONENT_TYPES).filter((type) => type.layer === layer);
}
//# sourceMappingURL=types.js.map