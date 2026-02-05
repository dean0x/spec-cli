/**
 * Structural Validation Entry Point
 *
 * Orchestrates all structural validation checks:
 * - Link validation
 * - Layer rule enforcement
 * - Frontmatter validation
 * - Orphan detection
 */

import type { ValidationResult, ValidationIssue } from '../../core/types.js';
import { getComponentTypeFromPath, COMPONENT_TYPES } from '../../core/types.js';
import { checkAllLinks } from './link-checker.js';
import { checkAllLayerRules } from './layer-rules.js';
import { validateFrontmatter } from './frontmatter.js';
import { findOrphans, findSelfReferences } from './orphan-detector.js';

export interface ValidationOptions {
  checkLinks?: boolean;
  checkLayerRules?: boolean;
  checkFrontmatter?: boolean;
  checkOrphans?: boolean;
  checkSelfReferences?: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  checkLinks: true,
  checkLayerRules: true,
  checkFrontmatter: true,
  checkOrphans: true,
  checkSelfReferences: true,
};

/**
 * Run all structural validations on a set of files
 */
export function validateStructure(
  files: Map<string, string>,
  options: ValidationOptions = DEFAULT_OPTIONS
): ValidationResult {
  const allIssues: ValidationIssue[] = [];
  const existingFiles = new Set(files.keys());

  // Link validation
  if (options.checkLinks !== false) {
    const linkIssues = checkAllLinks(files, existingFiles);
    allIssues.push(...linkIssues);
  }

  // Layer rule validation
  if (options.checkLayerRules !== false) {
    const layerIssues = checkAllLayerRules(files, existingFiles);
    allIssues.push(...layerIssues);
  }

  // Frontmatter validation
  if (options.checkFrontmatter !== false) {
    for (const [filePath, content] of files) {
      if (!filePath.endsWith('.md')) continue;

      const componentType = getComponentTypeFromPath(filePath);
      if (componentType) {
        // Get the type key from the component type
        const typeKey = Object.entries(COMPONENT_TYPES).find(
          ([, v]) => v === componentType
        )?.[0];

        if (typeKey) {
          const frontmatterIssues = validateFrontmatter(filePath, content, typeKey);
          allIssues.push(...frontmatterIssues);
        }
      }
    }
  }

  // Orphan detection
  if (options.checkOrphans !== false) {
    const orphanIssues = findOrphans(files);
    allIssues.push(...orphanIssues);
  }

  // Self-reference detection
  if (options.checkSelfReferences !== false) {
    const selfRefIssues = findSelfReferences(files);
    allIssues.push(...selfRefIssues);
  }

  // Calculate stats
  const errors = allIssues.filter((i) => i.severity === 'error').length;
  const warnings = allIssues.filter((i) => i.severity === 'warning').length;

  return {
    valid: errors === 0,
    issues: allIssues,
    stats: {
      filesChecked: files.size,
      errors,
      warnings,
    },
  };
}

/**
 * Format validation result for CLI output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  SPEC VALIDATION ${result.valid ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Stats
  lines.push(`  Files checked: ${result.stats.filesChecked}`);
  lines.push(`  Errors: ${result.stats.errors}`);
  lines.push(`  Warnings: ${result.stats.warnings}`);
  lines.push('');

  // Group issues by file
  const issuesByFile = new Map<string, ValidationIssue[]>();
  for (const issue of result.issues) {
    const existing = issuesByFile.get(issue.file) ?? [];
    existing.push(issue);
    issuesByFile.set(issue.file, existing);
  }

  // Sort files
  const sortedFiles = Array.from(issuesByFile.keys()).sort();

  for (const file of sortedFiles) {
    const fileIssues = issuesByFile.get(file);
    if (!fileIssues) continue;

    lines.push(`  ${file}`);

    for (const issue of fileIssues) {
      const icon = issue.severity === 'error' ? '✗' : '⚠';
      const lineRef = issue.line ? `:${issue.line}` : '';
      lines.push(`    ${icon} [${issue.code}]${lineRef} ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`      → ${issue.suggestion}`);
      }
    }
    lines.push('');
  }

  if (result.issues.length === 0) {
    lines.push('  No issues found.');
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Format validation result as JSON
 */
export function formatValidationResultJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}

// Re-export individual validators for direct use
export { checkAllLinks, checkFileLinks } from './link-checker.js';
export { checkAllLayerRules, checkFileLayerRules, generateLayerReport } from './layer-rules.js';
export { validateFrontmatter, parseFrontmatter } from './frontmatter.js';
export { findOrphans, findSelfReferences, generateOrphanStats } from './orphan-detector.js';
