import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  scanSubdirectories,
  extractFrameworkRules,
  buildContextMarkdown,
  writeContextToClaudeMd,
} from './context.js';

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'spec-context-'));
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('scanSubdirectories', () => {
  it('returns sorted directory names', () => {
    mkdirSync(join(testDir, 'beta'));
    mkdirSync(join(testDir, 'alpha'));
    mkdirSync(join(testDir, 'gamma'));
    writeFileSync(join(testDir, 'file.md'), 'not a dir');

    expect(scanSubdirectories(testDir)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('returns empty array for nonexistent directory', () => {
    expect(scanSubdirectories(join(testDir, 'nope'))).toEqual([]);
  });

  it('returns empty array for empty directory', () => {
    const emptyDir = join(testDir, 'empty');
    mkdirSync(emptyDir);
    expect(scanSubdirectories(emptyDir)).toEqual([]);
  });
});

describe('extractFrameworkRules', () => {
  it('extracts numbered rules with dot format', () => {
    const content = `## Documentation Rules

### 1. Single Source of Truth (SSOT)

Every concept has ONE canonical location.

### 2. Layer Boundaries

Files can only reference files in same or lower layers.
`;
    const rules = extractFrameworkRules(content);
    expect(rules).toEqual([
      { number: 1, name: 'Single Source of Truth (SSOT)', summary: 'Every concept has ONE canonical location.' },
      { number: 2, name: 'Layer Boundaries', summary: 'Files can only reference files in same or lower layers.' },
    ]);
  });

  it('extracts "Rule N:" format', () => {
    const content = `## Documentation Rules

### Rule 7: ADR Content Discipline

ADRs document decisions and rationale.

### Rule 8: Schema Purity

Schema files contain DDL, constraints, indexes, RLS policies, and reference data (enum catalogs).
`;
    const rules = extractFrameworkRules(content);
    expect(rules).toEqual([
      { number: 7, name: 'ADR Content Discipline', summary: 'ADRs document decisions and rationale.' },
      { number: 8, name: 'Schema Purity', summary: 'Schema files contain DDL, constraints, indexes, RLS policies, and reference data (enum catalogs).' },
    ]);
  });

  it('handles mixed formats', () => {
    const content = `## Documentation Rules

### 1. First Rule

First summary.

### Rule 2: Second Rule

Second summary.
`;
    const rules = extractFrameworkRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0]!.number).toBe(1);
    expect(rules[1]!.number).toBe(2);
  });

  it('skips headings followed by code fences', () => {
    const content = `## Documentation Rules

### 3. Code Example Rule

\`\`\`markdown
Example code
\`\`\`
`;
    const rules = extractFrameworkRules(content);
    expect(rules).toEqual([
      { number: 3, name: 'Code Example Rule', summary: '' },
    ]);
  });

  it('skips headings followed by tables', () => {
    const content = `## Documentation Rules

### 4. Table Rule

| Col | Val |
|-----|-----|
`;
    const rules = extractFrameworkRules(content);
    expect(rules).toEqual([
      { number: 4, name: 'Table Rule', summary: '' },
    ]);
  });

  it('returns empty array when no Documentation Rules section', () => {
    const content = '# No rules here\n\nJust text.\n';
    expect(extractFrameworkRules(content)).toEqual([]);
  });

  it('truncates summary at first period', () => {
    const content = `## Documentation Rules

### 1. My Rule

This is the first sentence. This is the second sentence.
`;
    const rules = extractFrameworkRules(content);
    expect(rules[0]!.summary).toBe('This is the first sentence.');
  });

  it('stops at next ## section (does not extract anti-patterns)', () => {
    const content = `## Documentation Rules

### 1. Real Rule

Real summary.

---

## Anti-Patterns

### 1. Fake Pattern

Should not appear.
`;
    const rules = extractFrameworkRules(content);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.name).toBe('Real Rule');
  });
});

describe('buildContextMarkdown', () => {
  it('includes markers', () => {
    const result = buildContextMarkdown(testDir);
    expect(result).toContain('<!-- spec:context:start -->');
    expect(result).toContain('<!-- spec:context:end -->');
  });

  it('always includes validation and file size sections', () => {
    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Validation');
    expect(result).toContain('`spec validate`');
    expect(result).toContain('### File Size Limits');
    expect(result).toContain('schema');
    expect(result).toContain('400');
  });

  it('omits domains section when no domains exist', () => {
    const result = buildContextMarkdown(testDir);
    expect(result).not.toContain('### Domains');
  });

  it('includes domains when they exist', () => {
    mkdirSync(join(testDir, 'docs', 'domains', 'auth'), { recursive: true });
    mkdirSync(join(testDir, 'docs', 'domains', 'billing'), { recursive: true });

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Domains');
    expect(result).toContain('`auth`');
    expect(result).toContain('`billing`');
  });

  it('includes products when they exist', () => {
    mkdirSync(join(testDir, 'docs', 'products', 'web-app'), { recursive: true });

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Products');
    expect(result).toContain('`web-app`');
  });

  it('includes terminology from spec.semantic.json', () => {
    const semanticConfig = {
      terminology: {
        glossary: { organization: ['tenant', 'account'] },
      },
    };
    writeFileSync(join(testDir, 'spec.semantic.json'), JSON.stringify(semanticConfig));

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Terminology');
    expect(result).toContain('organization');
    expect(result).toContain('tenant, account');
  });

  it('includes required sections from spec.semantic.json', () => {
    const semanticConfig = {
      completeness: {
        requiredSections: {
          decision: ['## Context', '## Decision'],
        },
      },
    };
    writeFileSync(join(testDir, 'spec.semantic.json'), JSON.stringify(semanticConfig));

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Required Sections');
    expect(result).toContain('**decision**: Context, Decision');
  });

  it('includes enabled semantic checkers', () => {
    const semanticConfig = {
      terminology: { glossary: { foo: ['bar'] } },
      placeholders: { enabled: true, markers: ['TBD'] },
    };
    writeFileSync(join(testDir, 'spec.semantic.json'), JSON.stringify(semanticConfig));

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Semantic Checks');
    expect(result).toContain('terminology');
    expect(result).toContain('placeholders');
  });

  it('includes framework rules from docs/FRAMEWORK.md', () => {
    mkdirSync(join(testDir, 'docs'), { recursive: true });
    writeFileSync(
      join(testDir, 'docs', 'FRAMEWORK.md'),
      '## Documentation Rules\n\n### 1. Single Source of Truth\n\nNever duplicate.\n',
    );

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Framework Rules');
    expect(result).toContain('**Single Source of Truth**');
    expect(result).toContain('Never duplicate.');
  });

  it('finds FRAMEWORK.md at project root if not in docs/', () => {
    writeFileSync(
      join(testDir, 'FRAMEWORK.md'),
      '## Documentation Rules\n\n### 1. My Rule\n\nSummary here.\n',
    );

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('### Framework Rules');
    expect(result).toContain('**My Rule**');
  });

  it('respects docsDir from spec.config.yaml', () => {
    writeFileSync(join(testDir, 'spec.config.yaml'), 'docsDir: specifications\n');
    mkdirSync(join(testDir, 'specifications', 'domains', 'auth'), { recursive: true });

    const result = buildContextMarkdown(testDir);
    expect(result).toContain('specifications/domains/auth/');
  });

  it('omits terminology section when no glossary entries', () => {
    const semanticConfig = {
      terminology: { glossary: {} },
    };
    writeFileSync(join(testDir, 'spec.semantic.json'), JSON.stringify(semanticConfig));

    const result = buildContextMarkdown(testDir);
    expect(result).not.toContain('### Terminology');
  });
});

describe('writeContextToClaudeMd', () => {
  const sampleContext = '<!-- spec:context:start -->\n## Context\n<!-- spec:context:end -->';

  it('creates new CLAUDE.md when none exists', () => {
    writeContextToClaudeMd(testDir, sampleContext);

    const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('<!-- spec:context:start -->');
    expect(content).toContain('<!-- spec:context:end -->');
  });

  it('appends to existing CLAUDE.md without markers', () => {
    writeFileSync(join(testDir, 'CLAUDE.md'), '# My Project\n\nCustom content.\n');

    writeContextToClaudeMd(testDir, sampleContext);

    const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Custom content.');
    expect(content).toContain('<!-- spec:context:start -->');
  });

  it('replaces existing marker section', () => {
    const existing = `# My Project

Custom content.

<!-- spec:context:start -->
## Old Context
Old stuff here.
<!-- spec:context:end -->

## More Custom Content
`;
    writeFileSync(join(testDir, 'CLAUDE.md'), existing);

    const newContext = '<!-- spec:context:start -->\n## New Context\nFresh content.\n<!-- spec:context:end -->';
    writeContextToClaudeMd(testDir, newContext);

    const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Custom content.');
    expect(content).toContain('## New Context');
    expect(content).toContain('Fresh content.');
    expect(content).toContain('## More Custom Content');
    expect(content).not.toContain('Old stuff here.');
  });

  it('is idempotent — running twice produces same result', () => {
    writeContextToClaudeMd(testDir, sampleContext);
    const first = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');

    writeContextToClaudeMd(testDir, sampleContext);
    const second = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');

    expect(first).toBe(second);
  });

  it('preserves content before and after markers', () => {
    const existing = `Before content.

<!-- spec:context:start -->
Original.
<!-- spec:context:end -->

After content.`;
    writeFileSync(join(testDir, 'CLAUDE.md'), existing);

    const updated = '<!-- spec:context:start -->\nUpdated.\n<!-- spec:context:end -->';
    writeContextToClaudeMd(testDir, updated);

    const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(`Before content.

<!-- spec:context:start -->
Updated.
<!-- spec:context:end -->

After content.`);
  });
});
