/**
 * Layer Rules Validator
 *
 * Enforces the layer dependency hierarchy:
 * - Reference layer (schemas, patterns, decisions) cannot reference other layers
 * - Domain layer can only reference reference layer
 * - Supporting layer can reference reference and domain
 * - Product layer can reference reference, domain, and supporting
 * - Planning layer can reference all layers
 */
import type { ComponentLayer, ValidationIssue } from '../../core/types.js';
/**
 * Check if a link target is in a specific layer based on its path
 */
export declare function getLayerFromPath(filePath: string): ComponentLayer | null;
/**
 * Validate layer references in a single file
 */
export declare function checkFileLayerRules(filePath: string, content: string, _existingFiles: Set<string>): ValidationIssue[];
/**
 * Get human-readable layer violation explanation
 */
export declare function explainLayerViolation(sourceLayer: ComponentLayer, targetLayer: ComponentLayer): string;
/**
 * Batch check all files for layer rule violations
 */
export declare function checkAllLayerRules(files: Map<string, string>, existingFiles: Set<string>): ValidationIssue[];
/**
 * Generate a report of layer reference statistics
 */
export declare function generateLayerReport(files: Map<string, string>): Map<ComponentLayer, {
    total: number;
    references: Map<ComponentLayer, number>;
}>;
//# sourceMappingURL=layer-rules.d.ts.map