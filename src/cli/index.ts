#!/usr/bin/env node
/**
 * spec Command Line Interface
 *
 * Entry point for npx spec commands.
 */

import { initProject } from './init.js';
import { runValidation } from './validate.js';
import { runAddFrontmatter } from './add-frontmatter.js';
import { runIssues } from './issues.js';

const HELP_TEXT = `
spec - Composable Specification Framework

Usage:
  spec <command> [options]

Commands:
  init              Initialize spec in current project
  validate          Run structural validation on docs
  add-frontmatter   Add missing YAML frontmatter to docs
  issues            Sync feature manifests to GitHub issues
  help              Show this help message

Options:
  --help, -h   Show help for a command
  --json       Output results as JSON (validate only)
  --semantic   Run semantic validation (validate only, advisory)

Examples:
  spec init
  spec validate
  spec validate --json

For more information, visit: https://github.com/dean0x/spec-cli
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

    case 'issues':
      await runIssues(args.slice(1));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "spec help" for available commands.');
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
