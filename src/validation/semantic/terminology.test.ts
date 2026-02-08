import { describe, it, expect } from 'vitest';
import { checkTerminology } from './terminology.js';
import { defaultSemanticConfig } from './config.js';
import type { SemanticConfig } from './config.js';

function configWith(glossary: Record<string, string[]>): SemanticConfig {
  return {
    ...defaultSemanticConfig(),
    terminology: { glossary },
  };
}

describe('checkTerminology', () => {
  it('detects synonym usage and suggests preferred term', () => {
    const files = new Map([
      ['docs/billing/model.md', 'The account can be suspended.'],
    ]);
    const config = configWith({ tenant: ['account'] });

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('TERMINOLOGY_INCONSISTENCY');
    expect(issues[0]!.message).toContain('account');
    expect(issues[0]!.suggestion).toContain('tenant');
  });

  it('does not flag word boundaries (accountability ≠ account)', () => {
    const files = new Map([
      ['docs/billing/model.md', 'This improves accountability across teams.'],
    ]);
    const config = configWith({ tenant: ['account'] });

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const files = new Map([
      ['docs/billing/model.md', 'The Account is important.'],
    ]);
    const config = configWith({ tenant: ['account'] });

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('Account');
  });

  it('skips content inside code fences', () => {
    const files = new Map([
      [
        'docs/billing/model.md',
        '# Header\n\n```typescript\nconst account = getAccount();\n```\n\nSome text.',
      ],
    ]);
    const config = configWith({ tenant: ['account'] });

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(0);
  });

  it('skips files matching ignore patterns', () => {
    const files = new Map([
      ['docs/drafts/billing.md', 'The account is here.'],
    ]);
    const config: SemanticConfig = {
      ...configWith({ tenant: ['account'] }),
      ignore: ['**/drafts/**'],
    };

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(0);
  });

  it('handles multiple glossary entries', () => {
    const files = new Map([
      ['docs/model.md', 'The account has a listing.'],
    ]);
    const config = configWith({
      tenant: ['account'],
      property: ['listing'],
    });

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(2);
    const codes = issues.map((i) => i.suggestion);
    expect(codes).toContainEqual(expect.stringContaining('tenant'));
    expect(codes).toContainEqual(expect.stringContaining('property'));
  });

  it('reports no issues when preferred terms are used', () => {
    const files = new Map([
      ['docs/model.md', 'The tenant has a property.'],
    ]);
    const config = configWith({
      tenant: ['account'],
      property: ['listing'],
    });

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(0);
  });

  it('reports correct line numbers', () => {
    const files = new Map([
      ['docs/model.md', 'Line 1\nLine 2\nThe account is here.\nLine 4'],
    ]);
    const config = configWith({ tenant: ['account'] });

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.line).toBe(3);
  });

  it('returns empty array when glossary is empty', () => {
    const files = new Map([
      ['docs/model.md', 'Some content with account.'],
    ]);
    const config = configWith({});

    const issues = checkTerminology(files, config);
    expect(issues).toHaveLength(0);
  });
});
