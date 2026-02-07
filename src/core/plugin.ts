/**
 * Plugin Installation Module
 *
 * Handles installing spec-core plugin files into Claude Code configuration.
 * Supports two paths:
 *   1. CLI-based install via `claude plugin install` (preferred)
 *   2. Manual file copy fallback when Claude CLI is not available
 *
 * Plugin files are sourced from the bundled plugins/spec-core/ directory.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { getPackageRoot } from './paths.js';
import type { PathResult } from './paths.js';

export type PluginScope = 'user' | 'local' | 'project';

export interface PluginInstallResult {
  method: 'cli' | 'manual';
  scope: PluginScope;
  installed: string[];
  skipped: string[];
}

/**
 * Check whether the `claude` CLI binary is available on PATH.
 */
export function isClaudeCliAvailable(): boolean {
  try {
    execSync('which claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the absolute path to the bundled plugin source directory.
 */
export function getPluginSourceDir(): string {
  return join(getPackageRoot(), 'plugins', 'spec-core');
}

/**
 * Get the settings file path for a given scope.
 */
export function getSettingsPath(scope: PluginScope, projectRoot: string): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'settings.json');
    case 'project':
      return join(projectRoot, '.claude', 'settings.json');
    case 'local':
      return join(projectRoot, '.claude', 'settings.local.json');
  }
}

/**
 * Register the spec-cli marketplace in Claude Code settings.
 *
 * Reads the settings JSON (or starts with `{}`), ensures
 * `extraKnownMarketplaces` contains the spec-cli entry, and writes back.
 */
export function registerMarketplace(
  scope: PluginScope,
  projectRoot: string
): PathResult<void> {
  const settingsPath = getSettingsPath(scope, projectRoot);

  try {
    let settings: Record<string, unknown> = {};

    if (existsSync(settingsPath)) {
      const raw = readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(raw) as Record<string, unknown>;
    }

    // Ensure the extraKnownMarketplaces object exists
    if (
      typeof settings['extraKnownMarketplaces'] !== 'object' ||
      settings['extraKnownMarketplaces'] === null ||
      Array.isArray(settings['extraKnownMarketplaces'])
    ) {
      settings['extraKnownMarketplaces'] = {};
    }

    const marketplaces = settings['extraKnownMarketplaces'] as Record<string, unknown>;
    marketplaces['spec-cli'] = {
      source: { source: 'github', repo: 'dean0x/spec-cli' },
    };

    // Create parent directories if needed
    const parentDir = dirname(settingsPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to register marketplace: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Install the plugin via the Claude CLI.
 */
export function installViaCli(
  scope: PluginScope,
  projectRoot: string
): PathResult<string[]> {
  try {
    execSync(`claude plugin install spec-core@spec-cli --scope ${scope}`, {
      timeout: 30_000,
      cwd: projectRoot,
      stdio: 'ignore',
    });
    return { ok: true, value: ['spec-core'] };
  } catch (error) {
    return {
      ok: false,
      error: `CLI install failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Recursively copy files from srcDir to destDir.
 *
 * If `force` is false, existing files at the destination are skipped.
 * Returns lists of installed and skipped relative file paths.
 */
export function copyDir(
  srcDir: string,
  destDir: string,
  force: boolean
): { installed: string[]; skipped: string[] } {
  const installed: string[] = [];
  const skipped: string[] = [];

  if (!existsSync(srcDir)) {
    return { installed, skipped };
  }

  mkdirSync(destDir, { recursive: true });

  const entries = readdirSync(srcDir);
  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      const sub = copyDir(srcPath, destPath, force);
      installed.push(...sub.installed);
      skipped.push(...sub.skipped);
    } else {
      if (existsSync(destPath) && !force) {
        skipped.push(destPath);
      } else {
        copyFileSync(srcPath, destPath);
        installed.push(destPath);
      }
    }
  }

  return { installed, skipped };
}

/**
 * Install plugin files by manually copying from the bundled source.
 *
 * Copies commands, agents, and skills into the appropriate Claude Code
 * configuration directory based on scope.
 */
export function installManual(
  scope: PluginScope,
  pluginSourceDir: string,
  projectRoot: string,
  force: boolean
): PathResult<PluginInstallResult> {
  if (!existsSync(pluginSourceDir)) {
    return {
      ok: false,
      error: `Plugin source directory not found: ${pluginSourceDir}`,
    };
  }

  const targetBase =
    scope === 'user'
      ? join(homedir(), '.claude')
      : join(projectRoot, '.claude');

  const allInstalled: string[] = [];
  const allSkipped: string[] = [];

  // Copy commands/*.md -> <target>/commands/spec/
  const commandsSrc = join(pluginSourceDir, 'commands');
  if (existsSync(commandsSrc)) {
    const result = copyDir(commandsSrc, join(targetBase, 'commands', 'spec'), force);
    allInstalled.push(...result.installed);
    allSkipped.push(...result.skipped);
  }

  // Copy agents/*.md -> <target>/agents/spec/
  const agentsSrc = join(pluginSourceDir, 'agents');
  if (existsSync(agentsSrc)) {
    const result = copyDir(agentsSrc, join(targetBase, 'agents', 'spec'), force);
    allInstalled.push(...result.installed);
    allSkipped.push(...result.skipped);
  }

  // Copy skills/spec-authoring/ -> <target>/skills/spec-authoring/ (recursive)
  const skillsSrc = join(pluginSourceDir, 'skills', 'spec-authoring');
  if (existsSync(skillsSrc)) {
    const result = copyDir(
      skillsSrc,
      join(targetBase, 'skills', 'spec-authoring'),
      force
    );
    allInstalled.push(...result.installed);
    allSkipped.push(...result.skipped);
  }

  return {
    ok: true,
    value: {
      method: 'manual',
      scope,
      installed: allInstalled,
      skipped: allSkipped,
    },
  };
}

/**
 * Install the spec-core plugin into Claude Code configuration.
 *
 * Attempts CLI-based install first (preferred). Falls back to manual file
 * copy if the Claude CLI is not available or if the CLI install fails.
 */
export function installPlugin(
  projectRoot: string,
  options: { scope: PluginScope; force: boolean }
): PathResult<PluginInstallResult> {
  const { scope, force } = options;

  if (isClaudeCliAvailable()) {
    const regResult = registerMarketplace(scope, projectRoot);
    if (!regResult.ok) {
      return regResult;
    }

    const cliResult = installViaCli(scope, projectRoot);
    if (cliResult.ok) {
      return {
        ok: true,
        value: {
          method: 'cli',
          scope,
          installed: cliResult.value,
          skipped: [],
        },
      };
    }
    // CLI install failed -- fall through to manual
  }

  return installManual(scope, getPluginSourceDir(), projectRoot, force);
}
