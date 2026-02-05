/**
 * Link Checker
 *
 * Validates that all markdown links resolve to existing files.
 */
import type { ValidationIssue } from '../../core/types.js';
/**
 * Extract markdown links from content
 * Returns array of { link, line } objects
 */
export declare function extractMarkdownLinks(content: string): Array<{
    link: string;
    line: number;
    text: string;
}>;
/**
 * Resolve a relative link from a source file path
 */
export declare function resolveLinkPath(sourceFile: string, link: string): string;
/**
 * Check all links in a file against existing files
 */
export declare function checkFileLinks(filePath: string, content: string, existingFiles: Set<string>): ValidationIssue[];
/**
 * Batch check all files for broken links
 */
export declare function checkAllLinks(files: Map<string, string>, existingFiles: Set<string>): ValidationIssue[];
//# sourceMappingURL=link-checker.d.ts.map