import { describe, it, expect } from 'vitest';
import { checkCompleteness } from './completeness.js';
import { defaultSemanticConfig } from './config.js';
import type { SemanticConfig } from './config.js';

function configWithSections(requiredSections: Record<string, string[]>): SemanticConfig {
  return {
    ...defaultSemanticConfig(),
    completeness: { requiredSections },
  };
}

describe('checkCompleteness', () => {
  it('detects missing required section', () => {
    const files = new Map([
      [
        'docs/architecture/decisions/adr-001.md',
        '---\ntitle: ADR-001\n---\n\n## Context\n\nSome context.\n\n## Decision\n\nWe decided X.',
      ],
    ]);
    const config = configWithSections({
      decision: ['## Context', '## Decision', '## Consequences'],
    });

    const issues = checkCompleteness(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('MISSING_REQUIRED_SECTION');
    expect(issues[0]!.message).toContain('Consequences');
  });

  it('passes when all required sections are present', () => {
    const content = [
      '---',
      'title: ADR-001',
      '---',
      '',
      '## Context',
      'Some context.',
      '',
      '## Decision',
      'We decided X.',
      '',
      '## Consequences',
      'The result.',
    ].join('\n');

    const files = new Map([['docs/architecture/decisions/adr-001.md', content]]);
    const config = configWithSections({
      decision: ['## Context', '## Decision', '## Consequences'],
    });

    const issues = checkCompleteness(files, config);
    expect(issues).toHaveLength(0);
  });

  it('ignores files with no configured required sections', () => {
    const files = new Map([
      ['docs/infrastructure/gcp.md', '# GCP\n\nSome content.'],
    ]);
    const config = configWithSections({
      decision: ['## Context', '## Decision'],
    });

    const issues = checkCompleteness(files, config);
    expect(issues).toHaveLength(0);
  });

  it('matches headings case-insensitively', () => {
    const content = [
      '---',
      'title: ADR-002',
      '---',
      '',
      '## context',
      'Lower case heading.',
    ].join('\n');

    const files = new Map([['docs/architecture/decisions/adr-002.md', content]]);
    const config = configWithSections({
      decision: ['## Context'],
    });

    const issues = checkCompleteness(files, config);
    expect(issues).toHaveLength(0);
  });

  it('skips ignored files', () => {
    const files = new Map([
      ['docs/architecture/decisions/_template.md', '# Template\n\nNo sections.'],
    ]);
    const config: SemanticConfig = {
      ...configWithSections({
        decision: ['## Context', '## Decision'],
      }),
      ignore: ['**/_template.md'],
    };

    const issues = checkCompleteness(files, config);
    expect(issues).toHaveLength(0);
  });

  it('returns empty when no requiredSections configured', () => {
    const files = new Map([
      ['docs/architecture/decisions/adr-001.md', '# ADR\n\nNo sections.'],
    ]);
    const config = configWithSections({});

    const issues = checkCompleteness(files, config);
    expect(issues).toHaveLength(0);
  });
});
