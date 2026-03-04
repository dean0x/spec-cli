/**
 * CLAUDE.md Context Generator
 *
 * Generates a project-specific context section for CLAUDE.md from:
 * - Domain directories
 * - Product directories
 * - spec.semantic.json (terminology, completeness, checkers)
 * - FRAMEWORK.md (rule summaries)
 * - File size limits (from CLI)
 *
 * Output is bounded by <!-- spec:context:start/end --> markers for
 * idempotent regeneration without clobbering user content.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../core/paths.js';
import { loadSemanticConfig } from '../validation/semantic/config.js';
import type { SemanticConfig } from '../validation/semantic/config.js';
import { FILE_SIZE_LIMITS } from '../validation/structural/file-size-checker.js';

const MARKER_START = '<!-- spec:context:start -->';
const MARKER_END = '<!-- spec:context:end -->';
const DEFAULT_LINE_LIMIT = 500;

/**
 * Scan a directory for subdirectory names (ignoring files).
 * Returns sorted list of directory names, or empty array if dir doesn't exist.
 */
export function scanSubdirectories(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  try {
    const entries = readdirSync(dirPath);
    return entries
      .filter((entry) => {
        const fullPath = join(dirPath, entry);
        try {
          return statSync(fullPath).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

/**
 * Extract numbered rule headings and first-sentence summaries from FRAMEWORK.md.
 *
 * Handles two heading formats:
 * - `### 1. Single Source of Truth (SSOT)` → name: "Single Source of Truth (SSOT)"
 * - `### Rule 7: ADR Content Discipline` → name: "ADR Content Discipline"
 */
export function extractFrameworkRules(content: string): Array<{ number: number; name: string; summary: string }> {
  const lines = content.split('\n');
  const rules: Array<{ number: number; name: string; summary: string }> = [];

  // Find the "## Documentation Rules" section boundary
  let inRulesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Track whether we're in the Documentation Rules section
    if (/^##\s+Documentation Rules/.test(line)) {
      inRulesSection = true;
      continue;
    }
    // Stop at the next ## heading (different section)
    if (inRulesSection && /^##\s+/.test(line) && !/^###/.test(line)) {
      break;
    }

    if (!inRulesSection) continue;

    // Match: ### 1. Name or ### Rule 7: Name
    const numberedMatch = line.match(/^###\s+(\d+)\.\s+(.+)$/);
    const ruleMatch = line.match(/^###\s+Rule\s+(\d+):\s+(.+)$/);

    const match = ruleMatch ?? numberedMatch;
    if (!match) continue;

    const num = parseInt(match[1]!, 10);
    const name = match[2]!.trim();

    // Find first non-empty paragraph after heading
    let summary = '';
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j]!.trim();
      // Skip empty lines
      if (nextLine === '') continue;
      // Stop at next heading or horizontal rule
      if (nextLine.startsWith('#') || nextLine === '---') break;
      // Skip code fences, tables, block quotes for first sentence
      if (nextLine.startsWith('```') || nextLine.startsWith('|') || nextLine.startsWith('>')) break;
      // Use first sentence (up to period)
      const periodIdx = nextLine.indexOf('.');
      summary = periodIdx !== -1 ? nextLine.slice(0, periodIdx + 1) : nextLine;
      break;
    }

    rules.push({ number: num, name, summary });
  }

  return rules;
}

/**
 * Find FRAMEWORK.md in the project — checks docsDir first, then project root.
 * Returns the content and relative path, or null if not found.
 */
function findFrameworkFile(projectRoot: string, docsDir: string): { content: string; relativePath: string } | null {
  const candidates = [
    { path: join(projectRoot, docsDir, 'FRAMEWORK.md'), rel: `${docsDir}/FRAMEWORK.md` },
    { path: join(projectRoot, 'FRAMEWORK.md'), rel: 'FRAMEWORK.md' },
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate.path)) {
      try {
        return { content: readFileSync(candidate.path, 'utf-8'), relativePath: candidate.rel };
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Determine which semantic checkers are enabled based on config.
 */
function getEnabledCheckers(config: SemanticConfig): string[] {
  const checkers: string[] = [];

  // These are always enabled when config exists
  if (Object.keys(config.terminology.glossary).length > 0) {
    checkers.push('terminology');
  }
  if (config.staleness.flagUndatedEstimates) {
    checkers.push('staleness');
  }
  if (Object.keys(config.completeness.requiredSections).length > 0) {
    checkers.push('completeness');
  }
  if (config.crossReference.scopeConsistency || config.crossReference.stateConsistency || config.crossReference.errorCodeUniqueness) {
    checkers.push('cross-references');
  }
  if (config.dependencyHealth.enabled) {
    checkers.push('dependency-health');
  }
  if (Object.keys(config.domainCoupling.domains).length > 0) {
    checkers.push('domain-coupling');
  }
  if (config.placeholders?.enabled) {
    checkers.push('placeholders');
  }

  return checkers;
}

/**
 * Build the markdown content for the spec context section.
 */
export function buildContextMarkdown(projectRoot: string): string {
  const configResult = loadConfig(projectRoot);
  const docsDir = configResult.ok ? (configResult.value.docsDir ?? 'docs') : 'docs';

  const sections: string[] = [];

  sections.push(`${MARKER_START}`);
  sections.push('## Spec Framework Context\n');
  sections.push('This project uses [spec-cli](https://github.com/dean0x/spec-cli) for documentation management.\n');

  // Domains
  const domainsPath = join(projectRoot, docsDir, 'domains');
  const domains = scanSubdirectories(domainsPath);
  if (domains.length > 0) {
    sections.push('### Domains\n');
    for (const domain of domains) {
      sections.push(`- \`${domain}\` — ${docsDir}/domains/${domain}/`);
    }
    sections.push('');
  }

  // Products
  const productsPath = join(projectRoot, docsDir, 'products');
  const products = scanSubdirectories(productsPath);
  if (products.length > 0) {
    sections.push('### Products\n');
    for (const product of products) {
      sections.push(`- \`${product}\` — ${docsDir}/products/${product}/`);
    }
    sections.push('');
  }

  // Semantic config sections
  const semanticResult = loadSemanticConfig(projectRoot);
  if (semanticResult.ok) {
    const config = semanticResult.value;

    // Terminology
    const glossary = config.terminology.glossary;
    const glossaryEntries = Object.entries(glossary);
    if (glossaryEntries.length > 0) {
      sections.push('### Terminology\n');
      sections.push('| Preferred | Avoid |');
      sections.push('|-----------|-------|');
      for (const [preferred, avoid] of glossaryEntries) {
        sections.push(`| ${preferred} | ${avoid.join(', ')} |`);
      }
      sections.push('');
    }

    // Required Sections
    const reqSections = config.completeness.requiredSections;
    const reqEntries = Object.entries(reqSections);
    if (reqEntries.length > 0) {
      sections.push('### Required Sections\n');
      for (const [type, headings] of reqEntries) {
        sections.push(`- **${type}**: ${headings.map((h) => h.replace(/^#+\s*/, '')).join(', ')}`);
      }
      sections.push('');
    }

    // Enabled semantic checkers
    const checkers = getEnabledCheckers(config);
    if (checkers.length > 0) {
      sections.push('### Semantic Checks\n');
      sections.push(`Enabled: ${checkers.join(', ')}\n`);
    }
  }

  // Validation commands (always included)
  sections.push('### Validation\n');
  sections.push('- `spec validate` — structural: links, layers, frontmatter, orphans, self-refs, DDL, file size');
  sections.push('- `spec validate --semantic` — + terminology, staleness, completeness, cross-refs, deps, coupling, placeholders');
  sections.push('- `spec validate --deep` — + LLM analysis: contradictions, coherence, implicit deps, schema purity\n');

  // File size limits (always included)
  sections.push('### File Size Limits\n');
  sections.push('| Type | Max Lines |');
  sections.push('|------|-----------|');
  for (const [type, limit] of Object.entries(FILE_SIZE_LIMITS)) {
    sections.push(`| ${type} | ${limit} |`);
  }
  sections.push(`| default | ${DEFAULT_LINE_LIMIT} |`);
  sections.push('');

  // Framework rules
  const framework = findFrameworkFile(projectRoot, docsDir);
  if (framework) {
    const rules = extractFrameworkRules(framework.content);
    if (rules.length > 0) {
      sections.push('### Framework Rules\n');
      sections.push(`> From [FRAMEWORK.md](${framework.relativePath})\n`);
      for (const rule of rules) {
        const summaryPart = rule.summary ? ` — ${rule.summary}` : '';
        sections.push(`${rule.number}. **${rule.name}**${summaryPart}`);
      }
      sections.push('');
    }
  }

  sections.push(MARKER_END);

  return sections.join('\n');
}

/**
 * Write the context section to CLAUDE.md in the project root.
 *
 * - If CLAUDE.md exists with markers: replace between markers
 * - If CLAUDE.md exists without markers: append section
 * - If no CLAUDE.md: create it with just the section
 */
export function writeContextToClaudeMd(projectRoot: string, contextMarkdown: string): void {
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');
  const markerStartRegex = new RegExp(escapeRegExp(MARKER_START));
  const markerEndRegex = new RegExp(escapeRegExp(MARKER_END));

  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, 'utf-8');

    if (markerStartRegex.test(existing) && markerEndRegex.test(existing)) {
      // Replace between markers (inclusive)
      const startIdx = existing.indexOf(MARKER_START);
      const endIdx = existing.indexOf(MARKER_END) + MARKER_END.length;
      const before = existing.slice(0, startIdx);
      const after = existing.slice(endIdx);
      writeFileSync(claudeMdPath, before + contextMarkdown + after);
    } else {
      // Append with separator
      const separator = existing.endsWith('\n') ? '\n' : '\n\n';
      writeFileSync(claudeMdPath, existing + separator + contextMarkdown + '\n');
    }
  } else {
    // Create new file
    writeFileSync(claudeMdPath, contextMarkdown + '\n');
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate and write project context to CLAUDE.md.
 * Called by `spec init`.
 */
export function generateContext(projectRoot: string): void {
  const contextMarkdown = buildContextMarkdown(projectRoot);
  writeContextToClaudeMd(projectRoot, contextMarkdown);
  console.log('  Generated CLAUDE.md context section');
}
