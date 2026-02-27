import { describe, it, expect } from 'vitest';
import { checkDependencyHealth } from './dependency-health.js';
import { defaultSemanticConfig } from './config.js';
import type { SemanticConfig } from './config.js';

function makeConfig(overrides: Partial<SemanticConfig['dependencyHealth']> = {}): SemanticConfig {
  const config = defaultSemanticConfig();
  config.dependencyHealth = { ...config.dependencyHealth, ...overrides };
  return config;
}

describe('checkDependencyHealth', () => {
  it('reports no issues when dependencies exist and are healthy', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/org-management.md',
        '---\ntitle: Org Management\ndependencies: organizations, users\n---\n# Content',
      ],
      ['docs/domains/organizations/overview.md', '---\ntitle: Organizations\n---\n# Orgs'],
      ['docs/domains/users/overview.md', '---\ntitle: Users\n---\n# Users'],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(0);
  });

  it('flags missing dependency when domain directory does not exist', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/org-management.md',
        '---\ntitle: Org Management\ndependencies: organizations, billing\n---\n# Content',
      ],
      ['docs/domains/organizations/overview.md', '---\ntitle: Organizations\n---\n# Orgs'],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('MISSING_DEPENDENCY');
    expect(issues[0]!.message).toContain('billing');
  });

  it('flags unhealthy dependency when domain is in unhealthyDomains list', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/org-management.md',
        '---\ntitle: Org Management\ndependencies: billing\n---\n# Content',
      ],
      ['docs/domains/billing/overview.md', '---\ntitle: Billing\n---\n# Billing'],
    ]);
    const config = makeConfig({ unhealthyDomains: ['billing'] });

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('UNHEALTHY_DEPENDENCY');
    expect(issues[0]!.message).toContain('billing');
  });

  it('reports no issues when file has no dependencies field', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/org-management.md',
        '---\ntitle: Org Management\n---\n# Content',
      ],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(0);
  });

  it('skips dependencies declared as "none"', () => {
    const files = new Map([
      [
        'docs/domains/users/overview.md',
        '---\ntitle: Users\ndependencies: none\n---\n# Content',
      ],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(0);
  });

  it('returns empty array when disabled', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/org-management.md',
        '---\ntitle: Org Management\ndependencies: nonexistent\n---\n# Content',
      ],
    ]);
    const config = makeConfig({ enabled: false });

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(0);
  });

  it('only flags unhealthy dependency, not the healthy ones', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/org-management.md',
        '---\ntitle: Org Management\ndependencies: organizations, billing, users\n---\n# Content',
      ],
      ['docs/domains/organizations/overview.md', '---\ntitle: Organizations\n---\n# Orgs'],
      ['docs/domains/billing/overview.md', '---\ntitle: Billing\n---\n# Billing'],
      ['docs/domains/users/overview.md', '---\ntitle: Users\n---\n# Users'],
    ]);
    const config = makeConfig({ unhealthyDomains: ['billing'] });

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('UNHEALTHY_DEPENDENCY');
    expect(issues[0]!.message).toContain('billing');
  });

  it('recognizes schema files as valid dependency targets', () => {
    const files = new Map([
      [
        'docs/products/alefy/features/user-management.md',
        '---\ntitle: User Management\ndependencies: users\n---\n# Content',
      ],
      ['docs/schemas/users.md', '---\ntitle: Users Schema\n---\n# Users'],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(0);
  });

  it('skips files matching ignore patterns', () => {
    const files = new Map([
      [
        'docs/drafts/feature.md',
        '---\ntitle: Draft Feature\ndependencies: nonexistent\n---\n# Content',
      ],
    ]);
    const config: SemanticConfig = {
      ...makeConfig(),
      ignore: ['**/drafts/**'],
    };

    const issues = checkDependencyHealth(files, config);
    expect(issues).toHaveLength(0);
  });

  it('detects A → B → A circular dependency', () => {
    const files = new Map([
      [
        'docs/domains/auth/overview.md',
        '---\ntitle: Auth\ndependencies: users\n---\n# Auth',
      ],
      [
        'docs/domains/users/overview.md',
        '---\ntitle: Users\ndependencies: auth\n---\n# Users',
      ],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    const circularIssues = issues.filter((i) => i.code === 'CIRCULAR_DEPENDENCY');
    expect(circularIssues).toHaveLength(1);
    expect(circularIssues[0]!.message).toContain('auth');
    expect(circularIssues[0]!.message).toContain('users');
  });

  it('detects A → B → C → A circular dependency', () => {
    const files = new Map([
      [
        'docs/domains/auth/overview.md',
        '---\ntitle: Auth\ndependencies: users\n---\n# Auth',
      ],
      [
        'docs/domains/users/overview.md',
        '---\ntitle: Users\ndependencies: billing\n---\n# Users',
      ],
      [
        'docs/domains/billing/overview.md',
        '---\ntitle: Billing\ndependencies: auth\n---\n# Billing',
      ],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    const circularIssues = issues.filter((i) => i.code === 'CIRCULAR_DEPENDENCY');
    expect(circularIssues).toHaveLength(1);
    expect(circularIssues[0]!.message).toContain('Circular dependency detected');
  });

  it('does not report circular dependency for acyclic chains', () => {
    const files = new Map([
      [
        'docs/domains/auth/overview.md',
        '---\ntitle: Auth\ndependencies: users\n---\n# Auth',
      ],
      [
        'docs/domains/users/overview.md',
        '---\ntitle: Users\ndependencies: billing\n---\n# Users',
      ],
      [
        'docs/domains/billing/overview.md',
        '---\ntitle: Billing\n---\n# Billing',
      ],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    const circularIssues = issues.filter((i) => i.code === 'CIRCULAR_DEPENDENCY');
    expect(circularIssues).toHaveLength(0);
  });

  it('detects self-dependency', () => {
    const files = new Map([
      [
        'docs/domains/auth/overview.md',
        '---\ntitle: Auth\ndependencies: auth\n---\n# Auth',
      ],
    ]);
    const config = makeConfig();

    const issues = checkDependencyHealth(files, config);
    const circularIssues = issues.filter((i) => i.code === 'CIRCULAR_DEPENDENCY');
    expect(circularIssues).toHaveLength(1);
    expect(circularIssues[0]!.message).toContain('auth');
  });
});
