/**
 * spec-cli Core Types
 *
 * Defines the 16 component types across 5 layers with their dependency rules.
 * This is the foundation of the specification framework.
 */
export type ComponentLayer = 'reference' | 'domain' | 'supporting' | 'product' | 'planning';
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
export declare const LAYER_HIERARCHY: Record<ComponentLayer, number>;
/**
 * All 16 component types organized by layer
 */
export declare const COMPONENT_TYPES: Record<string, ComponentType>;
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
export declare function getComponentTypeFromPath(filePath: string): ComponentType | null;
/**
 * Check if a reference from sourceLayer to targetLayer is valid
 */
export declare function isValidLayerReference(sourceLayer: ComponentLayer, targetLayer: ComponentLayer): boolean;
/**
 * Get all component types in a specific layer
 */
export declare function getComponentsByLayer(layer: ComponentLayer): ComponentType[];
//# sourceMappingURL=types.d.ts.map