/**
 * Layer Rules Validator
 *
 * Enforces strict layer dependency hierarchy (dependencies flow DOWN only):
 * - Reference layer: schemas and patterns cannot reference other layers
 * - Domain layer can only reference reference layer
 * - Supporting layer can reference reference and domain
 * - Product layer can reference reference, domain, and supporting
 * - Planning layer can reference all layers
 *
 * Exception: decisions (reference layer) can reference all layers — ADRs are
 * cross-cutting documents that discuss domain, supporting, product, and planning.
 *
 * Source of truth: per-type `canReference` arrays in COMPONENT_TYPES (src/core/types.ts).
 */

import type {
  ComponentLayer,
  ValidationIssue,
} from '../../core/types.js';
import {
  getComponentTypeFromPath,
} from '../../core/types.js';
import { extractMarkdownLinks, resolveLinkPath } from './link-checker.js';

/**
 * Check if a link target is in a specific layer based on its path
 */
export function getLayerFromPath(filePath: string): ComponentLayer | null {
  const componentType = getComponentTypeFromPath(filePath);
  return componentType?.layer ?? null;
}

/**
 * Validate layer references in a single file
 */
export function checkFileLayerRules(
  filePath: string,
  content: string,
  _existingFiles: Set<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Get the source file's component type and layer
  const sourceType = getComponentTypeFromPath(filePath);
  if (!sourceType) {
    // File is not in a recognized component directory
    return [];
  }

  const links = extractMarkdownLinks(content);

  for (const { link, line, text } of links) {
    if (!link) continue;

    const resolvedPath = resolveLinkPath(filePath, link);

    // Determine the target's layer
    const targetLayer = getLayerFromPath(resolvedPath);
    if (!targetLayer) {
      // Target is not in a recognized component directory (might be external or root)
      continue;
    }

    // Same layer is always valid
    if (sourceType.layer === targetLayer) continue;

    // Cross-layer: check the type's declared canReference list
    if (!sourceType.canReference.includes(targetLayer)) {
      issues.push({
        severity: 'error',
        code: 'LAYER_VIOLATION',
        message: `Layer violation: ${sourceType.name} (${sourceType.layer}) cannot reference ${targetLayer} layer`,
        file: filePath,
        line,
        suggestion: `${sourceType.name} (${sourceType.layer}) can only reference: ${sourceType.canReference.join(', ') || 'same layer only'}. Found reference to ${targetLayer} in [${text}](${link})`,
      });
    }
  }

  return issues;
}

/**
 * Get human-readable layer violation explanation
 */
export function explainLayerViolation(
  sourceLayer: ComponentLayer,
  targetLayer: ComponentLayer
): string {
  const layerDescriptions: Record<ComponentLayer, string> = {
    reference: 'foundational definitions (schemas, patterns, decisions)',
    domain: 'business logic documentation',
    supporting: 'cross-cutting concerns (infra, security, ops, api)',
    product: 'user-facing features and products',
    planning: 'meta-documentation and planning',
  };

  return (
    `The ${sourceLayer} layer contains ${layerDescriptions[sourceLayer]}. ` +
    `It cannot depend on the ${targetLayer} layer (${layerDescriptions[targetLayer]}) ` +
    `because dependencies must flow from higher-level concerns to lower-level foundations.`
  );
}

/**
 * Batch check all files for layer rule violations
 */
export function checkAllLayerRules(
  files: Map<string, string>,
  existingFiles: Set<string>
): ValidationIssue[] {
  const allIssues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (!filePath.endsWith('.md')) continue;

    const issues = checkFileLayerRules(filePath, content, existingFiles);
    allIssues.push(...issues);
  }

  return allIssues;
}

/**
 * Generate a report of layer reference statistics
 */
export function generateLayerReport(
  files: Map<string, string>
): Map<ComponentLayer, { total: number; references: Map<ComponentLayer, number> }> {
  const report = new Map<
    ComponentLayer,
    { total: number; references: Map<ComponentLayer, number> }
  >();

  // Initialize report structure
  for (const layer of ['reference', 'domain', 'supporting', 'product', 'planning'] as ComponentLayer[]) {
    report.set(layer, { total: 0, references: new Map() });
  }

  for (const [filePath, content] of files) {
    if (!filePath.endsWith('.md')) continue;

    const sourceType = getComponentTypeFromPath(filePath);
    if (!sourceType) continue;

    const layerStats = report.get(sourceType.layer);
    if (!layerStats) continue;

    layerStats.total++;

    const links = extractMarkdownLinks(content);
    for (const { link } of links) {
      if (!link) continue;

      const resolvedPath = resolveLinkPath(filePath, link);
      const targetLayer = getLayerFromPath(resolvedPath);
      if (!targetLayer) continue;

      const currentCount = layerStats.references.get(targetLayer) ?? 0;
      layerStats.references.set(targetLayer, currentCount + 1);
    }
  }

  return report;
}
