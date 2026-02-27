/**
 * Placeholder Marker Checker
 *
 * Detects TBD/TODO/FIXME/HACK/PLACEHOLDER as whole words outside
 * code fences and YAML frontmatter. Advisory — never fails validation.
 */

import type { ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { getNonProseLines } from './prose.js';
import { matchesIgnorePattern } from './ignore.js';

const DEFAULT_MARKERS = ['TBD', 'TODO', 'FIXME', 'HACK', 'PLACEHOLDER'];

/**
 * Check all files for placeholder markers outside code fences and frontmatter.
 */
export function checkPlaceholders(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  const placeholderConfig = config.placeholders;

  // If config section is absent or disabled, return empty
  if (!placeholderConfig || !placeholderConfig.enabled) return [];

  const markers = placeholderConfig.markers.length > 0
    ? placeholderConfig.markers
    : DEFAULT_MARKERS;

  // Build a single regex matching all markers as whole words, case-insensitive
  const escaped = markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (matchesIgnorePattern(filePath, config.ignore)) continue;

    const lines = content.split('\n');
    const nonProseLines = getNonProseLines(lines);

    for (let i = 0; i < lines.length; i++) {
      if (nonProseLines.has(i)) continue;

      const line = lines[i];
      if (line === undefined) continue;

      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const marker = match[1] ?? match[0];
        issues.push({
          severity: 'warning',
          code: 'PLACEHOLDER_MARKER',
          message: `Found placeholder marker "${marker}"`,
          file: filePath,
          line: i + 1,
          suggestion: `Replace "${marker}" with actual content before finalizing`,
        });
      }
    }
  }

  return issues;
}
