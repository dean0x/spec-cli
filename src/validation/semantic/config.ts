/**
 * Semantic Validation Configuration
 *
 * Types and loader for spec.semantic.json.
 * Uses JSON.parse — no external YAML dependency needed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PathResult } from '../../core/paths.js';

/**
 * Configuration for semantic validation checks
 */
export interface SemanticConfig {
  terminology: {
    glossary: Record<string, string[]>; // preferred term → synonyms to flag
  };
  staleness: {
    flagUndatedEstimates: boolean;
  };
  completeness: {
    requiredSections: Record<string, string[]>; // component type key → heading strings
  };
  crossReference: {
    scopeConsistency: boolean;
    stateConsistency: boolean;
    errorCodeUniqueness: boolean;
  };
  ignore: string[]; // glob patterns to skip
}

/**
 * Returns a default SemanticConfig with all checks enabled but no custom rules.
 */
export function defaultSemanticConfig(): SemanticConfig {
  return {
    terminology: {
      glossary: {},
    },
    staleness: {
      flagUndatedEstimates: true,
    },
    completeness: {
      requiredSections: {},
    },
    crossReference: {
      scopeConsistency: true,
      stateConsistency: true,
      errorCodeUniqueness: true,
    },
    ignore: [],
  };
}

/**
 * Type guard: checks that a value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates that raw parsed JSON conforms to the SemanticConfig shape.
 * Returns an error message if invalid, or null if valid.
 */
function validateConfigShape(raw: unknown): string | null {
  if (!isRecord(raw)) {
    return 'Config must be a JSON object';
  }

  // terminology
  if (raw['terminology'] !== undefined) {
    if (!isRecord(raw['terminology'])) {
      return '"terminology" must be an object';
    }
    const term = raw['terminology'];
    if (term['glossary'] !== undefined) {
      if (!isRecord(term['glossary'])) {
        return '"terminology.glossary" must be an object';
      }
      for (const [key, val] of Object.entries(term['glossary'])) {
        if (!Array.isArray(val) || !val.every((v): v is string => typeof v === 'string')) {
          return `"terminology.glossary.${key}" must be an array of strings`;
        }
      }
    }
  }

  // staleness
  if (raw['staleness'] !== undefined) {
    if (!isRecord(raw['staleness'])) {
      return '"staleness" must be an object';
    }
    const stale = raw['staleness'];
    if (stale['flagUndatedEstimates'] !== undefined && typeof stale['flagUndatedEstimates'] !== 'boolean') {
      return '"staleness.flagUndatedEstimates" must be a boolean';
    }
  }

  // completeness
  if (raw['completeness'] !== undefined) {
    if (!isRecord(raw['completeness'])) {
      return '"completeness" must be an object';
    }
    const comp = raw['completeness'];
    if (comp['requiredSections'] !== undefined) {
      if (!isRecord(comp['requiredSections'])) {
        return '"completeness.requiredSections" must be an object';
      }
      for (const [key, val] of Object.entries(comp['requiredSections'])) {
        if (!Array.isArray(val) || !val.every((v): v is string => typeof v === 'string')) {
          return `"completeness.requiredSections.${key}" must be an array of strings`;
        }
      }
    }
  }

  // crossReference
  if (raw['crossReference'] !== undefined) {
    if (!isRecord(raw['crossReference'])) {
      return '"crossReference" must be an object';
    }
    const cr = raw['crossReference'];
    for (const field of ['scopeConsistency', 'stateConsistency', 'errorCodeUniqueness'] as const) {
      if (cr[field] !== undefined && typeof cr[field] !== 'boolean') {
        return `"crossReference.${field}" must be a boolean`;
      }
    }
  }

  // ignore
  if (raw['ignore'] !== undefined) {
    if (!Array.isArray(raw['ignore']) || !raw['ignore'].every((v): v is string => typeof v === 'string')) {
      return '"ignore" must be an array of strings';
    }
  }

  return null;
}

/**
 * Merges parsed (validated) JSON onto defaults to produce a complete SemanticConfig.
 */
function mergeWithDefaults(raw: Record<string, unknown>): SemanticConfig {
  const defaults = defaultSemanticConfig();

  const term = isRecord(raw['terminology']) ? raw['terminology'] : {};
  const stale = isRecord(raw['staleness']) ? raw['staleness'] : {};
  const comp = isRecord(raw['completeness']) ? raw['completeness'] : {};
  const cr = isRecord(raw['crossReference']) ? raw['crossReference'] : {};

  return {
    terminology: {
      glossary: isRecord(term['glossary'])
        ? (term['glossary'] as Record<string, string[]>)
        : defaults.terminology.glossary,
    },
    staleness: {
      flagUndatedEstimates:
        typeof stale['flagUndatedEstimates'] === 'boolean'
          ? stale['flagUndatedEstimates']
          : defaults.staleness.flagUndatedEstimates,
    },
    completeness: {
      requiredSections: isRecord(comp['requiredSections'])
        ? (comp['requiredSections'] as Record<string, string[]>)
        : defaults.completeness.requiredSections,
    },
    crossReference: {
      scopeConsistency:
        typeof cr['scopeConsistency'] === 'boolean'
          ? cr['scopeConsistency']
          : defaults.crossReference.scopeConsistency,
      stateConsistency:
        typeof cr['stateConsistency'] === 'boolean'
          ? cr['stateConsistency']
          : defaults.crossReference.stateConsistency,
      errorCodeUniqueness:
        typeof cr['errorCodeUniqueness'] === 'boolean'
          ? cr['errorCodeUniqueness']
          : defaults.crossReference.errorCodeUniqueness,
    },
    ignore: Array.isArray(raw['ignore']) ? (raw['ignore'] as string[]) : defaults.ignore,
  };
}

const SEMANTIC_CONFIG_FILENAME = 'spec.semantic.json';

/**
 * Loads semantic config from `spec.semantic.json` in the project root.
 * Falls back to defaults if file does not exist.
 * Returns a Result error if file exists but is malformed.
 */
export function loadSemanticConfig(projectRoot: string): PathResult<SemanticConfig> {
  const configPath = join(projectRoot, SEMANTIC_CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return { ok: true, value: defaultSemanticConfig() };
  }

  let raw: unknown;
  try {
    const content = readFileSync(configPath, 'utf-8');
    raw = JSON.parse(content);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${SEMANTIC_CONFIG_FILENAME}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const shapeError = validateConfigShape(raw);
  if (shapeError !== null) {
    return {
      ok: false,
      error: `Invalid ${SEMANTIC_CONFIG_FILENAME}: ${shapeError}`,
    };
  }

  return { ok: true, value: mergeWithDefaults(raw as Record<string, unknown>) };
}
