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
 * Returns line indices that are inside fenced code blocks or YAML frontmatter.
 * Code fences start/end with ```. Frontmatter is a `---` block at line 0.
 */
function getNonProseLines(lines: string[]): Set<number> {
  const excluded = new Set<number>();

  // Frontmatter: must start at line 0 with `---`
  if (lines[0]?.trimEnd() === '---') {
    excluded.add(0);
    for (let i = 1; i < lines.length; i++) {
      excluded.add(i);
      if (lines[i]?.trimEnd() === '---') break;
    }
  }

  // Code fences
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (excluded.has(i)) continue;
    const trimmed = lines[i]?.trimStart() ?? '';
    if (trimmed.startsWith('```')) {
      excluded.add(i);
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      excluded.add(i);
    }
  }

  return excluded;
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
