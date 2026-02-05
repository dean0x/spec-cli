/**
 * Template operations for component creation
 *
 * Handles loading, parsing, and applying templates for the 16 component types.
 * Templates use mustache-style {{variable}} placeholders.
 */

import { COMPONENT_TYPES, type ComponentType } from './types.js';
import { getTemplatePath as getTemplateAssetPath, readAsset } from './paths.js';

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
export type TemplateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Common variables used across templates
 */
export const COMMON_VARIABLES: TemplateVariable[] = [
  { name: 'name', required: true, description: 'Component name' },
  { name: 'description', required: false, description: 'Brief description', defaultValue: 'TODO: Add description' },
  { name: 'date', required: false, description: 'Current date (YYYY-MM-DD)', defaultValue: new Date().toISOString().split('T')[0] },
];

/**
 * Type-specific variables
 */
export const TYPE_VARIABLES: Record<string, TemplateVariable[]> = {
  schema: [
    { name: 'domain', required: true, description: 'Business domain (billing, auth, etc.)' },
    { name: 'table_name', required: false, description: 'Primary table name', defaultValue: '{{name}}' },
  ],
  pattern: [],
  decision: [
    { name: 'author', required: false, description: 'Decision author' },
  ],
  domain: [],
  'domain-topic': [
    { name: 'domain', required: true, description: 'Parent domain name' },
    { name: 'resource', required: false, description: 'REST resource name' },
    { name: 'schema', required: false, description: 'Related schema name' },
    { name: 'pattern', required: false, description: 'Related pattern name' },
  ],
  feature: [
    { name: 'product', required: true, description: 'Parent product name' },
    { name: 'domain', required: false, description: 'Related domain' },
    { name: 'schema', required: false, description: 'Related schema' },
  ],
  product: [
    { name: 'audience', required: false, description: 'Target audience', defaultValue: 'developers' },
  ],
  infrastructure: [
    { name: 'domain', required: false, description: 'Related domain' },
  ],
  security: [
    { name: 'pattern', required: false, description: 'Related pattern' },
    { name: 'infra', required: false, description: 'Related infrastructure' },
  ],
  operations: [
    { name: 'infra', required: false, description: 'Related infrastructure' },
  ],
  frontend: [
    { name: 'domain', required: false, description: 'Related domain' },
    { name: 'product', required: false, description: 'Related product' },
    { name: 'feature', required: false, description: 'Related feature' },
  ],
  api: [
    { name: 'resource', required: false, description: 'REST resource name' },
    { name: 'schema', required: false, description: 'Related schema' },
    { name: 'domain', required: false, description: 'Related domain' },
  ],
  diagram: [
    { name: 'domain', required: false, description: 'Related domain' },
    { name: 'infra', required: false, description: 'Related infrastructure' },
  ],
  overview: [],
  'planning-doc': [
    { name: 'author', required: false, description: 'Document author' },
  ],
  framework: [],
};

/**
 * Get all variables for a component type
 */
export function getTemplateVariables(componentType: string): TemplateVariable[] {
  const typeSpecific = TYPE_VARIABLES[componentType] || [];
  return [...COMMON_VARIABLES, ...typeSpecific];
}

/**
 * Extract variables from template content
 */
export function extractTemplateVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const varName = match[1];
    if (varName) {
      variables.add(varName);
    }
  }

  return Array.from(variables);
}

/**
 * Apply context to template, replacing {{variables}}
 */
export function applyTemplate(
  template: string,
  context: TemplateContext
): TemplateResult<string> {
  const variables = extractTemplateVariables(template);
  const missing: string[] = [];

  // Check for required variables
  for (const varName of variables) {
    if (!(varName in context) && !COMMON_VARIABLES.find(v => v.name === varName && !v.required)) {
      // Check if it's a required type-specific variable
      const isRequired = Object.values(TYPE_VARIABLES).some(
        vars => vars.find(v => v.name === varName && v.required)
      );
      if (isRequired) {
        missing.push(varName);
      }
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required variables: ${missing.join(', ')}`,
    };
  }

  // Apply substitutions
  let result = template;
  for (const varName of variables) {
    const value = context[varName];
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');

    if (value !== undefined) {
      result = result.replace(regex, value);
    } else {
      // Use default or placeholder
      const commonVar = COMMON_VARIABLES.find(v => v.name === varName);
      const typeVar = Object.values(TYPE_VARIABLES).flat().find(v => v.name === varName);
      const defaultValue = commonVar?.defaultValue || typeVar?.defaultValue || `TODO: Set ${varName}`;
      result = result.replace(regex, defaultValue);
    }
  }

  return { ok: true, value: result };
}

/**
 * Validate that a component type is valid
 */
export function isValidComponentType(type: string): boolean {
  return type in COMPONENT_TYPES;
}

/**
 * Get component type info
 */
export function getComponentType(type: string): ComponentType | null {
  return COMPONENT_TYPES[type] || null;
}

/**
 * Generate the target path for a new component
 */
export function getComponentPath(
  componentType: string,
  name: string,
  parentContext?: { product?: string; domain?: string }
): TemplateResult<string> {
  const typeInfo = COMPONENT_TYPES[componentType];
  if (!typeInfo) {
    return { ok: false, error: `Unknown component type: ${componentType}` };
  }

  let directory = typeInfo.directory;

  // Handle wildcard directories
  if (directory.includes('*')) {
    if (componentType === 'domain-topic') {
      if (!parentContext?.domain) {
        return { ok: false, error: 'domain-topic requires domain context' };
      }
      directory = `docs/domains/${parentContext.domain}`;
    } else if (componentType === 'feature') {
      if (!parentContext?.product) {
        return { ok: false, error: 'feature requires product context' };
      }
      directory = `docs/products/${parentContext.product}/features`;
    }
  }

  // Determine filename
  const filename = `${name}.md`;

  return { ok: true, value: `${directory}/${filename}` };
}

/**
 * Get the absolute template file path for a component type
 * Uses the path resolution module to find templates in the assets directory
 */
export function getTemplateFilePath(componentType: string): string {
  return getTemplateAssetPath(componentType);
}

/**
 * Load a template file content by component type
 */
export function loadTemplate(componentType: string): TemplateResult<string> {
  return readAsset('templates', `${componentType}.md`);
}

/**
 * Validate template context has required fields for component type
 */
export function validateTemplateContext(
  componentType: string,
  context: TemplateContext
): TemplateResult<void> {
  const variables = getTemplateVariables(componentType);
  const missing: string[] = [];

  for (const variable of variables) {
    if (variable.required && !context[variable.name]) {
      missing.push(variable.name);
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required context for ${componentType}: ${missing.join(', ')}`,
    };
  }

  return { ok: true, value: undefined };
}

/**
 * List all available component types with their layers
 */
export function listComponentTypes(): Array<{ type: string; layer: string; directory: string }> {
  return Object.entries(COMPONENT_TYPES).map(([type, info]) => ({
    type,
    layer: info.layer,
    directory: info.directory,
  }));
}
