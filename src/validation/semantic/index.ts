/**
 * Semantic Validation Entry Point
 *
 * Orchestrates all semantic validation checks:
 * - Terminology glossary enforcement
 * - Staleness detection (undated estimates)
 * - Completeness (required section headings)
 * - Cross-reference consistency (scopes, error codes, states)
 *
 * Semantic issues are always advisory — they never fail validation.
 */

import type { ValidationResult, ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { checkTerminology } from './terminology.js';
import { checkStaleness } from './staleness.js';
import { checkCompleteness } from './completeness.js';
import { checkCrossReferences } from './cross-reference.js';
import { checkDependencyHealth } from './dependency-health.js';
import { checkDomainCoupling } from './domain-coupling.js';

/**
 * Run all semantic validations on a set of files.
 *
 * Returns `valid: true` always — semantic issues are advisory.
 */
export function validateSemantics(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  allIssues.push(...checkTerminology(files, config));
  allIssues.push(...checkStaleness(files, config));
  allIssues.push(...checkCompleteness(files, config));
  allIssues.push(...checkCrossReferences(files, config));
  allIssues.push(...checkDependencyHealth(files, config));
  allIssues.push(...checkDomainCoupling(files, config));

  const warnings = allIssues.filter((i) => i.severity === 'warning').length;
  const errors = allIssues.filter((i) => i.severity === 'error').length;

  return {
    valid: true, // Semantic issues are advisory — never fail
    issues: allIssues,
    stats: {
      filesChecked: files.size,
      errors,
      warnings,
    },
  };
}

/**
 * Format semantic validation result for CLI output.
 */
export function formatSemanticResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  SEMANTIC VALIDATION (Advisory)');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');

  lines.push(`  Warnings: ${result.stats.warnings}`);
  lines.push('');

  if (result.issues.length === 0) {
    lines.push('  No semantic issues found.');
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    return lines.join('\n');
  }

  // Group issues by code
  const issuesByCode = new Map<string, ValidationIssue[]>();
  for (const issue of result.issues) {
    const existing = issuesByCode.get(issue.code) ?? [];
    existing.push(issue);
    issuesByCode.set(issue.code, existing);
  }

  for (const [code, codeIssues] of issuesByCode) {
    lines.push(`  [${code}] (${codeIssues.length} issue${codeIssues.length === 1 ? '' : 's'})`);

    for (const issue of codeIssues) {
      const lineRef = issue.line ? `:${issue.line}` : '';
      lines.push(`    ⚠ ${issue.file}${lineRef}`);
      lines.push(`      ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`      → ${issue.suggestion}`);
      }
    }
    lines.push('');
  }

  lines.push('───────────────────────────────────────────────────────────────');

  return lines.join('\n');
}

// Re-export everything for direct use
export { loadSemanticConfig, defaultSemanticConfig } from './config.js';
export type { SemanticConfig } from './config.js';
export { checkTerminology } from './terminology.js';
export { checkStaleness } from './staleness.js';
export { checkCompleteness } from './completeness.js';
export {
  checkCrossReferences,
  checkScopeConsistency,
  checkErrorCodeUniqueness,
  checkStateConsistency,
} from './cross-reference.js';
export { checkDependencyHealth } from './dependency-health.js';
export { checkDomainCoupling } from './domain-coupling.js';
export { matchesIgnorePattern } from './ignore.js';
