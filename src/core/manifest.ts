/**
 * Manifest operations for feature ownership tracking
 */

import type { FeatureManifest, ValidationIssue } from './types.js';
import type { DependencyGraph } from './graph.js';

/** Shared mapping from manifest ownership types to their base directories */
const TYPE_TO_DIR: Record<string, string> = {
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

  let currentSection: 'root' | 'owns' | 'uses' | 'referencedBy' = 'root';
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
    if (trimmed === 'referencedBy:') {
      currentSection = 'referencedBy';
      currentKey = null;
      if (!manifest.referencedBy) {
        manifest.referencedBy = [];
      }
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
    } else if (trimmed.startsWith('- ')) {
      const item = trimmed.slice(2).trim();
      if (currentSection === 'referencedBy') {
        // referencedBy items are flat list, no currentKey needed
        manifest.referencedBy?.push(item);
      } else if (currentKey) {
        // Array item under owns/uses sub-key
        if (currentSection === 'owns') {
          (manifest.owns as Record<string, string[]>)[currentKey]?.push(item);
        } else if (currentSection === 'uses') {
          (manifest.uses as Record<string, string[]>)[currentKey]?.push(item);
        }
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

  serializeSection(lines, 'owns', manifest.owns);
  serializeSection(lines, 'uses', manifest.uses);

  if (manifest.referencedBy && manifest.referencedBy.length > 0) {
    lines.push('referencedBy:');
    for (const ref of manifest.referencedBy) {
      lines.push(`  - ${ref}`);
    }
  }

  return lines.join('\n');
}

/** Append a YAML section (owns/uses) with non-empty arrays as inline lists */
function serializeSection(
  lines: string[],
  header: string,
  section: Record<string, string[] | undefined>
): void {
  const entries = Object.entries(section).filter(
    ([, v]) => Array.isArray(v) && v.length > 0
  );
  if (entries.length === 0) return;

  lines.push(`${header}:`);
  for (const [key, values] of entries) {
    if (values) {
      lines.push(`  ${key}: [${values.join(', ')}]`);
    }
  }
}

/**
 * Validate a manifest's owned components exist
 */
export function validateManifestOwnership(
  manifest: FeatureManifest,
  existingFiles: Set<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const ownsEntries = Object.entries(manifest.owns) as Array<[string, string[] | undefined]>;

  for (const [type, components] of ownsEntries) {
    if (!components) continue;

    const baseDir = TYPE_TO_DIR[type];
    if (!baseDir) continue;

    for (const component of components) {
      if (type === 'features') {
        const featureSuffix = `/features/${component}.md`;
        let exists = false;
        for (const f of existingFiles) {
          if (f.startsWith('docs/products/') && f.endsWith(featureSuffix)) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          issues.push({
            severity: 'error',
            code: 'MISSING_OWNED_COMPONENT',
            message: `Manifest claims to own ${type}/${component} but no matching file found`,
            file: `.manifests/features/${manifest.feature}.yaml`,
            suggestion: `Create docs/products/<product>/features/${component}.md or remove from manifest`,
          });
        }
        continue;
      }

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

  const ownsEntries = Object.entries(manifest.owns) as Array<[string, string[] | undefined]>;

  for (const [type, components] of ownsEntries) {
    if (!components) continue;

    const baseDir = TYPE_TO_DIR[type];
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
    if (matchesOwnedPattern(filePath, pattern)) return true;
  }

  return false;
}

/**
 * Match a file path against a single owned path pattern.
 *
 * Patterns take one of four forms (produced by getOwnedFilePaths):
 *  - Glob:      docs/products/ ** /features/x.md  (feature ownership)
 *  - Directory: docs/domains/billing               (domain directory)
 *  - Exact:     docs/schemas/billing.md            (single file)
 *  - Bare name: (no slashes) — substring match     (fallback)
 */
function matchesOwnedPattern(filePath: string, pattern: string): boolean {
  // Glob: "docs/products/**/features/x.md"
  if (pattern.includes('**')) {
    const parts = pattern.split('**');
    if (parts[0] && parts[1]) {
      return filePath.startsWith(parts[0]) && filePath.endsWith(parts[1]);
    }
    return false;
  }

  // Exact file match
  if (filePath === pattern) return true;

  // Directory prefix: "docs/domains/billing" → matches "docs/domains/billing/invoices.md"
  // Require a "/" after the pattern to prevent "billing" matching "billing-v2"
  if (!pattern.endsWith('.md') && filePath.startsWith(pattern + '/')) return true;

  // Domain directory via .md stripping: "docs/domains/billing/index.md" → directory prefix "docs/domains/billing/"
  if (pattern.endsWith('/index.md')) {
    const dirPrefix = pattern.slice(0, -'index.md'.length); // keeps trailing "/"
    if (filePath.startsWith(dirPrefix)) return true;
  }

  // Bare component name (no slashes): match as path segment or filename stem
  if (!pattern.includes('/') && (filePath.includes(`/${pattern}/`) || filePath.includes(`/${pattern}.`))) return true;

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

  for (const [filePath, node] of graph.nodes) {
    if (isFileOwnedByManifest(filePath, manifest)) continue;

    for (const linkedTo of node.linksTo) {
      const linksToOwnedFile = ownedPaths.some(
        (ownedPath) =>
          linkedTo === ownedPath ||
          linkedTo.includes(ownedPath.replace('.md', '')) ||
          ownedPath.includes(linkedTo)
      );

      if (!linksToOwnedFile) continue;

      // Find which feature owns the referencing file
      for (const otherManifest of allManifests) {
        if (otherManifest.feature === manifest.feature) continue;
        if (isFileOwnedByManifest(filePath, otherManifest)) {
          referencingFeatures.add(otherManifest.feature);
          break;
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
