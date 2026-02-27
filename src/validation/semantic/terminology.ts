/**
 * Terminology Validator
 *
 * Enforces glossary-defined preferred terms by flagging synonym usage.
 * Skips code fences and files matching ignore patterns.
 */

import type { ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { getNonProseLines } from './prose.js';
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
 * Check all files for terminology inconsistencies based on glossary config.
 */
export function checkTerminology(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  const { glossary, allowedContexts } = config.terminology;
  const rules = buildSynonymRules(glossary);

  if (rules.length === 0) return [];

  const lowerContexts = allowedContexts.map((c) => c.toLowerCase());
  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (matchesIgnorePattern(filePath, config.ignore)) continue;

    const lines = content.split('\n');
    const codeFenceLines = getNonProseLines(lines);

    for (let i = 0; i < lines.length; i++) {
      if (codeFenceLines.has(i)) continue;

      const line = lines[i];
      if (line === undefined) continue;

      // Strip markdown link targets to avoid matching file paths
      const lineForMatching = line.replace(/\]\([^)]*\)/g, '](…)');
      const lowerLine = line.toLowerCase();

      for (const rule of rules) {
        // Reset lastIndex since we reuse the regex with 'g' flag
        rule.pattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = rule.pattern.exec(lineForMatching)) !== null) {
          if (lowerContexts.some((ctx) => lowerLine.includes(ctx))) continue;

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
