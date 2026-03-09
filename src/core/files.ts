/**
 * Shared file collection utilities
 *
 * Provides recursive markdown file discovery used by both
 * validate and add-frontmatter commands.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Recursively collect all markdown files in a directory.
 *
 * Skips hidden directories (starting with '.') and node_modules.
 * Returns a Map of relativePath → file content.
 */
export function collectMarkdownFiles(dir: string, base: string): Map<string, string> {
  const files = new Map<string, string>();

  function walk(currentDir: string): void {
    if (!existsSync(currentDir)) {
      return;
    }

    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const relativePath = relative(base, fullPath);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules') {
          walk(fullPath);
        }
      } else if (stat.isFile() && entry.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8');
        files.set(relativePath, content);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Collect all YAML manifest files from a flat directory.
 *
 * Returns a Map of relativePath → YAML content.
 * Returns empty Map if the directory doesn't exist (graceful degradation).
 * Only reads .yaml and .yml files; skips subdirectories.
 */
export function collectManifestFiles(
  manifestDir: string,
  projectRoot: string
): Map<string, string> {
  const files = new Map<string, string>();

  if (!existsSync(manifestDir)) {
    return files;
  }

  const entries = readdirSync(manifestDir);

  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;

    const fullPath = join(manifestDir, entry);
    const stat = statSync(fullPath);
    if (!stat.isFile()) continue;

    const relativePath = relative(projectRoot, fullPath);
    const content = readFileSync(fullPath, 'utf-8');
    files.set(relativePath, content);
  }

  return files;
}
