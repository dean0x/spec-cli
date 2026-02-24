/**
 * Dependency Health Checker
 *
 * Validates that frontmatter dependency declarations reference existing,
 * healthy domains. Flags missing domains and domains marked as unhealthy
 * in config.
 */

import type { ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { matchesIgnorePattern } from './ignore.js';

/**
 * Extract the domain name from a file path matching `docs/domains/{name}/`.
 * Returns the domain name or null if the path doesn't match.
 */
function extractDomainFromPath(filePath: string): string | null {
  const match = /^docs\/domains\/([^/]+)\//.exec(filePath);
  return match?.[1] ?? null;
}

/**
 * Parse frontmatter from markdown content, returning the raw text between --- delimiters.
 * Returns null if no frontmatter is found.
 */
function parseFrontmatterBlock(content: string): string | null {
  const lines = content.split('\n');
  if (lines[0]?.trimEnd() !== '---') return null;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trimEnd() === '---') {
      return lines.slice(1, i).join('\n');
    }
  }

  return null;
}

/**
 * Extract dependency names from the frontmatter dependencies field.
 * The field value is a comma-separated string like "organizations, users, billing".
 * Entries that are "none" (case-insensitive) are skipped.
 */
function extractDependencies(frontmatter: string): string[] {
  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('dependencies:')) {
      const value = trimmed.slice('dependencies:'.length).trim();
      if (value.length === 0) return [];

      return value
        .split(',')
        .map((dep) => dep.trim())
        .filter((dep) => dep.length > 0 && dep.toLowerCase() !== 'none');
    }
  }

  return [];
}

/**
 * Check all files for dependency health issues.
 *
 * Validates that frontmatter `dependencies` declarations reference existing,
 * healthy domains. Flags missing domains and domains marked as unhealthy
 * in config.
 */
export function checkDependencyHealth(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  if (!config.dependencyHealth.enabled) return [];

  const issues: ValidationIssue[] = [];

  // Build domain existence set by scanning file paths
  const existingDomains = new Set<string>();
  for (const filePath of files.keys()) {
    const domain = extractDomainFromPath(filePath);
    if (domain !== null) {
      existingDomains.add(domain);
    }
  }

  const unhealthySet = new Set(
    config.dependencyHealth.unhealthyDomains.map((d) => d.toLowerCase()),
  );

  for (const [filePath, content] of files) {
    if (matchesIgnorePattern(filePath, config.ignore)) continue;

    const frontmatter = parseFrontmatterBlock(content);
    if (frontmatter === null) continue;

    const deps = extractDependencies(frontmatter);
    if (deps.length === 0) continue;

    for (const dep of deps) {
      const depLower = dep.toLowerCase();

      if (!existingDomains.has(dep)) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_DEPENDENCY',
          message: `Declared dependency "${dep}" does not match any domain directory`,
          file: filePath,
          suggestion: `Verify that docs/domains/${dep}/ exists or remove "${dep}" from dependencies`,
        });
      }

      if (unhealthySet.has(depLower)) {
        issues.push({
          severity: 'warning',
          code: 'UNHEALTHY_DEPENDENCY',
          message: `Declared dependency "${dep}" is marked as unhealthy`,
          file: filePath,
          suggestion: `Review the health of the "${dep}" domain before depending on it`,
        });
      }
    }
  }

  return issues;
}
