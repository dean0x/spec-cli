/**
 * Cross-Reference Validator
 *
 * Three sub-checks for cross-file consistency:
 * 1. Scope consistency — scopes used in endpoints match type definitions
 * 2. Error code uniqueness — same error code shouldn't have different descriptions
 * 3. State description consistency — same state name should have consistent descriptions
 */

import type { ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { matchesIgnorePattern } from './ignore.js';

/**
 * Filter files by ignore patterns, returning only non-ignored entries.
 */
function filterFiles(
  files: Map<string, string>,
  ignore: string[],
): Map<string, string> {
  if (ignore.length === 0) return files;

  const filtered = new Map<string, string>();
  for (const [path, content] of files) {
    if (!matchesIgnorePattern(path, ignore)) {
      filtered.set(path, content);
    }
  }
  return filtered;
}

// ---------- Scope Consistency ----------

/**
 * Extract scope definitions from TypeScript-style type declarations in docs.
 * Looks for patterns like: type ApiScope = 'read:foo' | 'write:bar'
 */
function extractScopeDefinitions(content: string): Set<string> {
  const scopes = new Set<string>();

  // Match multi-line type declarations with scope-like string literals
  const typePattern = /type\s+\w*[Ss]cope\w*\s*=\s*([^;]+)/g;
  let typeMatch: RegExpExecArray | null;

  while ((typeMatch = typePattern.exec(content)) !== null) {
    const body = typeMatch[1];
    if (!body) continue;

    // Extract individual scope strings
    const scopePattern = /'([a-z]+:[a-z_:]+)'/g;
    let scopeMatch: RegExpExecArray | null;
    while ((scopeMatch = scopePattern.exec(body)) !== null) {
      if (scopeMatch[1]) {
        scopes.add(scopeMatch[1]);
      }
    }
  }

  return scopes;
}

/**
 * Extract scopes used in API endpoint documentation tables.
 * Looks for scope references in table cells like: | read:properties |
 */
function extractScopeUsages(content: string, filePath: string): Array<{ scope: string; file: string; line: number }> {
  const usages: Array<{ scope: string; file: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Only look in table rows
    if (!line.includes('|')) continue;

    const scopePattern = /\b([a-z]+:[a-z_:]+)\b/g;
    let match: RegExpExecArray | null;
    while ((match = scopePattern.exec(line)) !== null) {
      if (match[1]) {
        usages.push({ scope: match[1], file: filePath, line: i + 1 });
      }
    }
  }

  return usages;
}

/**
 * Check that scopes used in endpoint tables are defined in scope type declarations.
 */
export function checkScopeConsistency(files: Map<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Collect all scope definitions across all files
  const definedScopes = new Set<string>();
  for (const [, content] of files) {
    for (const scope of extractScopeDefinitions(content)) {
      definedScopes.add(scope);
    }
  }

  // If no scope type definitions found, nothing to check
  if (definedScopes.size === 0) return [];

  // Collect all scope usages in tables
  const allUsages: Array<{ scope: string; file: string; line: number }> = [];
  for (const [filePath, content] of files) {
    allUsages.push(...extractScopeUsages(content, filePath));
  }

  // Flag usages not in definitions
  for (const usage of allUsages) {
    if (!definedScopes.has(usage.scope)) {
      issues.push({
        severity: 'warning',
        code: 'SCOPE_NOT_IN_TYPE',
        message: `Scope "${usage.scope}" is used but not defined in any ApiScope type`,
        file: usage.file,
        line: usage.line,
        suggestion: `Add "${usage.scope}" to the ApiScope type definition, or verify the scope name`,
      });
    }
  }

  return issues;
}

// ---------- Error Code Uniqueness ----------

interface ErrorCodeEntry {
  code: string;
  description: string;
  file: string;
  line: number;
}

/**
 * Extract error codes from markdown tables.
 * Looks for uppercase-with-underscores codes in table cells.
 */
function extractErrorCodes(content: string, filePath: string): ErrorCodeEntry[] {
  const entries: ErrorCodeEntry[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Only look in table rows (must have |)
    if (!line.includes('|')) continue;
    // Skip separator rows
    if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) continue;

    const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 2) continue;

    // Look for error code pattern in cells: UPPER_CASE_CODE
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      if (cell === undefined) continue;

      // Require at least one underscore to distinguish error codes from acronyms (HTTP, GKE, etc.)
      const codeMatch = /^([A-Z][A-Z0-9]*_[A-Z0-9_]+)$/.exec(cell);
      if (codeMatch?.[1]) {
        // The description is typically the next cell
        const description = cells[j + 1] ?? '';
        entries.push({
          code: codeMatch[1],
          description: description.trim(),
          file: filePath,
          line: i + 1,
        });
      }
    }
  }

  return entries;
}

/**
 * Check that the same error code doesn't have different descriptions across files.
 */
export function checkErrorCodeUniqueness(files: Map<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Collect all error codes across all files
  const codeMap = new Map<string, ErrorCodeEntry[]>();
  for (const [filePath, content] of files) {
    const entries = extractErrorCodes(content, filePath);
    for (const entry of entries) {
      const existing = codeMap.get(entry.code) ?? [];
      existing.push(entry);
      codeMap.set(entry.code, existing);
    }
  }

  // Check for same code with different descriptions
  for (const [code, entries] of codeMap) {
    if (entries.length < 2) continue;

    const descriptions = new Set(
      entries.map((e) => e.description.toLowerCase()).filter((d) => d.length > 0),
    );

    if (descriptions.size > 1) {
      const first = entries[0];
      if (!first) continue;

      const locations = entries
        .map((e) => `${e.file}:${e.line}`)
        .join(', ');

      issues.push({
        severity: 'warning',
        code: 'ERROR_CODE_OVERLOADED',
        message: `Error code "${code}" has different descriptions across files: ${locations}`,
        file: first.file,
        line: first.line,
        suggestion: `Namespace error codes to avoid ambiguity (e.g., "DOMAIN_${code}" vs "OTHER_${code}")`,
      });
    }
  }

  return issues;
}

// ---------- State Description Consistency ----------

interface StateEntry {
  state: string;
  description: string;
  file: string;
  line: number;
}

/**
 * Extract state/status entries from markdown tables.
 * Looks for tables with "State" or "Status" column headers.
 */
function extractStateEntries(content: string, filePath: string): StateEntry[] {
  const entries: StateEntry[] = [];
  const lines = content.split('\n');

  let stateColIndex = -1;
  let descColIndex = -1;
  let inTable = false;
  let pastSeparator = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Not a table row — reset
    if (!line.includes('|')) {
      inTable = false;
      pastSeparator = false;
      stateColIndex = -1;
      descColIndex = -1;
      continue;
    }

    const cells = line.split('|').map((c) => c.trim());

    // Check for separator row (|---|---|)
    if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) {
      if (inTable) pastSeparator = true;
      continue;
    }

    if (!inTable) {
      // This might be the header row
      inTable = true;
      pastSeparator = false;

      // Find state/status column and description column
      stateColIndex = -1;
      descColIndex = -1;

      for (let j = 0; j < cells.length; j++) {
        const cell = cells[j]?.toLowerCase() ?? '';
        if (cell === 'state' || cell === 'status') {
          stateColIndex = j;
        } else if (
          stateColIndex >= 0 &&
          descColIndex < 0 &&
          cell.length > 0 &&
          cell !== 'state' &&
          cell !== 'status'
        ) {
          // First non-state column after finding state column
          descColIndex = j;
        }
      }

      continue;
    }

    // Data row — extract if we have valid columns
    if (pastSeparator && stateColIndex >= 0 && descColIndex >= 0) {
      const state = cells[stateColIndex]?.trim() ?? '';
      const description = cells[descColIndex]?.trim() ?? '';

      if (state.length > 0 && description.length > 0) {
        entries.push({ state: state.toLowerCase(), description, file: filePath, line: i + 1 });
      }
    }
  }

  return entries;
}

/**
 * Check that the same state name has consistent descriptions across files.
 */
export function checkStateConsistency(files: Map<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Collect all state entries across all files
  const stateMap = new Map<string, StateEntry[]>();
  for (const [filePath, content] of files) {
    const entries = extractStateEntries(content, filePath);
    for (const entry of entries) {
      const existing = stateMap.get(entry.state) ?? [];
      existing.push(entry);
      stateMap.set(entry.state, existing);
    }
  }

  // Check for same state with different descriptions (across different files)
  for (const [state, entries] of stateMap) {
    // Only compare across different files
    const byFile = new Map<string, StateEntry>();
    for (const entry of entries) {
      if (!byFile.has(entry.file)) {
        byFile.set(entry.file, entry);
      }
    }

    if (byFile.size < 2) continue;

    const descriptions = new Set(
      Array.from(byFile.values()).map((e) => e.description.toLowerCase()),
    );

    if (descriptions.size > 1) {
      const first = entries[0];
      if (!first) continue;

      const locations = Array.from(byFile.values())
        .map((e) => `${e.file}:${e.line}`)
        .join(', ');

      issues.push({
        severity: 'warning',
        code: 'STATE_DESCRIPTION_CONFLICT',
        message: `State "${state}" has conflicting descriptions across files: ${locations}`,
        file: first.file,
        line: first.line,
        suggestion: `Ensure "${state}" is described consistently across all documents`,
      });
    }
  }

  return issues;
}

// ---------- Orchestrator ----------

/**
 * Run all cross-reference checks based on config.
 */
export function checkCrossReferences(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  const filtered = filterFiles(files, config.ignore);
  const issues: ValidationIssue[] = [];

  if (config.crossReference.scopeConsistency) {
    issues.push(...checkScopeConsistency(filtered));
  }

  if (config.crossReference.errorCodeUniqueness) {
    issues.push(...checkErrorCodeUniqueness(filtered));
  }

  if (config.crossReference.stateConsistency) {
    issues.push(...checkStateConsistency(filtered));
  }

  return issues;
}
