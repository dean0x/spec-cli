/**
 * Link Checker
 *
 * Validates that all markdown links resolve to existing files.
 */

import { posix } from 'node:path';
import type { ValidationIssue } from '../../core/types.js';

/**
 * Extract markdown links from content
 * Returns array of { link, line } objects
 */
export function extractMarkdownLinks(
  content: string
): Array<{ link: string; line: number; text: string }> {
  const links: Array<{ link: string; line: number; text: string }> = [];
  const lines = content.split('\n');

  // Match [text](link) but not images ![alt](src)
  const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    if (!lineContent) continue;

    let match;
    while ((match = linkRegex.exec(lineContent)) !== null) {
      const linkText = match[1];
      const linkTarget = match[2];

      if (!linkTarget) continue;

      // Skip external links, anchors-only, and mailto
      if (
        linkTarget.startsWith('http://') ||
        linkTarget.startsWith('https://') ||
        linkTarget.startsWith('#') ||
        linkTarget.startsWith('mailto:')
      ) {
        continue;
      }

      const linkWithoutAnchor = linkTarget.split('#')[0] ?? '';
      links.push({
        text: linkText ?? '',
        link: linkWithoutAnchor,
        line: i + 1, // 1-indexed
      });
    }
  }

  return links;
}

/**
 * Resolve a relative link from a source file path
 */
export function resolveLinkPath(sourceFile: string, link: string): string {
  const sourceDir = posix.dirname(sourceFile);
  const resolved = link.startsWith('/')
    ? link.slice(1) // absolute: relative to docs root
    : posix.join(sourceDir, link); // relative: resolve from source dir

  // Normalize (.., ., double slashes) and strip trailing slash
  return posix.normalize(resolved).replace(/\/$/, '');
}

/**
 * Check all links in a file against existing files
 */
export function checkFileLinks(
  filePath: string,
  content: string,
  existingFiles: Set<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const links = extractMarkdownLinks(content);

  for (const { link, line, text } of links) {
    if (!link) continue;

    const resolvedPath = resolveLinkPath(filePath, link);

    // Check if file exists (with or without extension variations)
    const pathsToCheck = [
      resolvedPath,
      `${resolvedPath}.md`,
      `${resolvedPath}/index.md`,
      `${resolvedPath}/README.md`,
    ];

    const exists = pathsToCheck.some((p) => existingFiles.has(p));

    if (!exists) {
      issues.push({
        severity: 'error',
        code: 'BROKEN_LINK',
        message: `Broken link: [${text}](${link}) - target does not exist`,
        file: filePath,
        line,
        suggestion: `Check if "${resolvedPath}" exists or update the link`,
      });
    }
  }

  return issues;
}

/**
 * Batch check all files for broken links
 */
export function checkAllLinks(
  files: Map<string, string>,
  existingFiles: Set<string>
): ValidationIssue[] {
  const allIssues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (!filePath.endsWith('.md')) continue;

    const issues = checkFileLinks(filePath, content, existingFiles);
    allIssues.push(...issues);
  }

  return allIssues;
}
