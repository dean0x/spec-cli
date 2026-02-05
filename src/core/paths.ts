/**
 * Path Resolution Module
 *
 * Provides path resolution that works whether spec-cli is:
 * - A local directory (development)
 * - Installed in node_modules (npm package)
 *
 * Uses import.meta.url to locate package assets regardless of installation method.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolved paths for spec-cli operations
 */
export interface SpecCliPaths {
  /** Where spec-cli assets live (templates, schemas, agents) */
  packageRoot: string;
  /** Consumer's docs directory */
  docsRoot: string;
  /** Consumer's manifests directory */
  manifestDir: string;
  /** Consumer project root (where spec.config.yaml lives) */
  projectRoot: string;
}

/**
 * Asset types that can be resolved
 */
export type AssetType = 'templates' | 'schemas' | 'agents' | 'commands' | 'skills';

/**
 * Configuration loaded from spec.config.yaml
 */
export interface SpecConfig {
  docsDir?: string;
  manifestDir?: string;
  extends?: string;
}

/**
 * Result type for path operations
 */
export type PathResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Get the package root directory using import.meta.url
 * This works whether spec-cli is local or in node_modules
 */
export function getPackageRoot(): string {
  // This file is at: <package>/src/core/paths.ts (source) or <package>/dist/core/paths.js (built)
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);

  // Go up from core/ to package root
  // In source: src/core/paths.ts -> src/core -> src -> package
  // In dist: dist/core/paths.js -> dist/core -> dist -> package
  const packageRoot = resolve(currentDir, '..', '..');

  return packageRoot;
}

/**
 * Find the consumer project root by walking up from cwd until we find spec.config.yaml
 * Falls back to cwd if not found
 */
export function findProjectRoot(startDir?: string): string {
  let current = startDir ?? process.cwd();
  const root = resolve('/');

  while (current !== root) {
    const configPath = join(current, 'spec.config.yaml');
    if (existsSync(configPath)) {
      return current;
    }
    current = dirname(current);
  }

  // Fall back to cwd if no config found
  return startDir ?? process.cwd();
}

/**
 * Load configuration from spec.config.yaml
 */
export function loadConfig(projectRoot: string): PathResult<SpecConfig> {
  const configPath = join(projectRoot, 'spec.config.yaml');

  if (!existsSync(configPath)) {
    // Return defaults if no config exists
    return {
      ok: true,
      value: {
        docsDir: 'docs',
        manifestDir: '.manifests/features',
      },
    };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = parseYamlConfig(content);
    return { ok: true, value: config };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Simple YAML parser for spec.config.yaml
 * Handles basic key: value pairs without nested objects
 */
function parseYamlConfig(content: string): SpecConfig {
  const config: SpecConfig = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse key: value
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case 'docsDir':
        config.docsDir = value;
        break;
      case 'manifestDir':
        config.manifestDir = value;
        break;
      case 'extends':
        config.extends = value;
        break;
    }
  }

  return config;
}

/**
 * Resolve all paths needed for spec-cli operations
 *
 * @param projectRoot - Optional explicit project root. If not provided, searches up from cwd.
 */
export function resolveSpecCliPaths(projectRoot?: string): PathResult<SpecCliPaths> {
  const resolvedProjectRoot = projectRoot ?? findProjectRoot();
  const packageRoot = getPackageRoot();

  const configResult = loadConfig(resolvedProjectRoot);
  if (!configResult.ok) {
    return configResult;
  }

  const config = configResult.value;
  const docsDir = config.docsDir ?? 'docs';
  const manifestDir = config.manifestDir ?? '.manifests/features';

  const docsRoot = join(resolvedProjectRoot, docsDir);
  const manifestPath = join(resolvedProjectRoot, manifestDir);

  return {
    ok: true,
    value: {
      packageRoot,
      docsRoot,
      manifestDir: manifestPath,
      projectRoot: resolvedProjectRoot,
    },
  };
}

/**
 * Get the absolute path to an asset file
 *
 * @param assetType - Type of asset (templates, schemas, agents, commands, skills)
 * @param name - Asset filename (with or without extension)
 */
export function getAssetPath(assetType: AssetType, name: string): string {
  const packageRoot = getPackageRoot();

  // Assets are in the assets/ directory at package root
  const assetsDir = join(packageRoot, 'assets', assetType);

  // Handle special case for skills which have subdirectories
  if (assetType === 'skills' && !name.includes('/')) {
    // skills/spec-authoring/SKILL.md -> skills/{name}/SKILL.md
    return join(assetsDir, name, 'SKILL.md');
  }

  return join(assetsDir, name);
}

/**
 * Get the path to a template file
 */
export function getTemplatePath(componentType: string): string {
  return getAssetPath('templates', `${componentType}.md`);
}

/**
 * Get the path to a frontmatter schema
 */
export function getSchemaPath(componentType: string): string {
  return getAssetPath('schemas', `frontmatter/${componentType}.json`);
}

/**
 * Check if a path exists within the package assets
 */
export function assetExists(assetType: AssetType, name: string): boolean {
  const assetPath = getAssetPath(assetType, name);
  return existsSync(assetPath);
}

/**
 * Read an asset file as string
 */
export function readAsset(assetType: AssetType, name: string): PathResult<string> {
  const assetPath = getAssetPath(assetType, name);

  if (!existsSync(assetPath)) {
    return {
      ok: false,
      error: `Asset not found: ${assetType}/${name}`,
    };
  }

  try {
    const content = readFileSync(assetPath, 'utf-8');
    return { ok: true, value: content };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to read asset: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
