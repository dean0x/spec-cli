/**
 * Feature Removal Module
 *
 * Handles safe removal of features and their owned components.
 * Includes impact analysis, removal markers, and cleanup.
 */

import type { FeatureManifest } from './types.js';
import type { DependencyGraph, GraphEdge } from './graph.js';
import { getOwnedFilePaths } from './manifest.js';

/**
 * Result type for removal operations
 */
export type RemovalOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Removal marker format
 */
export interface RemovalMarker {
  /** Original link text */
  originalText: string;
  /** Original link path */
  originalPath: string;
  /** Feature that owned the removed component */
  featureName: string;
  /** The marker text to insert */
  markerText: string;
}

/**
 * A reference that will break due to removal
 */
export interface BreakingReference {
  /** File containing the broken link */
  sourceFile: string;
  /** Line number of the link */
  line: number;
  /** The link text */
  linkText: string;
  /** The removed file path */
  targetFile: string;
  /** Generated removal marker */
  marker: RemovalMarker;
}

/**
 * Removal plan generated before execution
 */
export interface RemovalPlan {
  /** Feature being removed */
  featureName: string;
  /** Files that will be deleted */
  filesToDelete: string[];
  /** References that will be marked as broken */
  breakingReferences: BreakingReference[];
  /** Other features that depend on this one */
  dependentFeatures: string[];
  /** Summary stats */
  stats: {
    filesDeleted: number;
    referencesMarked: number;
    featuresAffected: number;
  };
}

/**
 * Removal execution result
 */
export interface RemovalExecutionResult {
  /** Whether removal succeeded */
  success: boolean;
  /** Files that were deleted */
  deletedFiles: string[];
  /** Files that were updated with markers */
  updatedFiles: string[];
  /** Any errors encountered */
  errors: string[];
}

/**
 * Generate a removal marker for a broken link
 */
export function createRemovalMarker(
  linkText: string,
  linkPath: string,
  featureName: string
): RemovalMarker {
  return {
    originalText: linkText,
    originalPath: linkPath,
    featureName,
    markerText: `[REMOVED: ${featureName}]`,
  };
}

/**
 * Get all files owned by a manifest that exist in the graph
 */
export function getOwnedFilesFromGraph(
  manifest: FeatureManifest,
  graph: DependencyGraph
): string[] {
  const ownedPatterns = getOwnedFilePaths(manifest);
  const matchedFiles: string[] = [];

  for (const filePath of graph.nodes.keys()) {
    for (const pattern of ownedPatterns) {
      // Simple pattern matching
      if (pattern.includes('**')) {
        const parts = pattern.split('**');
        const prefix = parts[0] ?? '';
        const suffix = parts[1] ?? '';
        if (filePath.startsWith(prefix) && filePath.endsWith(suffix)) {
          matchedFiles.push(filePath);
          break;
        }
      } else if (pattern.endsWith('/')) {
        if (filePath.startsWith(pattern)) {
          matchedFiles.push(filePath);
          break;
        }
      } else if (filePath === pattern || filePath.startsWith(pattern.replace('.md', ''))) {
        matchedFiles.push(filePath);
        break;
      }
    }
  }

  return [...new Set(matchedFiles)];
}

/**
 * Find all edges that reference files being removed
 */
export function findBreakingEdges(
  filesToRemove: string[],
  graph: DependencyGraph
): GraphEdge[] {
  const removeSet = new Set(filesToRemove);
  return graph.edges.filter(
    (edge) => removeSet.has(edge.to) && !removeSet.has(edge.from)
  );
}

/**
 * Convert breaking edges to breaking references with markers
 */
export function edgesToBreakingReferences(
  edges: GraphEdge[],
  featureName: string
): BreakingReference[] {
  return edges.map((edge) => ({
    sourceFile: edge.from,
    line: edge.line,
    linkText: edge.linkText,
    targetFile: edge.to,
    marker: createRemovalMarker(edge.linkText, edge.to, featureName),
  }));
}

/**
 * Find features that depend on the feature being removed
 */
export function findDependentFeatures(
  manifest: FeatureManifest,
  allManifests: FeatureManifest[],
  graph: DependencyGraph
): string[] {
  const ownedFiles = getOwnedFilesFromGraph(manifest, graph);
  const ownedSet = new Set(ownedFiles);
  const dependentFeatures = new Set<string>();

  // For each other manifest, check if any of their owned files
  // reference our owned files
  for (const otherManifest of allManifests) {
    if (otherManifest.feature === manifest.feature) continue;

    const otherFiles = getOwnedFilesFromGraph(otherManifest, graph);
    for (const otherFile of otherFiles) {
      const node = graph.nodes.get(otherFile);
      if (!node) continue;

      for (const linkedTo of node.linksTo) {
        if (ownedSet.has(linkedTo)) {
          dependentFeatures.add(otherManifest.feature);
          break;
        }
      }
    }
  }

  return Array.from(dependentFeatures).sort();
}

/**
 * Generate a removal plan for a feature
 */
export function planRemoval(
  manifest: FeatureManifest,
  allManifests: FeatureManifest[],
  graph: DependencyGraph
): RemovalPlan {
  const filesToDelete = getOwnedFilesFromGraph(manifest, graph);
  const breakingEdges = findBreakingEdges(filesToDelete, graph);
  const breakingReferences = edgesToBreakingReferences(breakingEdges, manifest.feature);
  const dependentFeatures = findDependentFeatures(manifest, allManifests, graph);

  return {
    featureName: manifest.feature,
    filesToDelete,
    breakingReferences,
    dependentFeatures,
    stats: {
      filesDeleted: filesToDelete.length,
      referencesMarked: breakingReferences.length,
      featuresAffected: dependentFeatures.length,
    },
  };
}

/**
 * Format removal plan as human-readable text
 */
export function formatRemovalPlan(plan: RemovalPlan): string {
  const lines: string[] = [];

  lines.push(`Removal Plan: ${plan.featureName}`);
  lines.push('='.repeat(40));
  lines.push('');

  lines.push(`Files to delete (${plan.stats.filesDeleted}):`);
  if (plan.filesToDelete.length === 0) {
    lines.push('  (none)');
  } else {
    for (const file of plan.filesToDelete) {
      lines.push(`  - ${file}`);
    }
  }
  lines.push('');

  lines.push(`Breaking references to mark (${plan.stats.referencesMarked}):`);
  if (plan.breakingReferences.length === 0) {
    lines.push('  (none)');
  } else {
    for (const ref of plan.breakingReferences) {
      lines.push(`  - ${ref.sourceFile}:${ref.line}`);
      lines.push(`    Link: [${ref.linkText}](${ref.targetFile})`);
      lines.push(`    → ${ref.marker.markerText}`);
    }
  }
  lines.push('');

  lines.push(`Dependent features affected (${plan.stats.featuresAffected}):`);
  if (plan.dependentFeatures.length === 0) {
    lines.push('  (none)');
  } else {
    for (const feature of plan.dependentFeatures) {
      lines.push(`  - ${feature}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate the text replacement for a broken link
 *
 * Converts: [text](./path/to/file.md)
 * To: [REMOVED: feature-name] (was: [text](./path/to/file.md))
 */
export function generateLinkReplacement(
  originalMatch: string,
  featureName: string
): string {
  return `[REMOVED: ${featureName}] <!-- was: ${originalMatch} -->`;
}

/**
 * Apply removal markers to file content
 */
export function applyRemovalMarkers(
  content: string,
  markers: BreakingReference[],
  featureName: string
): string {
  let result = content;

  // Sort by line number descending to avoid offset issues when replacing
  const sortedMarkers = [...markers].sort((a, b) => b.line - a.line);

  for (const marker of sortedMarkers) {
    const lines = result.split('\n');
    const lineIndex = marker.line - 1;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      if (line) {
        // Find and replace the link on this line
        const linkPattern = new RegExp(
          `\\[${escapeRegex(marker.linkText)}\\]\\([^)]*${escapeRegex(marker.targetFile.split('/').pop() ?? '')}[^)]*\\)`,
          'g'
        );
        const replacement = generateLinkReplacement(
          `[${marker.linkText}](${marker.targetFile})`,
          featureName
        );
        lines[lineIndex] = line.replace(linkPattern, replacement);
        result = lines.join('\n');
      }
    }
  }

  return result;
}

/**
 * Escape string for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate that a removal is safe to proceed
 */
export function validateRemoval(
  plan: RemovalPlan
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (plan.stats.filesDeleted === 0) {
    warnings.push('No files found to delete. The feature may not own any components.');
  }

  if (plan.stats.featuresAffected > 0) {
    warnings.push(
      `${plan.stats.featuresAffected} other feature(s) have dependencies on ${plan.featureName}.`
    );
  }

  if (plan.stats.referencesMarked > 10) {
    warnings.push(
      `${plan.stats.referencesMarked} references will be marked as removed. Consider reviewing the impact.`
    );
  }

  return {
    valid: true, // We allow removal with warnings
    warnings,
  };
}

/**
 * Group breaking references by source file
 */
export function groupReferencesByFile(
  references: BreakingReference[]
): Map<string, BreakingReference[]> {
  const grouped = new Map<string, BreakingReference[]>();

  for (const ref of references) {
    const existing = grouped.get(ref.sourceFile) ?? [];
    existing.push(ref);
    grouped.set(ref.sourceFile, existing);
  }

  return grouped;
}
