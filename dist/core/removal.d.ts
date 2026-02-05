/**
 * Feature Removal Module
 *
 * Handles safe removal of features and their owned components.
 * Includes impact analysis, removal markers, and cleanup.
 */
import type { FeatureManifest } from './types.js';
import type { DependencyGraph, GraphEdge } from './graph.js';
/**
 * Result type for removal operations
 */
export type RemovalOperationResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
};
/**
 * Removal marker format
 */
export interface RemovalMarker {
    /** Original link text */
    originalText: string;
    /** Original link path */
    originalPath: string;
    /** Feature that owned the removed component */
    featureName: string;
    /** The marker text to insert */
    markerText: string;
}
/**
 * A reference that will break due to removal
 */
export interface BreakingReference {
    /** File containing the broken link */
    sourceFile: string;
    /** Line number of the link */
    line: number;
    /** The link text */
    linkText: string;
    /** The removed file path */
    targetFile: string;
    /** Generated removal marker */
    marker: RemovalMarker;
}
/**
 * Removal plan generated before execution
 */
export interface RemovalPlan {
    /** Feature being removed */
    featureName: string;
    /** Files that will be deleted */
    filesToDelete: string[];
    /** References that will be marked as broken */
    breakingReferences: BreakingReference[];
    /** Other features that depend on this one */
    dependentFeatures: string[];
    /** Summary stats */
    stats: {
        filesDeleted: number;
        referencesMarked: number;
        featuresAffected: number;
    };
}
/**
 * Removal execution result
 */
export interface RemovalExecutionResult {
    /** Whether removal succeeded */
    success: boolean;
    /** Files that were deleted */
    deletedFiles: string[];
    /** Files that were updated with markers */
    updatedFiles: string[];
    /** Any errors encountered */
    errors: string[];
}
/**
 * Generate a removal marker for a broken link
 */
export declare function createRemovalMarker(linkText: string, linkPath: string, featureName: string): RemovalMarker;
/**
 * Get all files owned by a manifest that exist in the graph
 */
export declare function getOwnedFilesFromGraph(manifest: FeatureManifest, graph: DependencyGraph): string[];
/**
 * Find all edges that reference files being removed
 */
export declare function findBreakingEdges(filesToRemove: string[], graph: DependencyGraph): GraphEdge[];
/**
 * Convert breaking edges to breaking references with markers
 */
export declare function edgesToBreakingReferences(edges: GraphEdge[], featureName: string): BreakingReference[];
/**
 * Find features that depend on the feature being removed
 */
export declare function findDependentFeatures(manifest: FeatureManifest, allManifests: FeatureManifest[], graph: DependencyGraph): string[];
/**
 * Generate a removal plan for a feature
 */
export declare function planRemoval(manifest: FeatureManifest, allManifests: FeatureManifest[], graph: DependencyGraph): RemovalPlan;
/**
 * Format removal plan as human-readable text
 */
export declare function formatRemovalPlan(plan: RemovalPlan): string;
/**
 * Generate the text replacement for a broken link
 *
 * Converts: [text](./path/to/file.md)
 * To: [REMOVED: feature-name] (was: [text](./path/to/file.md))
 */
export declare function generateLinkReplacement(originalMatch: string, featureName: string): string;
/**
 * Apply removal markers to file content
 */
export declare function applyRemovalMarkers(content: string, markers: BreakingReference[], featureName: string): string;
/**
 * Validate that a removal is safe to proceed
 */
export declare function validateRemoval(plan: RemovalPlan): {
    valid: boolean;
    warnings: string[];
};
/**
 * Group breaking references by source file
 */
export declare function groupReferencesByFile(references: BreakingReference[]): Map<string, BreakingReference[]>;
//# sourceMappingURL=removal.d.ts.map