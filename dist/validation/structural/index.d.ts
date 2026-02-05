/**
 * Structural Validation Entry Point
 *
 * Orchestrates all structural validation checks:
 * - Link validation
 * - Layer rule enforcement
 * - Frontmatter validation
 * - Orphan detection
 */
import type { ValidationResult } from '../../core/types.js';
export interface ValidationOptions {
    checkLinks?: boolean;
    checkLayerRules?: boolean;
    checkFrontmatter?: boolean;
    checkOrphans?: boolean;
    checkSelfReferences?: boolean;
}
/**
 * Run all structural validations on a set of files
 */
export declare function validateStructure(files: Map<string, string>, options?: ValidationOptions): ValidationResult;
/**
 * Format validation result for CLI output
 */
export declare function formatValidationResult(result: ValidationResult): string;
/**
 * Format validation result as JSON
 */
export declare function formatValidationResultJson(result: ValidationResult): string;
export { checkAllLinks, checkFileLinks } from './link-checker.js';
export { checkAllLayerRules, checkFileLayerRules, generateLayerReport } from './layer-rules.js';
export { validateFrontmatter, parseFrontmatter } from './frontmatter.js';
export { findOrphans, findSelfReferences, generateOrphanStats } from './orphan-detector.js';
//# sourceMappingURL=index.d.ts.map