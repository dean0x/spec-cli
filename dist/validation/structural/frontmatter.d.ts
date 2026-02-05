/**
 * Frontmatter Validator
 *
 * Validates YAML frontmatter in markdown files against component-type schemas.
 */
import type { ValidationIssue } from '../../core/types.js';
/**
 * Parse YAML frontmatter from markdown content
 */
export declare function parseFrontmatter(content: string): {
    frontmatter: Record<string, unknown> | null;
    bodyStart: number;
};
/**
 * Required frontmatter fields by component type
 */
export declare const REQUIRED_FRONTMATTER: Record<string, string[]>;
/**
 * Optional but recommended frontmatter fields
 */
export declare const RECOMMENDED_FRONTMATTER: Record<string, string[]>;
/**
 * Validate frontmatter against component type requirements
 */
export declare function validateFrontmatter(filePath: string, content: string, componentType: string): ValidationIssue[];
/**
 * Check if file has any frontmatter
 */
export declare function hasFrontmatter(content: string): boolean;
//# sourceMappingURL=frontmatter.d.ts.map