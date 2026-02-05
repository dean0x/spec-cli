#!/usr/bin/env node
/**
 * spec-cli Command Line Interface
 *
 * Entry point for npx spec-cli commands.
 */

import { initProject } from './init.js';
import { runValidation } from './validate.js';
import { runAddFrontmatter } from './add-frontmatter.js';

const HELP_TEXT = `
spec-cli - Composable Specification Framework

Usage:
  spec-cli <command> [options]

Commands:
  init              Initialize spec-cli in current project
  validate          Run structural validation on docs
  add-frontmatter   Add missing YAML frontmatter to docs
  help              Show this help message

Options:
  --help, -h  Show help for a command
  --json      Output results as JSON (validate only)

Examples:
  spec-cli init
  spec-cli validate
  spec-cli validate --json

For more information, visit: https://github.com/your-org/spec-cli
`;

function printHelp(): void {
  console.log(HELP_TEXT);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case 'init':
      await initProject(args.slice(1));
      break;

    case 'validate':
      await runValidation(args.slice(1));
      break;

    case 'add-frontmatter':
      await runAddFrontmatter(args.slice(1));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "spec-cli help" for available commands.');
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
