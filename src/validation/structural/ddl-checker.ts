/**
 * DDL Duplication Checker
 *
 * Detects CREATE TABLE statements appearing in multiple files.
 * Schema files (docs/schemas/*) are canonical — other files are flagged
 * when they duplicate a table that has a canonical definition.
 */

import type { ValidationIssue } from '../../core/types.js';

interface TableOccurrence {
  file: string;
  line: number;
  isCanonical: boolean;
}

const CREATE_TABLE_REGEX = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\w+\.)?(\w+)/gi;

/**
 * Check if a file path is a canonical schema file.
 */
function isSchemaFile(filePath: string): boolean {
  return filePath.startsWith('docs/schemas/');
}

/**
 * Extract table names and their line numbers from file content.
 */
export function extractTableNames(content: string): Array<{ tableName: string; line: number }> {
  const results: Array<{ tableName: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    CREATE_TABLE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CREATE_TABLE_REGEX.exec(line)) !== null) {
      const tableName = match[1];
      if (tableName !== undefined) {
        results.push({ tableName, line: i + 1 });
      }
    }
  }

  return results;
}

/**
 * Check all files for DDL duplication.
 *
 * Builds a map of table names to their occurrences, then flags non-schema
 * files when the same table has a canonical definition in a schema file.
 */
export function checkDdlDuplication(files: Map<string, string>): ValidationIssue[] {
  const tableMap = new Map<string, TableOccurrence[]>();

  // Build occurrence map
  for (const [filePath, content] of files) {
    if (!filePath.endsWith('.md')) continue;

    const tables = extractTableNames(content);
    const canonical = isSchemaFile(filePath);

    for (const { tableName, line } of tables) {
      const key = tableName.toLowerCase();
      const existing = tableMap.get(key) ?? [];
      existing.push({ file: filePath, line, isCanonical: canonical });
      tableMap.set(key, existing);
    }
  }

  // Flag non-schema duplicates where a canonical definition exists
  const issues: ValidationIssue[] = [];

  for (const [tableName, occurrences] of tableMap) {
    const hasCanonical = occurrences.some((o) => o.isCanonical);
    if (!hasCanonical) continue;

    const nonCanonical = occurrences.filter((o) => !o.isCanonical);
    for (const occurrence of nonCanonical) {
      issues.push({
        severity: 'warning',
        code: 'DUPLICATE_DDL',
        message: `CREATE TABLE "${tableName}" duplicates canonical definition in docs/schemas/`,
        file: occurrence.file,
        line: occurrence.line,
        suggestion: `Remove duplicated DDL and link to the canonical schema file instead`,
      });
    }
  }

  return issues;
}
