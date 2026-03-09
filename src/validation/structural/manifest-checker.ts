/**
 * Manifest Validation Checker
 *
 * Validates feature manifest files for structural correctness:
 * - Parse validity (required fields)
 * - Filename/feature name consistency
 * - Status value validation
 * - Owned component existence
 * - Used component existence
 * - Duplicate feature name detection
 */

import type { ValidationIssue } from '../../core/types.js';
import { parseManifest, validateManifestOwnership } from '../../core/manifest.js';

/**
 * Valid manifest status values
 */
const VALID_STATUSES = new Set(['active', 'deprecated', 'planned']);

/**
 * Mapping from `uses` type keys to their expected file path patterns.
 * Mirrors TYPE_TO_DIR in manifest.ts but scoped to what `uses` supports.
 */
const USES_TYPE_TO_PATH: Record<string, (name: string) => string> = {
  schemas: (name: string) => `docs/schemas/${name}.md`,
  patterns: (name: string) => `docs/architecture/patterns/${name}.md`,
  domains: (name: string) => `docs/domains/${name}/index.md`,
};

/**
 * Extract the basename from a manifest file path, stripping the
 * .yaml or .yml extension.
 */
function extractBasename(manifestPath: string): string {
  const segments = manifestPath.split('/');
  const filename = segments[segments.length - 1] ?? manifestPath;
  return filename.replace(/\.ya?ml$/, '');
}

/**
 * Check all manifest files for structural issues.
 *
 * Returns [] when manifestFiles is empty (opt-in feature).
 * Receives pre-loaded content — pure function, no disk I/O.
 */
export function checkManifests(
  manifestFiles: Map<string, string>,
  existingFiles: Set<string>
): ValidationIssue[] {
  if (manifestFiles.size === 0) return [];

  const issues: ValidationIssue[] = [];
  const featureNames = new Map<string, string[]>();

  for (const [filePath, content] of manifestFiles) {
    // 1. Parse manifest
    const manifest = parseManifest(content);
    if (manifest === null) {
      issues.push({
        severity: 'error',
        code: 'INVALID_MANIFEST',
        message: `Failed to parse manifest: missing required fields (feature, status)`,
        file: filePath,
        suggestion: `Ensure manifest has both 'feature:' and 'status:' fields`,
      });
      continue;
    }

    // 2. Filename match
    const basename = extractBasename(filePath);
    if (basename !== manifest.feature) {
      issues.push({
        severity: 'warning',
        code: 'MANIFEST_NAME_MISMATCH',
        message: `Manifest filename "${basename}" does not match feature name "${manifest.feature}"`,
        file: filePath,
        suggestion: `Rename file to ${manifest.feature}.yaml or update feature: to "${basename}"`,
      });
    }

    // 3. Status validation
    if (!VALID_STATUSES.has(manifest.status)) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_MANIFEST_STATUS',
        message: `Invalid manifest status "${manifest.status}": must be one of active, deprecated, planned`,
        file: filePath,
        suggestion: `Change status to one of: active, deprecated, planned`,
      });
    }

    // 4. Ownership validation
    const ownershipIssues = validateManifestOwnership(manifest, existingFiles);
    issues.push(...ownershipIssues);

    // 5. Uses validation
    const usesEntries = Object.entries(manifest.uses) as Array<[string, string[] | undefined]>;
    for (const [type, components] of usesEntries) {
      if (!components) continue;

      const pathBuilder = USES_TYPE_TO_PATH[type];
      if (!pathBuilder) continue;

      for (const component of components) {
        const expectedPath = pathBuilder(component);

        const exists =
          existingFiles.has(expectedPath) ||
          (type === 'domains' && existingFiles.has(`docs/domains/${component}.md`));

        if (!exists) {
          issues.push({
            severity: 'warning',
            code: 'MISSING_USED_COMPONENT',
            message: `Manifest uses ${type}/${component} but file not found at ${expectedPath}`,
            file: filePath,
            suggestion: `Create ${expectedPath} or remove from uses`,
          });
        }
      }
    }

    // Track feature names for duplicate detection
    const existing = featureNames.get(manifest.feature) ?? [];
    existing.push(filePath);
    featureNames.set(manifest.feature, existing);
  }

  // 6. Duplicate feature name detection
  for (const [featureName, files] of featureNames) {
    if (files.length > 1) {
      for (const file of files) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_FEATURE_NAME',
          message: `Feature name "${featureName}" is used by multiple manifests: ${files.join(', ')}`,
          file,
          suggestion: `Each manifest must have a unique feature name`,
        });
      }
    }
  }

  return issues;
}
