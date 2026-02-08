/**
 * Frontmatter Validator
 *
 * Validates YAML frontmatter in markdown files against component-type schemas.
 */

import type { ValidationIssue } from '../../core/types.js';

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(
  content: string
): { frontmatter: Record<string, unknown> | null; bodyStart: number } {
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
  const frontmatter: Record<string, unknown> = {};

  for (const line of yamlLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Handle common YAML types
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
      else if (value === '') value = null;
      // Handle quoted strings
      else if (
        typeof value === 'string' &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, bodyStart: endIndex + 1 };
}

/**
 * Frontmatter field definition — single source of truth for required/recommended fields.
 */
export interface FrontmatterFieldDef {
  name: string;
  requirement: 'required' | 'recommended';
}

/**
 * Unified frontmatter field definitions by component type.
 * REQUIRED_FRONTMATTER and RECOMMENDED_FRONTMATTER are derived from this.
 */
export const FRONTMATTER_FIELDS: Record<string, FrontmatterFieldDef[]> = {
  schema: [
    { name: 'title', requirement: 'required' },
    { name: 'domain', requirement: 'required' },
    { name: 'status', requirement: 'required' },
    { name: 'description', requirement: 'recommended' },
    { name: 'version', requirement: 'recommended' },
  ],
  pattern: [
    { name: 'title', requirement: 'required' },
    { name: 'status', requirement: 'required' },
    { name: 'description', requirement: 'recommended' },
    { name: 'related', requirement: 'recommended' },
  ],
  decision: [
    { name: 'title', requirement: 'required' },
    { name: 'status', requirement: 'required' },
    { name: 'date', requirement: 'required' },
    { name: 'deciders', requirement: 'recommended' },
    { name: 'supersedes', requirement: 'recommended' },
  ],
  domain: [
    { name: 'title', requirement: 'required' },
  ],
  'domain-topic': [
    { name: 'title', requirement: 'required' },
  ],
  feature: [
    { name: 'title', requirement: 'required' },
    { name: 'status', requirement: 'required' },
    { name: 'priority', requirement: 'recommended' },
    { name: 'dependencies', requirement: 'recommended' },
    { name: 'product', requirement: 'recommended' },
  ],
  product: [
    { name: 'title', requirement: 'required' },
  ],
  api: [
    { name: 'title', requirement: 'required' },
    { name: 'version', requirement: 'required' },
  ],
  infrastructure: [
    { name: 'title', requirement: 'required' },
  ],
  security: [
    { name: 'title', requirement: 'required' },
  ],
  operations: [
    { name: 'title', requirement: 'required' },
  ],
  frontend: [
    { name: 'title', requirement: 'required' },
  ],
  diagram: [
    { name: 'title', requirement: 'required' },
  ],
  overview: [
    { name: 'title', requirement: 'required' },
  ],
  'planning-doc': [
    { name: 'title', requirement: 'required' },
  ],
  framework: [
    { name: 'title', requirement: 'required' },
  ],
};

/**
 * Required frontmatter fields by component type (derived from FRONTMATTER_FIELDS)
 */
export const REQUIRED_FRONTMATTER: Record<string, string[]> = Object.fromEntries(
  Object.entries(FRONTMATTER_FIELDS).map(([type, fields]) => [
    type,
    fields.filter(f => f.requirement === 'required').map(f => f.name),
  ])
);

/**
 * Optional but recommended frontmatter fields (derived from FRONTMATTER_FIELDS)
 */
export const RECOMMENDED_FRONTMATTER: Record<string, string[]> = Object.fromEntries(
  Object.entries(FRONTMATTER_FIELDS)
    .map(([type, fields]) => {
      const recommended = fields.filter(f => f.requirement === 'recommended').map(f => f.name);
      return recommended.length > 0 ? [type, recommended] as const : null;
    })
    .filter((entry): entry is readonly [string, string[]] => entry !== null)
);

/**
 * Validate frontmatter against component type requirements
 */
export function validateFrontmatter(
  filePath: string,
  content: string,
  componentType: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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
    const validStatuses = ['draft', 'active', 'deprecated', 'superseded', 'proposed', 'accepted', 'rejected', 'planned'];
    if (!validStatuses.includes(frontmatter.status as string)) {
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
export function hasFrontmatter(content: string): boolean {
  return content.trim().startsWith('---');
}
