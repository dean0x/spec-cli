/**
 * Staleness Validator
 *
 * Detects undated monetary estimates — cost figures without
 * nearby date context (within ~20 lines).
 */

import type { ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { matchesIgnorePattern } from './ignore.js';

/** Matches lines containing dollar amounts like $10, $1,500, $12.50 */
const MONETARY_PATTERN = /\$\d[\d,]*(?:\.\d{2})?/;

/** Date patterns that provide temporal context */
const DATE_CONTEXT_PATTERNS = [
  /\d{4}-\d{2}/, // 2025-01
  /\b(?:as of|updated|estimated|pricing as of|costs as of)\b/i,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i,
  /\bQ[1-4]\s+\d{4}\b/i, // Q1 2025
];

const CONTEXT_WINDOW = 20; // lines before/after to search for date context

/**
 * Checks whether any line within a window around the target contains date context.
 */
function hasDateContext(lines: string[], targetIndex: number): boolean {
  const start = Math.max(0, targetIndex - CONTEXT_WINDOW);
  const end = Math.min(lines.length - 1, targetIndex + CONTEXT_WINDOW);

  for (let i = start; i <= end; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    for (const pattern of DATE_CONTEXT_PATTERNS) {
      if (pattern.test(line)) return true;
    }
  }

  return false;
}

/**
 * Returns line indices that are inside fenced code blocks.
 */
function getCodeFenceLines(lines: string[]): Set<number> {
  const fenced = new Set<number>();
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trimStart() ?? '';
    if (trimmed.startsWith('```')) {
      fenced.add(i);
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      fenced.add(i);
    }
  }

  return fenced;
}

/**
 * Check all files for undated monetary estimates.
 * Skips code fences to avoid false positives on JSON examples.
 */
export function checkStaleness(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  if (!config.staleness.flagUndatedEstimates) return [];

  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (matchesIgnorePattern(filePath, config.ignore)) continue;

    const lines = content.split('\n');
    const codeFenceLines = getCodeFenceLines(lines);

    for (let i = 0; i < lines.length; i++) {
      if (codeFenceLines.has(i)) continue;

      const line = lines[i];
      if (line === undefined) continue;

      if (MONETARY_PATTERN.test(line) && !hasDateContext(lines, i)) {
        issues.push({
          severity: 'warning',
          code: 'UNDATED_ESTIMATE',
          message: 'Monetary value without date context',
          file: filePath,
          line: i + 1,
          suggestion: 'Add a date context (e.g., "Estimates as of 2025-01") near monetary values',
        });
      }
    }
  }

  return issues;
}
