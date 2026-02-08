/**
 * Terminology Validator
 *
 * Enforces glossary-defined preferred terms by flagging synonym usage.
 * Skips code fences and files matching ignore patterns.
 */

import type { ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { matchesIgnorePattern } from './ignore.js';

interface SynonymRule {
  preferred: string;
  pattern: RegExp;
  synonyms: string[];
}

/**
 * Build word-boundary regexes for each glossary entry.
 * Groups all synonyms into a single alternation for efficiency.
 */
function buildSynonymRules(glossary: Record<string, string[]>): SynonymRule[] {
  const rules: SynonymRule[] = [];

  for (const [preferred, synonyms] of Object.entries(glossary)) {
    if (synonyms.length === 0) continue;

    // Escape regex special chars in each synonym, join with alternation
    const escaped = synonyms.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    rules.push({ preferred, pattern, synonyms });
  }

  return rules;
}

/**
 * Returns line indices that are inside fenced code blocks.
 * A fenced code block starts with ``` and ends with ```.
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
 * Check all files for terminology inconsistencies based on glossary config.
 */
export function checkTerminology(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  const { glossary } = config.terminology;
  const rules = buildSynonymRules(glossary);

  if (rules.length === 0) return [];

  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (matchesIgnorePattern(filePath, config.ignore)) continue;

    const lines = content.split('\n');
    const codeFenceLines = getCodeFenceLines(lines);

    for (let i = 0; i < lines.length; i++) {
      if (codeFenceLines.has(i)) continue;

      const line = lines[i];
      if (line === undefined) continue;

      for (const rule of rules) {
        // Reset lastIndex since we reuse the regex with 'g' flag
        rule.pattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = rule.pattern.exec(line)) !== null) {
          const matchedWord = match[1] ?? match[0];
          issues.push({
            severity: 'warning',
            code: 'TERMINOLOGY_INCONSISTENCY',
            message: `Found "${matchedWord}" — preferred term is "${rule.preferred}"`,
            file: filePath,
            line: i + 1,
            suggestion: `Consider using "${rule.preferred}" instead of "${matchedWord}"`,
          });
        }
      }
    }
  }

  return issues;
}
