/**
 * Template operations for component creation
 *
 * Handles loading, parsing, and applying templates for the 16 component types.
 * Templates use mustache-style {{variable}} placeholders.
 */
import { type ComponentType } from './types.js';
/**
 * Template variable definition
 */
export interface TemplateVariable {
    name: string;
    required: boolean;
    description: string;
    defaultValue?: string | undefined;
}
/**
 * Parsed template with metadata
 */
export interface ParsedTemplate {
    componentType: string;
    content: string;
    variables: TemplateVariable[];
    frontmatterFields: string[];
}
/**
 * Template application context
 */
export interface TemplateContext {
    name: string;
    description?: string;
    date?: string;
    [key: string]: string | undefined;
}
/**
 * Result type for template operations
 */
export type TemplateResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
};
/**
 * Common variables used across templates
 */
export declare const COMMON_VARIABLES: TemplateVariable[];
/**
 * Type-specific variables
 */
export declare const TYPE_VARIABLES: Record<string, TemplateVariable[]>;
/**
 * Get all variables for a component type
 */
export declare function getTemplateVariables(componentType: string): TemplateVariable[];
/**
 * Extract variables from template content
 */
export declare function extractTemplateVariables(content: string): string[];
/**
 * Apply context to template, replacing {{variables}}
 */
export declare function applyTemplate(template: string, context: TemplateContext): TemplateResult<string>;
/**
 * Validate that a component type is valid
 */
export declare function isValidComponentType(type: string): boolean;
/**
 * Get component type info
 */
export declare function getComponentType(type: string): ComponentType | null;
/**
 * Generate the target path for a new component
 */
export declare function getComponentPath(componentType: string, name: string, parentContext?: {
    product?: string;
    domain?: string;
}): TemplateResult<string>;
/**
 * Get the absolute template file path for a component type
 * Uses the path resolution module to find templates in the assets directory
 */
export declare function getTemplateFilePath(componentType: string): string;
/**
 * Load a template file content by component type
 */
export declare function loadTemplate(componentType: string): TemplateResult<string>;
/**
 * Validate template context has required fields for component type
 */
export declare function validateTemplateContext(componentType: string, context: TemplateContext): TemplateResult<void>;
/**
 * List all available component types with their layers
 */
export declare function listComponentTypes(): Array<{
    type: string;
    layer: string;
    directory: string;
}>;
//# sourceMappingURL=templates.d.ts.map