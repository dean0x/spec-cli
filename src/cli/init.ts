/**
 * spec-cli init command
 *
 * Initializes a project to use spec-cli by creating:
 * - spec.config.yaml with defaults
 * - .manifests/features/ directory
 * - Optionally scaffolds docs/ structure
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installPlugin } from '../core/plugin.js';
import type { PluginScope } from '../core/plugin.js';

const DEFAULT_CONFIG = `# spec-cli Configuration
# See https://github.com/dean0x/spec-cli for documentation

# Directory containing specification markdown files
docsDir: docs

# Directory containing feature manifests
manifestDir: .manifests/features
`;

const INIT_HELP = `
spec-cli init - Initialize spec-cli in current project

Usage:
  spec-cli init [options]

Options:
  --force                         Overwrite existing configuration
  --scaffold                      Also create docs/ directory structure
  --plugin=user|local|project|none  Install Claude Code plugin (default: user)
  --help, -h                      Show this help message

Examples:
  spec-cli init
  spec-cli init --scaffold
  spec-cli init --force
  spec-cli init --plugin=project
  spec-cli init --plugin=none
`;

interface InitOptions {
  force: boolean;
  scaffold: boolean;
  help: boolean;
  plugin: PluginScope | 'none';
}

function parsePluginArg(args: string[]): PluginScope | 'none' {
  const pluginArg = args.find((a) => a.startsWith('--plugin='));
  if (!pluginArg) {
    return 'user';
  }
  const value = pluginArg.slice('--plugin='.length);
  const validValues: ReadonlyArray<PluginScope | 'none'> = ['user', 'local', 'project', 'none'];
  if (validValues.includes(value as PluginScope | 'none')) {
    return value as PluginScope | 'none';
  }
  console.log(`  Warning: Invalid --plugin value "${value}", using "user"`);
  return 'user';
}

function parseArgs(args: string[]): InitOptions {
  return {
    force: args.includes('--force'),
    scaffold: args.includes('--scaffold'),
    help: args.includes('--help') || args.includes('-h'),
    plugin: parsePluginArg(args),
  };
}

function createDocsStructure(projectRoot: string): void {
  const directories = [
    'docs',
    'docs/schemas',
    'docs/architecture/patterns',
    'docs/architecture/decisions',
    'docs/domains',
    'docs/infrastructure',
    'docs/security',
    'docs/operations',
    'docs/api',
    'docs/products',
    'docs/diagrams',
  ];

  for (const dir of directories) {
    const fullPath = join(projectRoot, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`  Created: ${dir}/`);
    }
  }

  // Create a minimal index.md
  const indexPath = join(projectRoot, 'docs', 'index.md');
  if (!existsSync(indexPath)) {
    const indexContent = `---
title: Documentation Index
type: framework
---

# Documentation

Welcome to the project documentation.

## Quick Links

- [Schemas](./schemas/)
- [Architecture](./architecture/)
- [Domains](./domains/)
- [Products](./products/)
`;
    writeFileSync(indexPath, indexContent);
    console.log('  Created: docs/index.md');
  }
}

export async function initProject(args: string[]): Promise<void> {
  const options = parseArgs(args);

  if (options.help) {
    console.log(INIT_HELP);
    return;
  }

  const projectRoot = process.cwd();
  const configPath = join(projectRoot, 'spec.config.yaml');
  const manifestDir = join(projectRoot, '.manifests', 'features');

  console.log('Initializing spec-cli...\n');

  // Create spec.config.yaml
  if (existsSync(configPath) && !options.force) {
    console.log('  spec.config.yaml already exists (use --force to overwrite)');
  } else {
    writeFileSync(configPath, DEFAULT_CONFIG);
    console.log('  Created: spec.config.yaml');
  }

  // Create .manifests/features/
  if (!existsSync(manifestDir)) {
    mkdirSync(manifestDir, { recursive: true });
    console.log('  Created: .manifests/features/');

    // Create a sample manifest
    const sampleManifest = `# Example feature manifest
# See https://github.com/dean0x/spec-cli for documentation

feature: example
status: active
owns:
  schemas: []
  domains: []
uses:
  schemas: []
  patterns: []
`;
    const samplePath = join(manifestDir, 'example.yaml');
    writeFileSync(samplePath, sampleManifest);
    console.log('  Created: .manifests/features/example.yaml');
  } else {
    console.log('  .manifests/features/ already exists');
  }

  // Install Claude Code plugin
  if (options.plugin !== 'none') {
    console.log('\nInstalling Claude Code plugin...');
    const pluginResult = installPlugin(projectRoot, {
      scope: options.plugin,
      force: options.force,
    });
    if (pluginResult.ok) {
      const { method, installed, skipped } = pluginResult.value;
      console.log(`  Installed via ${method}: ${installed.length} files`);
      if (skipped.length > 0) {
        console.log(`  Skipped (existing): ${skipped.length} files`);
      }
    } else {
      console.log(`  Warning: Plugin installation failed: ${pluginResult.error}`);
      console.log('  You can install manually later with: claude plugin install spec-core@spec-cli');
    }
  }

  // Optionally scaffold docs structure
  if (options.scaffold) {
    console.log('\nScaffolding docs structure...');
    createDocsStructure(projectRoot);
  }

  console.log('\nspec-cli initialized successfully!');
  console.log('\nNext steps:');
  console.log('  1. Create specification documents in docs/');
  console.log('  2. Define feature manifests in .manifests/features/');
  console.log('  3. Run "spec-cli validate" to check structure');
  if (options.plugin !== 'none') {
    console.log('  4. Use /spec commands in Claude Code');
  }
}
