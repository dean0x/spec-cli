import { describe, it, expect } from 'vitest';
import { checkPlaceholders } from './placeholders.js';
import { defaultSemanticConfig } from './config.js';
import type { SemanticConfig } from './config.js';

function enabledConfig(markers: string[] = ['TBD', 'TODO', 'FIXME', 'HACK', 'PLACEHOLDER']): SemanticConfig {
  return {
    ...defaultSemanticConfig(),
    placeholders: { enabled: true, markers },
  };
}

describe('checkPlaceholders', () => {
  it('detects TBD in prose', () => {
    const files = new Map([
      ['docs/domains/billing/model.md', '# Billing\n\nThe pricing model is TBD.'],
    ]);
    const config = enabledConfig();

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('PLACEHOLDER_MARKER');
    expect(issues[0]!.message).toContain('TBD');
    expect(issues[0]!.line).toBe(3);
  });

  it('detects TODO in prose', () => {
    const files = new Map([
      ['docs/domains/auth/overview.md', '# Auth\n\nTODO: add more details.'],
    ]);
    const config = enabledConfig();

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('TODO');
  });

  it('skips markers inside code fences', () => {
    const files = new Map([
      ['docs/domains/auth/overview.md', '# Auth\n\n```typescript\n// TODO: refactor\n```\n\nSome text.'],
    ]);
    const config = enabledConfig();

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(0);
  });

  it('skips markers in YAML frontmatter', () => {
    const files = new Map([
      ['docs/domains/auth/overview.md', '---\ntitle: TBD Feature\nstatus: draft\n---\n# Auth'],
    ]);
    const config = enabledConfig();

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const files = new Map([
      ['docs/overview/index.md', '# Overview\n\nThis is tbd for now.'],
    ]);
    const config = enabledConfig();

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('tbd');
  });

  it('does not match partial words', () => {
    const files = new Map([
      ['docs/domains/billing/model.md', '# Billing\n\nThe PLACEHOLDER_VALUE is set.'],
    ]);
    // Only match "PLACEHOLDER" as a whole word — PLACEHOLDER_VALUE should not match
    const config = enabledConfig(['PLACEHOLDER']);

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(0);
  });

  it('returns empty when config section is absent', () => {
    const files = new Map([
      ['docs/domains/billing/model.md', '# Billing\n\nTBD'],
    ]);
    const config = defaultSemanticConfig(); // no placeholders config

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(0);
  });

  it('returns empty when disabled', () => {
    const files = new Map([
      ['docs/domains/billing/model.md', '# Billing\n\nTBD'],
    ]);
    const config: SemanticConfig = {
      ...defaultSemanticConfig(),
      placeholders: { enabled: false, markers: ['TBD'] },
    };

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(0);
  });

  it('respects ignore patterns', () => {
    const files = new Map([
      ['docs/drafts/billing.md', '# Billing\n\nTBD'],
    ]);
    const config: SemanticConfig = {
      ...enabledConfig(),
      ignore: ['**/drafts/**'],
    };

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(0);
  });

  it('detects multiple markers in same file', () => {
    const files = new Map([
      ['docs/domains/auth/overview.md', '# Auth\n\nTBD for now.\n\nTODO: add details.\n\nFIXME: broken link.'],
    ]);
    const config = enabledConfig();

    const issues = checkPlaceholders(files, config);
    expect(issues).toHaveLength(3);
    const markers = issues.map((i) => i.message);
    expect(markers).toContainEqual(expect.stringContaining('TBD'));
    expect(markers).toContainEqual(expect.stringContaining('TODO'));
    expect(markers).toContainEqual(expect.stringContaining('FIXME'));
  });
});
