/**
 * Link Checker
 *
 * Validates that all markdown links resolve to existing files.
 */
/**
 * Extract markdown links from content
 * Returns array of { link, line } objects
 */
export function extractMarkdownLinks(content) {
    const links = [];
    const lines = content.split('\n');
    // Match [text](link) but not images ![alt](src)
    const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
    for (let i = 0; i < lines.length; i++) {
        const lineContent = lines[i];
        if (!lineContent)
            continue;
        let match;
        while ((match = linkRegex.exec(lineContent)) !== null) {
            const linkText = match[1];
            const linkTarget = match[2];
            if (!linkTarget)
                continue;
            // Skip external links, anchors-only, and mailto
            if (linkTarget.startsWith('http://') ||
                linkTarget.startsWith('https://') ||
                linkTarget.startsWith('#') ||
                linkTarget.startsWith('mailto:')) {
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
export function resolveLinkPath(sourceFile, link) {
    // Handle absolute paths (starting with /)
    if (link.startsWith('/')) {
        return link.slice(1); // Remove leading slash
    }
    // Get directory of source file
    const sourceDir = sourceFile.substring(0, sourceFile.lastIndexOf('/'));
    // Handle relative paths
    const parts = link.split('/');
    const dirParts = sourceDir.split('/');
    for (const part of parts) {
        if (part === '..') {
            dirParts.pop();
        }
        else if (part !== '.') {
            dirParts.push(part);
        }
    }
    return dirParts.join('/');
}
/**
 * Check all links in a file against existing files
 */
export function checkFileLinks(filePath, content, existingFiles) {
    const issues = [];
    const links = extractMarkdownLinks(content);
    for (const { link, line, text } of links) {
        if (!link)
            continue;
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
export function checkAllLinks(files, existingFiles) {
    const allIssues = [];
    for (const [filePath, content] of files) {
        if (!filePath.endsWith('.md'))
            continue;
        const issues = checkFileLinks(filePath, content, existingFiles);
        allIssues.push(...issues);
    }
    return allIssues;
}
//# sourceMappingURL=link-checker.js.map