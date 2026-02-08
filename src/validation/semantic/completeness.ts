/**
 * Completeness Validator
 *
 * Verifies that files of configured component types contain
 * the expected section headings.
 */

import type { ValidationIssue } from '../../core/types.js';
import { getComponentTypeKeyFromPath } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { matchesIgnorePattern } from './ignore.js';

/** Extracts all `## Heading` lines from content, returns lowercase heading text. */
function extractHeadings(content: string): Set<string> {
  const headings = new Set<string>();
  const lines = content.split('\n');

  for (const line of lines) {
    if (line === undefined) continue;
    // Match ## headings (level 2)
    const match = /^##\s+(.+)$/.exec(line);
    if (match?.[1]) {
      headings.add(match[1].trim().toLowerCase());
    }
  }

  return headings;
}

/**
 * Normalize a required section config value to its heading text.
 * Config values like "## Context" → "context", or just "Context" → "context".
 */
function normalizeHeading(heading: string): string {
  return heading.replace(/^#+\s*/, '').trim().toLowerCase();
}

/**
 * Check all files for missing required section headings.
 */
export function checkCompleteness(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  const { requiredSections } = config.completeness;
  if (Object.keys(requiredSections).length === 0) return [];

  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (matchesIgnorePattern(filePath, config.ignore)) continue;

    const typeResult = getComponentTypeKeyFromPath(filePath);
    if (!typeResult) continue;

    const required = requiredSections[typeResult.key];
    if (!required || required.length === 0) continue;

    const existingHeadings = extractHeadings(content);

    for (const heading of required) {
      const normalized = normalizeHeading(heading);
      if (!existingHeadings.has(normalized)) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_REQUIRED_SECTION',
          message: `Missing required section: "${heading}"`,
          file: filePath,
          suggestion: `Add a "${heading}" section to this ${typeResult.type.name} document`,
        });
      }
    }
  }

  return issues;
}
