import { describe, it, expect } from 'vitest';
import { COMPONENT_TYPES } from './types.js';
import {
  loadTemplate,
  extractTemplateVariables,
  applyTemplate,
  COMMON_VARIABLES,
  TYPE_VARIABLES,
  getTemplateVariables,
} from './templates.js';
import {
  FRONTMATTER_FIELDS,
  REQUIRED_FRONTMATTER,
  RECOMMENDED_FRONTMATTER,
  parseFrontmatter,
} from '../validation/structural/frontmatter.js';

const ALL_TYPES = Object.keys(COMPONENT_TYPES);

describe('template loading', () => {
  it('loads all 16 templates successfully', () => {
    for (const type of ALL_TYPES) {
      const result = loadTemplate(type);
      expect(result.ok, `loadTemplate('${type}') should succeed`).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has exactly 16 component types', () => {
    expect(ALL_TYPES.length).toBe(16);
  });
});

describe('template variable definitions', () => {
  it('every {{variable}} in each template has a COMMON or TYPE definition', () => {
    const commonNames = new Set(COMMON_VARIABLES.map(v => v.name));

    for (const type of ALL_TYPES) {
      const result = loadTemplate(type);
      if (!result.ok) continue;

      const typeVarNames = new Set((TYPE_VARIABLES[type] ?? []).map(v => v.name));
      const variables = extractTemplateVariables(result.value);

      for (const varName of variables) {
        const defined = commonNames.has(varName) || typeVarNames.has(varName);
        expect(defined, `{{${varName}}} in ${type}.md has no variable definition`).toBe(true);
      }
    }
  });

  it('TYPE_VARIABLES covers all 16 component types', () => {
    for (const type of ALL_TYPES) {
      expect(
        type in TYPE_VARIABLES,
        `TYPE_VARIABLES missing key '${type}'`
      ).toBe(true);
    }
  });
});

describe('template frontmatter coverage', () => {
  it('each template includes all REQUIRED_FRONTMATTER fields', () => {
    for (const type of ALL_TYPES) {
      const result = loadTemplate(type);
      if (!result.ok) continue;

      const { frontmatter } = parseFrontmatter(result.value);
      expect(frontmatter, `${type}.md should have frontmatter`).not.toBeNull();
      if (!frontmatter) continue;

      const required = REQUIRED_FRONTMATTER[type] ?? [];
      for (const field of required) {
        // The field must appear in frontmatter (value can be a {{variable}} string or literal)
        expect(
          field in frontmatter,
          `${type}.md frontmatter missing required field '${field}'`
        ).toBe(true);
      }
    }
  });
});

describe('FRONTMATTER_FIELDS single source of truth', () => {
  it('covers all 16 component types', () => {
    for (const type of ALL_TYPES) {
      expect(
        type in FRONTMATTER_FIELDS,
        `FRONTMATTER_FIELDS missing key '${type}'`
      ).toBe(true);
    }
  });

  it('derived REQUIRED_FRONTMATTER matches FRONTMATTER_FIELDS', () => {
    for (const type of ALL_TYPES) {
      const fields = FRONTMATTER_FIELDS[type] ?? [];
      const expected = fields
        .filter(f => f.requirement === 'required')
        .map(f => f.name);
      const actual = REQUIRED_FRONTMATTER[type] ?? [];
      expect(actual, `REQUIRED_FRONTMATTER['${type}']`).toEqual(expected);
    }
  });

  it('derived RECOMMENDED_FRONTMATTER matches FRONTMATTER_FIELDS', () => {
    for (const type of ALL_TYPES) {
      const fields = FRONTMATTER_FIELDS[type] ?? [];
      const expected = fields
        .filter(f => f.requirement === 'recommended')
        .map(f => f.name);
      const actual = RECOMMENDED_FRONTMATTER[type] ?? [];
      expect(actual, `RECOMMENDED_FRONTMATTER['${type}']`).toEqual(expected);
    }
  });
});

describe('applyTemplate', () => {
  it('produces valid output with all required context for each type', () => {
    for (const type of ALL_TYPES) {
      const templateResult = loadTemplate(type);
      if (!templateResult.ok) continue;

      // Build minimal required context
      const allVars = getTemplateVariables(type);
      const context: Record<string, string> = { name: 'test-component' };

      for (const v of allVars) {
        if (v.required && !(v.name in context)) {
          context[v.name] = `test-${v.name}`;
        }
      }

      const result = applyTemplate(templateResult.value, context, type);
      expect(result.ok, `applyTemplate for ${type} should succeed: ${!result.ok ? result.error : ''}`).toBe(true);

      if (result.ok) {
        // No unresolved required variables should remain
        const remaining = extractTemplateVariables(result.value);
        const requiredRemaining = remaining.filter(varName => {
          const typeVars = TYPE_VARIABLES[type] ?? [];
          return typeVars.some(v => v.name === varName && v.required) ||
            COMMON_VARIABLES.some(v => v.name === varName && v.required);
        });
        expect(
          requiredRemaining,
          `${type}: unresolved required variables: ${requiredRemaining.join(', ')}`
        ).toEqual([]);
      }
    }
  });

  it('rejects missing required variables', () => {
    const templateResult = loadTemplate('frontend');
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) return;

    // Omit required 'framework' variable
    const result = applyTemplate(templateResult.value, { name: 'my-frontend' }, 'frontend');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('framework');
    }
  });

  it('scopes required checks to the specified type', () => {
    // 'provider' is required for infrastructure but NOT for other types
    // If we call applyTemplate for 'api' type, 'provider' should NOT be required
    const templateResult = loadTemplate('api');
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) return;

    const result = applyTemplate(templateResult.value, { name: 'my-api' }, 'api');
    expect(result.ok).toBe(true);
  });
});
