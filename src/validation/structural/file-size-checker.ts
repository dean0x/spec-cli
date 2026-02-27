/**
 * File Size Checker
 *
 * Checks line count against per-type limits from FRAMEWORK.md Rule 3.
 * Flags files that exceed the line limit for their component type.
 */

import type { ValidationIssue } from '../../core/types.js';
import { getComponentTypeKeyFromPath } from '../../core/types.js';

/**
 * Per-type line limits from FRAMEWORK.md Rule 3.
 */
export const FILE_SIZE_LIMITS: Record<string, number> = {
  schema: 400,
  pattern: 300,
  'domain-topic': 500,
  feature: 400,
};

const DEFAULT_LINE_LIMIT = 500;

/**
 * Get the line limit for a component type key.
 * Returns the per-type limit if defined, otherwise the default.
 */
export function getLineLimit(componentTypeKey: string): number {
  return FILE_SIZE_LIMITS[componentTypeKey] ?? DEFAULT_LINE_LIMIT;
}

/**
 * Check all files for line count exceeding per-type limits.
 */
export function checkFileSizes(files: Map<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (!filePath.endsWith('.md')) continue;

    const result = getComponentTypeKeyFromPath(filePath);
    if (!result) continue;

    const limit = getLineLimit(result.key);
    const lineCount = content.split('\n').length;

    if (lineCount > limit) {
      issues.push({
        severity: 'warning',
        code: 'FILE_SIZE_EXCEEDED',
        message: `File has ${lineCount} lines, exceeding ${result.key} limit of ${limit}`,
        file: filePath,
        suggestion: `Split this file into smaller, focused documents`,
      });
    }
  }

  return issues;
}
