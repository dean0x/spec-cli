/**
 * Manifest operations for feature ownership tracking
 */
import type { FeatureManifest, ValidationIssue } from './types.js';
import type { DependencyGraph } from './graph.js';
/**
 * Parse YAML manifest content into FeatureManifest
 * Note: In production, use a proper YAML parser. This is a simplified parser.
 */
export declare function parseManifest(content: string): FeatureManifest | null;
/**
 * Serialize FeatureManifest to YAML string
 */
export declare function serializeManifest(manifest: FeatureManifest): string;
/**
 * Validate a manifest's owned components exist
 */
export declare function validateManifestOwnership(manifest: FeatureManifest, existingFiles: Set<string>): ValidationIssue[];
/**
 * Get all file paths owned by a manifest
 */
export declare function getOwnedFilePaths(manifest: FeatureManifest): string[];
/**
 * Check if a file path matches any owned path pattern
 */
export declare function isFileOwnedByManifest(filePath: string, manifest: FeatureManifest): boolean;
/**
 * Find all features that reference components owned by a manifest
 *
 * This uses the dependency graph to find which other features
 * have files that link to files owned by this feature.
 */
export declare function findReferencingFeatures(manifest: FeatureManifest, allManifests: FeatureManifest[], graph: DependencyGraph): string[];
/**
 * Update referencedBy field for all manifests based on the dependency graph
 *
 * Returns updated manifests (does not write to disk)
 */
export declare function computeReferencedBy(manifests: FeatureManifest[], graph: DependencyGraph): Map<string, string[]>;
/**
 * Create an updated manifest with computed referencedBy
 */
export declare function updateManifestReferencedBy(manifest: FeatureManifest, referencedBy: string[]): FeatureManifest;
/**
 * Check if manifest referencedBy is stale (doesn't match computed)
 */
export declare function isReferencedByStale(manifest: FeatureManifest, computedRefs: string[]): boolean;
//# sourceMappingURL=manifest.d.ts.map