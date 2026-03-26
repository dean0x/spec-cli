/**
 * spec issues - GitHub Issues Sync Command
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { resolveSpecCliPaths } from '../core/paths.js';
import { parseManifest, serializeManifest } from '../core/manifest.js';
import {
  detectRepo,
  syncManifest,
  getLabelsForManifest,
} from '../core/github.js';
import type { FeatureManifest } from '../core/types.js';
import type { SyncResult } from '../core/github.js';

export async function runIssues(args: string[]): Promise<void> {
  const pathsResult = resolveSpecCliPaths();
  if (!pathsResult.ok) {
    console.error(`Error: ${pathsResult.error}`);
    process.exit(1);
  }

  const paths = pathsResult.value;
  const dryRun = args.includes('--dry-run');
  const jsonOutput = args.includes('--json');
  const force = args.includes('--force');

  // Check for status subcommand
  if (args[0] === 'status') {
    await showStatus(paths.manifestDir, jsonOutput);
    return;
  }

  // Determine repo
  const repo = paths.github?.repo || detectRepo();
  if (!repo) {
    console.error('Error: Could not detect GitHub repo. Run from a git repo or set github.repo in spec.config.yaml');
    process.exit(1);
  }

  // Load manifests
  const featureFilter = args.find(a => !a.startsWith('-'));
  const manifests = loadManifests(paths.manifestDir, featureFilter);

  if (manifests.length === 0) {
    console.error(featureFilter
      ? `No manifest found for feature: ${featureFilter}`
      : `No manifests found in ${paths.manifestDir}`
    );
    process.exit(1);
  }

  if (!jsonOutput && !dryRun) {
    console.log(`Syncing ${manifests.length} manifest(s) to ${repo}...`);
  }
  if (!jsonOutput && dryRun) {
    console.log(`Dry run: previewing sync for ${manifests.length} manifest(s) to ${repo}...`);
  }

  const results: SyncResult[] = [];

  for (const { manifest, filePath } of manifests) {
    const manifestRelPath = `.manifests/features/${basename(filePath)}`;
    const result = syncManifest(manifest, manifestRelPath, repo, { dryRun, force });
    results.push(result);

    // Write back issue number if created
    if (result.action === 'created' && result.issueNumber && !dryRun) {
      const updated: FeatureManifest = {
        ...manifest,
        github: {
          ...manifest.github,
          issue: result.issueNumber,
          labels: getLabelsForManifest(manifest),
        },
      };
      writeFileSync(filePath, serializeManifest(updated) + '\n');
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      const icon = r.action === 'created' ? '+' : r.action === 'updated' ? '~' : r.action === 'error' ? '!' : '=';
      const issue = r.issueNumber ? ` #${r.issueNumber}` : '';
      const err = r.error ? ` (${r.error})` : '';
      console.log(`  ${icon} ${r.feature}${issue}${err}`);
    }

    const created = results.filter(r => r.action === 'created').length;
    const updated = results.filter(r => r.action === 'updated').length;
    const unchanged = results.filter(r => r.action === 'unchanged').length;
    const errors = results.filter(r => r.action === 'error').length;

    console.log(`\nDone: ${created} created, ${updated} updated, ${unchanged} unchanged, ${errors} errors`);
  }
}

function loadManifests(
  manifestDir: string,
  featureFilter?: string
): Array<{ manifest: FeatureManifest; filePath: string }> {
  let files: string[];
  try {
    files = readdirSync(manifestDir).filter(f => f.endsWith('.yaml'));
  } catch {
    return [];
  }

  if (featureFilter) {
    files = files.filter(f => f === `${featureFilter}.yaml`);
  }

  const results: Array<{ manifest: FeatureManifest; filePath: string }> = [];
  for (const file of files) {
    const filePath = join(manifestDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const manifest = parseManifest(content);
    if (manifest) {
      results.push({ manifest, filePath });
    }
  }

  return results;
}

async function showStatus(manifestDir: string, jsonOutput: boolean): Promise<void> {
  const manifests = loadManifests(manifestDir);

  if (jsonOutput) {
    const status = manifests.map(({ manifest }) => ({
      feature: manifest.feature,
      status: manifest.status,
      issue: manifest.github?.issue ?? null,
    }));
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log('Feature'.padEnd(30) + 'Status'.padEnd(12) + 'Issue');
  console.log('-'.repeat(55));
  for (const { manifest } of manifests) {
    const issue = manifest.github?.issue ? `#${manifest.github.issue}` : '—';
    console.log(
      manifest.feature.padEnd(30) +
      manifest.status.padEnd(12) +
      issue
    );
  }
}
