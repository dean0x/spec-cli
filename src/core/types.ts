/**
 * spec-cli Core Types
 *
 * Defines the 16 component types across 5 layers with their dependency rules.
 * This is the foundation of the specification framework.
 */

export type ComponentLayer =
  | 'reference'
  | 'domain'
  | 'supporting'
  | 'product'
  | 'planning';

export interface ComponentType {
  layer: ComponentLayer;
  name: string;
  directory: string;
  canReference: ComponentLayer[];
}

/**
 * Layer hierarchy (dependencies flow DOWN only):
 *
 * planning    -> can reference everything
 * product     -> reference, domain, supporting
 * supporting  -> reference, domain
 * domain      -> reference
 * reference   -> nothing (foundation)
 */
export const LAYER_HIERARCHY: Record<ComponentLayer, number> = {
  reference: 0,
  domain: 1,
  supporting: 2,
  product: 3,
  planning: 4,
};

/**
 * All 16 component types organized by layer
 */
export const COMPONENT_TYPES: Record<string, ComponentType> = {
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
 * Feature manifest structure
 */
export interface FeatureManifest {
  feature: string;
  status: 'active' | 'deprecated' | 'planned';
  description?: string;
  owns: {
    schemas?: string[];
    domains?: string[];
    patterns?: string[];
    decisions?: string[];
    diagrams?: string[];
    features?: string[];
    infrastructure?: string[];
    security?: string[];
    operations?: string[];
    api?: string[];
    products?: string[];
  };
  uses: {
    schemas?: string[];
    patterns?: string[];
    domains?: string[];
  };
  referencedBy?: string[];
}

/**
 * Validation result types
 */
export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  file: string;
  line?: number;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    filesChecked: number;
    errors: number;
    warnings: number;
  };
}

/**
 * Determine component type from file path
 */
export function getComponentTypeFromPath(filePath: string): ComponentType | null {
  const result = getComponentTypeKeyFromPath(filePath);
  return result ? result.type : null;
}

/**
 * Determine component type key and type from file path.
 * Returns both the string key (for indexing REQUIRED_FRONTMATTER)
 * and the ComponentType object.
 */
export function getComponentTypeKeyFromPath(
  filePath: string
): { key: string; type: ComponentType } | null {
  const normalizedPath = filePath.replace(/\\/g, '/');

  const entries = Object.entries(COMPONENT_TYPES);

  // Check wildcard patterns first — they are more specific
  // (e.g. 'docs/products/*/features' before 'docs/products')
  for (const [key, type] of entries) {
    const pattern = type.directory;
    if (!pattern.includes('*')) continue;

    const regexPattern = pattern
      .replace(/\*/g, '[^/]+')
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexPattern}`);
    if (regex.test(normalizedPath)) {
      return { key, type };
    }
  }

  // Then check prefix patterns, longest first
  let best: { key: string; type: ComponentType } | null = null;
  let bestLen = 0;

  for (const [key, type] of entries) {
    const pattern = type.directory;
    if (pattern.includes('*')) continue;

    if (normalizedPath.startsWith(pattern) && pattern.length > bestLen) {
      best = { key, type };
      bestLen = pattern.length;
    }
  }

  return best;
}

/**
 * Check if a reference from sourceLayer to targetLayer is valid
 */
export function isValidLayerReference(
  sourceLayer: ComponentLayer,
  targetLayer: ComponentLayer
): boolean {
  const sourceLevel = LAYER_HIERARCHY[sourceLayer];
  const targetLevel = LAYER_HIERARCHY[targetLayer];

  // Can only reference layers at same level or below
  return targetLevel <= sourceLevel;
}

/**
 * Get all component types in a specific layer
 */
export function getComponentsByLayer(layer: ComponentLayer): ComponentType[] {
  return Object.values(COMPONENT_TYPES).filter((type) => type.layer === layer);
}
