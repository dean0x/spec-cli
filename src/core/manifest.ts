/**
 * Manifest operations for feature ownership tracking
 */

import type { FeatureManifest, ValidationIssue } from './types.js';
import type { DependencyGraph } from './graph.js';

/**
 * Parse YAML manifest content into FeatureManifest
 * Note: In production, use a proper YAML parser. This is a simplified parser.
 */
export function parseManifest(content: string): FeatureManifest | null {
  const lines = content.split('\n');
  const manifest: Partial<FeatureManifest> = {
    owns: {},
    uses: {},
  };

  let currentSection: 'root' | 'owns' | 'uses' = 'root';
  let currentKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for section headers
    if (trimmed === 'owns:') {
      currentSection = 'owns';
      currentKey = null;
      continue;
    }
    if (trimmed === 'uses:') {
      currentSection = 'uses';
      currentKey = null;
      continue;
    }

    // Parse key-value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0 && !trimmed.startsWith('-')) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (currentSection === 'root') {
        if (key === 'feature') manifest.feature = value;
        if (key === 'status') manifest.status = value as FeatureManifest['status'];
        if (key === 'description') manifest.description = value;
      } else {
        currentKey = key;
        // Handle inline array like: schemas: [billing, users]
        if (value.startsWith('[') && value.endsWith(']')) {
          const items = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (currentSection === 'owns') {
            (manifest.owns as Record<string, string[]>)[key] = items;
          } else {
            (manifest.uses as Record<string, string[]>)[key] = items;
          }
          currentKey = null;
        } else if (!value) {
          // Multi-line array starts
          if (currentSection === 'owns') {
            (manifest.owns as Record<string, string[]>)[key] = [];
          } else {
            (manifest.uses as Record<string, string[]>)[key] = [];
          }
        }
      }
    } else if (trimmed.startsWith('- ') && currentKey) {
      // Array item
      const item = trimmed.slice(2).trim();
      if (currentSection === 'owns') {
        (manifest.owns as Record<string, string[]>)[currentKey]?.push(item);
      } else {
        (manifest.uses as Record<string, string[]>)[currentKey]?.push(item);
      }
    }
  }

  if (!manifest.feature || !manifest.status) {
    return null;
  }

  return manifest as FeatureManifest;
}

/**
 * Serialize FeatureManifest to YAML string
 */
export function serializeManifest(manifest: FeatureManifest): string {
  const lines: string[] = [];

  lines.push(`feature: ${manifest.feature}`);
  lines.push(`status: ${manifest.status}`);
  if (manifest.description) {
    lines.push(`description: ${manifest.description}`);
  }

  // Owns section
  const ownsEntries = Object.entries(manifest.owns).filter(
    ([, v]) => Array.isArray(v) && v.length > 0
  ) as Array<[string, string[]]>;
  if (ownsEntries.length > 0) {
    lines.push('owns:');
    for (const [key, values] of ownsEntries) {
      lines.push(`  ${key}: [${values.join(', ')}]`);
    }
  }

  // Uses section
  const usesEntries = Object.entries(manifest.uses).filter(
    ([, v]) => Array.isArray(v) && v.length > 0
  ) as Array<[string, string[]]>;
  if (usesEntries.length > 0) {
    lines.push('uses:');
    for (const [key, values] of usesEntries) {
      lines.push(`  ${key}: [${values.join(', ')}]`);
    }
  }

  // Referenced by section
  if (manifest.referencedBy && manifest.referencedBy.length > 0) {
    lines.push('referencedBy:');
    for (const ref of manifest.referencedBy) {
      lines.push(`  - ${ref}`);
    }
  }

  return lines.join('\n');
}

/**
 * Validate a manifest's owned components exist
 */
export function validateManifestOwnership(
  manifest: FeatureManifest,
  existingFiles: Set<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Map component types to their base directories
  const typeToDir: Record<string, string> = {
    schemas: 'docs/schemas',
    domains: 'docs/domains',
    patterns: 'docs/architecture/patterns',
    decisions: 'docs/architecture/decisions',
    infrastructure: 'docs/infrastructure',
    security: 'docs/security',
    operations: 'docs/operations',
    api: 'docs/api',
    products: 'docs/products',
  };

  const ownsEntries = Object.entries(manifest.owns) as Array<[string, string[] | undefined]>;

  for (const [type, components] of ownsEntries) {
    if (!components || !Array.isArray(components)) continue;

    const baseDir = typeToDir[type];
    if (!baseDir) continue;

    for (const component of components) {
      // Check common file patterns
      const possiblePaths = [
        `${baseDir}/${component}.md`,
        `${baseDir}/${component}/index.md`,
        `${baseDir}/${component}/README.md`,
      ];

      const exists = possiblePaths.some((p) => existingFiles.has(p));

      if (!exists) {
        issues.push({
          severity: 'error',
          code: 'MISSING_OWNED_COMPONENT',
          message: `Manifest claims to own ${type}/${component} but no matching file found`,
          file: `.manifests/features/${manifest.feature}.yaml`,
          suggestion: `Create ${baseDir}/${component}.md or remove from manifest`,
        });
      }
    }
  }

  return issues;
}

/**
 * Get all file paths owned by a manifest
 */
export function getOwnedFilePaths(manifest: FeatureManifest): string[] {
  const paths: string[] = [];

  const typeToDir: Record<string, string> = {
    schemas: 'docs/schemas',
    domains: 'docs/domains',
    patterns: 'docs/architecture/patterns',
    decisions: 'docs/architecture/decisions',
    diagrams: 'docs/diagrams',
    infrastructure: 'docs/infrastructure',
    security: 'docs/security',
    operations: 'docs/operations',
    api: 'docs/api',
    products: 'docs/products',
    features: 'docs/products',
  };

  const ownsEntries = Object.entries(manifest.owns) as Array<[string, string[] | undefined]>;

  for (const [type, components] of ownsEntries) {
    if (!components || !Array.isArray(components)) continue;

    const baseDir = typeToDir[type];
    if (!baseDir) continue;

    for (const component of components) {
      // Add common file patterns
      if (type === 'domains') {
        paths.push(`${baseDir}/${component}/index.md`);
        // Also add any files in the domain directory
        paths.push(`${baseDir}/${component}`);
      } else if (type === 'features') {
        // Features are nested under products
        paths.push(`${baseDir}/**/features/${component}.md`);
      } else {
        paths.push(`${baseDir}/${component}.md`);
      }
    }
  }

  return paths;
}

/**
 * Check if a file path matches any owned path pattern
 */
export function isFileOwnedByManifest(filePath: string, manifest: FeatureManifest): boolean {
  const ownedPaths = getOwnedFilePaths(manifest);

  for (const pattern of ownedPaths) {
    if (pattern.includes('**')) {
      // Glob pattern matching (simplified)
      const parts = pattern.split('**');
      if (parts[0] && parts[1]) {
        const prefix = parts[0];
        const suffix = parts[1];
        if (filePath.startsWith(prefix) && filePath.endsWith(suffix)) {
          return true;
        }
      }
    } else if (pattern.endsWith('/')) {
      // Directory prefix match
      if (filePath.startsWith(pattern)) {
        return true;
      }
    } else if (!pattern.includes('/') || pattern === filePath) {
      // Exact match or just component name
      if (filePath === pattern || filePath.includes(`/${pattern.split('/').pop()}`)) {
        return true;
      }
    } else if (filePath.startsWith(pattern.replace('.md', ''))) {
      // Directory match for domains
      return true;
    }
  }

  return false;
}

/**
 * Find all features that reference components owned by a manifest
 *
 * This uses the dependency graph to find which other features
 * have files that link to files owned by this feature.
 */
export function findReferencingFeatures(
  manifest: FeatureManifest,
  allManifests: FeatureManifest[],
  graph: DependencyGraph
): string[] {
  const referencingFeatures = new Set<string>();
  const ownedPaths = getOwnedFilePaths(manifest);

  // For each file in the graph, check if it references our owned files
  for (const [filePath, node] of graph.nodes) {
    // Skip our own files
    if (isFileOwnedByManifest(filePath, manifest)) continue;

    // Check if this file links to any of our owned files
    for (const linkedTo of node.linksTo) {
      const linkedToNormalized = linkedTo;

      // Check if linkedTo matches any owned path
      for (const ownedPath of ownedPaths) {
        const matches =
          linkedToNormalized === ownedPath ||
          linkedToNormalized.includes(ownedPath.replace('.md', '')) ||
          ownedPath.includes(linkedToNormalized);

        if (matches) {
          // Find which feature owns this referencing file
          for (const otherManifest of allManifests) {
            if (otherManifest.feature === manifest.feature) continue;
            if (isFileOwnedByManifest(filePath, otherManifest)) {
              referencingFeatures.add(otherManifest.feature);
              break;
            }
          }
        }
      }
    }
  }

  return Array.from(referencingFeatures).sort();
}

/**
 * Update referencedBy field for all manifests based on the dependency graph
 *
 * Returns updated manifests (does not write to disk)
 */
export function computeReferencedBy(
  manifests: FeatureManifest[],
  graph: DependencyGraph
): Map<string, string[]> {
  const referencedByMap = new Map<string, string[]>();

  for (const manifest of manifests) {
    const refs = findReferencingFeatures(manifest, manifests, graph);
    referencedByMap.set(manifest.feature, refs);
  }

  return referencedByMap;
}

/**
 * Create an updated manifest with computed referencedBy
 */
export function updateManifestReferencedBy(
  manifest: FeatureManifest,
  referencedBy: string[]
): FeatureManifest {
  return {
    ...manifest,
    referencedBy,
  };
}

/**
 * Check if manifest referencedBy is stale (doesn't match computed)
 */
export function isReferencedByStale(
  manifest: FeatureManifest,
  computedRefs: string[]
): boolean {
  const currentRefs = manifest.referencedBy ?? [];
  if (currentRefs.length !== computedRefs.length) return true;

  const currentSet = new Set(currentRefs);
  for (const ref of computedRefs) {
    if (!currentSet.has(ref)) return true;
  }

  return false;
}
