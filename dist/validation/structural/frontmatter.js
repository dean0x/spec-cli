/**
 * Frontmatter Validator
 *
 * Validates YAML frontmatter in markdown files against component-type schemas.
 */
/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content) {
    const lines = content.split('\n');
    // Check for frontmatter delimiter
    if (lines[0]?.trim() !== '---') {
        return { frontmatter: null, bodyStart: 0 };
    }
    // Find closing delimiter
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === '---') {
            endIndex = i;
            break;
        }
    }
    if (endIndex === -1) {
        return { frontmatter: null, bodyStart: 0 };
    }
    // Parse YAML content (simplified parser)
    const yamlLines = lines.slice(1, endIndex);
    const frontmatter = {};
    for (const line of yamlLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            // Handle common YAML types
            if (value === 'true')
                value = true;
            else if (value === 'false')
                value = false;
            else if (/^\d+$/.test(value))
                value = parseInt(value, 10);
            else if (value === '')
                value = null;
            // Handle quoted strings
            else if (typeof value === 'string' &&
                ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'")))) {
                value = value.slice(1, -1);
            }
            frontmatter[key] = value;
        }
    }
    return { frontmatter, bodyStart: endIndex + 1 };
}
/**
 * Required frontmatter fields by component type
 */
export const REQUIRED_FRONTMATTER = {
    schema: ['title', 'domain'],
    pattern: ['title', 'status'],
    decision: ['title', 'status', 'date'],
    domain: ['title'],
    'domain-topic': ['title'],
    feature: ['title', 'status'],
    product: ['title'],
    api: ['title', 'version'],
};
/**
 * Optional but recommended frontmatter fields
 */
export const RECOMMENDED_FRONTMATTER = {
    schema: ['description', 'version'],
    pattern: ['description', 'related'],
    decision: ['deciders', 'supersedes'],
    feature: ['priority', 'dependencies'],
};
/**
 * Validate frontmatter against component type requirements
 */
export function validateFrontmatter(filePath, content, componentType) {
    const issues = [];
    const { frontmatter } = parseFrontmatter(content);
    const required = REQUIRED_FRONTMATTER[componentType] || [];
    const recommended = RECOMMENDED_FRONTMATTER[componentType] || [];
    // Check for missing frontmatter when required
    if (required.length > 0 && !frontmatter) {
        issues.push({
            severity: 'warning',
            code: 'MISSING_FRONTMATTER',
            message: `Missing frontmatter. ${componentType} components should have: ${required.join(', ')}`,
            file: filePath,
            line: 1,
            suggestion: `Add YAML frontmatter at the start of the file with: ${required.join(', ')}`,
        });
        return issues;
    }
    if (!frontmatter) {
        return issues;
    }
    // Check required fields
    for (const field of required) {
        if (!(field in frontmatter) || frontmatter[field] === null) {
            issues.push({
                severity: 'error',
                code: 'MISSING_REQUIRED_FIELD',
                message: `Missing required frontmatter field: ${field}`,
                file: filePath,
                line: 1,
                suggestion: `Add "${field}:" to the frontmatter`,
            });
        }
    }
    // Check recommended fields (warnings only)
    for (const field of recommended) {
        if (!(field in frontmatter)) {
            issues.push({
                severity: 'warning',
                code: 'MISSING_RECOMMENDED_FIELD',
                message: `Missing recommended frontmatter field: ${field}`,
                file: filePath,
                line: 1,
                suggestion: `Consider adding "${field}:" to the frontmatter`,
            });
        }
    }
    // Validate specific field values
    if (frontmatter.status) {
        const validStatuses = ['draft', 'active', 'deprecated', 'superseded', 'proposed', 'accepted', 'rejected'];
        if (!validStatuses.includes(frontmatter.status)) {
            issues.push({
                severity: 'warning',
                code: 'INVALID_STATUS',
                message: `Unusual status value: ${frontmatter.status}. Common values: ${validStatuses.join(', ')}`,
                file: filePath,
                line: 1,
            });
        }
    }
    return issues;
}
/**
 * Check if file has any frontmatter
 */
export function hasFrontmatter(content) {
    return content.trim().startsWith('---');
}
//# sourceMappingURL=frontmatter.js.map