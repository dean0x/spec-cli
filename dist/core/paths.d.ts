/**
 * Path Resolution Module
 *
 * Provides path resolution that works whether spec-cli is:
 * - A local directory (development)
 * - Installed in node_modules (npm package)
 *
 * Uses import.meta.url to locate package assets regardless of installation method.
 */
/**
 * Resolved paths for spec-cli operations
 */
export interface SpecCliPaths {
    /** Where spec-cli assets live (templates, schemas, agents) */
    packageRoot: string;
    /** Consumer's docs directory */
    docsRoot: string;
    /** Consumer's manifests directory */
    manifestDir: string;
    /** Consumer project root (where spec.config.yaml lives) */
    projectRoot: string;
}
/**
 * Asset types that can be resolved
 */
export type AssetType = 'templates' | 'schemas' | 'agents' | 'commands' | 'skills';
/**
 * Configuration loaded from spec.config.yaml
 */
export interface SpecConfig {
    docsDir?: string;
    manifestDir?: string;
    extends?: string;
}
/**
 * Result type for path operations
 */
export type PathResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
};
/**
 * Get the package root directory using import.meta.url
 * This works whether spec-cli is local or in node_modules
 */
export declare function getPackageRoot(): string;
/**
 * Find the consumer project root by walking up from cwd until we find spec.config.yaml
 * Falls back to cwd if not found
 */
export declare function findProjectRoot(startDir?: string): string;
/**
 * Load configuration from spec.config.yaml
 */
export declare function loadConfig(projectRoot: string): PathResult<SpecConfig>;
/**
 * Resolve all paths needed for spec-cli operations
 *
 * @param projectRoot - Optional explicit project root. If not provided, searches up from cwd.
 */
export declare function resolveSpecCliPaths(projectRoot?: string): PathResult<SpecCliPaths>;
/**
 * Get the absolute path to an asset file
 *
 * @param assetType - Type of asset (templates, schemas, agents, commands, skills)
 * @param name - Asset filename (with or without extension)
 */
export declare function getAssetPath(assetType: AssetType, name: string): string;
/**
 * Get the path to a template file
 */
export declare function getTemplatePath(componentType: string): string;
/**
 * Get the path to a frontmatter schema
 */
export declare function getSchemaPath(componentType: string): string;
/**
 * Check if a path exists within the package assets
 */
export declare function assetExists(assetType: AssetType, name: string): boolean;
/**
 * Read an asset file as string
 */
export declare function readAsset(assetType: AssetType, name: string): PathResult<string>;
//# sourceMappingURL=paths.d.ts.map