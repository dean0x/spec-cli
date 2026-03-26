/**
 * GitHub Issues integration via gh CLI
 */

import { execSync } from 'node:child_process';
import type { FeatureManifest } from './types.js';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
}

export interface SyncResult {
  feature: string;
  action: 'created' | 'updated' | 'unchanged' | 'error';
  issueNumber?: number;
  error?: string;
}

export interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Detect the GitHub repo from gh CLI
 */
export function detectRepo(): string | null {
  try {
    const output = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

/**
 * Build issue title from manifest
 */
export function buildIssueTitle(manifest: FeatureManifest): string {
  const desc = manifest.description || manifest.feature;
  return `[spec] ${manifest.feature}: ${desc}`;
}

/**
 * Build issue body from manifest
 */
export function buildIssueBody(manifest: FeatureManifest, manifestPath: string): string {
  const lines: string[] = [];

  lines.push(`## Specification: ${manifest.feature}`);
  lines.push('');
  lines.push(`**Status:** ${manifest.status}`);
  lines.push(`**Manifest:** \`${manifestPath}\``);
  lines.push('');

  if (manifest.description) {
    lines.push('### Description');
    lines.push(manifest.description);
    lines.push('');
  }

  // Owned components
  const ownedEntries = Object.entries(manifest.owns).filter(
    ([, v]) => Array.isArray(v) && v.length > 0
  );
  if (ownedEntries.length > 0) {
    lines.push('### Owned Components');
    lines.push('| Type | Component |');
    lines.push('|------|-----------|');
    for (const [type, components] of ownedEntries) {
      if (components) {
        for (const comp of components) {
          lines.push(`| ${type} | ${comp} |`);
        }
      }
    }
    lines.push('');
  }

  // Dependencies (uses)
  const usesEntries = Object.entries(manifest.uses).filter(
    ([, v]) => Array.isArray(v) && v.length > 0
  );
  if (usesEntries.length > 0) {
    lines.push('### Dependencies');
    lines.push('| Type | Component |');
    lines.push('|------|-----------|');
    for (const [type, components] of usesEntries) {
      if (components) {
        for (const comp of components) {
          lines.push(`| ${type} | ${comp} |`);
        }
      }
    }
    lines.push('');
  }

  // Referenced by
  if (manifest.referencedBy && manifest.referencedBy.length > 0) {
    lines.push('### Referenced By');
    for (const ref of manifest.referencedBy) {
      lines.push(`- ${ref}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Managed by [spec-cli](https://github.com/dean0x/spec-cli). Do not edit — body is overwritten on sync.*');
  lines.push('<!-- spec:managed -->');

  return lines.join('\n');
}

/**
 * Get labels for a manifest
 */
export function getLabelsForManifest(manifest: FeatureManifest, labelPrefix?: string): string[] {
  const prefix = labelPrefix || 'spec';
  return [prefix, `${prefix}:${manifest.status}`];
}

/**
 * Ensure labels exist in the repo (creates if missing)
 */
export function ensureLabels(repo: string, labels: string[]): void {
  for (const label of labels) {
    try {
      execSync(`gh label create "${label}" --repo "${repo}" --force`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // Label may already exist, that's fine
    }
  }
}

/**
 * Get an existing issue by number
 */
export function getIssue(repo: string, issueNumber: number): GitHubIssue | null {
  try {
    const output = execSync(
      `gh issue view ${issueNumber} --repo "${repo}" --json number,title,body,state,labels`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    const data = JSON.parse(output);
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      labels: (data.labels || []).map((l: { name: string }) => l.name),
    };
  } catch {
    return null;
  }
}

/**
 * Create a new GitHub issue
 */
export function createIssue(
  repo: string,
  title: string,
  body: string,
  labels: string[]
): number {
  const labelArgs = labels.map(l => `--label "${l}"`).join(' ');
  const output = execSync(
    `gh issue create --repo "${repo}" --title "${title}" --body "$(cat <<'SPEC_EOF'\n${body}\nSPEC_EOF\n)" ${labelArgs}`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();

  // gh issue create returns the issue URL, extract number
  const match = output.match(/\/issues\/(\d+)/);
  if (!match) {
    throw new Error(`Failed to parse issue number from: ${output}`);
  }
  return parseInt(match[1]!, 10);
}

/**
 * Update an existing GitHub issue
 */
export function updateIssue(
  repo: string,
  issueNumber: number,
  title: string,
  body: string
): void {
  execSync(
    `gh issue edit ${issueNumber} --repo "${repo}" --title "${title}" --body "$(cat <<'SPEC_EOF'\n${body}\nSPEC_EOF\n)"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

/**
 * Sync a single manifest to GitHub
 */
export function syncManifest(
  manifest: FeatureManifest,
  manifestPath: string,
  repo: string,
  options: SyncOptions = {}
): SyncResult {
  const title = buildIssueTitle(manifest);
  const body = buildIssueBody(manifest, manifestPath);
  const labels = getLabelsForManifest(manifest);

  if (options.dryRun) {
    if (manifest.github?.issue) {
      return { feature: manifest.feature, action: 'updated', issueNumber: manifest.github.issue };
    }
    return { feature: manifest.feature, action: 'created' };
  }

  try {
    if (manifest.github?.issue) {
      // Check if issue needs updating
      if (!options.force) {
        const existing = getIssue(repo, manifest.github.issue);
        if (existing && existing.title === title && existing.body === body) {
          return { feature: manifest.feature, action: 'unchanged', issueNumber: manifest.github.issue };
        }
      }

      updateIssue(repo, manifest.github.issue, title, body);
      return { feature: manifest.feature, action: 'updated', issueNumber: manifest.github.issue };
    }

    // Create new issue
    ensureLabels(repo, labels);
    const issueNumber = createIssue(repo, title, body, labels);
    return { feature: manifest.feature, action: 'created', issueNumber };
  } catch (error) {
    return {
      feature: manifest.feature,
      action: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
