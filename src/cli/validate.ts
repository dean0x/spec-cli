/**
 * spec validate command
 *
 * Runs structural validation on the consumer's docs directory.
 * Optionally runs semantic validation (advisory) with --semantic.
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
import {
  validateSemantics,
  formatSemanticResult,
  loadSemanticConfig,
} from '../validation/semantic/index.js';

const VALIDATE_HELP = `
spec validate - Run structural validation on documentation

Usage:
  spec validate [options]

Options:
  --json        Output results as JSON
  --strict      Fail on warnings too (not just errors)
  --semantic    Run semantic validation (advisory, never affects exit code)
  --help, -h    Show this help message

Examples:
  spec validate
  spec validate --json
  spec validate --strict
  spec validate --semantic

Exit codes:
  0 - Validation passed
  1 - Validation failed (errors found)
`;

interface ValidateOptions {
  json: boolean;
  strict: boolean;
  semantic: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ValidateOptions {
  return {
    json: args.includes('--json'),
    strict: args.includes('--strict'),
    semantic: args.includes('--semantic'),
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

  // Run structural validation
  const result = validateStructure(files);

  // Format and print structural results
  if (options.json) {
    if (options.semantic) {
      // Combined JSON output
      const configResult = loadSemanticConfig(projectRoot);
      if (!configResult.ok) {
        console.error(`Semantic config error: ${configResult.error}`);
        process.exit(1);
      }
      const semanticResult = validateSemantics(files, configResult.value);

      const combined = {
        structural: result,
        semantic: semanticResult,
      };
      console.log(JSON.stringify(combined, null, 2));
    } else {
      console.log(formatValidationResultJson(result));
    }
  } else {
    console.log(formatValidationResult(result));

    // Run semantic validation if requested
    if (options.semantic) {
      const configResult = loadSemanticConfig(projectRoot);
      if (!configResult.ok) {
        console.error(`Semantic config error: ${configResult.error}`);
        process.exit(1);
      }

      const semanticResult = validateSemantics(files, configResult.value);
      console.log(formatSemanticResult(semanticResult));
    }
  }

  // Determine exit code — semantic issues NEVER affect exit code
  if (!result.valid) {
    process.exit(1);
  }

  if (options.strict && result.issues.some(issue => issue.severity === 'warning')) {
    process.exit(1);
  }

  process.exit(0);
}
