/**
 * Orphan Detector
 *
 * Finds documents that are not referenced from any index or other document.
 */
import { extractMarkdownLinks, resolveLinkPath } from './link-checker.js';
/**
 * Build a set of all files that are referenced by other files
 */
export function buildReferenceSet(files) {
    const referenced = new Set();
    for (const [filePath, content] of files) {
        if (!filePath.endsWith('.md'))
            continue;
        const links = extractMarkdownLinks(content);
        for (const { link } of links) {
            if (!link)
                continue;
            const resolvedPath = resolveLinkPath(filePath, link);
            // Add possible variations
            referenced.add(resolvedPath);
            referenced.add(`${resolvedPath}.md`);
            referenced.add(`${resolvedPath}/index.md`);
            referenced.add(`${resolvedPath}/README.md`);
            // Also handle if link already has .md extension
            if (resolvedPath.endsWith('.md')) {
                referenced.add(resolvedPath.slice(0, -3));
            }
        }
    }
    return referenced;
}
/**
 * Index files that should not be flagged as orphans
 */
const INDEX_FILE_PATTERNS = [
    /index\.md$/,
    /README\.md$/,
    /CLAUDE\.md$/,
    /FRAMEWORK\.md$/,
    /CHANGELOG\.md$/,
];
/**
 * Root-level files that are entry points (not orphans)
 */
const ENTRY_POINT_PATTERNS = [
    /^docs\/index\.md$/,
    /^docs\/FRAMEWORK\.md$/,
    /^docs\/[^/]+\.md$/, // Top-level docs files are entry points
];
/**
 * Check if a file is an index/entry point that shouldn't be flagged
 */
export function isIndexOrEntryPoint(filePath) {
    // Check index patterns
    for (const pattern of INDEX_FILE_PATTERNS) {
        if (pattern.test(filePath))
            return true;
    }
    // Check entry point patterns
    for (const pattern of ENTRY_POINT_PATTERNS) {
        if (pattern.test(filePath))
            return true;
    }
    return false;
}
/**
 * Find all orphan documents (not referenced by anything)
 */
export function findOrphans(files) {
    const issues = [];
    const referenced = buildReferenceSet(files);
    for (const [filePath] of files) {
        if (!filePath.endsWith('.md'))
            continue;
        // Skip index files and entry points
        if (isIndexOrEntryPoint(filePath))
            continue;
        // Skip files outside docs/
        if (!filePath.startsWith('docs/'))
            continue;
        // Check if file is referenced anywhere
        const isReferenced = referenced.has(filePath) ||
            referenced.has(filePath.replace(/\.md$/, '')) ||
            referenced.has(filePath.replace(/\/index\.md$/, ''));
        if (!isReferenced) {
            issues.push({
                severity: 'warning',
                code: 'ORPHAN_DOCUMENT',
                message: 'Document is not referenced by any other document or index',
                file: filePath,
                suggestion: 'Add a link to this document from a relevant index or parent document',
            });
        }
    }
    return issues;
}
/**
 * Find documents that reference themselves (circular self-reference)
 */
export function findSelfReferences(files) {
    const issues = [];
    for (const [filePath, content] of files) {
        if (!filePath.endsWith('.md'))
            continue;
        const links = extractMarkdownLinks(content);
        for (const { link, line, text } of links) {
            if (!link)
                continue;
            const resolvedPath = resolveLinkPath(filePath, link);
            // Check if link points to the same file
            const normalizedTarget = resolvedPath.replace(/\.md$/, '');
            const normalizedSource = filePath.replace(/\.md$/, '');
            if (normalizedTarget === normalizedSource) {
                issues.push({
                    severity: 'warning',
                    code: 'SELF_REFERENCE',
                    message: `Document references itself: [${text}](${link})`,
                    file: filePath,
                    line,
                    suggestion: 'Remove self-reference or update to reference a different document',
                });
            }
        }
    }
    return issues;
}
/**
 * Generate orphan statistics
 */
export function generateOrphanStats(files) {
    const referenced = buildReferenceSet(files);
    let total = 0;
    let orphanCount = 0;
    for (const [filePath] of files) {
        if (!filePath.endsWith('.md'))
            continue;
        if (!filePath.startsWith('docs/'))
            continue;
        if (isIndexOrEntryPoint(filePath))
            continue;
        total++;
        const isReferenced = referenced.has(filePath) ||
            referenced.has(filePath.replace(/\.md$/, '')) ||
            referenced.has(filePath.replace(/\/index\.md$/, ''));
        if (!isReferenced) {
            orphanCount++;
        }
    }
    return {
        total,
        orphans: orphanCount,
        referenced: total - orphanCount,
    };
}
//# sourceMappingURL=orphan-detector.js.map