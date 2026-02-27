/**
 * Domain Coupling Checker
 *
 * Detects when files outside a domain's directory contain that domain's
 * implementation-specific marker terms. Helps enforce modularity by
 * keeping domain details within domain boundaries.
 */

import type { ValidationIssue } from '../../core/types.js';
import type { SemanticConfig } from './config.js';
import { getNonProseLines } from './prose.js';
import { matchesIgnorePattern } from './ignore.js';

interface DomainMatcher {
  domain: string;
  term: string;
  pattern: RegExp;
}

/**
 * Build matchers for each domain's marker terms.
 * If a term contains `.*`, treat it as a regex.
 * Otherwise, create a word-boundary case-insensitive regex.
 */
function buildMatchers(domains: Record<string, string[]>): DomainMatcher[] {
  const matchers: DomainMatcher[] = [];

  for (const [domain, terms] of Object.entries(domains)) {
    for (const term of terms) {
      let pattern: RegExp;
      if (term.includes('.*')) {
        pattern = new RegExp(term, 'i');
      } else {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = new RegExp(`\\b${escaped}\\b`, 'i');
      }
      matchers.push({ domain, term, pattern });
    }
  }

  return matchers;
}

/**
 * Check if a file belongs to a domain (its own directory or schema file).
 */
function isDomainOwnFile(filePath: string, domain: string): boolean {
  // Domain's own directory: docs/domains/{domain}/
  if (filePath.includes(`docs/domains/${domain}/`)) return true;

  // Domain's schema file: docs/schemas/{domain}.md
  if (filePath === `docs/schemas/${domain}.md`) return true;

  return false;
}

/**
 * Check all files for domain coupling violations.
 *
 * Detects when files outside a domain's directory contain that domain's
 * implementation-specific marker terms. Helps enforce modularity.
 */
export function checkDomainCoupling(
  files: Map<string, string>,
  config: SemanticConfig,
): ValidationIssue[] {
  const { domains } = config.domainCoupling;

  if (Object.keys(domains).length === 0) return [];

  const matchers = buildMatchers(domains);
  if (matchers.length === 0) return [];

  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of files) {
    if (matchesIgnorePattern(filePath, config.ignore)) continue;

    // Build set of domains this file belongs to (skip those)
    const ownedDomains = new Set<string>();
    for (const domain of Object.keys(domains)) {
      if (isDomainOwnFile(filePath, domain)) {
        ownedDomains.add(domain);
      }
    }

    const lines = content.split('\n');
    const nonProseLines = getNonProseLines(lines);

    for (let i = 0; i < lines.length; i++) {
      if (nonProseLines.has(i)) continue;

      const line = lines[i];
      if (line === undefined) continue;

      // Strip markdown link targets to avoid matching file paths
      const lineForMatching = line.replace(/\]\([^)]*\)/g, '](...)');

      for (const matcher of matchers) {
        // Skip if this file belongs to the matcher's domain
        if (ownedDomains.has(matcher.domain)) continue;

        if (matcher.pattern.test(lineForMatching)) {
          issues.push({
            severity: 'warning',
            code: 'DOMAIN_COUPLING',
            message: `Found ${matcher.domain}-specific term "${matcher.term}" in non-${matcher.domain} file`,
            file: filePath,
            line: i + 1,
            suggestion: `Consider moving this detail into docs/domains/${matcher.domain}/ or abstracting the reference`,
          });
        }
      }
    }
  }

  return issues;
}
