/**
 * Orphan Detector
 *
 * Finds documents that are not referenced from any index or other document.
 */
import type { ValidationIssue } from '../../core/types.js';
/**
 * Build a set of all files that are referenced by other files
 */
export declare function buildReferenceSet(files: Map<string, string>): Set<string>;
/**
 * Check if a file is an index/entry point that shouldn't be flagged
 */
export declare function isIndexOrEntryPoint(filePath: string): boolean;
/**
 * Find all orphan documents (not referenced by anything)
 */
export declare function findOrphans(files: Map<string, string>): ValidationIssue[];
/**
 * Find documents that reference themselves (circular self-reference)
 */
export declare function findSelfReferences(files: Map<string, string>): ValidationIssue[];
/**
 * Generate orphan statistics
 */
export declare function generateOrphanStats(files: Map<string, string>): {
    total: number;
    orphans: number;
    referenced: number;
};
//# sourceMappingURL=orphan-detector.d.ts.map