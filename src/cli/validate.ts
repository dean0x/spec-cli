/**
 * spec validate command
 *
 * Runs structural validation on the consumer's docs directory.
 * Uses resolveSpecCliPaths() to find docs regardless of where spec-cli is installed.
 */

import { existsSync } from 'node:fs';
import { resolveSpecCliPaths } from '../core/paths.js';
import { collectMarkdownFiles } from '../core/files.js';
import {
  validateStructure,
  formatValidationResult,
  formatValidationResultJson,
} from '../validation/structural/index.js';

const VALIDATE_HELP = `
spec validate - Run structural validation on documentation

Usage:
  spec validate [options]

Options:
  --json        Output results as JSON
  --strict      Fail on warnings too (not just errors)
  --help, -h    Show this help message

Examples:
  spec validate
  spec validate --json
  spec validate --strict

Exit codes:
  0 - Validation passed
  1 - Validation failed (errors found)
`;

interface ValidateOptions {
  json: boolean;
  strict: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ValidateOptions {
  return {
    json: args.includes('--json'),
    strict: args.includes('--strict'),
    help: args.includes('--help') || args.includes('-h'),
  };
}


export async function runValidation(args: string[]): Promise<void> {
  const options = parseArgs(args);

  if (options.help) {
    console.log(VALIDATE_HELP);
    return;
  }

  // Resolve paths using the path resolution module
  const pathsResult = resolveSpecCliPaths();
  if (!pathsResult.ok) {
    console.error(`Error resolving paths: ${pathsResult.error}`);
    process.exit(1);
  }

  const { docsRoot, projectRoot } = pathsResult.value;

  if (!existsSync(docsRoot)) {
    console.error(`Docs directory not found: ${docsRoot}`);
    console.error('');
    console.error('Make sure you have a docs/ directory or configure docsDir in spec.config.yaml');
    process.exit(1);
  }

  if (!options.json) {
    console.log(`Validating docs in: ${docsRoot}`);
    console.log('');
  }

  // Collect all markdown files
  const files = collectMarkdownFiles(docsRoot, projectRoot);

  if (!options.json) {
    console.log(`Found ${files.size} markdown files`);
  }

  // Run validation
  const result = validateStructure(files);

  // Format and print results
  if (options.json) {
    console.log(formatValidationResultJson(result));
  } else {
    console.log(formatValidationResult(result));
  }

  // Determine exit code
  if (!result.valid) {
    process.exit(1);
  }

  if (options.strict && result.issues.some(issue => issue.severity === 'warning')) {
    process.exit(1);
  }

  process.exit(0);
}
