import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSemanticConfig, defaultSemanticConfig } from './config.js';

describe('loadSemanticConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'spec-semantic-config-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', () => {
    const result = loadSemanticConfig(tempDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(defaultSemanticConfig());
  });

  it('parses valid JSON config and merges with defaults', () => {
    const config = {
      terminology: {
        glossary: {
          tenant: ['organization', 'account'],
        },
      },
      ignore: ['**/drafts/**'],
    };
    writeFileSync(join(tempDir, 'spec.semantic.json'), JSON.stringify(config));

    const result = loadSemanticConfig(tempDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.terminology.glossary).toEqual({
      tenant: ['organization', 'account'],
    });
    expect(result.value.ignore).toEqual(['**/drafts/**']);
    // Defaults should be preserved for unspecified fields
    expect(result.value.staleness.flagUndatedEstimates).toBe(true);
    expect(result.value.crossReference.scopeConsistency).toBe(true);
  });

  it('returns error for malformed JSON', () => {
    writeFileSync(join(tempDir, 'spec.semantic.json'), '{ not valid json }');

    const result = loadSemanticConfig(tempDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Failed to parse spec.semantic.json');
  });

  it('returns error for invalid shape', () => {
    writeFileSync(
      join(tempDir, 'spec.semantic.json'),
      JSON.stringify({ terminology: { glossary: { tenant: 'not-an-array' } } }),
    );

    const result = loadSemanticConfig(tempDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('terminology.glossary.tenant');
    expect(result.error).toContain('array of strings');
  });

  it('returns error when staleness.flagUndatedEstimates is not boolean', () => {
    writeFileSync(
      join(tempDir, 'spec.semantic.json'),
      JSON.stringify({ staleness: { flagUndatedEstimates: 'yes' } }),
    );

    const result = loadSemanticConfig(tempDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('flagUndatedEstimates');
    expect(result.error).toContain('boolean');
  });
});

describe('defaultSemanticConfig', () => {
  it('returns a complete config with all fields', () => {
    const config = defaultSemanticConfig();
    expect(config.terminology.glossary).toEqual({});
    expect(config.staleness.flagUndatedEstimates).toBe(true);
    expect(config.completeness.requiredSections).toEqual({});
    expect(config.crossReference.scopeConsistency).toBe(true);
    expect(config.crossReference.stateConsistency).toBe(true);
    expect(config.crossReference.errorCodeUniqueness).toBe(true);
    expect(config.ignore).toEqual([]);
  });
});
