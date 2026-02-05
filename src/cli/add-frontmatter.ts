/**
 * spec-cli add-frontmatter command
 *
 * Adds YAML frontmatter to markdown files that are missing it.
 * Dry-run by default — use --write to apply changes.
 *
 * Smart extraction: scans body text for existing metadata
 * (Status, Date, Priority) before falling back to defaults.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { resolveSpecCliPaths } from '../core/paths.js';
import { collectMarkdownFiles } from '../core/files.js';
import { getComponentTypeKeyFromPath } from '../core/types.js';
import { parseFrontmatter, REQUIRED_FRONTMATTER } from '../validation/structural/frontmatter.js';

const HELP_TEXT = `
spec-cli add-frontmatter - Add YAML frontmatter to markdown files

Usage:
  spec-cli add-frontmatter [options]

Options:
  --write         Apply changes (dry-run by default)
  --filter=TYPE   Only process files of this component type
  --json          Output as JSON
  --help, -h      Show this help message

Examples:
  spec-cli add-frontmatter                 # Preview what would be added
  spec-cli add-frontmatter --write         # Apply frontmatter to files
  spec-cli add-frontmatter --filter=schema # Only process schema files
`;

interface AddFrontmatterOptions {
  write: boolean;
  filter: string | null;
  json: boolean;
  help: boolean;
}

export interface FrontmatterFields {
  title: string;
  status?: string;
  date?: string;
  domain?: string;
  version?: string;
}

export interface FileResult {
  file: string;
  componentType: string;
  fields: FrontmatterFields;
  skipped: boolean;
  skipReason?: string;
}

function parseArgs(args: string[]): AddFrontmatterOptions {
  let filter: string | null = null;
  for (const arg of args) {
    if (arg.startsWith('--filter=')) {
      filter = arg.slice('--filter='.length);
    }
  }

  return {
    write: args.includes('--write'),
    filter,
    json: args.includes('--json'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

/**
 * Extract title from first heading, or humanize the filename.
 */
export function extractTitle(content: string, filePath: string): string {
  const headingMatch = /^#\s+(.+)$/m.exec(content);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  // Fallback: humanize filename
  const name = basename(filePath, '.md');
  if (name === 'index') {
    // Use parent directory name for index files
    const parent = basename(dirname(filePath));
    return humanize(parent);
  }
  return humanize(name);
}

/**
 * Extract status from body text patterns like **Status:** Accepted
 */
export function extractStatusFromBody(content: string): string {
  const statusMatch = /\*\*Status:\*\*\s*(.+)/i.exec(content);
  if (statusMatch?.[1]) {
    return statusMatch[1].trim().toLowerCase();
  }
  return 'draft';
}

/**
 * Extract date from body text patterns like **Date:** 2024-01-03
 */
export function extractDateFromBody(content: string): string {
  const dateMatch = /\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(content);
  if (dateMatch?.[1]) {
    return dateMatch[1];
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Infer domain from file path.
 * docs/schemas/billing.md → billing
 * docs/domains/notifications/overview.md → notifications
 */
export function inferDomain(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');

  // docs/schemas/<name>.md
  const schemaMatch = /^docs\/schemas\/([^/]+)\.md$/.exec(normalized);
  if (schemaMatch?.[1] && schemaMatch[1] !== 'index') {
    return schemaMatch[1];
  }

  // docs/domains/<name>/... → domain name
  const domainMatch = /^docs\/domains\/([^/]+)/.exec(normalized);
  if (domainMatch?.[1]) {
    return domainMatch[1];
  }

  return null;
}

/**
 * Generate frontmatter fields for a file based on its component type.
 */
export function generateFrontmatter(
  content: string,
  filePath: string,
  componentTypeKey: string
): FrontmatterFields {
  const requiredFields = REQUIRED_FRONTMATTER[componentTypeKey] ?? [];
  const fields: FrontmatterFields = {
    title: extractTitle(content, filePath),
  };

  if (requiredFields.includes('status')) {
    fields.status = extractStatusFromBody(content);
  }

  if (requiredFields.includes('date')) {
    fields.date = extractDateFromBody(content);
  }

  if (requiredFields.includes('domain')) {
    const domain = inferDomain(filePath);
    if (domain) {
      fields.domain = domain;
    }
  }

  if (requiredFields.includes('version')) {
    fields.version = '1.0';
  }

  return fields;
}

/**
 * Serialize frontmatter fields to a YAML block.
 */
export function serializeFrontmatter(fields: FrontmatterFields): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      continue;
    }
    lines.push(`${key}: ${quoteIfNeeded(String(value))}`);
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Quote YAML values that contain special characters.
 */
function quoteIfNeeded(value: string): string {
  // Quote if contains colons, hashes, brackets, or starts with special chars
  if (/[:#\[\]{}|>&*!?@`]/.test(value) || /^['"]/.test(value) || value === '') {
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return value;
}

function humanize(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Process all files and return results.
 */
export function processFiles(
  files: Map<string, string>,
  filter: string | null
): FileResult[] {
  const results: FileResult[] = [];

  for (const [filePath, content] of files) {
    const typeResult = getComponentTypeKeyFromPath(filePath);

    if (!typeResult) {
      results.push({
        file: filePath,
        componentType: 'unknown',
        fields: { title: '' },
        skipped: true,
        skipReason: 'no matching component type',
      });
      continue;
    }

    if (filter && typeResult.key !== filter) {
      continue;
    }

    const requiredFields = REQUIRED_FRONTMATTER[typeResult.key];
    if (!requiredFields || requiredFields.length === 0) {
      results.push({
        file: filePath,
        componentType: typeResult.key,
        fields: { title: '' },
        skipped: true,
        skipReason: 'no required frontmatter for this type',
      });
      continue;
    }

    const { frontmatter } = parseFrontmatter(content);
    if (frontmatter !== null) {
      results.push({
        file: filePath,
        componentType: typeResult.key,
        fields: { title: '' },
        skipped: true,
        skipReason: 'already has frontmatter',
      });
      continue;
    }

    const fields = generateFrontmatter(content, filePath, typeResult.key);

    results.push({
      file: filePath,
      componentType: typeResult.key,
      fields,
      skipped: false,
    });
  }

  return results;
}

/**
 * Apply frontmatter to a file by prepending the YAML block.
 */
function applyFrontmatter(
  projectRoot: string,
  filePath: string,
  fields: FrontmatterFields
): void {
  const fullPath = join(projectRoot, filePath);
  const content = readFileSync(fullPath, 'utf-8');
  const yaml = serializeFrontmatter(fields);
  writeFileSync(fullPath, `${yaml}\n${content}`, 'utf-8');
}


/**
 * Format results for CLI output (dry-run mode).
 */
function formatDryRun(results: FileResult[], totalFiles: number): string {
  const lines: string[] = [];
  const skippedWithFrontmatter = results.filter(
    (r) => r.skipped && r.skipReason === 'already has frontmatter'
  ).length;
  const toProcess = results.filter((r) => !r.skipped);

  lines.push(`Found ${totalFiles} markdown files`);
  lines.push(`  ${skippedWithFrontmatter} already have frontmatter (skipped)`);
  lines.push(`  ${toProcess.length} missing frontmatter`);
  lines.push('');

  for (const result of toProcess) {
    lines.push(`  ${result.file} (${result.componentType})`);
    for (const [key, value] of Object.entries(result.fields)) {
      if (value === undefined || value === null) continue;
      const extracted = isExtracted(key, result.fields);
      const suffix = extracted ? '    \u2190 extracted from body' : '';
      lines.push(`    + ${key}: ${value}${suffix}`);
    }
    lines.push('');
  }

  if (toProcess.length > 0) {
    lines.push('Dry run. Use --write to apply.');
  } else {
    lines.push('Nothing to do — all files have frontmatter.');
  }

  return lines.join('\n');
}

/**
 * Check if a field value was extracted from body (not a default).
 */
function isExtracted(key: string, fields: FrontmatterFields): boolean {
  if (key === 'status' && fields.status !== 'draft') return true;
  if (key === 'date') {
    const today = new Date().toISOString().slice(0, 10);
    if (fields.date !== today) return true;
  }
  return false;
}

/**
 * Format results for --write mode.
 */
function formatWriteResult(results: FileResult[]): string {
  const processed = results.filter((r) => !r.skipped);
  const lines: string[] = [];

  for (const result of processed) {
    lines.push(`  \u2713 ${result.file} (${result.componentType})`);
  }

  lines.push('');
  lines.push(`Added frontmatter to ${processed.length} files.`);
  return lines.join('\n');
}

export async function runAddFrontmatter(args: string[]): Promise<void> {
  const options = parseArgs(args);

  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  const pathsResult = resolveSpecCliPaths();
  if (!pathsResult.ok) {
    console.error(`Error resolving paths: ${pathsResult.error}`);
    process.exit(1);
  }

  const { docsRoot, projectRoot } = pathsResult.value;

  if (!existsSync(docsRoot)) {
    console.error(`Docs directory not found: ${docsRoot}`);
    process.exit(1);
  }

  const files = collectMarkdownFiles(docsRoot, projectRoot);
  const results = processFiles(files, options.filter);

  if (options.json) {
    console.log(JSON.stringify(results.filter((r) => !r.skipped), null, 2));
    return;
  }

  if (!options.write) {
    console.log(formatDryRun(results, files.size));
    return;
  }

  // Write mode — apply frontmatter
  const toProcess = results.filter((r) => !r.skipped);

  for (const result of toProcess) {
    applyFrontmatter(projectRoot, result.file, result.fields);
  }

  console.log(formatWriteResult(results));
}
